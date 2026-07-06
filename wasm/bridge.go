//go:build js && wasm

package wasm

import (
	"context"
	"fmt"
	"sync/atomic"
	"syscall/js"
	"time"

	"github.com/mtgo-labs/mtgo/telegram"
)

var nextClientID atomic.Int64

// Register installs the global MTGoWasm API on the JavaScript global object.
// Call this from main(); the Go program then blocks forever (the wasm instance
// stays alive to serve JS calls).
func Register() {
	api := map[string]any{
		"createClient": js.FuncOf(jsCreateClient),
	}
	js.Global().Set("MTGoWasm", js.ValueOf(api))
}

// jsCreateClient implements MTGoWasm.createClient(opts) -> client handle.
//
// opts:
//
//	{
//	  apiID: 12345,
//	  apiHash: "...",
//	  botToken: "123:ABC",            // optional — bot login
//	  sessionString: "...",           // optional — restore from string
//	  phoneNumber: "+1555...",        // optional — interactive user login
//	  codeFunc: async (phone) => ..., // optional — OTP provider
//	  passwordFunc: async (hint) => .. // optional — 2FA password provider
//	}
func jsCreateClient(this js.Value, args []js.Value) any {
	if len(args) < 1 || args[0].Type() != js.TypeObject {
		return jsError(fmt.Errorf("createClient: options object required"))
	}
	opts := args[0]

	cfg := telegram.Config{
		WebSocket:    true,
		WebSocketTLS: true,
		InMemory:     true,
		WSDialer:     telegram.NewWSDialer(BrowserWSDialer()),
	}
	cfg.APIID = int32(opts.Get("apiID").Int())
	cfg.APIHash = opts.Get("apiHash").String()

	if v := opts.Get("botToken"); v.Type() == js.TypeString && v.String() != "" {
		cfg.BotToken = v.String()
	}
	if v := opts.Get("sessionString"); v.Type() == js.TypeString && v.String() != "" {
		cfg.SessionString = v.String()
	}
	if v := opts.Get("phoneNumber"); v.Type() == js.TypeString && v.String() != "" {
		cfg.PhoneNumber = v.String()
	}
	if v := opts.Get("codeFunc"); v.Type() == js.TypeFunction {
		cfg.CodeFunc = makeCodeFunc(v)
	}
	if v := opts.Get("passwordFunc"); v.Type() == js.TypeFunction {
		cfg.PasswordFunc = makePasswordFunc(v)
	}

	client, err := telegram.NewClient(cfg.APIID, cfg.APIHash, &cfg)
	if err != nil {
		return jsError(fmt.Errorf("createClient: %w", err))
	}

	id := nextClientID.Add(1)

	// Build the JS client object with method closures over the Go *Client.
	clientObj := map[string]any{
		"id": id,
		"connect": js.FuncOf(func(this js.Value, args []js.Value) any {
			return newPromise(func(resolve, reject js.Value) {
				safeGo(reject, func() {
					if err := client.Connect(60 * time.Second); err != nil {
						reject.Invoke(jsError(err))
						return
					}
					resolve.Invoke(js.Undefined())
				})
			})
		}),
		"invoke": js.FuncOf(func(this js.Value, args []js.Value) any {
			if len(args) < 1 {
				return newPromise(func(_, reject js.Value) {
					reject.Invoke(jsError(fmt.Errorf("invoke: method name required")))
				})
			}
			method := args[0].String()
			var params []byte
			if len(args) > 1 && args[1].Type() == js.TypeObject {
				params = jsValueToJSON(args[1])
			} else {
				params = []byte("{}")
			}
			return newPromise(func(resolve, reject js.Value) {
				safeGo(reject, func() {
					ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
					defer cancel()
					result, err := client.InvokeJSON(ctx, method, params, true)
					if err != nil {
						reject.Invoke(jsError(err))
						return
					}
					resolve.Invoke(jsonToJSValue(result))
				})
			})
		}),
		"disconnect": js.FuncOf(func(this js.Value, args []js.Value) any {
			return newPromise(func(resolve, reject js.Value) {
				safeGo(reject, func() {
					_ = client.Disconnect()
					resolve.Invoke(js.Undefined())
				})
			})
		}),
		"me": js.FuncOf(func(this js.Value, args []js.Value) any {
			me := client.Me()
			if me == nil {
				return nil
			}
			return js.ValueOf(map[string]any{
				"id":         me.ID,
				"username":   me.Username,
				"first_name": me.FirstName,
				"last_name":  me.LastName,
				"is_bot":     me.IsBot,
			})
		}),
		"getMe": js.FuncOf(func(this js.Value, args []js.Value) any {
			return newPromise(func(resolve, reject js.Value) {
				safeGo(reject, func() {
					ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
					defer cancel()
					result, err := client.InvokeJSON(ctx, "users.getUsers",
						[]byte(`{"id":[{"_":"inputUserSelf"}]}`), true)
					if err != nil {
						reject.Invoke(jsError(err))
						return
					}
					resolve.Invoke(jsonToJSValue(result))
				})
			})
		}),
	}
	// Wrap the client in a Proxy: known methods (connect, invoke, me,
	// disconnect, id) pass through; any other string property is treated
	// as a TL namespace (e.g. tg.account.updateProfile(...) → invoke).
	return wrapClientProxy(js.ValueOf(clientObj), client)
}

// --- Promise helpers ---

func newPromise(fn func(resolve, reject js.Value)) js.Value {
	handler := js.FuncOf(func(this js.Value, args []js.Value) any {
		fn(args[0], args[1])
		return nil
	})
	return js.Global().Get("Promise").New(handler)
}

// safeGo runs fn in a goroutine with panic recovery. If fn panics, the
// recovered value is sent to reject as a JS error instead of crashing the
// entire WASM runtime (which would make all subsequent calls fail with
// "Go program has already exited").
func safeGo(reject js.Value, fn func()) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				reject.Invoke(jsError(fmt.Errorf("panic: %v", r)))
			}
		}()
		fn()
	}()
}

func jsError(err error) js.Value {
	return js.Global().Get("Error").New(err.Error())
}

func jsValueToJSON(v js.Value) []byte {
	s := js.Global().Get("JSON").Call("stringify", v).String()
	return []byte(s)
}

func jsonToJSValue(b []byte) js.Value {
	return js.Global().Get("JSON").Call("parse", string(b))
}

// --- Auth callback bridges ---

// makeCodeFunc wraps a JS function as a telegram.CodeFunc.
// The JS function may return a string or a Promise<string>.
func makeCodeFunc(jsFn js.Value) telegram.CodeFunc {
	return func(ctx context.Context, phone string) (string, error) {
		return awaitString(jsFn.Invoke(phone))
	}
}

// makePasswordFunc wraps a JS function as a telegram.PasswordFunc.
func makePasswordFunc(jsFn js.Value) telegram.PasswordFunc {
	return func(ctx context.Context, hint string) (string, error) {
		return awaitString(jsFn.Invoke(hint))
	}
}

// awaitString resolves a JS value that is either a string or a thenable
// (Promise) yielding a string. It blocks the calling goroutine until the
// promise settles; in GOOS=js this is safe — the JS event loop keeps running.
func awaitString(v js.Value) (string, error) {
	if v.Type() != js.TypeObject || v.Get("then").Type() != js.TypeFunction {
		return v.String(), nil
	}

	resultCh := make(chan string, 1)
	errCh := make(chan error, 1)

	v.Call("then",
		js.FuncOf(func(this js.Value, args []js.Value) any {
			resultCh <- args[0].String()
			return nil
		}),
		js.FuncOf(func(this js.Value, args []js.Value) any {
			errCh <- fmt.Errorf("%s", args[0].String())
			return nil
		}),
	)

	select {
	case s := <-resultCh:
		return s, nil
	case err := <-errCh:
		return "", err
	}
}

// wrapClientProxy wraps the client JS object in a Proxy so that:
//
//   - Known properties (connect, invoke, me, disconnect, id) pass through.
//   - Any other string property is treated as a TL namespace, returning a
//     nested proxy: client.account.updateProfile(...) → invoke("account.updateProfile", ...).
//   - Symbols and well-known JS properties (then, toJSON, etc.) are ignored
//     to prevent thenable detection and proxy trap interference.
//
// This lets users write:
//
//	const tg = mtgo.createClient({ ... });
//	await tg.connect();
//	await tg.account.updateProfile({ first_name: "John" });
//	await tg.messages.sendMessage({ peer: { _: "inputPeerSelf" }, message: "hi" });
func wrapClientProxy(base js.Value, client *telegram.Client) js.Value {
	proxyCtor := js.Global().Get("Proxy")
	empty := js.ValueOf(map[string]any{})

	// invokeMethod runs InvokeJSON and returns a Promise.
	invokeMethod := func(method string, params js.Value) js.Value {
		var jsonParams []byte
		if params.Type() == js.TypeObject {
			jsonParams = jsValueToJSON(params)
		} else {
			jsonParams = []byte("{}")
		}
		return newPromise(func(resolve, reject js.Value) {
			safeGo(reject, func() {
				ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
				defer cancel()
				result, err := client.InvokeJSON(ctx, method, jsonParams, true)
				if err != nil {
					reject.Invoke(jsError(err))
					return
				}
				resolve.Invoke(jsonToJSValue(result))
			})
		})
	}

	// makeNSProxy creates a namespace proxy: ns.method(params) → invoke("ns.method", params).
	makeNSProxy := func(ns string) js.Value {
		handler := map[string]any{
			"get": js.FuncOf(func(this js.Value, args []js.Value) any {
				mprop := args[1]
				if mprop.Type() != js.TypeString {
					return js.Undefined()
				}
				method := mprop.String()
				if method == "then" || method == "catch" ||
					method == "finally" || method == "toJSON" ||
					method == "toString" {
					return js.Undefined()
				}
				fullMethod := ns + "." + method
				return js.FuncOf(func(this js.Value, args []js.Value) any {
					var params js.Value
					if len(args) > 0 {
						params = args[0]
					}
					return invokeMethod(fullMethod, params)
				})
			}),
		}
		return proxyCtor.New(empty, js.ValueOf(handler))
	}

	// Top-level handler: known props → base object; unknown → namespace proxy.
	topHandler := map[string]any{
		"get": js.FuncOf(func(this js.Value, args []js.Value) any {
			target := args[0]
			prop := args[1]

			// Ignore non-string properties (symbols, etc.)
			if prop.Type() != js.TypeString {
				return js.Undefined()
			}
			name := prop.String()

			// Prevent thenable detection.
			if name == "then" || name == "catch" || name == "finally" {
				return js.Undefined()
			}

			// Known client properties → return from base object.
			val := target.Get(name)
			if val.Type() != js.TypeUndefined {
				return val
			}

			// Unknown string property → treat as TL namespace.
			return makeNSProxy(name)
		}),
	}

	return proxyCtor.New(base, js.ValueOf(topHandler))
}
