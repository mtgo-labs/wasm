module github.com/mtgo-labs/mtgo-wasm

go 1.26.2

require github.com/mtgo-labs/mtgo v0.12.0

require (
	github.com/klauspost/compress v1.19.0 // indirect
	github.com/mtgo-labs/storage v0.5.0 // indirect
	golang.org/x/crypto v0.53.0 // indirect
	golang.org/x/sync v0.21.0 // indirect
	golang.org/x/sys v0.46.0 // indirect
	golang.org/x/term v0.44.0 // indirect
)

// Local development only — remove before committing.
// The WSDialer / NewWSDialer API lands in the next mtgo release; until then
// point at the local checkout so `make build` works.
replace github.com/mtgo-labs/mtgo => ../mtgo
