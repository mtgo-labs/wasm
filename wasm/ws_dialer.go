package wasm

import (
	"context"
	"net"
	"time"

	"github.com/mtgo-labs/mtgo/telegram"
)

// BrowserWSDialer returns a telegram.RawWSDialer that opens a WebSocket via
// the browser's native WebSocket API (syscall/js) and adapts it to net.Conn.
//
// The returned conn is a raw bytestream (the browser performs TLS + the HTTP
// WebSocket upgrade internally). mtgo's telegram.NewWSDialer wraps it with the
// MTProto obfuscated2 framing layer — callers never touch internal/transport.
//
// Use it like:
//
//	cfg := telegram.Config{
//	    WebSocket:   true,
//	    WebSocketTLS: true,
//	    WSDialer:    telegram.NewWSDialer(wasm.BrowserWSDialer()),
//	}
func BrowserWSDialer() telegram.RawWSDialer {
	return func(ctx context.Context, addr string) (net.Conn, error) {
		type result struct {
			conn *wsConn
			err  error
		}
		ch := make(chan result, 1)

		go func() {
			conn, err := dialBrowserWS(addr)
			ch <- result{conn, err}
		}()

		ctxDone := awaitContext(ctx)
		select {
		case r := <-ch:
			return r.conn, r.err
		case <-ctxDone:
			// Context cancelled: the goroutine may still complete in the
			// background; if it does, close the conn to avoid a leak.
			go func() {
				if r := <-ch; r.conn != nil {
					r.conn.Close()
				}
			}()
			return nil, ctx.Err()
		case <-time.After(30 * time.Second):
			go func() {
				if r := <-ch; r.conn != nil {
					r.conn.Close()
				}
			}()
			return nil, context.DeadlineExceeded
		}
	}
}
