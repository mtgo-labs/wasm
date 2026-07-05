/**
 * Links WASM build artifacts from the repo root into static/.
 *
 * Run automatically via `postinstall`. Creates relative symlinks so the dev
 * server and production build serve the same files the Go toolchain produced:
 *
 *   static/mtgo-wasm.wasm  →  ../../../mtgo-wasm.wasm
 *   static/wasm_exec.js    →  ../../../lib/wasm_exec.js
 *
 * If the targets don't exist yet, the symlinks are still created — they'll
 * resolve once `make build && make copy-exec` has been run in the repo root.
 */
import { mkdir, symlink, readlink, rm } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const repoRoot = resolve(projectRoot, '..', '..');
const staticDir = resolve(projectRoot, 'static');

const links = [
  {
    name: 'mtgo-wasm.wasm',
    target: resolve(repoRoot, 'mtgo-wasm.wasm'),
  },
  {
    name: 'wasm_exec.js',
    target: resolve(repoRoot, 'lib', 'wasm_exec.js'),
  },
];

await mkdir(staticDir, { recursive: true });

for (const { name, target } of links) {
  const linkPath = resolve(staticDir, name);
  // Relative path from staticDir to the target (portable symlink).
  const relTarget = relative(staticDir, target);

  try {
    await symlink(relTarget, linkPath, 'file');
    console.log(`  linked  static/${name} → ${relTarget}`);
  } catch (err) {
    if (err.code === 'EEXIST') {
      try {
        const existing = await readlink(linkPath);
        if (existing === relTarget) {
          console.log(`  ok      static/${name} (already linked)`);
        } else {
          // Stale symlink — replace it.
          await rm(linkPath);
          await symlink(relTarget, linkPath, 'file');
          console.log(`  fixed   static/${name} → ${relTarget} (was ${existing})`);
        }
      } catch {
        console.log(`  warn    static/${name} exists (not a symlink), skipping`);
      }
    } else {
      throw err;
    }
  }
}

console.log('\nWASM assets linked. Run `make build && make copy-exec` in the repo root if they are missing.');
