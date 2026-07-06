/**
 * mtgo-wasm — Vite/SvelteKit loader type definitions.
 *
 * Covers the load() function, the MTGoWasm API surface, and global
 * declarations for Go (from wasm_exec.js) and MTGoWasm (set by the Go
 * bridge in wasm/bridge.go).
 */

// --- Public API types ---

/** Authenticated user info returned by client.me(). */
export interface MTGoUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  is_bot: boolean;
}

/**
 * Options passed to MTGoWasm.createClient().
 *
 * `apiID` and `apiHash` are required unless `sessionString` carries them.
 */
export interface ClientOptions {
  /** Telegram API ID from my.telegram.org */
  apiID: number;
  /** Telegram API hash */
  apiHash: string;
  /** Bot token — triggers bot auth on connect. */
  botToken?: string;
  /** Pre-authenticated session string (Telethon/Pyrogram/etc). */
  sessionString?: string;
  /** Phone number for interactive user login. */
  phoneNumber?: string;
  /** OTP provider: `async (phone) => code`. */
  codeFunc?: (phone: string) => string | Promise<string>;
  /** 2FA password provider: `async (hint) => password`. */
  passwordFunc?: (hint: string) => string | Promise<string>;
}

/** A Telegram MTProto client instance backed by the WASM runtime. */
export interface MTGoClient {
  /** Internal client handle ID. */
  readonly id: number;
  /**
   * Establish the WebSocket transport, perform the DH key exchange, and
   * authenticate (bot login or session restore).
   */
  connect(): Promise<void>;
  /**
   * Invoke a Telegram TL method by name.
   *
   * @param method TL function name (e.g. `"messages.sendMessage"`).
   * @param params Plain JS object using snake_case keys matching the TL schema.
   * @returns The parsed response, typed as `T` (defaults to `unknown`).
   */
  invoke<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  /** Get the authenticated user, or `null` if not connected. */
  me(): MTGoUser | null;
  /** Close the transport and release the session. */
  disconnect(): Promise<void>;
  /** TL namespace proxy: tg.namespace.method(params) for any TL method. */
  readonly [namespace: string]: TGNamespaces | TGMethods | Promise<unknown> | MTGoUser | null | number | Function;
}

/**
 * TL namespace proxy. Provides `namespace.method(params)` style access
 * to all Telegram TL methods. Each method returns a Promise.
 *
 * Params use snake_case keys matching the TL schema (same as `invoke`).
 */
export interface TGNamespaces {
  readonly [namespace: string]: TGMethods;
}

/** TL method accessor — call any method as a function returning a Promise. */
export interface TGMethods {
  readonly [method: string]: (params?: Record<string, unknown>) => Promise<unknown>;
}

/** Global API installed by the Go bridge after WASM instantiation. */
export interface MTGoWasmAPI {
  createClient(opts: ClientOptions): MTGoClient;
}

/** Options for the Vite loader's `load()` function. */
export interface LoadOptions {
  /** URL to the `.wasm` file. Defaults to `"/mtgo-wasm.wasm"`. */
  wasmUrl?: string;
  /**
   * URL to Go's `wasm_exec.js`.
   * Pass `null` (or omit) if already loaded via `<script>` in `app.html`.
   */
  wasmExecUrl?: string | null;
}

// --- Loader function ---

/**
 * Load and instantiate mtgo-wasm.
 *
 * @returns The MTGoWasm API (`createClient`).
 */
export declare function load(opts?: LoadOptions): Promise<MTGoWasmAPI>;

// --- Global declarations (from wasm_exec.js + Go bridge) ---

/** Instance of Go's WASM bootstrap class (from wasm_exec.js). */
interface GoInstance {
  /** WebAssembly import object providing syscalls the Go runtime needs. */
  importObject: WebAssembly.Imports;
  /** Run the Go program. Resolves when the program exits. */
  run(instance: WebAssembly.Instance): Promise<void>;
  /** Whether the Go program has exited. */
  exited: boolean;
}

declare global {
  /** Go WASM bootstrap constructor (loaded via wasm_exec.js). */
  // eslint-disable-next-line no-var
  var Go: { new (): GoInstance };
  /** mtgo-wasm API, set by the Go bridge after instantiation. */
  // eslint-disable-next-line no-var
  var MTGoWasm: MTGoWasmAPI | undefined;
}
