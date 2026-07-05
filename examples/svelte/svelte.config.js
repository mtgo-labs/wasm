import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    // SPA mode — WASM is client-side only, no SSR.
    adapter: adapter({
      fallback: 'index.html',
      strict: false,
    }),
  },
};

export default config;
