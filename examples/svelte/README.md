# mtgo-wasm × SvelteKit

A complete [SvelteKit](https://kit.svelte.dev/) example for
[mtgo-wasm](../../README.md) — Telegram MTProto running client-side in the
browser via WebAssembly.

## Prerequisites

From the **repo root**, build the WASM binary and copy Go's bootstrap:

```bash
make build        # produces mtgo-wasm.wasm (~30 MB)
make copy-exec    # copies Go's wasm_exec.js into lib/
```

## Quick start

```bash
cd examples/svelte
npm install       # also links WASM assets via postinstall
npm run dev       # http://localhost:5173
```

Open the dev server, enter your API credentials + bot token (or session
string), click **Connect**, and invoke any TL method.

## How it works

```
examples/svelte/
├── package.json              # SvelteKit + adapter-static (SPA mode)
├── svelte.config.js          # SSR disabled — WASM is client-side only
├── vite.config.js            # COOP/COEP headers for SharedArrayBuffer
├── scripts/
│   └── link-assets.mjs       # postinstall: symlinks WASM into static/
├── src/
│   ├── app.html              # loads wasm_exec.js in <head>
│   ├── app.css               # dark-theme global styles
│   ├── lib/
│   │   ├── mtgo-wasm-vite.js  # Vite-compatible WASM loader
│   │   └── MTGoClient.svelte  # ready-made component ($state runes, Svelte 5)
│   └── routes/
│       ├── +layout.js        # `export const ssr = false;`
│       ├── +layout.svelte
│       └── +page.svelte      # renders <MTGoClient />
└── static/                   # symlinks to repo-root assets (auto-linked)
    ├── mtgo-wasm.wasm → ../../../mtgo-wasm.wasm
    └── wasm_exec.js   → ../../../lib/wasm_exec.js
```

### Key design decisions

- **SPA mode** (`adapter-static` + `ssr = false`): WASM has no server context.
  Every page falls back to `index.html`.
- **`wasm_exec.js` in `app.html`**: Loaded as a classic `<script>` in
  `<head>`, making the global `Go` class available before the app boots.
- **Symlinked assets**: The `postinstall` script creates symlinks from
  `static/` to the repo-root build artifacts. No manual copying.
- **Svelte 5 runes**: `MTGoClient.svelte` uses `$state` for reactive UI
  state and `onclick` event handlers.

## Using the component in your own app

Copy `src/lib/MTGoClient.svelte` and `src/lib/mtgo-wasm-vite.js` into your
project's `$lib/`, add `wasm_exec.js` + `.wasm` to your `static/` directory,
load `wasm_exec.js` in your `app.html`, and:

```svelte
<script>
  import MTGoClient from '$lib/MTGoClient.svelte';
</script>

<MTGoClient />
```

## Production build

```bash
npm run build      # outputs to build/
npm run preview    # preview the production build
```

The `build/` directory is a fully static site you can deploy anywhere.
