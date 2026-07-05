/**
 * mtgo-wasm — Vite/SvelteKit-compatible loader.
 *
 * Unlike the plain-browser loader (lib/mtgo-wasm.js), this version is designed
 * for bundler environments (Vite, Rollup, SvelteKit, Next.js). It imports the
 * .wasm as a static URL via Vite's `?url` suffix and loads wasm_exec.js as a
 * module so the bundler can process both.
 *
 * Usage in a Svelte component:
 *
 *   import { load } from "$lib/mtgo-wasm-vite.js";
 *   const mtgo = await load();
 *   const client = mtgo.createClient({ apiID, apiHash, botToken });
 *
 * Requirements:
 *   1. Copy wasm_exec.js to static/ (so it's served at /wasm_exec.js)
 *   2. Copy mtgo-wasm.wasm to static/ (so it's served at /mtgo-wasm.wasm)
 *   3. Add <script src="/wasm_exec.js"></script> to src/app.html <head>
 *      (or call load({ wasmExecUrl: "/wasm_exec.js" }) to lazy-load it)
 */

/**
 * Load and instantiate mtgo-wasm.
 *
 * @param {object} [opts]
 * @param {string} [opts.wasmUrl="/mtgo-wasm.wasm"]    - URL to the .wasm file
 * @param {string} [opts.wasmExecUrl="/wasm_exec.js"]   - URL to Go's wasm_exec.js (skip if already loaded)
 * @returns {Promise<object>} The MtgoWasm API
 */
export async function load(opts = {}) {
  const {
    wasmUrl = "/mtgo-wasm.wasm",
    wasmExecUrl = null, // null = assume already loaded via <script> in app.html
  } = opts;

  // Ensure Go bootstrap is available.
  if (typeof Go === "undefined") {
    if (!wasmExecUrl) {
      throw new Error(
        "Go bootstrap not found. Either load wasm_exec.js via <script> in app.html, " +
        "or pass { wasmExecUrl: '/wasm_exec.js' }."
      );
    }
    await loadScript(wasmExecUrl);
  }

  const go = new Go();
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${wasmUrl}: ${response.status}`);
  }
  const bytes = await response.arrayBuffer();
  const result = await WebAssembly.instantiate(bytes, go.importObject);
  const runPromise = go.run(result.instance);

  // Detect unexpected Go program exit. go.run() resolves when main() returns
  // or the runtime crashes (e.g. an unrecovered panic). Surface this so users
  // aren't left debugging "Go program has already exited" on the next call.
  runPromise.then(() => {
    console.error(
      "[mtgo-wasm] Go program exited unexpectedly. " +
      "All subsequent calls will fail. Reload the page to restart."
    );
  });

  if (!globalThis.MtgoWasm) {
    throw new Error(
      "WASM instance started but MtgoWasm API was not registered. " +
      "This may indicate a panic during initialization."
    );
  }
  return globalThis.MtgoWasm;
}

/**
 * @param {string} src
 * @returns {Promise<void>}
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}
