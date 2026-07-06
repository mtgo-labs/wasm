//go:build js && wasm

// Command mtgo-wasm builds the mtgo Telegram client as a WebAssembly module
// for use in browsers (and browser-like JS runtimes).
//
// Build:
//
//	GOOS=js GOARCH=wasm go build -o mtgo-wasm.wasm .
//
// The binary exposes a global MTGoWasm object with a createClient method.
// See lib/mtgo-wasm.js for the JS loader and examples/browser/ for usage.
package main

import (
	"github.com/mtgo-labs/wasm/wasm"
)

func main() {
	wasm.Register()
	// Block forever — the wasm instance stays alive to serve JS calls.
	select {}
}
