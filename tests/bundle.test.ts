import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('the standalone bundled CLI starts without workspace dependencies', () => {
  const result = spawnSync(process.execPath, [resolve('dist/jevra.mjs'), '--help'], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Jevra 0.1.0-alpha.2/);
});

test('packaged hooks fail open with valid JSON on absent config and malformed input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jevra-bundle-'));
  try {
    const config = join(dir, 'config.json');
    for (const host of ['codex', 'claude-code']) {
      const entry = resolve(`plugins/${host}/jevra/dist/jevra.mjs`);
      const missing = spawnSync(process.execPath, [entry, 'hook', '--host', host, '--config', config], { input: '{}', encoding: 'utf8' });
      assert.equal(missing.status, 0);
      assert.deepEqual(JSON.parse(missing.stdout), {});
      assert.match(missing.stderr, /config_missing/);
    }
    await writeFile(config, JSON.stringify({ version: 1, skillRoots: [dir], traces: false }));
    const invalid = spawnSync(process.execPath, [resolve('dist/jevra.mjs'), 'hook', '--host', 'codex', '--config', config],
      { input: 'INVALID PRIVATE CONTENT', encoding: 'utf8' });
    assert.equal(invalid.status, 0);
    assert.deepEqual(JSON.parse(invalid.stdout), {});
    assert.doesNotMatch(invalid.stderr, /PRIVATE CONTENT/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
