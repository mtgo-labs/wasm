/**
 * mtgo-wasm — JavaScript loader and API wrapper.
 *
 * Usage (ESM):
 *
 *   import { load } from "./lib/mtgo-wasm.js";
 *   const mtgo = await load("./mtgo-wasm.wasm", "./lib/wasm_exec.js");
 *   const client = mtgo.createClient({ apiID: 12345, apiHash: "...", botToken: "..." });
 *   await client.connect();
 *   const me = await client.invoke("users.getUsers", { id: [{ _: "inputUserSelf" }] });
 *   await client.disconnect();
 *
 * Usage (script tag — exposes global MTGoWasmLoader):
 *
 *   <script src="lib/wasm_exec.js"></script>
 *   <script src="lib/mtgo-wasm.js"></script>
 *   <script>
 *     const mtgo = await MTGoWasmLoader.load("mtgo-wasm.wasm");
 *   </script>
 */

/**
 * Load and instantiate the mtgo-wasm module.
 *
 * @param {string} wasmPath  - URL/path to mtgo-wasm.wasm
 * @param {string} [execPath] - URL/path to wasm_exec.js (skip if already loaded via <script>)
 * @returns {Promise<object>} The MTGoWasm API (createClient, etc.)
 */
export async function load(wasmPath, execPath) {
  // Ensure the Go wasm_exec.js bootstrap is present (provides the global `Go`).
  if (typeof Go === "undefined") {
    if (!execPath) {
      throw new Error(
        "wasm_exec.js not found. Either load it via <script> or pass execPath."
      );
    }
    await loadScript(execPath);
  }

  const go = new Go();

  const response = await fetch(wasmPath);
  const bytes = await readWasmBytes(response, wasmPath);
  const result = await WebAssembly.instantiate(bytes, go.importObject);
  go.run(result.instance);

  // The Go side sets globalThis.MTGoWasm in Register().
  return globalThis.MTGoWasm;
}

/**
 * Read wasm bytes from a fetch Response, transparently decompressing a
 * pre-compressed artifact (gzip or brotli). Lets the wasm ship compressed on
 * size-capped hosts (e.g. Cloudflare Pages' 25 MiB per-file limit). Gzip is
 * detected by magic bytes (0x1f 0x8b); brotli by a `.br` URL suffix.
 *
 * @param {Response} response
 * @param {string} url
 * @returns {Promise<ArrayBuffer>}
 */
async function readWasmBytes(response, url) {
  const buf = await response.arrayBuffer();
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (head[0] === 0x1f && head[1] === 0x8b) {
    return decompress(buf, "gzip", url);
  }
  const path = url.split("#")[0].split("?")[0].toLowerCase();
  if (path.endsWith(".br")) {
    return decompress(buf, "brotli", url);
  }
  return buf;
}

/**
 * @param {ArrayBuffer} buf
 * @param {"gzip"|"brotli"} format
 * @param {string} url
 * @returns {Promise<ArrayBuffer>}
 */
function decompress(buf, format, url) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(`DecompressionStream is unavailable; cannot decompress ${url}`);
  }
  const stream = new Response(buf).body.pipeThrough(new DecompressionStream(format));
  return new Response(stream).arrayBuffer();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

// UMD-ish: expose as global for non-module usage.
if (typeof globalThis !== "undefined") {
  globalThis.MTGoWasmLoader = { load };
}
