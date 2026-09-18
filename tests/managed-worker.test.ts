import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DecisionError, hash, MODEL } from '@jevra/core';
import type { ProviderRequest, ProviderResult } from '@jevra/core';
import { createTypeSafeProvider } from '@jevra/provider-typesafe';
import { evidenceHash, ManagedTestOperation, sourceBinding } from '../packages/core/src/managed-worker.ts';
import type { ManagedTestOptions, ManagedTestRequest } from '../packages/core/src/managed-worker.ts';
import type { WorkerRequest, WorkerResult } from '../packages/core/src/worker.ts';
import { CodexCliWorker } from '../packages/cli/src/codex-worker.ts';
import { economicConfigSchema } from '../packages/core/src/economics.ts';
import { calibration } from './fixtures/economic-calibration.ts';

function input(): ManagedTestRequest {
  const content = 'PRIVATE_SOURCE: export function add(a: number, b: number) { return a + b; }';
  return { schemaVersion: 1, operationId: 'PRIVATE_OPERATION', scopeHash: hash('scope'), stateRevision: hash('revision'),
    preference: 'managed', task: 'PRIVATE_TASK: add tests for add', instructions: ['PRIVATE_INSTRUCTION: use node:test'],
    requirements: ['PRIVATE_REQUIREMENT: assert that add(1, 2) equals 3'],
    evidence: [{ id: 'PRIVATE_SOURCE_ID', sourceHash: evidenceHash(content), content }] };
}
function response(request: ProviderRequest): ProviderResult {
  return { model: MODEL, usage: { input_tokens: 100, output_tokens: 20 },
    answers: Object.fromEntries(Object.entries(request.questions).map(([id, question]) => {
      if (question.type === 'noul') return [id, { type: 'noul', noul: 0.99 }];
      if (question.type === 'score') return [id, { type: 'score', score: 2, confidence: 1,
        probabilities: { 0: 0, 1: 0, 2: 1 }, legend: Object.fromEntries(question.criteria.map((v, i) => [i, v])) }];
      const choice = id === 'route' ? 'tests' : id === 'economic_route'
        ? 'delegate' in question.criteria ? 'delegate' : 'insufficient' : id === 'continuation' ? 'validate' : 'supported';
      return [id, { type: 'choice', choice, confidence: 1,
        probabilities: Object.fromEntries(Object.keys(question.criteria).map(k => [k, k === choice ? 1 : 0])) }];
    })) };
}
function choose(result: ProviderResult, id: string, choice: string, confidence = 1) {
  const answer = result.answers[id];
  assert.equal(answer?.type, 'choice');
  if (answer?.type !== 'choice') return;
  answer.choice = choice;
  answer.confidence = confidence;
  for (const key of Object.keys(answer.probabilities)) answer.probabilities[key] = key === choice ? 1 : 0;
}
function generated(request: WorkerRequest): WorkerResult {
  const content = 'PRIVATE_CANDIDATE: assert.equal(add(1, 2), 3);';
  return { status: 'generated', candidate: { content, sha256: evidenceHash(content), bytes: Buffer.byteLength(content) },
    receipt: { schemaVersion: 1, transport: 'codex-cli', requestHash: hash(request), operationHash: hash(request.operationId),
      attempt: request.attempt, profile: request.profile, configuredModel: 'gpt-5.6-luna', configuredEffort: 'low',
      observedModel: null, isolationProfile: 'codex-generator/1', cliVersion: 'synthetic', authentication: 'chatgpt',
      inputBytes: 100, stdoutBytes: 100, stderrBytes: 0, generationInvocations: 1, observedToolItems: 0,
      usage: { inputTokens: 1000, cachedInputTokens: 100, outputTokens: 50 }, usageComplete: true,
      durationMs: 1, exitCode: 0, cleanupComplete: true, actualBilledUsd: null, subscriptionUsage: null } };
}
function fixture(overrides: Partial<ManagedTestOptions> = {},
  mutate?: (result: ProviderResult, request: ProviderRequest, call: number) => void) {
  const request = overrides.request ?? input();
  const calls: ProviderRequest[] = [], packets: WorkerRequest[] = [];
  const operation = new ManagedTestOperation({ request,
    provider: { async evaluate(req) { calls.push(req); const r = response(req); mutate?.(r, req, calls.length); return r; } },
    worker: { async generate(packet) { packets.push(packet); return generated(packet); } },
    currentBinding: async () => sourceBinding(request), ...overrides });
  return { operation, calls, packets };
}

test('three Jev batches gate a single worker, returning an unaccepted candidate and private-body-free ledger', async () => {
  const { operation, calls, packets } = fixture();
  const result = await operation.run();
  assert.equal(result.status, 'awaiting_validation');
  assert.equal(calls.length, 3);
  assert.equal(packets.length, 1);
  assert.equal(packets[0]?.profile, 'artifact-writer/tests');
  assert.equal(result.receipt.validation, 'not_run');
  assert.deepEqual(result.receipt.transitions.map(t => t.to),
    ['evidence_selected', 'generation_requested', 'awaiting_validation']);
  for (const transition of result.receipt.transitions) for (const id of transition.decisionReceiptIds) {
    assert.ok(result.receipt.decisions.some(d => d.id === id && d.status === 'validated'));
  }
  assert.deepEqual(result.receipt.usage.jev,
    { inputTokens: 300, cachedInputTokens: 0, outputTokens: 60, unknownUsageEntries: 0, unknownCacheEntries: 3 });
  assert.deepEqual(result.receipt.usage.worker,
    { inputTokens: 1000, cachedInputTokens: 100, outputTokens: 50, unknownUsageEntries: 0, unknownCacheEntries: 0 });
  assert.equal(result.receipt.usage.host, null);
  assert.equal(result.receipt.actualBilledUsd, null);
  assert.equal(result.receipt.subscriptionUsage, null);
  assert.doesNotMatch(JSON.stringify(result.receipt), /PRIVATE_/);
  assert.ok(Object.isFrozen(result.receipt));
});

test('concurrent and later run calls join one operation without another provider or worker invocation', async () => {
  const { operation, calls, packets } = fixture();
  const first = operation.run(), second = operation.run();
  assert.equal(first, second);
  assert.equal(await first, await second);
  assert.equal(await operation.run(), await first);
  assert.equal(calls.length, 3);
  assert.equal(packets.length, 1);
});

test('explicit native preference bypasses Jev even when source freshness cannot be obtained', async () => {
  const { operation, calls, packets } = fixture({ request: { ...input(), preference: 'native' },
    currentBinding: async () => { throw new Error('must not call'); } });
  const result = await operation.run();
  assert.equal(result.reason, 'native_requested');
  assert.equal(result.receipt.transitions[0]?.mode, 'native_bypass');
  assert.equal(calls.length + packets.length, 0);
});

test('economic decision shares the first Jev batch, stays out of worker packets and persists only nonprivate evidence', async () => {
  const config = calibration();
  const f = fixture({ economics: { config, context: { host: 'codex', delivery: 'native-ticket' } } });
  config.calibration!.pairs[0]!.managed.parent = null; // Constructor must snapshot trusted settings.
  const result = await f.operation.run();
  assert.equal(result.status, 'awaiting_validation'); assert.equal(f.calls.length, 3);
  assert.ok('economic_route' in f.calls[0]!.questions);
  assert.equal(result.receipt.economics?.judgment, 'delegate');
  assert.equal(result.receipt.economics?.applied, true);
  assert.equal(result.receipt.economics?.conservativeSavingsFraction, 0.43);
  assert.doesNotMatch(JSON.stringify(result.receipt), /PRIVATE_/);
  assert.ok(!('economics' in f.packets[0]!));
  assert.ok(!('economics' in (f.calls[1]!.state as object)));
});

test('economic native, insufficient and uncertain choices stop before sufficiency and generation with attributable receipts', async () => {
  for (const [choice, confidence, reason] of [['native', 1, 'economic_native_selected'],
    ['insufficient', 1, 'economic_evidence_insufficient'], ['delegate', 0.4, 'economic_uncertain']] as const) {
    const f = fixture({ economics: { config: calibration(), context: { host: 'codex', delivery: 'native-ticket' } } },
      (r, _request, call) => { if (call === 1) choose(r, 'economic_route', choice, confidence); });
    const result = await f.operation.run();
    assert.equal(result.reason, reason); assert.equal(result.status, 'native_handoff');
    assert.equal(f.calls.length, 1); assert.equal(f.packets.length, 0);
    assert.equal(result.receipt.transitions[0]!.mode, 'managed');
    assert.equal(result.receipt.usage.jev.inputTokens, 100);
  }
});

test('missing measurements remove the delegate option; observe mode records the judgment without changing capability routing', async () => {
  for (const mode of ['observe', 'enforce'] as const) {
    const config = calibration(); config.mode = mode; delete config.calibration;
    const f = fixture({ economics: { config, context: { host: 'codex', delivery: 'native-ticket' } } });
    const result = await f.operation.run();
    assert.equal(result.receipt.economics?.judgment, 'insufficient');
    assert.equal(f.packets.length, mode === 'observe' ? 1 : 0);
    assert.equal(result.reason, mode === 'observe' ? 'awaiting_validation' : 'economic_evidence_insufficient');
  }
});

test('economic options cannot be forged by a model or spend past an explicit question budget', async () => {
  const config = calibration(); delete config.calibration;
  const bad = fixture({ economics: { config, context: { host: 'codex', delivery: 'native-ticket' } } },
    (r, _request, call) => { if (call === 1) choose(r, 'economic_route', 'delegate'); });
  assert.equal((await bad.operation.run()).reason, 'invalid_response'); assert.equal(bad.packets.length, 0);
  const capped = fixture({ economics: { config: calibration(), context: { host: 'codex', delivery: 'native-ticket' } },
    limits: { maxQuestions: 2 } });
  assert.equal((await capped.operation.run()).reason, 'budget_exceeded'); assert.equal(capped.calls.length, 0);
  assert.equal(economicConfigSchema.safeParse({ ...config, minPairs: 0 }).success, false);
});

test('economic calibration expiring during support blocks the worker; explicit native preference still costs no inference', async () => {
  const config = calibration(), expiresAt = config.calibration!.expiresAt;
  const realNow = Date.now;
  try {
    const f = fixture({ economics: { config, context: { host: 'codex', delivery: 'native-ticket' } } },
      (_r, _request, call) => { if (call === 2) Date.now = () => expiresAt; });
    assert.equal((await f.operation.run()).reason, 'stale_state'); assert.equal(f.packets.length, 0);
  } finally { Date.now = realNow; }
  const f = fixture({ request: { ...input(), preference: 'native' },
    economics: { config, context: { host: 'codex', delivery: 'native-ticket' } } });
  assert.equal((await f.operation.run()).reason, 'native_requested'); assert.equal(f.calls.length, 0);
});

for (const [choice, confidence, expected] of [['native', 1, 'native_selected'], ['abstain', 1, 'abstained'],
  ['tests', 0.4, 'uncertain']] as const) test(`route ${choice} at confidence ${confidence} does not generate`, async () => {
  const f = fixture({}, r => choose(r, 'route', choice, confidence));
  assert.equal((await f.operation.run()).reason, expected);
  assert.equal(f.calls.length, 1);
  assert.equal(f.packets.length, 0);
});

test('evidence selection shrinks the packet, then sufficiency sees only what the worker would receive', async () => {
  const request = input();
  request.evidence.push({ id: 'unrelated', content: 'unrelated content', sourceHash: evidenceHash('unrelated content') });
  const f = fixture({ request }, (r, _, call) => {
    if (call === 1) {
      const answer = r.answers.evidence_1;
      if (answer?.type === 'score') { answer.score = 0; answer.probabilities = { 0: 1, 1: 0, 2: 0 }; }
    }
  });
  assert.equal((await f.operation.run()).status, 'awaiting_validation');
  assert.equal((f.calls[0]?.state as { evidence: unknown[] }).evidence.length, 2);
  assert.equal((f.calls[1]?.state as { evidence: unknown[] }).evidence.length, 1);
  assert.equal(f.packets[0]?.evidence.length, 1);
  assert.deepEqual(f.packets[0]?.instructions, request.instructions);
  assert.deepEqual(f.packets[0]?.requirements, request.requirements);
});

test('missing, truncated or semantically insufficient evidence does not reach generation', async () => {
  for (const mode of ['empty', 'too-large', 'unsupported']) {
    const request = input();
    if (mode === 'empty') request.evidence = [];
    const f = fixture({ request, limits: mode === 'too-large' ? { maxEvidenceBytes: 1 } : {} }, (r, _, call) => {
      if (call === 2) r.answers.requirement_0 = { type: 'noul', noul: 0.5 };
    });
    assert.equal((await f.operation.run()).status, 'unresolved');
    assert.equal(f.packets.length, 0);
  }
});

test('candidate review cannot turn missing or contradictory assertions into trusted success', async () => {
  for (const choice of ['insufficient', 'contradicted']) {
    const f = fixture({}, (r, _, call) => { if (call === 3) choose(r, 'requirement_0', choice); });
    const result = await f.operation.run();
    assert.equal(result.reason, 'unsupported_candidate');
    assert.equal(result.candidate, undefined);
    assert.equal(result.receipt.validation, 'not_run');
    assert.equal(result.receipt.generations.length, 1);
  }
});

test('continuation can hand off or abstain without silently repairing', async () => {
  for (const choice of ['native', 'abstain']) {
    const f = fixture({}, (r, _, call) => { if (call === 3) choose(r, 'continuation', choice); });
    const result = await f.operation.run();
    assert.equal(result.reason, choice === 'native' ? 'native_selected' : 'abstained');
    assert.equal(f.packets.length, 1);
    assert.equal(result.candidate, undefined);
  }
});

test('scope, revision and deleted or changed sources invalidate in-flight decisions without hiding usage', async () => {
  for (const change of ['scopeHash', 'stateRevision', 'evidence', 'deleted'] as const) {
    const request = input();
    let changed = false;
    const f = fixture({ request, currentBinding: async () => {
      const binding = sourceBinding(request);
      if (changed) {
        if (change === 'evidence') binding.evidenceHashes.PRIVATE_SOURCE_ID = hash('changed');
        else if (change === 'deleted') delete binding.evidenceHashes.PRIVATE_SOURCE_ID;
        else binding[change] = hash('changed');
      }
      return binding;
    } }, () => { changed = true; });
    const result = await f.operation.run();
    assert.equal(result.reason, 'stale_state');
    assert.equal(result.receipt.decisions[0]?.status, 'stale');
    assert.equal(result.receipt.usage.jev.inputTokens, 100);
    assert.equal(f.packets.length, 0);
  }
});

test('a source change during generation prevents candidate review and retains worker usage', async () => {
  const request = input();
  let changed = false;
  const f = fixture({ request, worker: { async generate(packet) { changed = true; return generated(packet); } },
    currentBinding: async () => ({ ...sourceBinding(request), stateRevision: changed ? hash('changed') : request.stateRevision }) });
  const result = await f.operation.run();
  assert.equal(result.reason, 'stale_state');
  assert.equal(f.calls.length, 2);
  assert.equal(result.receipt.usage.worker.inputTokens, 1000);
});

test('invalid candidates, missing answers and mismatched models cannot create a receipt permitting generation', async () => {
  for (const mode of ['omitted', 'invented', 'model']) {
    const f = fixture({}, r => {
      if (mode === 'omitted') delete r.answers.route;
      else if (mode === 'invented') choose(r, 'route', 'run_arbitrary_command');
      else r.model = 'other-model';
    });
    const result = await f.operation.run();
    assert.equal(result.reason, 'invalid_response');
    assert.equal(result.receipt.usage.jev.inputTokens, 100);
    assert.equal(f.packets.length, 0);
  }
});

test('failed, missing-usage and timed-out Jev requests remain unknown and never switch judges', async () => {
  for (const mode of ['outage', 'missing-usage', 'timeout']) {
    const f = fixture({ limits: { decisionTimeoutMs: 20 }, provider: { async evaluate(req) {
      if (mode === 'outage') throw new DecisionError('overloaded');
      if (mode === 'timeout') return new Promise(() => {});
      return { ...response(req), usage: undefined };
    } } });
    const result = await f.operation.run();
    assert.equal(result.reason, mode === 'outage' ? 'overloaded' : mode === 'timeout' ? 'timeout' : 'invalid_response');
    assert.equal(result.receipt.usage.jev.unknownUsageEntries, 1);
    assert.equal(f.packets.length, 0);
  }
});

test('known call/question budget exhaustion is detected before paying for an unreviewable candidate', async () => {
  for (const limits of [{ maxJevCalls: 0 }, { maxJevCalls: 2 }, { maxQuestions: 3 },
    { maxTotalJevBytes: 256 }, { maxWorkerBytes: 256 }]) {
    const f = fixture({ limits });
    assert.equal((await f.operation.run()).reason, 'budget_exceeded');
    assert.equal(f.packets.length, 0);
  }
});

test('invalid evidence hashes, duplicate identities and extra receipt fields fail before inference', () => {
  for (const mode of ['hash', 'duplicate', 'forged']) {
    const request = input();
    if (mode === 'hash') request.evidence[0]!.sourceHash = hash('wrong');
    if (mode === 'duplicate') request.evidence.push(request.evidence[0]!);
    if (mode === 'forged') Object.assign(request, { decisions: [{ status: 'validated' }] });
    assert.throws(() => fixture({ request }), (e: unknown) => e instanceof DecisionError && e.code === 'input_invalid');
  }
});

test('cancellation and operation expiry stop a non-cooperative provider; returned ledger cannot change later', async () => {
  for (const mode of ['cancel', 'expire']) {
    const controller = new AbortController();
    let late: ((value: unknown) => void) | undefined;
    let captured: ProviderRequest | undefined;
    const f = fixture({ signal: controller.signal, limits: { operationTimeoutMs: 30 },
      provider: { evaluate(req) { captured = req; if (mode === 'cancel') setTimeout(() => controller.abort(), 5);
        return new Promise(resolve => { late = resolve; }); } } });
    const result = await f.operation.run();
    assert.equal(result.reason, mode === 'cancel' ? 'cancelled' : 'timeout');
    const before = JSON.stringify(result.receipt);
    late?.(response(captured!));
    await new Promise(r => setTimeout(r, 5));
    assert.equal(JSON.stringify(result.receipt), before);
    assert.equal(f.packets.length, 0);
  }
});

test('failed or unmetered workers preserve unknown usage, with no retry or semantic fallback', async () => {
  for (const mode of ['throw', 'missing-usage', 'failed']) {
    const f = fixture({ worker: { async generate(packet) {
      if (mode === 'throw') throw new Error('PRIVATE_EXCEPTION');
      const result = generated(packet);
      result.receipt.usage = null;
      result.receipt.usageComplete = false;
      return mode === 'failed' ? { status: 'failed', reason: 'rate_limited', receipt: result.receipt } : result;
    } } });
    const result = await f.operation.run();
    assert.equal(result.receipt.usage.worker.unknownUsageEntries, 1);
    assert.equal(result.receipt.generations.length, 1);
    assert.equal(result.status, mode === 'missing-usage' ? 'awaiting_validation' : 'unresolved');
    assert.doesNotMatch(JSON.stringify(result.receipt), /PRIVATE_/);
  }
});

test('worker output with foreign bindings, modified candidate, tool use or incomplete cleanup is rejected', async () => {
  for (const mode of ['binding', 'candidate', 'tool', 'cleanup']) {
    const f = fixture({ worker: { async generate(packet) {
      const result = generated(packet);
      if (mode === 'binding') result.receipt.requestHash = hash('different packet');
      if (mode === 'candidate' && result.status === 'generated') result.candidate.content += 'modified';
      if (mode === 'tool') result.receipt.observedToolItems = 1;
      if (mode === 'cleanup') result.receipt.cleanupComplete = false;
      return result;
    } } });
    const result = await f.operation.run();
    assert.equal(result.reason, 'invalid_response');
    if (mode === 'binding') {
      assert.equal(result.receipt.usage.worker.inputTokens, 0);
      assert.equal(result.receipt.usage.worker.unknownUsageEntries, 1);
    }
    assert.equal(f.calls.length, 2);
  }
});

test('pre-cancelled operations and oversized candidates cannot advance', async () => {
  const controller = new AbortController();
  controller.abort();
  const cancelled = fixture({ signal: controller.signal });
  assert.equal((await cancelled.operation.run()).reason, 'cancelled');
  assert.equal(cancelled.calls.length, 0);
  const oversized = fixture({ limits: { maxArtifactBytes: 1 } });
  const result = await oversized.operation.run();
  assert.equal(result.reason, 'budget_exceeded');
  assert.equal(oversized.calls.length, 2);
  assert.equal(result.receipt.usage.worker.inputTokens, 1000);
});

test('cancellation waits for bounded worker cleanup and retains returned usage without reviewing', async () => {
  const controller = new AbortController();
  let cleaned = false;
  const f = fixture({ signal: controller.signal, worker: { generate(packet, signal) {
    setTimeout(() => controller.abort(), 5);
    return new Promise(resolve => signal!.addEventListener('abort', () => {
      setTimeout(() => { cleaned = true;
        resolve({ status: 'failed', reason: 'cancelled', receipt: generated(packet).receipt });
      }, 15);
    }, { once: true }));
  } } });
  const result = await f.operation.run();
  assert.equal(cleaned, true);
  assert.equal(result.reason, 'cancelled');
  assert.equal(result.receipt.generations[0]?.cleanupComplete, true);
  assert.equal(result.receipt.usage.worker.inputTokens, 1000);
  assert.equal(f.calls.length, 2);
});

test('a non-cooperative worker cannot outlive the bounded cleanup observation in the managed caller', async () => {
  const f = fixture({ limits: { operationTimeoutMs: 30 }, worker: { generate: () => new Promise(() => {}) } });
  const started = performance.now();
  const result = await f.operation.run();
  assert.equal(result.reason, 'timeout');
  assert.equal(result.receipt.generations[0]?.cleanupComplete, null);
  assert.equal(result.receipt.usage.worker.unknownUsageEntries, 1);
  assert.ok(performance.now() - started < 2500);
});

test('constructor snapshots prevent later task or candidate-set mutations from changing an operation', async () => {
  const request = input();
  const binding = sourceBinding(request);
  const f = fixture({ request, currentBinding: async () => binding });
  request.task = 'changed task';
  request.evidence = [];
  assert.equal((await f.operation.run()).status, 'awaiting_validation');
  assert.notEqual(f.packets[0]?.task, request.task);
  assert.equal(f.packets[0]?.evidence.length, 1);
});

test('a source change during review blocks the final transition and still counts all usage', async () => {
  const request = input();
  let changed = false;
  const f = fixture({ currentBinding: async () => ({ ...sourceBinding(request),
    stateRevision: changed ? hash('changed') : request.stateRevision }) }, (_, __, call) => { if (call === 3) changed = true; });
  const result = await f.operation.run();
  assert.equal(result.reason, 'stale_state');
  assert.equal(result.candidate, undefined);
  assert.equal(result.receipt.decisions[2]?.status, 'stale');
  assert.equal(result.receipt.usage.jev.inputTokens, 300);
});

test('official SDK and real subprocess parser compose with managed receipts without network or credentials', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jevra-managed-test-'));
  let calls = 0;
  try {
    const provider = createTypeSafeProvider({ getApiKey: async () => 'synthetic-key', fetch: async (url, init) => {
      assert.equal(String(url), 'https://api.typesafe.ai/v1/systemone');
      calls++;
      return new Response(JSON.stringify(response(JSON.parse(String(init?.body)))),
        { headers: { 'content-type': 'application/json' } });
    } });
    const worker = new CodexCliWorker({ executable: process.execPath,
      executableArgs: [resolve('tests/fixtures/codex-worker.mjs'), 'ok', join(root, 'calls.jsonl')],
      temporaryDirectory: root, env: { PATH: process.env.PATH, HOME: root, CODEX_HOME: join(root, 'auth') } });
    const { operation } = fixture({ provider, worker });
    const result = await operation.run();
    assert.equal(result.status, 'awaiting_validation');
    assert.equal(calls, 3);
    assert.equal(result.receipt.generations[0]?.usage?.inputTokens, 125);
    assert.equal(result.receipt.generations[0]?.cleanupComplete, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('fixed mandatory evidence shares route and support, while generation receives the unchanged packet', async () => {
  const f = fixture({ packetMode: 'fixed' }); const result = await f.operation.run();
  assert.equal(result.status, 'awaiting_validation'); assert.equal(f.calls.length, 2);
  assert.equal(result.receipt.packetMode, 'fixed');
  assert.equal('evidence_0' in f.calls[0]!.questions, false);
  assert.equal(f.calls[0]!.questions.requirement_0?.type, 'noul');
  assert.deepEqual((f.calls[0]!.state as { evidence: unknown }).evidence, f.packets[0]!.evidence);
  assert.equal(result.receipt.decisions[0]!.stage, 'route_evidence_support');
  const blocked = fixture({ packetMode: 'fixed' }, (r, _q, call) => {
    if (call === 1) r.answers.requirement_0 = { type: 'noul', noul: 0.5 };
  });
  assert.equal((await blocked.operation.run()).reason, 'insufficient_evidence'); assert.equal(blocked.packets.length, 0);
  const oversized = fixture({ packetMode: 'fixed', limits: { maxEvidenceBytes: 1 } });
  assert.equal((await oversized.operation.run()).reason, 'budget_exceeded'); assert.equal(oversized.calls.length, 0);
});
test('membership economic routing sends no arithmetic to Jev and cannot override hard eligibility', async () => {
  for (const [probability, expected] of [[0.99, 'awaiting_validation'], [0.01, 'economic_native_selected'], [0.5, 'economic_uncertain']] as const) {
    const config = calibration(); delete config.questionProfile;
    const f = fixture({ packetMode: 'fixed', economics: { config, context: { host: 'codex', delivery: 'native-ticket' } } }, (r, q, call) => {
      if (call === 1) { assert.equal(q.questions.economic_route?.type, 'noul');
        assert.equal('economics' in (q.state as object), false); r.answers.economic_route = { type: 'noul', noul: probability }; }
    });
    assert.equal((await f.operation.run()).reason, expected);
    assert.equal(f.packets.length, probability === 0.99 ? 1 : 0);
  }
  const config = calibration(); delete config.questionProfile; config.calibration!.pairs[0]!.managed.jev = null;
  const f = fixture({ economics: { config, context: { host: 'codex', delivery: 'native-ticket' } } });
  assert.equal((await f.operation.run()).reason, 'economic_evidence_insufficient');
  assert.equal(f.calls.length, 0); assert.equal(f.packets.length, 0);
});
