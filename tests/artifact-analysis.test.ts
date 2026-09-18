import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../evals/artifact-comparison/analyze.ts';

const cell = (arm: string, success = true, high = 1) => ({ id: `codex-task-${arm}`, host: 'codex', task: 'task', arm,
  success, total: { input: 100, output: 10, cost: { low: high / 2, high } }, durationMs: 100,
  hostMetrics: { usage: { input: 90, cacheRead: 40 } }, managedMetrics: { worker: { calls: 1 }, jev: { calls: 1 } },
  privatePath: '/private/example', ledger: [{ privatePrompt: 'do not export' }] });
const data = (rows: any[]) => ({ rows, manifest: { hashes: { 'evals/artifact-comparison/protocol.md': 'hash' },
  schedule: [{ host: 'codex', task: 'task', arms: ['native', 'worker', 'jev'] }] }, stopReason: null });

test('analysis counts failures in cost and distinguishes a lower estimate from robust scenario savings', () => {
  const result = analyze(data([cell('native'), cell('worker', false, 0.1), cell('jev', true, 0.7)]));
  const worker = result.groups.find(g => g.host === 'codex' && g.arm === 'worker')!;
  assert.equal(worker.cost?.high, 0.1); assert.equal(worker.costPerSuccess, null);
  assert.equal(result.gates.find(g => g.host === 'codex' && g.arm === 'worker')?.qualifiesForLargerTest, false);
  const jev = result.gates.find(g => g.host === 'codex' && g.arm === 'jev')!;
  assert.equal(jev.qualifiesForLargerTest, true); assert.equal(jev.robustScenarioSaving, false);
  assert.equal(JSON.stringify(result).includes('privatePrompt'), false);
  assert.equal(JSON.stringify(result).includes('/private/example'), false);
});

test('missing cells and incomplete accounting cannot pass the release screening gate', () => {
  const incomplete = { ...cell('jev', true, 0.1), total: { input: null, output: null, cost: null } };
  const result = analyze(data([cell('native'), incomplete]));
  assert.deepEqual(result.missing, ['codex-task-worker']);
  assert.equal(result.gates.find(g => g.host === 'codex' && g.arm === 'jev')?.fullAccounting, false);
  assert.equal(result.gates.find(g => g.host === 'codex' && g.arm === 'worker')?.qualifiesForLargerTest, false);
  assert.equal(result.groups.find(g => g.host === 'codex' && g.arm === 'jev')?.costPerSuccess, null);
  assert.throws(() => analyze(data([cell('native'), cell('native')])), /Invalid comparison cells/);
});
