import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODEL } from '@jevra/core';
import type { ProviderResult } from '@jevra/core';
import { applicabilityCases } from '../evals/economic-applicability/cases.ts';
import { queryFor, scoreCase, summarizeCases } from '../evals/economic-applicability-v2/evaluate.ts';
const c = applicabilityCases[0]!;
function raw(): ProviderResult {
  const q = queryFor(c)!;
  return { model: MODEL, usage: { input_tokens: 12, output_tokens: 6 }, answers: Object.fromEntries(Object.entries(q.questions).map(([id, v]) => {
    if (v.type === 'noul') return [id, { type: 'noul', noul: 0.99 }];
    if (v.type === 'score') return [id, { type: 'score', score: 1.5, confidence: 0.9,
      probabilities: { 0: 0, 1: 0.5, 2: 0.5 }, legend: Object.fromEntries(v.criteria.map((t, i) => [i, t])) }];
    return [id, { type: 'choice', choice: 'tests', confidence: 0.9, probabilities: { tests: 0.9, native: 0.05, abstain: 0.05 } }];
  })) };
}
test('v2 uses the production fractional Score boundary and preserves every typed answer', () => {
  const r = scoreCase(c, raw()); assert.equal(r.initialRouteDelegate, true);
  assert.deepEqual(r.answers, raw().answers); assert.equal(r.answers.evidence_0?.type, 'score');
  const low = raw(); if (low.answers.evidence_0?.type === 'score') {
    low.answers.evidence_0.score = 1.49; low.answers.evidence_0.probabilities = { 0: 0, 1: 0.51, 2: 0.49 };
  }
  assert.equal(scoreCase(c, low).initialRouteDelegate, false);
});
test('v2 rejects malformed answers and missing/duplicate results cannot become a complete measurement', () => {
  const malformed = raw(); delete malformed.answers.evidence_0; assert.throws(() => scoreCase(c, malformed));
  const r = scoreCase(c, raw()); assert.throws(() => summarizeCases([r, r], [c]));
  const failed = summarizeCases([{ id: c.id, failure: 'invalid_response', usage: { input_tokens: 123, output_tokens: 4 } }], [c]);
  assert.equal(failed.complete, false); assert.equal(failed.usage.knownInputTokens, 123);
  assert.equal(summarizeCases([], [c]).complete, false);
});
test('numerical ineligibility skips membership and cannot be overridden by semantic output', () => {
  for (const bad of applicabilityCases.filter(c => c.category === 'invalid_accounting')) {
    assert.equal(queryFor(bad), null);
    assert.equal(scoreCase(bad, null).invocations, 0);
  }
});
