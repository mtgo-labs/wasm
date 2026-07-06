/**
 * Links WASM build artifacts from the repo root into static/.
 *
 * Run automatically via `postinstall`. Creates relative symlinks so the dev
 * server and production build serve the same files the Go toolchain produced:
 *
 *   static/mtgo-wasm.wasm.gz  →  ../../../mtgo-wasm.wasm.gz
 *   static/wasm_exec.js       →  ../../../lib/wasm_exec.js
 *
 * The wasm ships gzip-compressed (~5 MiB) rather than the raw ~30 MB binary so
 * the SvelteKit example deploys to size-capped hosts such as Cloudflare Pages
 * (25 MiB per file). The loader decompresses it in the browser. Produce the
 * artifact with `make gzip` in the repo root.
 *
 * If the targets don't exist yet, the symlinks are still created — they'll
 * resolve once `make build copy-exec gzip` has been run.
 */
import { mkdir, symlink, readlink, rm, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const repoRoot = resolve(projectRoot, '..', '..');
const staticDir = resolve(projectRoot, 'static');

const links = [
  {
    name: 'mtgo-wasm.wasm.gz',
    target: resolve(repoRoot, 'mtgo-wasm.wasm.gz'),
  },
  {
    name: 'wasm_exec.js',
    target: resolve(repoRoot, 'lib', 'wasm_exec.js'),
  },
];

await mkdir(staticDir, { recursive: true });

// Legacy cleanup: older versions linked the raw (uncompressed) wasm into
// static/. Remove any such symlink so it can't blow past a host's per-file
// size limit (e.g. Cloudflare Pages' 25 MiB cap). Real files are left alone.
const legacyRaw = resolve(staticDir, 'mtgo-wasm.wasm');
try {
  await readlink(legacyRaw); // throws if not a symlink / missing
  await rm(legacyRaw);
  console.log('  removed static/mtgo-wasm.wasm (legacy raw link, replaced by .gz)');
} catch {
  // not a symlink or absent — nothing to do
}

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

console.log('\nWASM assets linked. Run `make build copy-exec gzip` in the repo root if they are missing.');
