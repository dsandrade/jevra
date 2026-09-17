import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

test('unavailable provider usage is null rather than a zero-cost claim', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jevra-eval-'));
  try {
    const output = join(dir, 'report.json');
    const result = spawnSync(process.execPath, [resolve('evals/runners/skill-routing.ts'),
      '--backend', 'jev', '--limit', '1', '--output', output], {
      encoding: 'utf8', env: { ...process.env, TYPESAFE_API_KEY: '' }, timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(report.rows[0].reason, 'missing_credentials');
    assert.equal(report.summary.evaluationAttempts, 1);
    assert.equal(report.summary.callsWithKnownUsage, 0);
    assert.equal(report.summary.inputTokens, null);
    assert.equal(report.summary.outputTokens, null);
    assert.equal(report.summary.actualCost, null);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
