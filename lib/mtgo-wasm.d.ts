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
}

export interface MTGoClient {
  readonly id: number;
  connect(): Promise<void>;
  invoke<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  me(): MTGoUser | null;
  getMe(): Promise<unknown>;
  resolveUsername(params: { username: string }): Promise<unknown>;
  disconnect(): Promise<void>;
  readonly tg: Record<string, Record<string, (params?: Record<string, unknown>) => Promise<unknown>>>;
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
