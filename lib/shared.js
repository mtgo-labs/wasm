/**
 * Shared utilities for the mtgo-wasm loaders.
 */

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
export async function readWasmBytes(response, url) {
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
export function decompress(buf, format, url) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(`DecompressionStream is unavailable; cannot decompress ${url}`);
  }
  const stream = new Response(buf).body.pipeThrough(new DecompressionStream(format));
  return new Response(stream).arrayBuffer();
}

/**
 * @param {string} src
 * @returns {Promise<void>}
 */
export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}
