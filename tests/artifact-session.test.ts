import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { DecisionError, hash, MODEL } from '@jevra/core';
import type { Provider, ProviderRequest, ProviderResult } from '@jevra/core';
import { evidenceHash } from '@jevra/core/managed-worker';
import type { WorkerRequest, WorkerResult, WorkerTransport } from '@jevra/core/worker';
import { configSchema } from '../packages/cli/src/config.ts';
import { ArtifactSession } from '../packages/cli/src/artifact-session.ts';
import { createMcpServer } from '../packages/cli/src/mcp.ts';
import { calibration } from './fixtures/economic-calibration.ts';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
const source = 'export function sum(a: number, b: number): number { return a + b; }\n';
const content = `import test from 'node:test';
import assert from 'node:assert/strict';
import { sum } from './sum.ts';
test('adds', () => { assert.equal(sum(2, 3), 5); });
`;
const request = { operationId: 'one', profileId: 'sum', task: 'Generate tests for sum.', requirements: [] };
const signal = () => new AbortController().signal;
function response(req: ProviderRequest): ProviderResult {
  return { model: MODEL, usage: { input_tokens: 100, output_tokens: 20 },
    answers: Object.fromEntries(Object.entries(req.questions).map(([id, q]) => {
      if (q.type === 'noul') return [id, { type: 'noul', noul: 1 }];
      if (q.type === 'score') return [id, { type: 'score', score: 2, confidence: 1,
        probabilities: { 0: 0, 1: 0, 2: 1 }, legend: Object.fromEntries(q.criteria.map((v, i) => [i, v])) }];
      const choice = id === 'route' ? 'tests' : id.startsWith('requirement_') ? 'supported'
        : 'accept' in q.criteria ? 'accept' : 'native';
      return [id, { type: 'choice', choice, confidence: 1,
        probabilities: Object.fromEntries(Object.keys(q.criteria).map(key => [key, key === choice ? 1 : 0])) }];
    })) };
}
function generated(req: WorkerRequest): WorkerResult {
  return { status: 'generated', candidate: { content, sha256: evidenceHash(content), bytes: Buffer.byteLength(content) },
    receipt: { schemaVersion: 1, transport: 'codex-cli', requestHash: hash(req), operationHash: hash(req.operationId),
      attempt: req.attempt, profile: req.profile, configuredModel: 'gpt-5.6-luna', configuredEffort: 'low',
      observedModel: null, isolationProfile: 'codex-generator/1', cliVersion: 'synthetic', authentication: 'chatgpt',
      inputBytes: 100, stdoutBytes: 100, stderrBytes: 0, generationInvocations: 1, observedToolItems: 0,
      usage: { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 50 }, usageComplete: true,
      durationMs: 1, exitCode: 0, cleanupComplete: true, actualBilledUsd: null, subscriptionUsage: null } };
}
async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jevra-session-'))); roots.push(root);
  await writeFile(join(root, 'sum.ts'), source);
  const config = configSchema.parse({ version: 1, mode: 'advise', skillRoots: [root], traces: false,
    testArtifacts: { enabled: true, experimentalProfile: 'node-pure-function-tests/1',
      codexExecutable: '/unused/codex', stagingDirectory: join(root, 'stage'), maxOperations: 2,
      profiles: [{ id: 'sum', sourcePath: join(root, 'sum.ts'), exportName: 'sum', outputName: 'sum.test.ts',
        requirements: ['Assert sum(2, 3) equals 5.'], instructions: ['Write tests in English.'],
        mutants: [{ id: 'subtract', content: source.replace('a + b', 'a - b') }] }] } });
  const requests: ProviderRequest[] = [], packets: WorkerRequest[] = [];
  const provider: Provider = { async evaluate(req) { requests.push(req); return response(req); } };
  const worker: WorkerTransport = { async generate(req) { packets.push(req); return generated(req); } };
  return { root, config, provider, worker, requests, packets, session: new ArtifactSession(config, provider, root, worker) };
}

test('MCP artifact tools are opt-in, advise-only and never expose an apply tool', async () => {
  const f = await fixture();
  for (const mode of ['disabled', 'observe', 'advise'] as const) {
    for (const enabled of [false, true]) {
      const server = createMcpServer({ ...f.config, mode, testArtifacts: { ...f.config.testArtifacts!, enabled } }, 'codex', f.provider, f.root, f.worker);
      const client = new Client({ name: 'test', version: '1' });
      const [a, b] = InMemoryTransport.createLinkedPair();
      try {
        await server.connect(b); await client.connect(a);
        const tools = (await client.listTools()).tools;
        assert.equal(tools.length, mode === 'advise' && enabled ? 5 : 2);
        assert.ok(!tools.some(t => /apply/.test(t.name)));
        if (tools.length === 5) {
          assert.equal(tools.find(t => t.name === 'generate_tests')!.annotations!.readOnlyHint, false);
          const catalog = await client.callTool({ name: 'test_profiles', arguments: {} });
          assert.match(JSON.stringify(catalog), /sum.test.ts/);
          const invalid = await client.callTool({ name: 'generate_tests', arguments: { ...request, command: 'echo forbidden' } });
          assert.equal(invalid.isError, true);
          const result = await client.callTool({ name: 'generate_tests', arguments: request });
          assert.notEqual(result.isError, true);
          assert.match(JSON.stringify(result), /accepted/);
          assert.doesNotMatch(JSON.stringify(result), /import test/);
        }
      } finally { await client.close(); await server.close(); }
    }
  }
  assert.equal(f.packets.length, 1);
});

test('accepted artifact review is source-bound, compact first, and never writes the destination', async () => {
  const f = await fixture();
  const result = await f.session.generate(request, signal());
  assert.equal(result.status, 'accepted');
  assert.ok('artifact' in result && result.artifact);
  assert.equal(result.usage.worker.inputTokens, 1000);
  assert.doesNotMatch(JSON.stringify(result), /import test|sum.ts|Write tests/);
  const review = await f.session.read({ operationId: 'one', artifactId: result.artifact.id }, signal());
  assert.equal(review.content, content);
  assert.equal(review.source.sha256, evidenceHash(source));
  assert.equal(review.destination, join(f.root, 'sum.test.ts'));
  assert.equal(review.application, 'native_host_only');
  await assert.rejects(readFile(review.destination));
  assert.ok(f.packets[0]!.requirements.includes('Assert sum(2, 3) equals 5.'));
  const directory = join(f.root, 'stage', (await readdir(join(f.root, 'stage')))[0]!);
  const receiptFile = (await readdir(directory)).find(p => p.endsWith('.json'))!;
  const receipt = await readFile(join(directory, receiptFile), 'utf8');
  assert.match(receipt, /native_host_unobserved/);
  assert.doesNotMatch(receipt, /import test|sum.ts|Generate tests|Write tests/);
});

test('identical retries reuse receipts; changed IDs, changed requests and duplicate profiles cannot buy more attempts', async () => {
  const f = await fixture();
  const first = await f.session.generate(request, signal());
  const replay = await f.session.generate(request, signal());
  assert.deepEqual(replay, { ...first, replayed: true });
  assert.equal(f.packets.length, 1); assert.equal(f.requests.length, 2);
  await assert.rejects(f.session.generate({ ...request, task: 'Different task' }, signal()), /input_invalid/);
  await assert.rejects(f.session.generate({ ...request, operationId: 'two' }, signal()), /budget_exceeded/);
});

test('source changes, existing destination and foreign artifact handles block read and replay', async () => {
  const f = await fixture();
  const result = await f.session.generate(request, signal());
  assert.ok('artifact' in result && result.artifact);
  const read = { operationId: request.operationId, artifactId: result.artifact.id };
  await assert.rejects(f.session.read({ ...read, operationId: 'foreign' }, signal()), /input_invalid/);
  await writeFile(join(f.root, 'sum.ts'), source.replace('a + b', 'a - b'));
  await assert.rejects(f.session.read(read, signal()), /stale_state/);
  await assert.rejects(f.session.generate(request, signal()), /stale_state/);
  await writeFile(join(f.root, 'sum.ts'), source);
  await writeFile(join(f.root, 'sum.test.ts'), 'native output');
  await assert.rejects(f.session.read(read, signal()), /stale_state/);
  assert.equal(f.packets.length, 1);
});

test('concurrent calls reserve the slot before preparation and a duplicate never starts inference twice', async () => {
  const f = await fixture();
  const running = f.session.generate(request, signal());
  const replay = await f.session.generate(request, signal());
  assert.equal(replay.reason, 'operation_in_progress');
  await assert.rejects(f.session.generate({ ...request, operationId: 'two' }, signal()), /budget_exceeded/);
  await running;
  assert.equal(f.packets.length, 1);
});

test('failed setup consumes its slot, scope excludes other workspaces, and unknown fields are rejected', async () => {
  const f = await fixture();
  await assert.rejects(f.session.generate({ ...request, path: '/private' }, signal()), /input_invalid/);
  const config = structuredClone(f.config);
  config.testArtifacts!.profiles[0]!.sourcePath = '/other/workspace/sum.ts';
  const outside = new ArtifactSession(config, f.provider, f.root, f.worker);
  assert.deepEqual(outside.list().profiles, []);
  await assert.rejects(outside.generate(request, signal()), /input_invalid/);
  await writeFile(join(f.root, 'sum.ts'), 'export const invalid = 1;');
  await assert.rejects(f.session.generate(request, signal()), /input_invalid/);
  assert.equal((await f.session.generate(request, signal())).replayed, true);
  await assert.rejects(f.session.generate({ ...request, operationId: 'two' }, signal()), /budget_exceeded/);
  assert.equal(f.requests.length, 0);
});

test('Jev outage retains a failed receipt without a worker fallback or duplicate charges', async () => {
  const f = await fixture();
  const session = new ArtifactSession(f.config, { async evaluate() { throw new DecisionError('network_error'); } }, f.root, f.worker);
  const result = await session.generate(request, signal());
  assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'network_error');
  assert.equal(f.packets.length, 0);
  assert.equal((await session.generate(request, signal())).replayed, true);
});

test('configuration rejects duplicate destinations, arbitrary executables and absent experiment acknowledgment', async () => {
  const f = await fixture();
  const config = structuredClone(f.config);
  config.testArtifacts!.profiles.push({ ...config.testArtifacts!.profiles[0]!, id: 'alias' });
  assert.equal(configSchema.safeParse(config).success, false);
  assert.equal(configSchema.safeParse({ ...f.config, testArtifacts: { ...f.config.testArtifacts, codexExecutable: 'codex; echo x' } }).success, false);
  assert.equal(configSchema.safeParse({ ...f.config, testArtifacts: { ...f.config.testArtifacts, experimentalProfile: undefined } }).success, false);
});

test('cancellation stops managed generation, preserves incurred usage and cannot publish a late artifact', async () => {
  const f = await fixture(), abort = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>(r => { started = r; });
  const worker: WorkerTransport = { async generate(req, signal) {
    started();
    await new Promise<void>(r => signal!.addEventListener('abort', () => r(), { once: true }));
    return generated(req);
  } };
  const session = new ArtifactSession(f.config, f.provider, f.root, worker);
  const running = session.generate(request, abort.signal);
  await ready; abort.abort();
  await assert.rejects(running, /cancelled/);
  const replay = await session.generate(request, signal());
  assert.equal(replay.status, 'unresolved'); assert.equal(replay.reason, 'cancelled');
  await assert.rejects(readFile(join(f.root, 'sum.test.ts')));
  const directory = join(f.root, 'stage', (await readdir(join(f.root, 'stage')))[0]!);
  const receiptFile = (await readdir(directory)).find(p => p.endsWith('.json'))!;
  const metadata = JSON.parse(await readFile(join(directory, receiptFile), 'utf8'));
  assert.ok(metadata.receipt.usage.jev.inputTokens > 0);
  assert.equal(metadata.status, 'cancelled');
  assert.equal(metadata.deliveryFailure, 'cancelled');
  assert.equal(metadata.managedStatus, 'unresolved');
});

test('expired reviews and repeated summaries cannot mutate session authority', async () => {
  const f = await fixture();
  const result = await f.session.generate(request, signal());
  assert.ok('artifact' in result && result.artifact);
  const original = result.artifact.id;
  result.artifact.id = '00000000-0000-4000-8000-000000000000';
  const replay = await f.session.generate(request, signal());
  assert.ok('artifact' in replay && replay.artifact);
  assert.equal(replay.artifact.id, original);
  const now = Date.now;
  try {
    Date.now = () => now() + 600001;
    await assert.rejects(f.session.read({ operationId: request.operationId, artifactId: original }, signal()), /stale_state/);
    await assert.rejects(f.session.generate(request, signal()), /stale_state/);
  } finally { Date.now = now; }
});

test('MCP binds economic evidence to the actual host and retains a native decision without a worker or ticket', async () => {
  const f = await fixture(), economics = calibration();
  economics.execution.delivery = 'review'; economics.calibration!.execution.delivery = 'review';
  f.config.testArtifacts!.economics = economics;
  const server = createMcpServer(f.config, 'claude-code', f.provider, f.root, f.worker);
  const client = new Client({ name: 'economic-test', version: '1' }), [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(b); await client.connect(a);
    const raw = await client.callTool({ name: 'generate_tests', arguments: request });
    assert.notEqual(raw.isError, true);
    const result = JSON.parse((raw.content as { text: string }[])[0]!.text);
    assert.equal(result.reason, 'economic_native_selected'); assert.equal(result.artifact, null);
    assert.ok(result.economics.issues.includes('current_host_or_delivery_mismatch'));
    assert.equal('materialization' in result, false);
    assert.equal(f.requests.length, 1); assert.equal(f.packets.length, 0);
    const replay = await client.callTool({ name: 'generate_tests', arguments: request });
    assert.notEqual(replay.isError, true); assert.equal(f.requests.length, 1);
  } finally { await client.close(); await server.close(); }
});
