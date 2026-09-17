import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DecisionError, MODEL, skillQuestions } from '@jevra/core';
import { createTypeSafeProvider } from '@jevra/provider-typesafe';
import { event, response, skills } from './helpers.ts';

test('official SDK uses the pinned endpoint and passes the signal, request, and authorization', async () => {
  const request = skillQuestions(event.prompt, skills, MODEL);
  let calls = 0;
  const provider = createTypeSafeProvider({ getApiKey: async () => 'synthetic-key', fetch: async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://api.typesafe.ai/v1/systemone');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-key');
    assert.deepEqual(JSON.parse(String(init?.body)), request);
    assert.ok(init?.signal);
    return new Response(JSON.stringify(response(request)), { headers: { 'content-type': 'application/json' } });
  } });
  const result = await provider.evaluate(request, new AbortController().signal);
  assert.deepEqual(result, response(request));
  assert.equal(calls, 1);
});

test('missing credentials never start a network request', async () => {
  const provider = createTypeSafeProvider({ getApiKey: async () => undefined, fetch: async () => { throw new Error('network used'); } });
  await assert.rejects(provider.evaluate(skillQuestions(event.prompt, skills, MODEL), new AbortController().signal),
    (error: unknown) => error instanceof DecisionError && error.code === 'missing_credentials');
});

for (const [status, expected] of [[401, 'authentication'], [422, 'invalid_request'], [429, 'rate_limited'], [529, 'overloaded']] as const) {
  test(`HTTP ${status} is sanitized and does not trigger an implicit SDK retry`, async () => {
    let calls = 0;
    const provider = createTypeSafeProvider({ getApiKey: async () => 'synthetic-key', fetch: async () => {
      calls++;
      return new Response(JSON.stringify({ message: 'PRIVATE_MARKER' }), { status, headers: { 'retry-after': '60' } });
    } });
    await assert.rejects(provider.evaluate(skillQuestions(event.prompt, skills, MODEL), new AbortController().signal),
      (error: unknown) => error instanceof DecisionError && error.code === expected && !error.message.includes('PRIVATE_MARKER'));
    assert.equal(calls, 1);
  });
}
