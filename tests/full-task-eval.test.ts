import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { hostMetrics } from '../evals/full-task/metrics.ts';
import { prepareFixture } from '../evals/full-task/fixtures.ts';

test('full-task accounting distinguishes cached input, auxiliary model costs, and missing usage', () => {
  const missing = hostMetrics('codex', [{ type: 'turn.failed' }]);
  assert.equal(missing.totalInputTokens, null);
  assert.equal(missing.costEstimateUsdLow, null);
  const codex = hostMetrics('codex', [{ type: 'turn.completed', usage: { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 100 } }]);
  assert.equal(codex.costEstimateUsdLow, 0.0078);
  assert.equal(codex.costEstimateUsdHigh, 0.0083);
  const claude = hostMetrics('claude-code', [{ type: 'system', subtype: 'init', model: 'main' },
    { type: 'result', total_cost_usd: 0.123, modelUsage: {
      main: { inputTokens: 10, cacheReadInputTokens: 100, cacheCreationInputTokens: 50, outputTokens: 20 },
      auxiliary: { inputTokens: 30, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, outputTokens: 5 },
    } }]);
  assert.equal(claude.totalInputTokens, 190);
  assert.equal(claude.totalOutputTokens, 25);
  assert.equal(claude.costEstimateUsdLow, 0.123);
  assert.equal(hostMetrics('claude-code', []).costEstimateUsdLow, null);
});

test('external full-task judges reject broken fixtures and accept independently specified implementations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jevra-judge-'));
  const runJudge = (task: string, cwd: string) => {
    const result = spawnSync(process.execPath, [resolve('evals/full-task/judge.mjs'), task, cwd], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0);
    return JSON.parse(result.stdout);
  };
  try {
    const retry = join(root, 'retry');
    await prepareFixture(retry, 'retry-policy');
    assert.equal(runJudge('retry-policy', retry).passed, false);
    await writeFile(join(retry, 'src/retry.mjs'), `export function retryDecision(x) {
      if (!Number.isInteger(x.attempt) || x.attempt < 1) throw new RangeError();
      const no = reason => ({ retry: false, delayMs: 0, reason });
      if (x.attempt >= 4) return no('exhausted');
      if (!(x.status === 429 || (x.status >= 500 && x.status <= 599 && ![501,505].includes(x.status)) || ['TIMEOUT','NETWORK_RESET'].includes(x.code))) return no('permanent');
      if (!(x.idempotent === true || (typeof x.idempotencyKey === 'string' && x.idempotencyKey.trim()))) return no('unsafe');
      let delayMs = Math.min(2000, 200 * 2 ** (x.attempt - 1));
      if ([429,503].includes(x.status) && typeof x.retryAfterMs === 'number' && Number.isFinite(x.retryAfterMs) && x.retryAfterMs >= 0) delayMs = Math.max(delayMs, Math.ceil(x.retryAfterMs));
      return { retry: true, delayMs: Math.min(delayMs, 10000), reason: 'retry' };
    }`);
    assert.equal(runJudge('retry-policy', retry).passed, true);
    const retention = join(root, 'retention');
    await prepareFixture(retention, 'retention-policy');
    assert.equal(runJudge('retention-policy', retention).passed, false);
    await writeFile(join(retention, 'src/retention.mjs'), `export function planPurge(records, now) {
      const time = Date.parse(now);
      if (!Number.isFinite(time)) throw new TypeError();
      const newest = new Map();
      for (const r of records) if (r.category === 'report' && Number.isFinite(Date.parse(r.createdAt))) newest.set(r.accountId, Math.max(newest.get(r.accountId) ?? -Infinity, Date.parse(r.createdAt)));
      return records.filter(r => {
        const days = new Map([['session',7],['audit',90],['report',30]]).get(r.category);
        const created = Date.parse(r.createdAt);
        if (days === undefined || !Number.isFinite(created) || created > time || r.legalHold === true || (r.category === 'session' && r.accountActive === true)) return false;
        if (r.category === 'report' && created === newest.get(r.accountId)) return false;
        return time - created > days * 86400000;
      }).map(r => r.id).sort();
    }`);
    assert.equal(runJudge('retention-policy', retention).passed, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});
