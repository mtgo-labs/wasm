<div align="center">

# @mtgo-labs/wasm

[![Go](https://img.shields.io/badge/Go-1.26+-00ADD8?logo=go)](https://go.dev/)
[![mtgo](https://img.shields.io/badge/mtgo-v0.12.0+-5684AD)](https://github.com/mtgo-labs/mtgo)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![npm](https://img.shields.io/npm/v/@mtgo-labs/wasm)](https://www.npmjs.com/package/@mtgo-labs/wasm)

<p><strong>@mtgo-labs/wasm</strong> brings the <a href="https://github.com/mtgo-labs/mtgo">mtgo</a> Telegram MTProto client to the browser via WebAssembly. It exposes a small JavaScript API for creating a client, connecting over WebSocket, and invoking arbitrary Telegram TL methods — all running client-side in the browser.</p>

</div>

```mermaid
flowchart LR
    JS[Your JS code] -->|invoke method| W[@mtgo-labs/wasm<br/>.wasm]
    W -->|syscall/js| WS[Browser WebSocket]
    WS -->|wss://| TG[Telegram DC]
    TG --> WS --> W --> JS
```

## Install

```bash
npm install @mtgo-labs/wasm
# or
bun add @mtgo-labs/wasm
# or
pnpm add @mtgo-labs/wasm
```

## Quick start (Vite / SvelteKit / Next.js)

```js
import { load } from "@mtgo-labs/wasm";
import wasmUrl from "@mtgo-labs/wasm/mtgo-wasm.wasm?url";
import wasmExecUrl from "@mtgo-labs/wasm/wasm_exec.js?url";

const mtgo = await load({ wasmUrl, wasmExecUrl });

const client = mtgo.createClient({
  apiID: 12345,
  apiHash: "your_api_hash",
  botToken: "123:ABCdefGHI", // or sessionString for a user session
});

await client.connect();
console.log("Logged in as", client.me());

// Invoke any TL method by name (snake_case params):
const result = await client.invoke("users.getUsers", {
  id: [{ _: "inputUserSelf" }],
});
console.log(result);

await client.disconnect();
```

> **SSR safety**: call `load()` inside `onMount` / `useEffect` only — WASM has
> no server context.

## Plain HTML (no bundler)

If you're not using a bundler, use the `browser` subpath export. You can pull
everything from a CDN — no install needed:

```html
<script src="https://unpkg.com/@mtgo-labs/wasm/wasm_exec.js"></script>
<script type="module">
  import { load } from "https://unpkg.com/@mtgo-labs/wasm/browser";

  const mtgo = await load("https://unpkg.com/@mtgo-labs/wasm/mtgo-wasm.wasm");

  const client = mtgo.createClient({
    apiID: 12345,
    apiHash: "your_api_hash",
    botToken: "123:ABCdefGHI",
  });
  await client.connect();
  console.log(client.me());
</script>
```

Or from `node_modules` after `npm install`:

```html
<script src="node_modules/@mtgo-labs/wasm/wasm_exec.js"></script>
<script type="module">
  import { load } from "node_modules/@mtgo-labs/wasm/browser";

  const mtgo = await load("node_modules/@mtgo-labs/wasm/mtgo-wasm.wasm");
  const client = mtgo.createClient({ apiID: 12345, apiHash: "...", botToken: "..." });
  await client.connect();
</script>
```

## SvelteKit integration

### 1. Install

```bash
npm install @mtgo-labs/wasm
```

### 2. Use in a component

```svelte
<!-- src/routes/+page.svelte -->
<script>
  import { onMount } from "svelte";
  import { load } from "@mtgo-labs/wasm";
  import wasmUrl from "@mtgo-labs/wasm/mtgo-wasm.wasm?url";
  import wasmExecUrl from "@mtgo-labs/wasm/wasm_exec.js?url";

  let client = null;

  onMount(async () => {
    // onMount only runs in the browser — SSR-safe.
    const mtgo = await load({ wasmUrl, wasmExecUrl });

    client = mtgo.createClient({
      apiID: 12345,
      apiHash: "your_hash",
      botToken: "123:ABC",
    });
    await client.connect();
    const me = await client.invoke("users.getUsers", { id: [{ _: "inputUserSelf" }] });
    console.log(me);
  });
</script>
```

### Alternative: load `wasm_exec.js` via `app.html`

Instead of the `wasmExecUrl` import, you can load Go's bootstrap script
globally in `app.html`:

```html
<!-- src/app.html — inside <head> -->
<script src="%sveltekit.assets%/wasm_exec.js"></script>
```

Then copy `wasm_exec.js` into `static/` and omit `wasmExecUrl`:

```bash
cp node_modules/@mtgo-labs/wasm/wasm_exec.js static/
```

```js
const mtgo = await load({ wasmUrl }); // wasmExecUrl not needed — Go is already global
```

### Key points

- **SSR safety**: `onMount` / `useEffect` only. Never call `load()` during SSR.
- **`Go` global**: `wasm_exec.js` sets `globalThis.Go`. Load it once, not per-component.
- **`?url` suffix**: Vite resolves `@mtgo-labs/wasm/mtgo-wasm.wasm?url` to a served URL automatically — no need to copy files to `static/`.

## API

### `MTGoWasm.createClient(opts) → client`

| Option           | Type       | Required | Description                                      |
|------------------|------------|----------|--------------------------------------------------|
| `apiID`          | `number`   | yes\*    | Telegram API ID from my.telegram.org             |
| `apiHash`        | `string`   | yes\*    | Telegram API hash                                |
| `botToken`       | `string`   | no       | Bot token — triggers bot auth on connect         |
| `sessionString`  | `string`   | no       | Pre-authenticated session (Telethon/Pyrogram/etc)|
| `phoneNumber`    | `string`   | no       | Phone number for interactive user login          |
| `codeFunc`       | `function` | no       | `async (phone) => code` — OTP provider           |
| `passwordFunc`   | `function` | no       | `async (hint) => password` — 2FA password        |

\* `apiID`/`apiHash` optional only when `sessionString` carries them.

### `client.connect() → Promise<void>`

Establishes the WebSocket transport, performs the DH key exchange, and
authenticates (bot login or session restore). Returns a Promise.

### `client.invoke(method, params) → Promise<object>`

Invokes a Telegram TL method by name. `method` is the TL function name
(e.g. `"messages.sendMessage"`). `params` is a plain JS object using
snake_case keys matching the TL schema. Returns the parsed response.

### `client.me() → object | null`

Returns the authenticated user (`{ id, username, first_name, last_name, is_bot }`),
or `null` if not connected.

### `client.disconnect() → Promise<void>`

Closes the transport and releases the session.

## Package exports

| Subpath                            | Description                              |
|------------------------------------|------------------------------------------|
| `@mtgo-labs/wasm`                  | Vite/bundler loader (default)            |
| `@mtgo-labs/wasm/browser`          | Plain-browser loader (no bundler)        |
| `@mtgo-labs/wasm/wasm_exec.js`     | Go's WASM bootstrap (`globalThis.Go`)    |
| `@mtgo-labs/wasm/mtgo-wasm.wasm`   | The compiled `.wasm` binary              |

## How it works

mtgo is a pure-Go MTProto client. This package adds two things:

1. **A browser WebSocket transport** — `wasm/wsconn.go` wraps the browser's
   native `WebSocket` API as a Go `net.Conn`. mtgo's obfuscated2 framing layer
   sits on top, exactly as it does for server-side WebSocket connections.

2. **A JS bridge** — `wasm/bridge.go` uses `syscall/js` to expose
   `createClient`/`connect`/`invoke`/`disconnect` to JavaScript. RPC calls go
   through mtgo's `InvokeJSON`, so **every TL method** is available without
   per-method glue code.

The mtgo side needs one hook: `Config.WSDialer` (landed in the mtgo release
after v0.12.0) lets this package inject the browser WebSocket as the transport
without reaching into mtgo internals.

## Transport notes

- Traffic flows over **`wss://`** (TLS) to Telegram's WebSocket endpoints
  (`pluto.web.telegram.org/apiws`, etc.). WebSocket connections are not bound
  by fetch CORS rules, so browsers can reach Telegram directly — GramJS and
  Telegram Web do the same.
- All storage is **in-memory** (`InMemory: true`). No filesystem is used.

## Building from source

If you need to rebuild the `.wasm` binary (e.g. after modifying the Go code):

```bash
git clone https://github.com/mtgo-labs/wasm.git
cd wasm
make build       # produces mtgo-wasm.wasm
make copy-exec   # copies Go's wasm_exec.js into lib/
make serve       # starts a demo server at http://localhost:8080/
```

Requires Go 1.22+ (for `math/rand/v2`) and the mtgo version that ships
`Config.WSDialer` + `telegram.NewWSDialer`.

## License

MIT, same as mtgo.
