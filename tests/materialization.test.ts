import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, realpath, readFile, writeFile, rm, readdir, symlink, chmod, link } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { hash, MODEL } from '@jevra/core';
import type { Provider, ProviderRequest } from '@jevra/core';
import { evidenceHash } from '@jevra/core/managed-worker';
import type { WorkerTransport, WorkerRequest } from '@jevra/core/worker';
import { configSchema } from '../packages/cli/src/config.ts';
import { ArtifactSession } from '../packages/cli/src/artifact-session.ts';
import { createMcpServer } from '../packages/cli/src/mcp.ts';
import { materializeTest } from '../packages/cli/src/materialization.ts';
import type { MaterializationHandle } from '../packages/cli/src/materialization.ts';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
const source = 'export function sum(a: number, b: number): number { return a + b; }\n';
const candidate = `import test from 'node:test';
import assert from 'node:assert/strict';
import { sum } from './sum.ts';
test('adds', () => { assert.equal(sum(2, 3), 5); });
`;
const requirement = 'Assert sum(2, 3) equals 5.';
const request = { operationId: 'one', source: 'sum.ts', task: 'Generate tests for sum.', requirements: [requirement] };
const signal = () => new AbortController().signal;
async function fixture(accept = true, prefix = 'jevra-materialize-') {
  const root = await realpath(await mkdtemp(join(tmpdir(), prefix))); roots.push(root);
  const workspace = join(root, 'repo'); await mkdir(workspace);
  await writeFile(join(workspace, 'sum.ts'), source);
  const configFile = join(root, 'config.json'), cliFile = resolve('dist/jevra.mjs');
  const config = configSchema.parse({ version: 1, mode: 'advise', skillRoots: [workspace], traces: false,
    testArtifacts: { enabled: true, experimentalProfile: 'node-pure-function-tests/1', delivery: 'native-ticket',
      codexExecutable: '/unused/codex', stagingDirectory: join(root, 'state'),
      profiles: [{ id: 'sum', sourcePath: join(workspace, 'sum.ts'), exportName: 'sum', outputName: 'sum.test.ts',
        requirements: [requirement], mutants: [{ id: 'subtract', content: source.replace('a + b', 'a - b') }] }] } });
  await writeFile(configFile, JSON.stringify(config), { mode: 0o600 });
  const requests: ProviderRequest[] = [], packets: WorkerRequest[] = [];
  const provider: Provider = { async evaluate(req) {
    requests.push(req);
    return { model: MODEL, usage: { input_tokens: 100, output_tokens: 20 },
      answers: Object.fromEntries(Object.entries(req.questions).map(([id, q]) => {
        if (q.type === 'noul') return [id, { type: 'noul', noul: 1 }];
        if (q.type === 'score') return [id, { type: 'score', score: 2, confidence: 1,
          probabilities: { 0: 0, 1: 0, 2: 1 }, legend: Object.fromEntries(q.criteria.map((v, i) => [i, v])) }];
        const choice = id === 'route' ? 'tests' : id.startsWith('requirement_') ? 'supported' : accept ? 'accept' : 'abstain';
        return [id, { type: 'choice', choice, confidence: 1,
          probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === choice ? 1 : 0])) }];
      })) };
  } };
  const worker: WorkerTransport = { async generate(req) {
    packets.push(req);
    return { status: 'generated', candidate: { content: candidate, sha256: evidenceHash(candidate), bytes: Buffer.byteLength(candidate) },
      receipt: { schemaVersion: 1, transport: 'codex-cli', requestHash: hash(req), operationHash: hash(req.operationId),
        attempt: req.attempt, profile: req.profile, configuredModel: 'gpt-5.6-luna', configuredEffort: 'low', observedModel: null,
        isolationProfile: 'codex-generator/1', cliVersion: 'synthetic', authentication: 'chatgpt', inputBytes: 100,
        stdoutBytes: 100, stderrBytes: 0, generationInvocations: 1, observedToolItems: 0,
        usage: { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 50 }, usageComplete: true,
        durationMs: 1, exitCode: 0, cleanupComplete: true, actualBilledUsd: null, subscriptionUsage: null } };
  } };
  const context = { configFile, cliFile };
  const session = new ArtifactSession(config, provider, workspace, worker, context);
  const generate = async () => {
    const result = await session.generate(request, signal());
    assert.equal(result.status, 'accepted');
    assert.ok('materialization' in result && result.materialization);
    return { result, handle: result.materialization };
  };
  const apply = (h: MaterializationHandle, s = signal()) => materializeTest(config, workspace, h.sessionId, h.id, s);
  const ticketPath = (h: MaterializationHandle, suffix: string) => join(root, 'state/native-tickets', h.sessionId, h.id + suffix);
  return { root, workspace, config, configFile, cliFile, context, session, provider, worker, requests, packets, generate, apply, ticketPath };
}

test('accepted compact handoff survives issuer lifetime and the standalone CLI creates exact bytes with zero inference', async () => {
  const f = await fixture(true, "jevra materialize's-"), { result, handle } = await f.generate();
  assert.doesNotMatch(JSON.stringify(result), /import test|assert.equal/);
  assert.equal(f.packets[0]!.requirements.length, 1, 'Exact repeated requirements must not inflate semantic review');
  assert.deepEqual(await f.session.generate(request, signal()), { ...result, replayed: true });
  assert.equal(f.requests.length, 2); assert.equal(f.packets.length, 1);
  await assert.rejects(readFile(join(f.workspace, 'sum.test.ts')));
  assert.ok('materializeCommand' in result && typeof result.materializeCommand === 'string');
  const { stdout } = await promisify(execFile)('/bin/sh', ['-c', result.materializeCommand],
    { cwd: f.workspace, env: { PATH: process.env.PATH }, timeout: 10000 });
  assert.equal(JSON.parse(stdout).status, 'applied'); assert.equal(JSON.parse(stdout).inferenceCalls, 0);
  assert.doesNotMatch(stdout, /import test|assert.equal/);
  assert.equal(await readFile(join(f.workspace, 'sum.test.ts'), 'utf8'), candidate);
  assert.equal(await readFile(join(f.workspace, 'sum.ts'), 'utf8'), source);
  assert.equal(f.requests.length, 2); assert.equal(f.packets.length, 1);
  await assert.rejects(f.apply(handle));
});

test('MCP generates directly from configured source and exposes no application tool or file body', async () => {
  const f = await fixture(), server = createMcpServer(f.config, 'codex', f.provider, f.workspace, f.worker, f.context);
  const client = new Client({ name: 'test', version: '1' }), [a, b] = InMemoryTransport.createLinkedPair();
  let handle: MaterializationHandle;
  try {
    await server.connect(b); await client.connect(a);
    assert.equal((await client.listTools()).tools.some(t => /apply|materialize/.test(t.name)), false);
    const result = await client.callTool({ name: 'generate_tests', arguments: request });
    assert.notEqual(result.isError, true);
    const text = (result.content as { type: string; text: string }[])[0]!.text;
    assert.doesNotMatch(text, /import test/); handle = JSON.parse(text).materialization;
  } finally { await client.close(); await server.close(); }
  assert.equal((await f.apply(handle!)).status, 'applied');
});

test('unresolved work has no ticket and retains the final managed reason', async () => {
  const f = await fixture(false), result = await f.session.generate(request, signal());
  assert.equal(result.status, 'unresolved'); assert.equal('materialization' in result, false);
  const base = join(f.root, 'state'), session = (await readdir(base)).find(p => p.startsWith('mcp-session-'))!;
  const receipt = (await readdir(join(base, session))).find(p => p.endsWith('.json'))!;
  const metadata = JSON.parse(await readFile(join(base, session, receipt), 'utf8'));
  assert.equal(metadata.managedReason, 'abstained');
  assert.deepEqual(await readdir(join(base, 'native-tickets')), ['authority.key']);
});

test('ticket signature, candidate bytes, authority permissions and configuration are checked independently', async () => {
  for (const mutate of ['ticket', 'candidate', 'key-permissions', 'config', 'missing-key'] as const) {
    const f = await fixture(), { handle } = await f.generate();
    if (mutate === 'ticket') { const p = f.ticketPath(handle, '.json'), data = JSON.parse(await readFile(p, 'utf8'));
      data.ticket.destination = join(f.workspace, 'other.ts'); await writeFile(p, JSON.stringify(data)); }
    if (mutate === 'candidate') await writeFile(f.ticketPath(handle, '.ts'), candidate.replace('5)', '6)'));
    if (mutate === 'key-permissions') await chmod(join(f.root, 'state/native-tickets/authority.key'), 0o644);
    if (mutate === 'missing-key') await rm(join(f.root, 'state/native-tickets/authority.key'));
    if (mutate === 'config') f.config.testArtifacts!.profiles[0]!.requirements.push('Another obligation.');
    await assert.rejects(f.apply(handle), mutate);
    await assert.rejects(readFile(join(f.workspace, 'sum.test.ts')));
  }
});

test('changed source, existing target and candidate/source symlinks or hardlinks cannot authorize publication', async () => {
  for (const mutate of ['source', 'target', 'source-link', 'candidate-link', 'candidate-hardlink', 'target-link'] as const) {
    const f = await fixture(), { handle } = await f.generate();
    const src = join(f.workspace, 'sum.ts'), dst = join(f.workspace, 'sum.test.ts'), staged = f.ticketPath(handle, '.ts');
    if (mutate === 'source') await writeFile(src, source.replace('a + b', 'a - b'));
    if (mutate === 'target') await writeFile(dst, 'existing');
    if (mutate === 'source-link') { await writeFile(join(f.root, 'source.ts'), source); await rm(src); await symlink(join(f.root, 'source.ts'), src); }
    if (mutate === 'candidate-link') { await rm(staged); await writeFile(join(f.root, 'candidate.ts'), candidate); await symlink(join(f.root, 'candidate.ts'), staged); }
    if (mutate === 'candidate-hardlink') await link(staged, join(f.root, 'copy.ts'));
    if (mutate === 'target-link') await symlink(join(f.root, 'absent.ts'), dst);
    await assert.rejects(f.apply(handle), mutate);
    if (mutate === 'target') assert.equal(await readFile(dst, 'utf8'), 'existing');
    else await assert.rejects(readFile(dst));
  }
});

test('expiry, cancellation, workspace and mixed-session handles block application', async () => {
  const f = await fixture(), { handle } = await f.generate();
  await assert.rejects(materializeTest(f.config, f.workspace, randomUUID(), handle.id, signal()));
  const other = join(f.root, 'other'); await mkdir(other);
  await assert.rejects(materializeTest(f.config, other, handle.sessionId, handle.id, signal()));
  const cancelled = new AbortController(); cancelled.abort(); await assert.rejects(f.apply(handle, cancelled.signal));
  const now = Date.now;
  try { Date.now = () => handle.expiresAt; await assert.rejects(f.apply(handle)); } finally { Date.now = now; }
  assert.equal((await f.apply(handle)).status, 'applied', 'Rejected preflight must not consume the ticket');
});

test('concurrent native materializers publish once and spent tickets cannot recreate a deleted output', async () => {
  const f = await fixture(), { handle } = await f.generate();
  const outcomes = await Promise.allSettled([f.apply(handle), f.apply(handle)]);
  assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1);
  assert.equal(await readFile(join(f.workspace, 'sum.test.ts'), 'utf8'), candidate);
  await rm(join(f.workspace, 'sum.test.ts')); await assert.rejects(f.apply(handle));
});

test('ticket delivery refuses workspace-owned authority/config and ambiguous or foreign source identity before inference', async () => {
  for (const invalid of ['authority', 'config', 'ambiguous', 'foreign', 'disabled'] as const) {
    const f = await fixture();
    if (invalid === 'authority') f.config.testArtifacts!.stagingDirectory = join(f.workspace, 'stage');
    if (invalid === 'config') f.context.configFile = join(f.workspace, 'config.json');
    if (invalid === 'ambiguous') f.config.testArtifacts!.profiles.push({ ...f.config.testArtifacts!.profiles[0]!, id: 'another', outputName: 'other.test.ts' });
    if (invalid === 'disabled') f.config.mode = 'disabled';
    await assert.rejects(async () => {
      const session = new ArtifactSession(f.config, f.provider, f.workspace, f.worker, f.context);
      await session.generate({ ...request, source: invalid === 'foreign' ? '../outside.ts' : 'sum.ts' }, signal());
    });
    assert.equal(f.requests.length, 0); assert.equal(f.packets.length, 0);
  }
});
