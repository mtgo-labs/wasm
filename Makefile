GO ?= go
GOROOT := $(shell $(GO) env GOROOT)
WASM_EXEC_SRC := $(GOROOT)/lib/wasm/wasm_exec.js

.PHONY: build gzip copy-exec example serve svelte-dev svelte-build clean

## build: compile the WASM binary (mtgo-wasm.wasm)
build: mtgo-wasm.wasm

mtgo-wasm.wasm: main.go wasm/*.go go.mod go.sum
	# -trimpath: strip local file paths from the binary
	# -ldflags "-s -w": strip symbol table (-s) and DWARF (-w) — pure overhead for a wasm serving JS
	GOOS=js GOARCH=wasm $(GO) build -trimpath -ldflags "-s -w" -o $@ .

## gzip: produce a gzip-compressed copy (mtgo-wasm.wasm.gz) for size-capped hosts
##       such as Cloudflare Pages (25 MiB per-file limit). The JS loader
##       decompresses it in the browser via DecompressionStream.
gzip: mtgo-wasm.wasm.gz

mtgo-wasm.wasm.gz: mtgo-wasm.wasm
	gzip -9fn -c mtgo-wasm.wasm > $@

## copy-exec: copy Go's wasm_exec.js bootstrap into lib/
copy-exec: lib/wasm_exec.js

lib/wasm_exec.js: $(WASM_EXEC_SRC)
	cp $< $@

## example: build + copy-exec, then point at the local demo server
example: build copy-exec
	@echo "Run:  cd examples/browser && python3 -m http.server 8080"
	@echo "Open: http://localhost:8080/"


## svelte-dev: install deps and run the SvelteKit example dev server
svelte-dev: build copy-exec gzip
	@echo "Starting SvelteKit dev server at http://localhost:5173/  (Ctrl+C to stop)"
	cd examples/svelte && npm install && npm run dev

## svelte-build: build the SvelteKit example for production (outputs examples/svelte/build/)
svelte-build: build copy-exec gzip
	cd examples/svelte && npm install && npm run build

## serve: build everything and start a local HTTP server for the demo
serve: build copy-exec
	@echo "Serving at http://localhost:8080/examples/browser/  (Ctrl+C to stop)"
	python3 -m http.server 8080

## clean: remove build artefacts
clean:
	rm -f mtgo-wasm.wasm mtgo-wasm.wasm.gz lib/wasm_exec.js
