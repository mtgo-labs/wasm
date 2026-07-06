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
  /** Get the authenticated user (cached, sync). */
  me(): MTGoUser | null;
  /** Close the transport and release the session. */
  disconnect(): Promise<void>;

  // -- Auth --
  /** Full user info via RPC. */
  getMe(): Promise<unknown>;
  /** Log out and invalidate the current session. */
  logOut(): Promise<unknown>;

  // -- Profile --
  /** Set the current account's username. */
  setUsername(params: { username: string }): Promise<unknown>;
  /** Set the current account's bio. */
  setBio(params: { about: string }): Promise<unknown>;
  /** Update profile fields (firstName, lastName, bio). */
  updateProfile(params: { first_name?: string; last_name?: string; about?: string }): Promise<unknown>;
  /** Check if a username is available. */
  checkUsername(params: { username: string }): Promise<unknown>;

  // -- Peer resolution --
  resolveUsername(params: { username: string }): Promise<unknown>;
  resolvePhone(params: { phone: string }): Promise<unknown>;

  // -- Messages --
  sendMessage(params: Record<string, unknown>): Promise<unknown>;
  editMessage(params: Record<string, unknown>): Promise<unknown>;
  deleteMessages(params: { id: number[]; revoke?: boolean }): Promise<unknown>;
  forwardMessages(params: Record<string, unknown>): Promise<unknown>;
  getHistory(params: { peer: unknown; offset_id?: number; limit?: number }): Promise<unknown>;
  getDialogs(params?: Record<string, unknown>): Promise<unknown>;
  searchMessages(params: Record<string, unknown>): Promise<unknown>;
  sendReaction(params: Record<string, unknown>): Promise<unknown>;
  readHistory(params: { peer: unknown; max_id?: number }): Promise<unknown>;
  pinMessage(params: Record<string, unknown>): Promise<unknown>;
  unpinMessage(params: Record<string, unknown>): Promise<unknown>;

  // -- Chats & channels --
  getChat(params: { id: number[] }): Promise<unknown>;
  getFullChat(params: { channel: unknown }): Promise<unknown>;
  joinChat(params: { channel: unknown }): Promise<unknown>;
  leaveChat(params: { channel: unknown }): Promise<unknown>;
  createChannel(params: Record<string, unknown>): Promise<unknown>;
  createGroup(params: { users: unknown[]; title: string }): Promise<unknown>;
  getChatMembers(params: { channel: unknown }): Promise<unknown>;
  inviteToChat(params: Record<string, unknown>): Promise<unknown>;

  // -- Users --
  getUsers(params: { id: unknown[] }): Promise<unknown>;
  getFullUser(params: { id: unknown }): Promise<unknown>;

  // -- Bots --
  answerCallbackQuery(params: Record<string, unknown>): Promise<unknown>;
  answerInlineQuery(params: Record<string, unknown>): Promise<unknown>;
  getMyCommands(params?: Record<string, unknown>): Promise<unknown>;
  setMyCommands(params: Record<string, unknown>): Promise<unknown>;

  /** TL namespace proxy for all other TL methods. */
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
