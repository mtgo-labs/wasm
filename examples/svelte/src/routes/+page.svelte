<script>
  import MTGoClient from '$lib/MTGoClient.svelte';
</script>

<svelte:head>
  <title>mtgo-wasm · Telegram MTProto in your browser</title>
  <meta
    name="description"
    content="Telegram MTProto client running in the browser via WebAssembly, powered by mtgo-wasm."
  />
</svelte:head>

<div class="page">
  <header class="hero">
    <div class="hero-badge">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
      WebAssembly
    </div>
    <h1>mtgo<span class="dot">.</span><span class="ext">wasm</span></h1>
    <p>Telegram MTProto client running entirely in your browser.</p>
  </header>

  <div class="card">
    <MTGoClient />
  </div>

  <footer>
    <a href="https://github.com/mtgo-labs/mtgo-wasm" target="_blank" rel="noopener">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.34.85 0 1.7.12 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z" />
      </svg>
      mtgo-wasm
    </a>
  </footer>
</div>

<style>
  .page {
    max-width: 480px;
    margin: 0 auto;
    padding: var(--sp-8) var(--sp-4) var(--sp-6);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .hero {
    text-align: center;
    margin-bottom: var(--sp-6);
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    padding: 3px 10px;
    font-size: 0.7rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
    background: rgba(42, 171, 238, 0.08);
    border: 1px solid rgba(42, 171, 238, 0.2);
    border-radius: 100px;
    margin-bottom: var(--sp-4);
  }

  .hero h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 var(--sp-2);
    letter-spacing: -0.02em;
    color: var(--text);
  }

  .hero h1 .dot {
    color: var(--accent);
  }

  .hero h1 .ext {
    color: var(--text-dim);
    font-weight: 500;
  }

  .hero p {
    color: var(--text-dim);
    margin: 0;
    font-size: 0.95rem;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    padding: var(--sp-5);
    box-shadow: var(--shadow-card);
  }

  footer {
    margin-top: auto;
    padding-top: var(--sp-6);
    text-align: center;
  }

  footer a {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    font-size: 0.85rem;
    color: var(--text-faint);
    transition: color 0.15s;
  }

  footer a:hover {
    color: var(--text-dim);
  }

  @media (max-width: 520px) {
    .page {
      padding: var(--sp-5) var(--sp-3) var(--sp-4);
    }

    .hero h1 {
      font-size: 1.6rem;
    }

    .card {
      padding: var(--sp-4);
    }
  }
</style>
