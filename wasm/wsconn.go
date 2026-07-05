package wasm

import (
	"context"
	"fmt"
	"io"
	"net"
	"sync"
	"syscall/js"
	"time"
)

// wsAddr is a dummy net.Addr for WebSocket connections.
type wsAddr struct {
	url string
}

func (a wsAddr) Network() string { return "websocket" }
func (a wsAddr) String() string  { return a.url }

// wsConn adapts a browser WebSocket (via syscall/js) to net.Conn.
//
// Browser WebSockets are message-oriented and deliver data via JS event
// callbacks; net.Conn is a byte stream consumed by blocking Read calls. We
// bridge the two with a mutex-guarded message queue + a non-blocking notify
// channel: JS callbacks append whole messages and signal (never blocking the
// JS event loop), while Read goroutines drain the queue and park on notify.
type wsConn struct {
	ws  js.Value
	url string

	mu      sync.Mutex
	pending []byte   // partial message left from a previous Read
	queue   [][]byte // whole messages not yet consumed
	notify  chan struct{}
	closed  bool

	closeOnce sync.Once
	closeCh   chan struct{}

	readDeadline time.Time
}

// dialBrowserWS opens a browser WebSocket to the given URL and returns it as
// a net.Conn. Blocks until the connection opens or times out (30s).
func dialBrowserWS(url string) (*wsConn, error) {
	ws := js.Global().Get("WebSocket").New(url, "binary")
	c := &wsConn{
		ws:      ws,
		url:     url,
		notify:  make(chan struct{}, 1),
		closeCh: make(chan struct{}),
	}

	// ArrayBuffer mode for binary MTProto frames.
	ws.Set("binaryType", js.ValueOf("arraybuffer"))

	openCh := make(chan struct{})
	var openErr error
	var wsErrored bool
	opened := false

	fireOpen := func() {
		if !opened {
			opened = true
			close(openCh)
		}
	}

	ws.Call("addEventListener", "open", js.FuncOf(func(this js.Value, args []js.Value) any {
		// Verify the "binary" subprotocol was negotiated. Telegram's WebSocket
		// server rejects connections that don't request it (→ code 1006).
		protocol := ws.Get("protocol").String()
		if protocol != "binary" {
			fmt.Printf("[mtgo-wasm] WARNING: WebSocket opened without 'binary' subprotocol (got %q). Connection will likely fail.\n", protocol)
		}
		fireOpen()
		return nil
	}))

	ws.Call("addEventListener", "message", js.FuncOf(func(this js.Value, args []js.Value) any {
		// args[0] is a MessageEvent; .data is an ArrayBuffer.
		data := args[0].Get("data")
		u8 := js.Global().Get("Uint8Array").New(data)
		n := u8.Get("byteLength").Int()
		buf := make([]byte, n)
		js.CopyBytesToGo(buf, u8)

		c.mu.Lock()
		if !c.closed {
			c.queue = append(c.queue, buf)
		}
		c.mu.Unlock()

		// Non-blocking signal — Read re-checks the queue before parking.
		select {
		case c.notify <- struct{}{}:
		default:
		}
		return nil
	}))

	ws.Call("addEventListener", "error", js.FuncOf(func(this js.Value, args []js.Value) any {
		wsErrored = true
		// Safety net: the close event should follow within a tick and carry
		// the diagnostic code/reason. If it doesn't, finalise so the dialer
		// doesn't hang for 30s.
		time.AfterFunc(100*time.Millisecond, func() {
			c.closeOnce.Do(func() {
				openErr = fmt.Errorf("websocket error (url=%s)", url)
				c.mu.Lock()
				c.closed = true
				c.mu.Unlock()
				close(c.closeCh)
				fireOpen()
			})
		})
		return nil
	}))

	ws.Call("addEventListener", "close", js.FuncOf(func(this js.Value, args []js.Value) any {
		code, reason := 0, ""
		if len(args) > 0 {
			ev := args[0]
			code = ev.Get("code").Int()
			reason = ev.Get("reason").String()
		}
		c.closeOnce.Do(func() {
			if wsErrored || code != 1000 {
				openErr = fmt.Errorf("websocket closed (code=%d reason=%q url=%s)", code, reason, url)
			}
			c.mu.Lock()
			c.closed = true
			c.mu.Unlock()
			close(c.closeCh)
			fireOpen()
		})
		return nil
	}))

	ws.Call("addEventListener", "close", js.FuncOf(func(this js.Value, args []js.Value) any {
		c.closeOnce.Do(func() {
			c.mu.Lock()
			c.closed = true
			c.mu.Unlock()
			close(c.closeCh)
			fireOpen()
		})
		return nil
	}))

	select {
	case <-openCh:
		if openErr != nil {
			return nil, openErr
		}
		return c, nil
	case <-time.After(30 * time.Second):
		ws.Call("close")
		return nil, fmt.Errorf("websocket dial timeout (url=%s)", url)
	}
}

// Read implements io.Reader. It drains the pending partial-message buffer
// first, then whole messages from the queue, copying into p. If no data is
// available it parks until a message arrives, the connection closes, or the
// read deadline elapses.
func (c *wsConn) Read(p []byte) (int, error) {
	for {
		c.mu.Lock()
		if len(c.pending) > 0 {
			n := copy(p, c.pending)
			c.pending = c.pending[n:]
			c.mu.Unlock()
			return n, nil
		}
		if len(c.queue) > 0 {
			c.pending = c.queue[0]
			c.queue = c.queue[1:]
			c.mu.Unlock()
			continue
		}
		if c.closed {
			c.mu.Unlock()
			return 0, io.EOF
		}
		deadline := c.readDeadline
		c.mu.Unlock()

		var timer *time.Timer
		var timeoutCh <-chan time.Time
		if !deadline.IsZero() {
			remaining := time.Until(deadline)
			if remaining <= 0 {
				return 0, &net.OpError{Op: "read", Net: "websocket", Err: fmt.Errorf("i/o timeout")}
			}
			timer = time.NewTimer(remaining)
			defer timer.Stop()
			timeoutCh = timer.C
		}

		select {
		case <-c.notify:
		case <-c.closeCh:
			// Fall through; next loop iteration sees c.closed and returns EOF
			// or drains any final queued messages first.
		case <-timeoutCh:
			return 0, &net.OpError{Op: "read", Net: "websocket", Err: fmt.Errorf("i/o timeout")}
		}
	}
}

// Write sends p as a single WebSocket binary message.
func (c *wsConn) Write(p []byte) (int, error) {
	c.mu.Lock()
	closed := c.closed
	c.mu.Unlock()
	if closed {
		return 0, io.ErrClosedPipe
	}

	arr := js.Global().Get("Uint8Array").New(len(p))
	js.CopyBytesToJS(arr, p)
	c.ws.Call("send", arr)
	return len(p), nil
}

// Close closes the underlying WebSocket and wakes any blocked Read.
func (c *wsConn) Close() error {
	c.closeOnce.Do(func() {
		c.mu.Lock()
		c.closed = true
		c.mu.Unlock()
		c.ws.Call("close")
		close(c.closeCh)
	})
	return nil
}

func (c *wsConn) LocalAddr() net.Addr  { return wsAddr{url: "local"} }
func (c *wsConn) RemoteAddr() net.Addr { return wsAddr{url: c.url} }

func (c *wsConn) SetDeadline(t time.Time) error {
	return c.SetReadDeadline(t)
}

func (c *wsConn) SetReadDeadline(t time.Time) error {
	c.mu.Lock()
	c.readDeadline = t
	c.mu.Unlock()
	// Wake a parked Read so it re-evaluates the deadline.
	select {
	case c.notify <- struct{}{}:
	default:
	}
	return nil
}

func (c *wsConn) SetWriteDeadline(t time.Time) error {
	return nil // writes are synchronous JS calls; no deadline
}

// awaitContext returns a channel closed when ctx is cancelled, or nil if ctx
// has no deadline/cancellation. Used by the dialer to honour context timeouts.
func awaitContext(ctx context.Context) <-chan struct{} {
	if ctx == nil {
		return nil
	}
	done := make(chan struct{})
	go func() {
		<-ctx.Done()
		close(done)
	}()
	return done
}
