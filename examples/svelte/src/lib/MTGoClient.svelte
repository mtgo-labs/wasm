<script lang="ts">
  import { onMount } from "svelte";
  import CodeEditor from "$lib/CodeEditor.svelte";
  import { load, type MTGoWasmAPI, type MTGoClient as MTGoClientHandle, type ClientOptions } from "$lib/mtgo-wasm-vite.js";
  import { filterMethods, getTemplate, type TLMethod } from "$lib/tl-methods";

  // Non-reactive handles.
  let mtgo: MTGoWasmAPI | null = null;
  let client: MTGoClientHandle | null = null;

  // Reactive UI state.
  let loading = $state(true);
  let connected = $state(false);
  let busy = $state(false);
  let error = $state<Error | null>(null);
  let status = $state("Loading WASM module…");
  let result = $state<unknown>(null);
  let copied = $state(false);

  // Form state.
  let apiID = $state("");
  let apiHash = $state("");
  let botToken = $state("");
  let sessionString = $state("");
  let showSecrets = $state(false);

  // RPC state.
  let method = $state("users.getUsers");
  let params = $state('{"id":[{"_":"inputUserSelf"}]}');

  // Method autocomplete state.
  let methodFocused = $state(false);
  let methodHighlight = $state(-1);
  let methodSuggestions = $state<TLMethod[]>([]);
  let methodOpen = $derived(methodFocused && methodSuggestions.length > 0);

  // Derived status kind for badge styling.
  let statusKind = $derived.by(() => {
    if (error) return "error";
    if (connected) return "connected";
    if (loading || busy) return "busy";
    return "ready";
  });

  onMount(async () => {
    try {
      mtgo = await load({ wasmUrl: "/mtgo-wasm.wasm" });
      status = "WASM ready — enter credentials and connect.";
      loading = false;
    } catch (err) {
      const e = err as Error;
      status = `Load failed: ${e.message}`;
      error = e;
      loading = false;
    }
  });

  async function connect() {
    if (!mtgo || busy) return;
    busy = true;
    error = null;
    status = "Connecting…";

    try {
      const opts: Partial<ClientOptions> = {};
      if (apiID) opts.apiID = parseInt(apiID, 10);
      if (apiHash) opts.apiHash = apiHash;
      if (botToken) opts.botToken = botToken;
      if (sessionString) opts.sessionString = sessionString;

      client = mtgo.createClient(opts as ClientOptions);
      await client.connect();
      connected = true;
      const me = client.me();
      status = me ? `Connected as ${me.username || me.id}` : "Connected";
    } catch (err) {
      const e = err as Error;
      status = `Connect failed: ${e.message}`;
      error = e;
    } finally {
      busy = false;
    }
  }

  async function invoke() {
    if (!client || busy) return;
    busy = true;
    error = null;
    status = `Invoking ${method}…`;

    try {
      const p = params.trim() ? JSON.parse(params) : {};
      result = await client.invoke(method, p);
      status = `✓ ${method}`;
    } catch (err) {
      const e = err as Error;
      status = `Invoke failed: ${e.message}`;
      error = e;
    } finally {
      busy = false;
    }
  }

  async function disconnect() {
    if (!client || busy) return;
    busy = true;
    status = "Disconnecting…";

    try {
      await client.disconnect();
      client = null;
      connected = false;
      result = null;
      status = "Disconnected";
    } catch (err) {
      const e = err as Error;
      status = `Disconnect failed: ${e.message}`;
    } finally {
      busy = false;
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  // Derived: result as pretty JSON string for the read-only editor.
  let resultStr = $derived(result ? JSON.stringify(result, null, 2) : "");

  // JSON utilities for the params editor.
  function formatParams() {
    try {
      params = JSON.stringify(JSON.parse(params), null, 2);
    } catch {
      // invalid JSON — CodeMirror linter will show the error
    }
  }

  function minifyParams() {
    try {
      params = JSON.stringify(JSON.parse(params));
    } catch {
      // invalid JSON
    }
  }

  // --- Method autocomplete ---
  function onMethodInput() {
    methodSuggestions = filterMethods(method);
    methodHighlight = -1;
  }

  function onMethodKeydown(e: KeyboardEvent) {
    if (!methodOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      methodHighlight = Math.min(methodHighlight + 1, methodSuggestions.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      methodHighlight = Math.max(methodHighlight - 1, 0);
    } else if (e.key === "Enter" && methodHighlight >= 0) {
      e.preventDefault();
      selectMethod(methodSuggestions[methodHighlight]);
    } else if (e.key === "Escape") {
      methodFocused = false;
    }
  }

  function selectMethod(m: TLMethod) {
    method = m.name;
    methodFocused = false;
    if (m.template) params = m.template;
  }

  function loadTemplate() {
    const tpl = getTemplate(method);
    params = tpl ?? "{}";
  }

</script>

<!-- Status badge -->
<div class="status-badge {statusKind}">
  {#if statusKind === "busy"}
    <span class="dot pulse"></span>
  {:else}
    <span class="dot"></span>
  {/if}
  <span>{status}</span>
</div>

{#if !connected}
  <!-- Credentials form -->
  <div class="form-section">
    <div class="form-section-header">
      <h3>Credentials</h3>
      <button class="toggle-btn" onclick={() => (showSecrets = !showSecrets)}>
        {showSecrets ? "Hide" : "Show"} secrets
      </button>
    </div>

    <div class="field">
      <label for="apiID">API ID</label>
      <input id="apiID" type="number" bind:value={apiID} placeholder="12345" disabled={busy} />
    </div>

    <div class="field">
      <label for="apiHash">API Hash</label>
      <input
        id="apiHash"
        type={showSecrets ? "text" : "password"}
        bind:value={apiHash}
        placeholder="0123456789abcdef…"
        autocomplete="off"
        disabled={busy}
      />
    </div>

    <div class="field">
      <label for="botToken">Bot Token <span class="opt">or session string</span></label>
      <input
        id="botToken"
        type={showSecrets ? "text" : "password"}
        bind:value={botToken}
        placeholder="123:ABCdef…"
        autocomplete="off"
        disabled={busy}
      />
    </div>

    <div class="field">
      <label for="session">Session String <span class="opt">optional</span></label>
      <input
        id="session"
        type={showSecrets ? "text" : "password"}
        bind:value={sessionString}
        placeholder="…"
        autocomplete="off"
        disabled={busy}
      />
    </div>

    <button class="btn btn-primary" onclick={connect} disabled={loading || busy}>
      {#if busy}
        <span class="spinner"></span>
        Connecting…
      {:else}
        Connect
      {/if}
    </button>
  </div>
{:else}
  <!-- RPC console -->
  <div class="form-section">
    <div class="form-section-header">
      <h3>RPC Console</h3>
    </div>

    <div class="field autocomplete-field">
      <label for="method">Method</label>
      <div class="autocomplete-wrap">
        <input
          id="method"
          type="text"
          bind:value={method}
          oninput={onMethodInput}
          onkeydown={onMethodKeydown}
          onfocus={() => { methodFocused = true; onMethodInput(); }}
          onblur={() => setTimeout(() => (methodFocused = false), 150)}
          spellcheck="false"
          class="mono"
          autocomplete="off"
          disabled={busy}
        />
        {#if methodOpen}
          <ul class="autocomplete-list">
            {#each methodSuggestions as m, i}
              <li>
                <button
                  class="autocomplete-item"
                  class:highlighted={i === methodHighlight}
                  onmousedown={(e) => { e.preventDefault(); selectMethod(m); }}
                  onmouseenter={() => (methodHighlight = i)}
                >
                  <span class="method-name">{m.name}</span>
                  <span class="method-desc">{m.description}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>

    <div class="field">
      <div class="field-label-row">
        <label for="params">Params <span class="opt">JSON</span></label>
        <div class="editor-toolbar">
          <button class="tool-btn" onclick={loadTemplate} title="Load params template for current method">Template</button>
          <button class="tool-btn" onclick={formatParams} title="Pretty-print (2-space indent)">Format</button>
          <button class="tool-btn" onclick={minifyParams} title="Minify to single line">Minify</button>
        </div>
      </div>
      <CodeEditor bind:value={params} placeholderText="Enter JSON params…" />
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" onclick={invoke} disabled={busy}>
        {#if busy}
          <span class="spinner"></span>
          Invoking…
        {:else}
          Invoke
        {/if}
      </button>
      <button class="btn btn-ghost" onclick={disconnect} disabled={busy}>
        Disconnect
      </button>
    </div>
  </div>
{/if}

{#if result}
  <div class="result-section">
    <div class="result-header">
      <span class="result-label">Response</span>
      <button class="copy-btn" onclick={copyResult}>
        {copied ? "✓ Copied" : "Copy"}
      </button>
    </div>
    <CodeEditor value={resultStr} readOnly />
  </div>
{/if}

<style>
  .status-badge {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    border-radius: var(--r-md);
    font-size: 0.85rem;
    font-weight: 500;
    margin-bottom: var(--sp-5);
    transition: all 0.2s ease;
  }

  .status-badge.ready {
    background: var(--surface-2);
    color: var(--text-dim);
  }

  .status-badge.busy {
    background: var(--warn-bg);
    color: var(--warn);
  }

  .status-badge.connected {
    background: var(--ok-bg);
    color: var(--ok);
  }

  .status-badge.error {
    background: var(--err-bg);
    color: var(--err);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: currentColor;
  }

  .dot.pulse {
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.8); }
  }

  /* Form sections */
  .form-section {
    margin-bottom: var(--sp-5);
  }

  .form-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--sp-4);
  }

  .form-section-header h3 {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
    margin: 0;
  }

  /* Fields */
  .field {
    margin-bottom: var(--sp-3);
  }

  .field label {
    display: block;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-dim);
    margin-bottom: var(--sp-1);
  }

  .field .opt {
    font-weight: 400;
    color: var(--text-faint);
  }

  .field input {
    width: 100%;
    padding: var(--sp-2) var(--sp-3);
    font-size: 0.9rem;
    font-family: var(--font-sans);
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  /* Remove number input increment/decrement spinners */
  .field input[type="number"]::-webkit-inner-spin-button,
  .field input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .field input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .field input.mono {
    font-family: var(--font-mono);
    font-size: 0.82rem;
  }

  .field input::placeholder {
    color: var(--text-faint);
  }

  .field input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(42, 171, 238, 0.12);
  }

  .field input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Toggle button */
  .toggle-btn {
    font-size: 0.75rem;
    color: var(--text-faint);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
  }

  .toggle-btn:hover {
    color: var(--accent);
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-5);
    font-size: 0.9rem;
    font-weight: 500;
    font-family: var(--font-sans);
    border: none;
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hi);
    box-shadow: var(--shadow-glow);
  }

  .btn-ghost {
    background: var(--surface-2);
    color: var(--text-dim);
    border: 1px solid var(--border);
  }

  .btn-ghost:hover:not(:disabled) {
    background: var(--surface-3);
    color: var(--text);
  }

  .btn-row {
    display: flex;
    gap: var(--sp-2);
  }

  /* Spinner */
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Result */
  .result-section {
    margin-top: var(--sp-5);
    border-top: 1px solid var(--border);
    padding-top: var(--sp-4);
  }

  .result-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--sp-2);
  }

  .result-label {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
  }

  .copy-btn {
    font-size: 0.75rem;
    padding: var(--sp-1) var(--sp-2);
    background: var(--surface-2);
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: all 0.15s;
  }

  .copy-btn:hover {
    background: var(--surface-3);
    color: var(--text);
  }

  .field-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--sp-1);
  }

  .editor-toolbar {
    display: flex;
    gap: 2px;
  }

  .tool-btn {
    font-size: 0.72rem;
    font-weight: 500;
    padding: 2px 8px;
    background: var(--surface-2);
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: all 0.15s;
  }

  .tool-btn:hover {
    background: var(--surface-3);
    color: var(--accent);
    border-color: var(--accent-dim);
  }

  /* Method autocomplete dropdown */
  .autocomplete-wrap {
    position: relative;
  }

  .autocomplete-list {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 50;
    margin: 0;
    padding: 4px;
    list-style: none;
    background: var(--surface-2);
    border: 1px solid var(--border-hi);
    border-radius: var(--r-md);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    max-height: 280px;
    overflow-y: auto;
  }

  .autocomplete-item {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 1px;
    padding: 6px 10px;
    background: none;
    border: none;
    border-radius: var(--r-sm);
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .autocomplete-item.highlighted {
    background: var(--surface-3);
  }

  .method-name {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--accent);
  }

  .autocomplete-item.highlighted .method-name {
    color: var(--accent-hi);
  }

  .method-desc {
    font-size: 0.72rem;
    color: var(--text-faint);
  }
</style>
