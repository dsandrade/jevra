import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DecisionError, hash, hasExplicitReference, MODEL, selectSkill, skillQuestions, validateResult } from '@jevra/core';
import type { ProviderRequest } from '@jevra/core';
import { codexOutput, parseCodexEvent } from '@jevra/adapter-codex';
import { claudeOutput, parseClaudeEvent } from '@jevra/adapter-claude-code';
import { event, fakeProvider, response, skills } from './helpers.ts';

test('a valid bounded selection yields advice only in advise mode', async () => {
  const decision = await selectSkill({ event, skills, mode: 'observe', provider: fakeProvider() });
  assert.equal(decision.reasonCode, 'recommended');
  assert.equal(decision.selectedCandidateId, skills[0]!.id);
  assert.deepEqual(codexOutput(decision, 'observe', skills), {});
  assert.deepEqual(claudeOutput(decision, 'disabled', skills), {});
  for (const output of [codexOutput(decision, 'advise', skills), claudeOutput(decision, 'advise', skills)]) {
    assert.match(JSON.stringify(output), /UserPromptSubmit/);
    assert.match(JSON.stringify(output), /change-review/);
    assert.doesNotMatch(JSON.stringify(output), /permissionDecision/);
  }
});

test('disabled, empty catalog, and explicit references never call the provider', async () => {
  let calls = 0;
  const provider = { async evaluate() { calls++; throw new Error('unreachable'); } };
  assert.equal((await selectSkill({ event, skills, mode: 'disabled', provider })).reasonCode, 'disabled');
  assert.equal((await selectSkill({ event, skills: [], mode: 'advise', provider })).reasonCode, 'empty_catalog');
  for (const prompt of ['Use $change-review', 'Do not use change-review', 'Use /unknown-plugin:run']) {
    assert.equal((await selectSkill({ event: { ...event, prompt }, skills, mode: 'advise', provider })).reasonCode, 'explicit_skill_reference');
  }
  assert.equal(calls, 0);
  assert.equal(hasExplicitReference('Inspect this patch', skills), false);
});

test('no match, uncertain, and multi-skill judgments abstain', async () => {
  const noMatch = fakeProvider((_, req) => response(req, 'none'));
  const uncertain = fakeProvider(r => { if (r.answers.selection?.type === 'choice') r.answers.selection.confidence = 0.5; return r; });
  const multiple = fakeProvider(r => { r.answers.multiple = { type: 'noul', noul: 0.8 }; return r; });
  for (const [provider, reason] of [[noMatch, 'no_match'], [uncertain, 'uncertain'], [multiple, 'multiple_skills']] as const) {
    const result = await selectSkill({ event, skills, mode: 'advise', provider });
    assert.equal(result.reasonCode, reason);
    assert.equal(result.selectedCandidateId, null);
  }
});

test('malformed distributions and omitted answers cannot produce recommendations', async () => {
  for (const mutate of [
    (r: ReturnType<typeof response>) => { delete r.answers.multiple; return r; },
    (r: ReturnType<typeof response>) => { if (r.answers.selection?.type === 'choice') r.answers.selection.choice = 'invented'; return r; },
    (r: ReturnType<typeof response>) => { if (r.answers.selection?.type === 'choice') r.answers.selection.probabilities.none = 0.9; return r; },
    (r: ReturnType<typeof response>) => { r.model = 'different-model'; return r; },
  ]) {
    assert.equal((await selectSkill({ event, skills, mode: 'advise', provider: fakeProvider(mutate) })).reasonCode, 'invalid_response');
  }
});

test('deadline terminates a provider that ignores cancellation', async () => {
  const start = performance.now();
  const result = await selectSkill({ event, skills, mode: 'advise', timeoutMs: 25,
    provider: { evaluate: () => new Promise(() => {}) } });
  assert.equal(result.reasonCode, 'timeout');
  assert.ok(performance.now() - start < 500);
});

test('cancellation aborts an in-flight provider and stale state suppresses advice', async () => {
  const controller = new AbortController();
  const resultPromise = selectSkill({ event, skills, mode: 'advise', signal: controller.signal,
    provider: { evaluate: () => new Promise(() => {}) } });
  controller.abort();
  assert.equal((await resultPromise).reasonCode, 'cancelled');
  const stale = await selectSkill({ event, skills, mode: 'advise', provider: fakeProvider(), currentRevision: async () => 'changed' });
  assert.equal(stale.reasonCode, 'stale_state');
  assert.deepEqual(stale.usage, { input_tokens: 200, output_tokens: 30 });
});

test('request-size budget and duplicate candidates fail before inference', async () => {
  const provider = { async evaluate() { throw new Error('must not execute'); } };
  const oversized = await selectSkill({ event, skills, mode: 'advise', provider, maxRequestBytes: 10 });
  assert.equal(oversized.reasonCode, 'budget_exceeded');
  assert.equal(oversized.requests, 0);
  assert.equal((await selectSkill({ event, skills: [skills[0]!, skills[0]!], mode: 'advise', provider })).reasonCode, 'catalog_unavailable');
});

test('provider failures remain sanitized and concurrent sessions remain separate', async () => {
  const first = selectSkill({ event, skills, mode: 'advise', provider: fakeProvider() });
  const second = selectSkill({ event: { ...event, sessionId: 'other', prompt: 'Create tests for this module' }, skills, mode: 'advise',
    provider: fakeProvider((_, req) => response(req, skills[1]!.id)) });
  const results = await Promise.all([first, second]);
  assert.equal(results[0].selectedCandidateId, skills[0]!.id);
  assert.equal(results[1].selectedCandidateId, skills[1]!.id);
  assert.notEqual(results[0].stateRevision, results[1].stateRevision);
  const failed = await selectSkill({ event, skills, mode: 'observe', provider: {
    async evaluate() { throw new Error('PRIVATE_SECRET_MARKER'); },
  } });
  assert.equal(failed.reasonCode, 'provider_error');
  assert.doesNotMatch(JSON.stringify(failed), /PRIVATE_SECRET_MARKER/);
});

test('provider validation supports Noul and Score without fabricating confidence', () => {
  const request: ProviderRequest = { model: MODEL, state: 'sample', questions: {
    present: { type: 'noul' as const, instructions: 'Is the item present?' },
    rank: { type: 'score' as const, instructions: 'How relevant?', criteria: ['Unrelated', 'Relevant'] },
  } };
  const value = { model: MODEL, answers: { present: { type: 'noul', noul: 0.9 },
    rank: { type: 'score', score: 0.8, confidence: 0.7, probabilities: { 0: 0.2, 1: 0.8 }, legend: { 0: 'Unrelated', 1: 'Relevant' } },
  }, usage: { input_tokens: 10, output_tokens: 2 } };
  assert.equal('confidence' in validateResult(value, request).answers.present!, false);
  value.answers.rank.score = 1.5;
  assert.throws(() => validateResult(value, request), DecisionError);
});

test('provider state excludes local paths and preserves stable semantic question versions', () => {
  const request = skillQuestions(event.prompt, skills, MODEL);
  assert.doesNotMatch(JSON.stringify(request), /\/synthetic\//);
  assert.equal(hash({ a: 1, b: 2 }), hash({ b: 2, a: 1 }));
});

test('host adapters validate events and do not invent a stable Claude turn identifier', () => {
  const payload = { hook_event_name: 'UserPromptSubmit', session_id: 's', cwd: '/tmp', prompt: 'hello', turn_id: 't' };
  assert.equal(parseCodexEvent(payload).eventId, 't');
  const a = parseClaudeEvent(payload);
  const b = parseClaudeEvent(payload);
  assert.equal(a.turnId, null);
  assert.notEqual(a.eventId, b.eventId);
  assert.throws(() => parseCodexEvent({ ...payload, cwd: 'relative' }), DecisionError);
  assert.throws(() => parseClaudeEvent({ ...payload, hook_event_name: 'PreToolUse' }), DecisionError);
});

// Sanitized live Score response: rounded score 2.67 and rounded mass imply 2.68.
test('rounded provider probabilities and Score values remain valid without accepting incoherent scores', () => {
  const criteria = ['Unrelated', 'Related but not useful', 'Useful facts', 'Essential rules'] as [string, string, ...string[]];
  const request = { model: MODEL, state: {}, questions: { relevance: { type: 'score' as const, instructions: 'Relevance?', criteria } } };
  const value = { model: MODEL, usage: { input_tokens: 340, output_tokens: 19 }, answers: { relevance: {
    type: 'score', score: 2.67, confidence: 0.67, legend: Object.fromEntries(criteria.map((c, i) => [String(i), c])),
    probabilities: { '0': 0, '1': 0, '2': 0.32, '3': 0.68 },
  } } };
  assert.doesNotThrow(() => validateResult(value, request));
  value.answers.relevance.score = 2.2;
  assert.throws(() => validateResult(value, request), /invalid_response/);
  value.answers.relevance.score = 2.67;
  value.answers.relevance.probabilities['1'] = 0.15;
  assert.throws(() => validateResult(value, request), /invalid_response/);
});
