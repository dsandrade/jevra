import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hash } from '@jevra/core';
import { evidenceHash } from '@jevra/core/managed-worker';
import type { WorkerRequest, WorkerResult } from '@jevra/core/worker';
import { configSchema } from '../packages/cli/src/config.ts';
import { tasks, schedule, taskPrompt } from '../evals/artifact-comparison/fixtures.ts';
import { coversCases, judge } from '../evals/artifact-comparison/judge.ts';
import { FixedWorkerControl } from '../evals/artifact-comparison/control.ts';
import { codexCost, hostMetrics, managedMetrics, totalMetrics } from '../evals/artifact-comparison/metrics.ts';

const render = (task: typeof tasks[number], count = task.cases.length) => `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { ${task.exportName} } from './${task.sourceName}';\n`
  + task.cases.slice(0, count).map((c, i) => `test('case ${i}', () => { assert.equal(${task.exportName}(${c.args.join(', ')}), ${c.expected}); });\n`).join('');
async function temp(fn: (root: string) => Promise<void>) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jevra-comparison-test-')));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
function generated(req: WorkerRequest, content: string): WorkerResult {
  return { status: 'generated', candidate: { content, sha256: evidenceHash(content), bytes: Buffer.byteLength(content) }, receipt: {
    schemaVersion: 1, transport: 'codex-cli', requestHash: hash(req), operationHash: hash(req.operationId), attempt: req.attempt,
    profile: req.profile, configuredModel: 'gpt-5.6-luna', configuredEffort: 'low', observedModel: null,
    isolationProfile: 'codex-generator/1', cliVersion: 'synthetic', authentication: 'chatgpt', inputBytes: 1, stdoutBytes: 1,
    stderrBytes: 0, generationInvocations: 1, observedToolItems: 0, usage: { inputTokens: 100, cachedInputTokens: 10, outputTokens: 20 },
    usageComplete: true, durationMs: 1, exitCode: 0, cleanupComplete: true, actualBilledUsd: null, subscriptionUsage: null,
  } };
}

test('frozen schedule includes every host/task/arm exactly once and prompts never force helpers', () => {
  const cells = schedule.flatMap(b => b.arms.map(a => `${b.host}/${b.task}/${a}`));
  assert.equal(cells.length, 12); assert.equal(new Set(cells).size, 12);
  for (const task of tasks) {
    assert.equal(task.cases.length, 8); assert.equal(task.mutants.length, 4);
    assert.doesNotMatch(taskPrompt(task), /jevra|generate_tests|test_profiles/i);
  }
});

test('independent judge requires complete requested assertions and detects both runtime and hidden defects', async () => {
  for (const task of tasks) await temp(async root => {
    const result = await judge(task, render(task), true, root);
    assert.equal(result.passed, true); assert.equal(result.coverage.filter(Boolean).length, 8);
    assert.equal(result.validation!.checks.filter(c => c.reason === 'mutant_detected').length, 4);
    assert.equal((await judge(task, render(task), false, join(root, 'changed'))).passed, false);
  });
});

test('coverage catches omitted requirements despite other passing assertions and rejects unsafe test text', () => {
  const t = tasks[0]!;
  assert.equal(coversCases(t, render(t, 7)).filter(Boolean).length, 7);
  assert.ok(coversCases(t, render(t) + 'process.exit(0);').every(c => !c));
});

test('evaluation-only worker control records actual work, repairs once and never invents Jev receipts', async () => {
  await temp(async root => {
    const task = tasks[0]!, packets: WorkerRequest[] = [];
    await writeFile(join(root, task.sourceName), task.source);
    const config = configSchema.parse({ version: 1, mode: 'advise', skillRoots: [root], testArtifacts: {
      enabled: true, experimentalProfile: 'node-pure-function-tests/1', codexExecutable: '/unused/codex',
      stagingDirectory: join(root, 'staging'), profiles: [{ id: task.id, sourcePath: join(root, task.sourceName),
        outputName: task.outputName, exportName: task.exportName, requirements: task.requirements, mutants: task.mutants.slice(0, 2) }] } });
    const controller = new FixedWorkerControl(config, { async generate(req) { packets.push(req);
      return generated(req, req.attempt === 1 ? render(task).replace('), 0);', '), 99);') : render(task)); } });
    const input = { operationId: 'tests', profileId: task.id, task: taskPrompt(task) }, signal = new AbortController().signal;
    const result = await controller.generate(input, signal);
    assert.equal(result.status, 'accepted'); assert.equal(packets.length, 2);
    assert.ok(packets[1]!.evidence.some(e => e.id === 'jevra_observed_checks'));
    assert.equal((await controller.generate(input, signal)).status, 'accepted'); assert.equal(packets.length, 2);
    await assert.rejects(controller.generate({ ...input, operationId: 'retry' }, signal), /budget_exceeded/);
    const ledger = JSON.parse(await readFile(join(root, 'staging', 'control.json'), 'utf8'));
    assert.equal(ledger.kind, 'fixed-worker-control'); assert.equal(ledger.generations.length, 2);
    assert.equal(ledger.decisions, undefined); assert.equal(ledger.receipt, undefined);
    const metrics = managedMetrics('worker', [ledger], true);
    assert.equal(metrics.worker.calls, 2); assert.equal(metrics.worker.input, 200); assert.equal(metrics.jev.calls, 0);
    await assert.rejects(readFile(join(root, task.outputName)));
  });
});

test('API-equivalent scenario separates cached input, bounds missing cache writes and preserves unknown telemetry', () => {
  assert.deepEqual(codexCost({ input: 1000000, cacheRead: 500000, cacheWrite: null, output: 1000000 }, 'astra'), { low: 55.5, high: 88.5 });
  assert.equal(codexCost({ input: null, cacheRead: 0, cacheWrite: null, output: 1 }, 'luna'), null);
  assert.equal(codexCost({ input: 1, cacheRead: 2, cacheWrite: null, output: 1 }, 'astra'), null);
  const host = hostMetrics('codex', [{ type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 } }]);
  const missing = managedMetrics('jev', [], true);
  assert.equal(totalMetrics(host, missing).cost, null); assert.equal(totalMetrics(host, missing).input, null);
  assert.equal(totalMetrics(host, managedMetrics('native', [], false)).input, 100);
});

test('Claude success subtype cannot hide an API error and cache classes are not double counted', () => {
  const events = [{ type: 'result', subtype: 'success', is_error: true, result: 'Not logged in', total_cost_usd: 0.1,
    modelUsage: { 'claude-sonnet-5': { inputTokens: 100, cacheReadInputTokens: 200, cacheCreationInputTokens: 50, outputTokens: 10 } } }];
  const m = hostMetrics('claude-code', events);
  assert.equal(m.failure, 'authentication'); assert.equal(m.usage.input, 350);
  assert.equal(m.usage.cacheRead, 200); assert.equal(m.usage.cacheWrite, 50);
  assert.deepEqual(m.cost, { low: 0.1, high: 0.1 });
  assert.equal(hostMetrics('claude-code', []).usage.input, null);
});
