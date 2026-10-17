/**
 * Compile the Express engine (server.ts) into a single ESM bundle at
 * build/server.mjs, which the Electron shell spawns as a child process.
 *
 * npm packages stay EXTERNAL (they ship in node_modules and are resolved at
 * runtime) — bundling them tends to break packages that use dynamic requires.
 * Our own source is bundled, so the build output is one tidy file.
 */
import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [path.join(root, 'server.ts')],
  outfile: path.join(root, 'build', 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  sourcemap: false,
  logLevel: 'info',
  banner: {
    // Some CJS-only packages still expect `require`; give them a real one.
    js: [
      "import { createRequire as __fgcCreateRequire } from 'module';",
      'const require = __fgcCreateRequire(import.meta.url);',
    ].join('\n'),
  },
});

console.log('[build-server] wrote build/server.mjs');
