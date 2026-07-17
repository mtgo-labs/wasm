//go:build js && wasm

package wasm

import (
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"syscall/js"
	"time"

	"github.com/mtgo-labs/mtgo/telegram"
	"github.com/mtgo-labs/mtgo/tg"
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
//	  timeout: 60,                    // optional — RPC timeout in seconds (default 60)
//	}
func jsCreateClient(this js.Value, args []js.Value) any {
	if len(args) < 1 || args[0].Type() != js.TypeObject {
		return jsError(fmt.Errorf("createClient: options object required"))
	}
	opts := args[0]

	timeout := 60 * time.Second
	if v := opts.Get("timeout"); v.Type() == js.TypeNumber && v.Int() > 0 {
		timeout = time.Duration(v.Int()) * time.Second
	}

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

	hasAuth := (cfg.BotToken != "") || (cfg.SessionString != "") || (cfg.PhoneNumber != "")
	if !hasAuth {
		return jsError(fmt.Errorf("createClient: one of botToken, sessionString, or phoneNumber is required"))
	}

	client, err := telegram.NewClient(cfg.APIID, cfg.APIHash, &cfg)
	if err != nil {
		return jsError(fmt.Errorf("createClient: %w", err))
	}

	id := nextClientID.Add(1)

	// Build the JS client object with method closures over the Go *Client.

	// helper: create a JS function that calls InvokeJSON with the given TL method.
	// If defaultParams is non-empty, it's used when the caller passes no args.
	jsRPC := func(method, defaultParams string) func(this js.Value, args []js.Value) any {
		return func(this js.Value, args []js.Value) any {
			var jsonParams []byte
			if len(args) > 0 && args[0].Type() == js.TypeObject {
				jsonParams = jsValueToJSON(args[0])
			} else if defaultParams != "" {
				jsonParams = []byte(defaultParams)
			} else {
				jsonParams = []byte("{}")
			}
			return newPromise(func(resolve, reject js.Value) {
				safeGo(reject, func() {
					ctx, cancel := context.WithTimeout(context.Background(), timeout)
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
	}


	// jsBoolRPC is like jsRPC but returns a bare JS boolean (true) on success
	// instead of the JSON-encoded result. The generated Go methods for these
	// TL calls discard the BoolTrue/BoolFalse result (_ = result; return nil),
	// so InvokeJSON always succeeds — we just return true. Used for methods
	// where only success/failure matters (not the Bool value itself).
	jsBoolRPC := func(method string) func(this js.Value, args []js.Value) any {
		return func(this js.Value, args []js.Value) any {
			var jsonParams []byte
			if len(args) > 0 && args[0].Type() == js.TypeObject {
				jsonParams = jsValueToJSON(args[0])
			} else {
				jsonParams = []byte("{}")
			}
			return newPromise(func(resolve, reject js.Value) {
				safeGo(reject, func() {
					ctx, cancel := context.WithTimeout(context.Background(), timeout)
					defer cancel()
					if _, err := client.InvokeJSON(ctx, method, jsonParams, true); err != nil {
						reject.Invoke(jsError(err))
						return
					}
					resolve.Invoke(js.ValueOf(true))
				})
			})
		}
	}

	// jsCheckUsername calls account.checkUsername via typed RPC and returns
	// the actual boolean: BoolTrue = username available, BoolFalse = taken.
	// Unlike the other Bool methods, the real value matters here.
	jsCheckUsername := func(this js.Value, args []js.Value) any {
		req := &tg.AccountCheckUsernameRequest{}
		if len(args) > 0 && args[0].Type() == js.TypeObject {
			if err := json.Unmarshal(jsValueToJSON(args[0]), req); err != nil {
				return newPromise(func(_, reject js.Value) {
					reject.Invoke(jsError(fmt.Errorf("checkUsername: %w", err)))
				})
			}
		}
		return newPromise(func(resolve, reject js.Value) {
			safeGo(reject, func() {
				ctx, cancel := context.WithTimeout(context.Background(), timeout)
				defer cancel()
				result, err := client.Raw().Invoke(ctx, req, func(r *tg.Reader) (tg.TLObject, error) {
					return tg.ReadTLObject(r)
				})
				if err != nil {
					reject.Invoke(jsError(err))
					return
				}
				switch result.(type) {
				case *tg.BoolTrue:
					resolve.Invoke(js.ValueOf(true))
				case *tg.BoolFalse:
					resolve.Invoke(js.ValueOf(false))
				default:
					reject.Invoke(jsError(fmt.Errorf("checkUsername: unexpected result type %T", result)))
				}
			})
		})
	}

	clientObj := map[string]any{
		"id": id,
		"connect": js.FuncOf(func(this js.Value, args []js.Value) any {
			return newPromise(func(resolve, reject js.Value) {
				safeGo(reject, func() {
					if err := client.Connect(timeout); err != nil {
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
					ctx, cancel := context.WithTimeout(context.Background(), timeout)
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

		// -- Auth --
		"getMe":  js.FuncOf(jsRPC("users.getUsers", `{"id":[{"_":"inputUserSelf"}]}`)),
		"logOut": js.FuncOf(jsRPC("auth.logOut", "")),

		// -- Profile --
		"setUsername":    js.FuncOf(jsRPC("account.updateUsername", "")),
		"setBio":         js.FuncOf(jsRPC("account.updateProfile", "")),
		"updateProfile":  js.FuncOf(jsRPC("account.updateProfile", "")),
		"checkUsername":  js.FuncOf(jsCheckUsername),

		// -- Peer resolution --
		"resolveUsername": js.FuncOf(jsRPC("contacts.resolveUsername", "")),
		"resolvePhone":    js.FuncOf(jsRPC("contacts.resolvePhone", "")),

		// -- Messages --
		"sendMessage": js.FuncOf(func(this js.Value, args []js.Value) any {
			if len(args) < 1 || args[0].Type() != js.TypeObject {
				return newPromise(func(_, reject js.Value) {
					reject.Invoke(jsError(fmt.Errorf("sendMessage: params object required")))
				})
			}
			params := args[0]
			paramsCopy := js.Global().Get("Object").Call("assign", js.Global().Get("Object").New(), params)
			if params.Get("random_id").Type() == js.TypeUndefined {
				paramsCopy.Set("random_id", js.ValueOf(client.RandomID()))
			}
			jsonParams := jsValueToJSON(paramsCopy)
			return newPromise(func(resolve, reject js.Value) {
				safeGo(reject, func() {
					ctx, cancel := context.WithTimeout(context.Background(), timeout)
					defer cancel()
					result, err := client.InvokeJSON(ctx, "messages.sendMessage", jsonParams, true)
					if err != nil {
						reject.Invoke(jsError(err))
						return
					}
					resolve.Invoke(jsonToJSValue(result))
				})
			})
		}),
		"editMessage":      js.FuncOf(jsRPC("messages.editMessage", "")),
		"deleteMessages":   js.FuncOf(jsRPC("messages.deleteMessages", "")),
		"forwardMessages":  js.FuncOf(jsRPC("messages.forwardMessages", "")),
		"getHistory":       js.FuncOf(jsRPC("messages.getHistory", "")),
		"getDialogs":       js.FuncOf(jsRPC("messages.getDialogs", "")),
		"searchMessages":   js.FuncOf(jsRPC("messages.search", "")),
		"sendReaction":     js.FuncOf(jsRPC("messages.sendReaction", "")),
		"readHistory":      js.FuncOf(jsRPC("messages.readHistory", "")),
		"pinMessage":       js.FuncOf(jsRPC("messages.updatePinnedMessage", "")),
		"unpinMessage": js.FuncOf(func(this js.Value, args []js.Value) any {
			var params js.Value
			if len(args) > 0 && args[0].Type() == js.TypeObject {
				params = args[0]
			} else {
				params = js.Global().Get("Object").New()
			}
			paramsCopy := js.Global().Get("Object").Call("assign", js.Global().Get("Object").New(), params)
			paramsCopy.Set("unpin", js.ValueOf(true))
			jsonParams := jsValueToJSON(paramsCopy)
			return newPromise(func(resolve, reject js.Value) {
				safeGo(reject, func() {
					ctx, cancel := context.WithTimeout(context.Background(), timeout)
					defer cancel()
					result, err := client.InvokeJSON(ctx, "messages.updatePinnedMessage", jsonParams, true)
					if err != nil {
						reject.Invoke(jsError(err))
						return
					}
					resolve.Invoke(jsonToJSValue(result))
				})
			})
		}),

		// -- Chats & channels --
		"getChat":          js.FuncOf(jsRPC("messages.getChats", "")),
		"getFullChat":      js.FuncOf(jsRPC("channels.getFullChannel", "")),
		"joinChat":         js.FuncOf(jsRPC("channels.joinChannel", "")),
		"leaveChat":        js.FuncOf(jsRPC("channels.leaveChannel", "")),
		"createChannel":    js.FuncOf(jsRPC("channels.createChannel", "")),
		"createGroup":      js.FuncOf(jsRPC("messages.createChat", "")),
		"getChatMembers":   js.FuncOf(jsRPC("channels.getParticipants", "")),
		"inviteToChat":     js.FuncOf(jsRPC("channels.inviteToChannel", "")),

		// -- Users --
		"getUsers":         js.FuncOf(jsRPC("users.getUsers", "")),
		"getFullUser":      js.FuncOf(jsRPC("users.getFullUser", "")),

		// -- Bots --
		"answerCallbackQuery": js.FuncOf(jsBoolRPC("messages.setBotCallbackAnswer")),
		"answerInlineQuery":   js.FuncOf(jsBoolRPC("messages.setInlineBotResults")),
		"getMyCommands":       js.FuncOf(jsRPC("bots.getBotCommands", "")),
		"setMyCommands":       js.FuncOf(jsBoolRPC("bots.setBotCommands")),
	}
	// Wrap the client in a Proxy: known methods (connect, invoke, me,
	// disconnect, id) pass through; any other string property is treated
	// as a TL namespace (e.g. tg.account.updateProfile(...) → invoke).
	return wrapClientProxy(js.ValueOf(clientObj), client, timeout)
}

// --- Promise helpers ---

func newPromise(fn func(resolve, reject js.Value)) js.Value {
	handler := js.FuncOf(func(this js.Value, args []js.Value) any {
		fn(args[0], args[1])
		return nil
	})
	p := js.Global().Get("Promise").New(handler)
	handler.Release()
	return p
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
		return awaitString(ctx, jsFn.Invoke(phone))
	}
}

// makePasswordFunc wraps a JS function as a telegram.PasswordFunc.
func makePasswordFunc(jsFn js.Value) telegram.PasswordFunc {
	return func(ctx context.Context, hint string) (string, error) {
		return awaitString(ctx, jsFn.Invoke(hint))
	}
}

// awaitString resolves a JS value that is either a string or a thenable
// (Promise) yielding a string. It blocks the calling goroutine until the
// promise settles; in GOOS=js this is safe — the JS event loop keeps running.
func awaitString(ctx context.Context, v js.Value) (string, error) {
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
	case <-ctx.Done():
		return "", ctx.Err()
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
func wrapClientProxy(base js.Value, client *telegram.Client, timeout time.Duration) js.Value {
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
				ctx, cancel := context.WithTimeout(context.Background(), timeout)
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

	// nsCache caches namespace proxies so repeated property access (e.g.
	// tg.messages.sendMessage) reuses the same Proxy instead of creating a
	// new one with a fresh js.FuncOf handler on every access.
	nsCache := make(map[string]js.Value)

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
				var methodFn js.Func
				methodFn = js.FuncOf(func(this js.Value, args []js.Value) any {
					defer methodFn.Release()
					var params js.Value
					if len(args) > 0 {
						params = args[0]
					}
					return invokeMethod(fullMethod, params)
				})
				return methodFn
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
			if cached, ok := nsCache[name]; ok {
				return cached
			}
			proxy := makeNSProxy(name)
			nsCache[name] = proxy
			return proxy
		}),
	}

	return proxyCtor.New(base, js.ValueOf(topHandler))
}
