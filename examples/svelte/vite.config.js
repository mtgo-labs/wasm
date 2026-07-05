import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],

  // Treat .wasm in static/ as a static asset, not a bundled module.
  assetsInclude: ['**/*.wasm'],
});
