/**
 * mtgo-wasm — Plain-browser loader type definitions.
 *
 * This loader uses positional string arguments (wasmPath, execPath) rather
 * than an options object, matching the plain `<script>` usage pattern.
 */

export interface MTGoUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  is_bot: boolean;
}

export interface ClientOptions {
  apiID: number;
  apiHash: string;
  botToken?: string;
  sessionString?: string;
  phoneNumber?: string;
  codeFunc?: (phone: string) => string | Promise<string>;
  passwordFunc?: (hint: string) => string | Promise<string>;
  /** RPC timeout in seconds (default 60). */
  timeout?: number;
}

export interface MTGoClient {
  readonly id: number;
  connect(): Promise<void>;
  invoke<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  me(): MTGoUser | null;
  disconnect(): Promise<void>;
  getMe(): Promise<unknown>;
  logOut(): Promise<unknown>;
  setUsername(params: { username: string }): Promise<unknown>;
  setBio(params: { about: string }): Promise<unknown>;
  updateProfile(params: { first_name?: string; last_name?: string; about?: string }): Promise<unknown>;
  checkUsername(params: { username: string }): Promise<boolean>;
  resolveUsername(params: { username: string }): Promise<unknown>;
  resolvePhone(params: { phone: string }): Promise<unknown>;
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
  getChat(params: { id: number[] }): Promise<unknown>;
  getFullChat(params: { channel: unknown }): Promise<unknown>;
  joinChat(params: { channel: unknown }): Promise<unknown>;
  leaveChat(params: { channel: unknown }): Promise<unknown>;
  createChannel(params: Record<string, unknown>): Promise<unknown>;
  createGroup(params: { users: unknown[]; title: string }): Promise<unknown>;
  getChatMembers(params: { channel: unknown }): Promise<unknown>;
  inviteToChat(params: Record<string, unknown>): Promise<unknown>;
  getUsers(params: { id: unknown[] }): Promise<unknown>;
  getFullUser(params: { id: unknown }): Promise<unknown>;
  answerCallbackQuery(params: Record<string, unknown>): Promise<boolean>;
  answerInlineQuery(params: Record<string, unknown>): Promise<boolean>;
  getMyCommands(params?: Record<string, unknown>): Promise<unknown>;
  setMyCommands(params: Record<string, unknown>): Promise<boolean>;
  /**
   * At runtime, the client is wrapped in a Proxy that supports namespace access:
   *   client.account.updateProfile({ first_name: "John" })
   *   client.messages.sendMessage({ peer: ..., message: "hi" })
   * This is not reflected in the type system. For typed arbitrary TL access,
   * use `client.invoke<T>(method, params)`.
   */
}

export interface MTGoWasmAPI {
  createClient(opts: ClientOptions): MTGoClient;
}

/**
 * Load and instantiate mtgo-wasm.
 *
 * @param wasmPath URL/path to mtgo-wasm.wasm.
 * @param execPath URL/path to wasm_exec.js (skip if already loaded via `<script>`).
 * @returns The MTGoWasm API.
 */
export declare function load(wasmPath: string, execPath?: string): Promise<MTGoWasmAPI>;

/** Global namespace for script-tag usage: `MTGoWasmLoader.load(...)`. */
export declare const MTGoWasmLoader: { load: typeof load };

interface GoInstance {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
  exited: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var Go: { new (): GoInstance };
  // eslint-disable-next-line no-var
  var MTGoWasm: MTGoWasmAPI | undefined;
  // eslint-disable-next-line no-var
  var MTGoWasmLoader: { load: typeof load };
}
