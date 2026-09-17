import { build } from 'esbuild';
import { chmod, mkdir, copyFile } from 'node:fs/promises';

await build({
  entryPoints: ['packages/cli/src/entry.ts'],
  outfile: 'dist/jevra.mjs',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  sourcemap: true,
  legalComments: 'eof',
});
await chmod('dist/jevra.mjs', 0o755);
for (const host of ['codex', 'claude-code']) {
  const target = `plugins/${host}/jevra/dist`;
  await mkdir(target, { recursive: true });
  await copyFile('dist/jevra.mjs', `${target}/jevra.mjs`);
  await copyFile('dist/jevra.mjs.map', `${target}/jevra.mjs.map`);
}
console.log('Built the CLI and both local development plugin bundles.');
