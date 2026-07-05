// Disable SSR globally — WASM has no server context.
export const ssr = false;

// Don't prerender individual pages; the adapter uses a SPA fallback.
export const prerender = false;
