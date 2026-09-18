import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODEL } from '@jevra/core';
import type { ProviderResult } from '@jevra/core';
import { applicabilityCases, caseInput } from '../evals/economic-applicability/cases.ts';
import type { ApplicabilityCase } from '../evals/economic-applicability/cases.ts';
import { queryFor, scoreCase, summarizeCases } from '../evals/economic-applicability/evaluate.ts';

function response(c: ApplicabilityCase, membership = 0.99, route = 'tests'): ProviderResult {
  const query = queryFor(c);
  return { model: MODEL, usage: { input_tokens: 100, output_tokens: 10 },
    answers: Object.fromEntries(Object.entries(query.questions).map(([id, q]) => {
      if (q.type === 'noul') return [id, { type: 'noul', noul: membership }];
      if (q.type === 'score') return [id, { type: 'score', score: 2, confidence: 1,
        probabilities: { 0: 0, 1: 0, 2: 1 }, legend: Object.fromEntries(q.criteria.map((s, i) => [i, s])) }];
      const choice = id === 'route' ? route : 'delegate' in q.criteria ? 'delegate' : 'insufficient';
      return [id, { type: 'choice', choice, confidence: 1,
        probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === choice ? 1 : 0])) }];
    })) };
}
const positive = applicabilityCases[0]!;

test('synthetic economic comparisons stay deterministic and block missing, unfavorable or invalid accounting', () => {
  for (const c of applicabilityCases) {
    assert.deepEqual(queryFor(c), queryFor(c));
    assert.ok(!('expectedDelegate' in (queryFor(c).state as object)));
    const a = caseInput(c).economics;
    if (c.category === 'invalid_accounting') {
      assert.equal(a.admissible, false, c.id);
      assert.equal(scoreCase(c, response(c)).challenger.economicDelegate, false, c.id);
    } else assert.equal(a.admissible, true, c.id);
  }
});

test('applicability uncertainty and capability rejection do not become initial-route delegation', () => {
  const uncertain = scoreCase(positive, response(positive, 0.84));
  assert.equal(uncertain.observedApplicability, 'uncertain');
  assert.equal(uncertain.challenger.economicDelegate, false);
  const native = scoreCase(positive, response(positive, 0.99, 'native'));
  assert.equal(native.challenger.economicDelegate, true);
  assert.equal(native.challenger.initialRouteDelegate, false);
  const irrelevantRaw = response(positive);
  irrelevantRaw.answers.evidence_0 = { type: 'score', score: 0, confidence: 1,
    probabilities: { 0: 1, 1: 0, 2: 0 }, legend: (irrelevantRaw.answers.evidence_0 as { legend: Record<string, string> }).legend };
  assert.equal(scoreCase(positive, irrelevantRaw).current.initialRouteDelegate, false);
});

test('economic false positives remain visible even if the capability gate rejects the task', () => {
  const c = applicabilityCases.find(c => c.id === 'currency-table-family')!;
  const row = scoreCase(c, response(c, 0.99, 'native'));
  const summary = summarizeCases([row], [c]);
  for (const variant of summary.variants) {
    assert.deepEqual(variant.unsafeEconomicDelegation, [c.id]);
    assert.deepEqual(variant.unsafeInitialRouteDelegation, []);
  }
});

test('partial, failed, duplicated, unexpected or relabeled results cannot masquerade as complete evidence', () => {
  const row = scoreCase(positive, response(positive));
  const partial = summarizeCases([row], applicabilityCases);
  assert.equal(partial.variants[0]!.complete, false);
  assert.equal(partial.missing.length, 15);
  const failed = summarizeCases([{ id: positive.id, failure: 'timeout' }], [positive]);
  assert.deepEqual(failed.usage, { knownInputTokens: 0, knownOutputTokens: 0, unknownCalls: 1 });
  assert.equal(failed.variants[0]!.complete, false);
  assert.throws(() => summarizeCases([row, row], [positive]), /duplicate_or_unexpected/);
  assert.throws(() => summarizeCases([{ ...row, id: 'unlisted' }], [positive]), /duplicate_or_unexpected/);
  assert.throws(() => summarizeCases([{ ...row, expectedDelegate: false }], [positive]), /mismatched_expected_label/);
  const all = applicabilityCases.map(c => scoreCase(c, response(c)));
  assert.equal(summarizeCases(all, applicabilityCases).variants[0]!.complete, true);
  assert.equal(summarizeCases(all, applicabilityCases).usage.knownInputTokens, 1600);
});
