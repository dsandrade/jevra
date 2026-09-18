import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEconomics, economicConfigSchema, economicQuestion } from '../packages/core/src/economics.ts';
import type { EconomicConfig } from '../packages/core/src/economics.ts';
import { hash } from '@jevra/core';
import { generateTestsSchema } from '../packages/cli/src/artifact-session.ts';

import { calibration } from './fixtures/economic-calibration.ts';

const context = { host: 'codex', delivery: 'native-ticket' } as const;
const facts = { sourceBytes: 100, requirementCount: 1 };

test('economic arithmetic includes all components and uses conservative observed bounds in each explicit metric', () => {
  for (const metric of ['total_tokens', 'api_equivalent_usd'] as const) {
    const a = analyzeEconomics(calibration(metric), context, facts);
    assert.deepEqual(a.native, { low: 100, high: 120 });
    assert.deepEqual(a.managed, { low: 41, high: 57 });
    assert.deepEqual(a.netBenefit, { low: 43, high: 79 });
    assert.equal(a.conservativeSavingsFraction, 0.43); assert.equal(a.admissible, true);
    assert.equal(a.parentExecutionVerified, false);
    const q = economicQuestion(a); assert.ok(q.type === 'choice' && 'delegate' in q.criteria);
  }
});

test('unknowns, quality failures, non-adoption and incomparable observations cannot silently authorize delegation', () => {
  const mutations: [string, (c: EconomicConfig) => void][] = [
    ['unknown_usage', c => { c.calibration!.pairs[1]!.managed.jev = null; }],
    ['quality_not_established', c => { c.calibration!.pairs[1]!.managedQuality = 'failed'; }],
    ['quality_not_established', c => { c.calibration!.equivalentQualityChecks = false; }],
    ['helper_not_used', c => { c.calibration!.pairs[1]!.helperUsed = false; }],
    ['insufficient_pairs', c => { c.calibration!.pairs.pop(); }],
    ['measurement_context_mismatch', c => { c.calibration!.execution.delivery = 'review'; }],
    ['measurement_context_mismatch', c => { c.calibration!.execution.parentModel = 'different'; }],
    ['measurement_context_mismatch', c => { c.calibration!.execution.contextHash = hash('other'); }],
    ['measurement_context_mismatch', c => { c.calibration!.metric = 'api_equivalent_usd'; }],
    ['expired_or_future_measurement', c => { c.calibration!.expiresAt = Date.now() - 1; }],
    ['expired_or_future_measurement', c => { c.calibration!.measuredAt = Date.now() + 1e6; }],
    ['missing_calibration', c => { delete c.calibration; }],
  ];
  for (const [issue, mutate] of mutations) {
    const c = calibration(); mutate(c); const a = analyzeEconomics(c, context, facts);
    assert.ok(a.issues.includes(issue), issue); assert.equal(a.admissible, false);
    assert.equal(a.netBenefit, null);
    const q = economicQuestion(a); assert.ok(q.type === 'choice' && !('delegate' in q.criteria));
  }
  assert.ok(analyzeEconomics(calibration(), { ...context, host: 'claude-code' }, facts).issues.includes('current_host_or_delivery_mismatch'));
  assert.ok(analyzeEconomics(calibration(), context, { ...facts, sourceBytes: 3000 }).issues.includes('outside_measured_size_range'));
});

test('negative, overlapping or zero-baseline ranges do not acquire a saving by averaging away an expensive attempt', () => {
  for (const high of [100, 200]) {
    const c = calibration(); c.calibration!.pairs[2]!.managed.parent!.high = high;
    const a = analyzeEconomics(c, context, facts);
    assert.equal(a.admissible, false); assert.ok(a.netBenefit!.low < 0);
    assert.equal(a.issues.length, 0, 'Complete but unfavorable data is distinct from missing data');
  }
  const c = calibration(); c.calibration!.pairs[0]!.native.parent!.low = 0;
  assert.equal(analyzeEconomics(c, context, facts).conservativeSavingsFraction, null);
});

test('economic configuration rejects invalid bounds, duplicate pairs and caller-supplied cost overrides', () => {
  const c = calibration(); c.calibration!.pairs[0]!.native.parent!.high = -1;
  assert.equal(economicConfigSchema.safeParse(c).success, false);
  const duplicate = calibration(); duplicate.calibration!.pairs[1]!.id = duplicate.calibration!.pairs[0]!.id;
  assert.equal(economicConfigSchema.safeParse(duplicate).success, false);
  assert.equal(generateTestsSchema.safeParse({ operationId: 'one', source: 'sum.ts', task: 'Generate tests', economics: calibration() }).success, false);
});
