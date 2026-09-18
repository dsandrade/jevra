import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claudeUsage, codexUsage, jevUsage, reconcileInvocations } from '../packages/core/src/accounting.ts';
import type { Invocation, Reservation } from '../packages/core/src/accounting.ts';

test('provider accounting counts cached input exactly once and preserves absent fields as unknown', () => {
  assert.equal(codexUsage({ inputTokens: 100, outputTokens: 10, cachedInputTokens: 60 })!.input, 100);
  assert.equal(claudeUsage({ input_tokens: 10, output_tokens: 3, cache_read_input_tokens: 60, cache_creation_input_tokens: 30 })!.input, 100);
  assert.equal(claudeUsage({ input_tokens: 10, output_tokens: 3 })!.input, null);
  assert.equal(jevUsage({ input_tokens: 20, output_tokens: 4 })!.cacheRead, null);
});
test('failed hook usage and native recovery count; missing/started hooks cannot be counted as zero', () => {
  const reservations: Reservation[] = [{ id: 'p', component: 'parent' }, { id: 'hook', component: 'routing_hook' }, { id: 'recovery', component: 'parent' }];
  const journals: Invocation[] = [
    { id: 'p', component: 'parent', status: 'completed', usage: codexUsage({ inputTokens: 100, outputTokens: 10, cachedInputTokens: 0 }) },
    { id: 'hook', component: 'routing_hook', status: 'failed', usage: jevUsage({ input_tokens: 20, output_tokens: 4 }) },
    { id: 'recovery', component: 'parent', status: 'completed', usage: codexUsage({ inputTokens: 30, outputTokens: 5, cachedInputTokens: 0 }) },
  ];
  const complete = reconcileInvocations(reservations, journals); assert.equal(complete.totalTokens, 169);
  assert.equal(reconcileInvocations(reservations, journals.slice(0, 1)).complete, false);
  assert.equal(reconcileInvocations(reservations, journals, ['routing_hook']).complete, false);
  assert.throws(() => reconcileInvocations(reservations, [...journals, journals[0]!]));
  assert.throws(() => reconcileInvocations(reservations, [...journals, { ...journals[0]!, id: 'hidden' }]));
});
test('partially observed worker usage remains a known subtotal with incomplete total accounting', () => {
  const reservations: Reservation[] = [{ id: 'p', component: 'parent' }, { id: 'w', component: 'worker' }];
  const r = reconcileInvocations(reservations, [
    { id: 'p', component: 'parent', status: 'completed', usage: codexUsage({ inputTokens: 100, outputTokens: 10, cachedInputTokens: 0 }) },
    { id: 'w', component: 'worker', status: 'failed', usageComplete: false, usage: codexUsage({ inputTokens: 50, outputTokens: 3, cachedInputTokens: 0 }) },
  ]); assert.equal(r.knownInput, 150); assert.equal(r.totalTokens, null);
});
