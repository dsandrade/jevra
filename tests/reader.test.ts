import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { DecisionError, hash, MODEL } from '@jevra/core';
import type { ProviderRequest, ProviderResult } from '@jevra/core';
import { chunkDocument } from '@jevra/core/context';
import { focusedRead, resolveReaderCitations } from '../packages/core/src/reader.ts';
import type { ReaderAnswer, ReaderOptions, ReaderReceipt } from '../packages/core/src/reader.ts';
import { evidenceHash } from '@jevra/core/managed-worker';
import type { WorkerRequest, WorkerResult } from '@jevra/core/worker';
import { configSchema } from '../packages/cli/src/config.ts';
import { FocusedReaderSession } from '../packages/cli/src/reader-session.ts';
import { CodexCliWorker } from '../packages/cli/src/codex-worker.ts';
import { createMcpServer } from '../packages/cli/src/mcp.ts';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
const passages = chunkDocument('rules.md', 'PRIVATE_SOURCE\nRetries reject nonintegers.\n');
const answer: ReaderAnswer = { status: 'answered', claims: [{ text: 'Retries reject nonintegers.',
  citations: [{ id: passages[0]!.id, quote: 'Retries reject nonintegers.' }] }], gaps: [] };
function response(q: ProviderRequest): ProviderResult {
  return { model: MODEL, usage: { input_tokens: 100, output_tokens: 12 }, answers: Object.fromEntries(Object.entries(q.questions).map(([id, v]) => {
    if (v.type === 'noul') return [id, { type: 'noul', noul: 0.99 }];
    if (v.type === 'score') return [id, { type: 'score', score: 3, confidence: 1,
      probabilities: { 0: 0, 1: 0, 2: 0, 3: 1 }, legend: Object.fromEntries(v.criteria.map((t, i) => [i, t])) }];
    const choice = id === 'route' ? 'reader' : id === 'continuation' ? 'answer' : 'supported';
    return [id, { type: 'choice', choice, confidence: 1,
      probabilities: Object.fromEntries(Object.keys(v.criteria).map(k => [k, k === choice ? 1 : 0])) }];
  })) };
}
function generated(q: WorkerRequest, content = JSON.stringify(answer)): WorkerResult {
  return { status: 'generated', candidate: { content, sha256: evidenceHash(content), bytes: Buffer.byteLength(content) },
    receipt: { schemaVersion: 1, transport: 'codex-cli', requestHash: hash(q), operationHash: hash(q.operationId),
      attempt: 1, profile: q.profile, configuredModel: 'gpt-5.6-luna', configuredEffort: 'low', isolationProfile: 'codex-generator/1',
      observedModel: null, cliVersion: 'synthetic', authentication: 'chatgpt', inputBytes: 100, stdoutBytes: 100,
      stderrBytes: 0, generationInvocations: 1, observedToolItems: 0, usage: { inputTokens: 500, cachedInputTokens: 20, outputTokens: 30 },
      usageComplete: true, durationMs: 1, exitCode: 0, cleanupComplete: true, actualBilledUsd: null, subscriptionUsage: null } };
}
function fixture(overrides: Partial<ReaderOptions> = {}, mutate?: (r: ProviderResult, q: ProviderRequest, call: number) => void) {
  const calls: ProviderRequest[] = [], packets: WorkerRequest[] = [], journals: ReaderReceipt[] = [];
  const options: ReaderOptions = { operationId: 'reader-one', query: 'What rejects noninteger retries?', passages,
    scopeHash: hash('scope'), currentPassages: async () => passages, persist: async r => { journals.push(r); },
    provider: { async evaluate(q) { calls.push(q); const r = response(q); mutate?.(r, q, calls.length); return r; } },
    worker: { async generate(q) { packets.push(q); return generated(q); } }, ...overrides };
  return { options, calls, packets, journals, run: () => focusedRead(options) };
}
function choose(r: ProviderResult, id: string, choice: string) {
  const a = r.answers[id]; if (a?.type !== 'choice') throw new Error('wrong_answer_type');
  a.choice = choice; for (const k of Object.keys(a.probabilities)) a.probabilities[k] = k === choice ? 1 : 0;
}
test('full reader uses two Jev calls and one fresh generator, journals reservations before spending and returns runtime line numbers', async () => {
  const f = fixture(); const result = await f.run();
  assert.equal(result.result.reason, 'answered'); assert.equal(f.calls.length, 2); assert.equal(f.packets.length, 1);
  assert.equal(f.packets[0]!.profile, 'context-reader/1');
  assert.equal(JSON.parse(result.text).claims[0].citations[0].startLine, 2);
  assert.ok(f.journals.some(j => j.decisions[0]?.status === 'started'));
  assert.ok(f.journals.some(j => j.generations[0]?.status === 'started'));
  assert.doesNotMatch(JSON.stringify(result.receipt), /PRIVATE_SOURCE|nonintegers|rules.md/);
});
test('selected reader assesses exactly the selected packet before generation and searches dropped passages for counterevidence', async () => {
  const more = [...passages, ...chunkDocument('conflict.md', 'Retries allow noninteger retries in compatibility mode.\n')];
  const f = fixture({ passages: more, currentPassages: async () => more, policy: { selection: 'jev', topK: 1 } }, (r, _q, call) => {
    if (call === 1) { const a = r.answers[more[1]!.id]; if (a?.type === 'score') {
      a.score = 0; a.probabilities = { 0: 1, 1: 0, 2: 0, 3: 0 };
    } }
  });
  const result = await f.run(); assert.equal(result.result.reason, 'answered'); assert.equal(f.calls.length, 3);
  assert.equal(result.receipt.selectedPassages, 1); assert.equal(result.receipt.reviewedPassages, 2);
  const selected = (f.calls[1]!.state as { passages: unknown }).passages;
  assert.deepEqual(JSON.parse(f.packets[0]!.evidence[0]!.content), selected);
});
test('native/uncertain route, exhausted budgets and missing selected-packet support do not invoke Luna', async () => {
  for (const choice of ['native', 'abstain']) {
    const f = fixture({}, (r, _q, call) => { if (call === 1) choose(r, 'route', choice); });
    assert.equal((await f.run()).text, ''); assert.equal(f.packets.length, 0);
  }
  const capped = fixture({ policy: { maxJevCalls: 1 } });
  assert.equal((await capped.run()).result.reason, 'budget_exceeded'); assert.equal(capped.packets.length, 0);
  const insufficient = fixture({ policy: { selection: 'jev' } }, (r, _q, call) => {
    if (call === 2) r.answers.sufficient = { type: 'noul', noul: 0.5 };
  }); assert.equal((await insufficient.run()).text, ''); assert.equal(insufficient.packets.length, 0);
});
test('invented citations, altered quotes, empty/no-answer and malformed output cannot reach semantic review or leak content', async () => {
  const bad = [JSON.stringify({ ...answer, claims: [{ ...answer.claims[0], citations: [{ id: 'invented', quote: 'PRIVATE_LIE' }] }] }),
    JSON.stringify({ ...answer, claims: [{ ...answer.claims[0], citations: [{ id: passages[0]!.id, quote: 'PRIVATE_LIE' }] }] }),
    JSON.stringify({ status: 'answered', claims: [], gaps: [] }),
    JSON.stringify({ status: 'insufficient', claims: [], gaps: ['Missing evidence.'] }), '', 'PRIVATE_MALFORMED'];
  for (const content of bad) {
    const f = fixture({ worker: { async generate(q) { return generated(q, content); } } });
    const r = await f.run(); assert.equal(r.text, ''); assert.equal(f.calls.length, 1);
    assert.doesNotMatch(JSON.stringify(r.receipt), /PRIVATE_LIE|PRIVATE_MALFORMED/);
  }
});
test('contradictions, omissions and uncertain support cannot become a delivered answer', async () => {
  for (const id of ['claim_0', 'coverage', 'continuation']) {
    const f = fixture({}, (r, _q, call) => { if (call === 2) {
      if (id === 'coverage') r.answers.coverage = { type: 'noul', noul: 0.5 };
      else choose(r, id, id === 'claim_0' ? 'contradicted' : 'native');
    } }); assert.equal((await f.run()).text, ''); assert.equal(f.calls.length, 2);
  }
});
test('source changes and foreign/tool/auth/cleanup receipts block review while preserving known incurred usage', async () => {
  let changed = false;
  const stale = fixture({ currentPassages: async () => changed ? [] : passages,
    worker: { async generate(q) { changed = true; return generated(q); } } });
  const r = await stale.run(); assert.equal(r.result.reason, 'stale_state');
  assert.equal(r.receipt.generations[0]!.receipt!.usage!.inputTokens, 500);
  for (const mutate of [
    (r: WorkerResult) => { r.receipt.requestHash = hash('foreign'); },
    (r: WorkerResult) => { r.receipt.observedToolItems = 1; },
    (r: WorkerResult) => { r.receipt.authentication = 'unknown'; },
    (r: WorkerResult) => { r.receipt.cleanupComplete = false; },
  ]) {
    const f = fixture({ worker: { async generate(q) { const r = generated(q); mutate(r); return r; } } });
    assert.equal((await f.run()).result.reason, 'invalid_response'); assert.equal(f.calls.length, 1);
  }
});
test('failed judgments preserve malformed-response usage and never switch the decision provider', async () => {
  const f = fixture({ provider: { async evaluate() { return { model: 'wrong', usage: { input_tokens: 70, output_tokens: 2 }, answers: {} }; } } });
  const r = await f.run(); assert.equal(r.text, ''); assert.equal(r.receipt.decisions[0]!.usage!.input_tokens, 70);
  assert.equal(r.receipt.decisions[0]!.status, 'failed'); assert.equal(f.packets.length, 0);
});
test('cancellation waits for bounded CLI cleanup and retains returned usage without reviewing', async () => {
  const controller = new AbortController();
  const f = fixture({ signal: controller.signal, worker: { async generate(q, signal) {
    controller.abort(); await new Promise(r => setTimeout(r, 20)); assert.ok(signal!.aborted); return generated(q);
  } } });
  const r = await f.run(); assert.equal(r.result.reason, 'cancelled'); assert.equal(r.text, '');
  assert.equal(r.receipt.generations[0]!.receipt!.usage!.inputTokens, 500); assert.equal(f.calls.length, 1);
});
test('source quote validation computes exact ranges and rejects unsupported IDs independently of a model', () => {
  assert.equal(resolveReaderCitations(answer, passages)[0]!.citations[0]!.endLine, 2);
  assert.throws(() => resolveReaderCitations({ ...answer, claims: [{ text: 'x', citations: [{ id: 'missing', quote: 'x' }] }] }, passages));
});
async function sessionFixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jevra-reader-'))); directories.push(root);
  await writeFile(join(root, 'rules.md'), passages[0]!.text); await mkdir(join(root, 'skills'));
  const f = fixture();
  const config = configSchema.parse({ version: 1, mode: 'advise', skillRoots: [join(root, 'skills')], traces: false,
    stateDirectory: join(root, 'state'), bulkRead: { roots: [root], backend: 'deterministic', reader: {
      enabled: true, experimentalProfile: 'focused-reader/1', codexExecutable: '/fixture/codex' } } });
  const { roots: _roots, minLines: _lines, transport: _transport, reader: _reader, ...base } = config.bulkRead!;
  return { root, config, context: { ...base, sources: [join(root, 'rules.md')] }, f };
}
test('reader session joins identical concurrent calls and persists metadata; new queries/source changes cannot buy more slots', async () => {
  const { root, config, context, f } = await sessionFixture();
  const s = new FocusedReaderSession(config, f.options.provider, f.options.worker);
  const results = await Promise.all([s.read('retry rules', context, root, 'caller'), s.read('retry rules', context, root, 'caller')]);
  assert.equal(results[0]!.text, results[1]!.text); assert.equal(f.packets.length, 1);
  await assert.rejects(s.read('another question', context, root, 'caller'), /budget_exceeded/);
  await writeFile(join(root, 'rules.md'), 'changed');
  await assert.rejects(s.read('retry rules', context, root, 'caller'), /budget_exceeded/);
  const directory = (await readdir(join(root, 'state/readers')))[0]!;
  const file = (await readdir(join(root, 'state/readers', directory))).find(x => x.endsWith('.json'))!;
  assert.doesNotMatch(await readFile(join(root, 'state/readers', directory, file), 'utf8'), /PRIVATE_SOURCE|rules.md/);
});
test('MCP composes the actual bounded CLI parser with reader validation, while code_context remains evidence-only', async () => {
  const { root, config, f } = await sessionFixture();
  const worker = new CodexCliWorker({ executable: process.execPath, executableArgs: [resolve('tests/fixtures/codex-worker.mjs'), 'reader', join(root, 'calls.jsonl')],
    temporaryDirectory: root, limits: { timeoutMs: 4000 } });
  const server = createMcpServer(config, 'codex', f.options.provider, root, worker);
  const client = new Client({ name: 'reader-test', version: '1' }); const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(b); await client.connect(a);
    const context = await client.callTool({ name: 'code_context', arguments: { spec: 'noninteger retries', references: ['rules.md'] } });
    assert.match(JSON.stringify(context.content), /PRIVATE_SOURCE/); assert.equal(f.calls.length, 0);
    const result = await client.callTool({ name: 'bulk_read', arguments: { question: 'retry rules', paths: ['rules.md'] } });
    assert.notEqual(result.isError, true);
    assert.match(JSON.stringify(result.content), /answered/); assert.equal(f.calls.length, 2);
    const forbidden = await client.callTool({ name: 'bulk_read', arguments: { question: 'x', paths: ['../outside.md'] } });
    assert.equal(forbidden.isError, true);
  } finally { await client.close(); await server.close(); }
});
test('oversized worker/review/output budgets fail closed and cannot expose an unreviewed answer', async () => {
  const input = fixture({ policy: { maxWorkerBytes: 1024 } });
  assert.equal((await input.run()).result.reason, 'budget_exceeded'); assert.equal(input.packets.length, 0);
  const output = fixture({ worker: { async generate(q) { return generated(q, 'x'.repeat(8001)); } } });
  assert.equal((await output.run()).text, ''); assert.equal(output.calls.length, 1);
  const review = fixture({ policy: { maxJevRequestBytes: 1024 }, query: 'retry' });
  assert.equal((await review.run()).text, '');
});
test('operation timeout cannot accept a non-cooperative late judgment or mutate the returned journal', async () => {
  const f = fixture({ policy: { operationTimeoutMs: 10 }, provider: { async evaluate(q) {
    await new Promise(r => setTimeout(r, 30)); return response(q);
  } } });
  const r = await f.run(); assert.equal(r.result.reason, 'timeout'); assert.equal(f.packets.length, 0);
  const snapshot = JSON.stringify(r.receipt); await new Promise(r => setTimeout(r, 40));
  assert.equal(JSON.stringify(r.receipt), snapshot); assert.equal(r.receipt.decisions[0]!.usage, null);
});
