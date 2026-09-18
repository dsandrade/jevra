import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, access, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { hash } from '@jevra/core';
import type { WorkerRequest } from '../packages/core/src/worker.ts';
import { CodexCliWorker, workerEnvironment } from '../packages/cli/src/codex-worker.ts';

const directories: string[] = [];
const children: number[] = [];
afterEach(async () => {
  for (const pid of children.splice(0)) { try { process.kill(pid, 'SIGKILL'); } catch {} }
  await Promise.all(directories.splice(0).map(p => rm(p, { recursive: true, force: true })));
});
const request: WorkerRequest = { schemaVersion: 1, operationId: 'private-operation', attempt: 1,
  profile: 'transport-probe', task: 'Return the requested candidate.', instructions: ['Use English.'],
  requirements: ['Return the supplied value.'], evidence: [{ id: 'source', sourceHash: hash('value'), content: 'value' }] };
async function fixture(mode = 'ok', limits = {}) {
  const root = await mkdtemp(join(tmpdir(), 'jevra-worker-test-'));
  directories.push(root);
  const record = join(root, 'calls.jsonl');
  const worker = new CodexCliWorker({ executable: process.execPath,
    executableArgs: [resolve('tests/fixtures/codex-worker.mjs'), mode, record], temporaryDirectory: root,
    env: { PATH: process.env.PATH, HOME: root, CODEX_HOME: join(root, 'auth-location'),
      OPENAI_API_KEY: 'PRIVATE_SECRET', CODEX_API_KEY: 'PRIVATE_SECRET',
      NODE_OPTIONS: '--require PRIVATE_PATH', JEVRA_PARENT_HISTORY: 'PRIVATE_HISTORY' },
    limits: { timeoutMs: 4000, killGraceMs: 50, ...limits } });
  return { worker, root, record };
}
async function waitForFile(path: string) {
  for (let i = 0; i < 100; i++) {
    try { return await readFile(path, 'utf8'); } catch {}
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error('Fixture did not start.');
}
async function assertGone(pid: number) {
  for (let i = 0; i < 100; i++) {
    try { process.kill(pid, 0); } catch { return; }
    await new Promise(r => setTimeout(r, 10));
  }
  assert.fail('Child process survived cleanup.');
}

test('worker uses stdin, fixed argv and official auth without inheriting credentials or parent context', async () => {
  const { worker, root, record } = await fixture();
  const marker = join(root, 'must-not-exist');
  const input = { ...request, task: 'PRIVATE_PROMPT `touch ' + marker + '` $(touch ' + marker + ')' };
  const result = await worker.generate(input);
  assert.equal(result.status, 'generated');
  if (result.status !== 'generated') return;
  assert.equal(result.candidate.content, 'export const café = 42;\n');
  assert.equal(result.candidate.bytes, Buffer.byteLength(result.candidate.content));
  assert.deepEqual(result.receipt.usage, { inputTokens: 125, cachedInputTokens: 25, outputTokens: 12 });
  assert.equal(result.receipt.usageComplete, true);
  assert.equal(result.receipt.authentication, 'chatgpt');
  assert.equal(result.receipt.observedModel, null);
  assert.equal(result.receipt.generationInvocations, 1);
  assert.equal(result.receipt.actualBilledUsd, null);
  assert.doesNotMatch(JSON.stringify(result.receipt), /PRIVATE_|private-operation|private-thread|café/);
  const calls = (await readFile(record, 'utf8')).trim().split('\n').map(x => JSON.parse(x));
  assert.equal(calls.length, 3);
  const generation = calls[2];
  assert.equal(generation.args[0], 'exec');
  for (const flag of ['--ignore-user-config', '--ephemeral', '--json', '--output-schema']) assert.ok(generation.args.includes(flag));
  assert.ok(generation.args.includes('forced_login_method="chatgpt"'));
  assert.ok(generation.args.includes('features.shell_tool=false'));
  assert.ok(generation.args.includes('project_doc_max_bytes=0'));
  assert.doesNotMatch(JSON.stringify(generation.args), /PRIVATE_PROMPT|resume|dangerously/);
  for (const key of ['OPENAI_API_KEY', 'CODEX_API_KEY', 'NODE_OPTIONS', 'JEVRA_PARENT_HISTORY']) assert.ok(!generation.envKeys.includes(key));
  assert.deepEqual(JSON.parse(await readFile(record + '.packet', 'utf8')), input);
  await assert.rejects(access(marker));
  await assert.rejects(access(generation.cwd));
  assert.ok(!(await readdir(root)).some(name => name.startsWith('jevra-worker-')));
});

test('environment retains auth location and excludes inherited agent state', () => {
  assert.deepEqual(workerEnvironment({ HOME: '/home/example', CODEX_HOME: '/auth', PATH: '/bin',
    ANTHROPIC_API_KEY: 'secret', OPENAI_BASE_URL: 'https://untrusted.invalid', CODEX_THREAD_ID: 'parent' }),
  { HOME: '/home/example', CODEX_HOME: '/auth', PATH: '/bin', JEVRA_WORKER_ACTIVE: '1' });
});

for (const [mode, reason] of [
  ['old-version', 'unsupported_cli'], ['api-auth', 'authentication'], ['invalid-json', 'invalid_response'],
  ['invalid-artifact', 'invalid_response'], ['truncated', 'invalid_response'], ['tool', 'unexpected_tool'],
  ['rate-limited', 'rate_limited'], ['different-model', 'model_unavailable'], ['exit-failure', 'process_failed'],
  ['extra-turn', 'invalid_response'],
] as const) test(`worker rejects ${mode} and exposes only a sanitized failure`, async () => {
  const { worker } = await fixture(mode);
  const result = await worker.generate(request);
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') assert.equal(result.reason, reason);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|private-thread/);
  if (mode === 'old-version' || mode === 'api-auth') assert.equal(result.receipt.generationInvocations, 0);
  if (mode === 'invalid-artifact') assert.equal(result.receipt.usageComplete, true);
});

for (const mode of ['unknown-usage', 'invalid-usage']) test(`${mode} remains unknown rather than zero`, async () => {
  const { worker } = await fixture(mode);
  const result = await worker.generate(request);
  assert.equal(result.status, 'generated');
  assert.equal(result.receipt.usage, null);
  assert.equal(result.receipt.usageComplete, false);
});

test('JSONL handles split UTF-8 and a final line without newline', async () => {
  const { worker } = await fixture('split-utf8');
  const result = await worker.generate(request);
  assert.equal(result.status, 'generated');
  if (result.status === 'generated') assert.equal(result.candidate.content, 'export const café = 42;\n');
});

test('input, stdout, stderr and candidate limits reject rather than truncate output', async () => {
  const cases = [
    { mode: 'ok', limits: { maxInputBytes: 256 }, reason: 'input_limit' },
    { mode: 'stdout-limit', limits: { maxOutputBytes: 1024 }, reason: 'output_limit' },
    { mode: 'stderr-limit', limits: { maxStderrBytes: 1024 }, reason: 'output_limit' },
    { mode: 'large-artifact', limits: { maxArtifactBytes: 32 }, reason: 'artifact_limit' },
  ];
  for (const c of cases) {
    const { worker } = await fixture(c.mode, c.limits);
    const result = await worker.generate(request);
    assert.equal(result.status, 'failed');
    if (result.status === 'failed') assert.equal(result.reason, c.reason);
  }
});

test('timeout cleans up a process group with a grandchild that ignores SIGTERM', async () => {
  const { worker, record } = await fixture('hang', { timeoutMs: 800 });
  const pending = worker.generate(request);
  const pid = Number(await waitForFile(record + '.child')); children.push(pid);
  const result = await pending;
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') assert.equal(result.reason, 'timeout');
  assert.equal(result.receipt.usage, null);
  await assertGone(pid);
});

test('cancellation stops the worker tree, rejects concurrent work and never returns a late candidate', async () => {
  const { worker, record } = await fixture('hang');
  const controller = new AbortController();
  const pending = worker.generate(request, controller.signal);
  const pid = Number(await waitForFile(record + '.child')); children.push(pid);
  const busy = await worker.generate(request);
  assert.equal(busy.status, 'failed');
  if (busy.status === 'failed') assert.equal(busy.reason, 'busy');
  controller.abort();
  const result = await pending;
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') assert.equal(result.reason, 'cancelled');
  await assertGone(pid);
});

test('a prematurely exiting parent cannot leak a grandchild with closed stdio', async () => {
  const { worker, record } = await fixture('descendant');
  const pending = worker.generate(request);
  const pid = Number(await waitForFile(record + '.child')); children.push(pid);
  const result = await pending;
  assert.equal(result.status, 'failed');
  await assertGone(pid);
});

test('pre-cancelled, recursive, invalid and unavailable requests do not generate', async () => {
  const { worker, record } = await fixture();
  const cancelled = await worker.generate(request, AbortSignal.abort());
  assert.equal(cancelled.status, 'failed');
  if (cancelled.status === 'failed') assert.equal(cancelled.reason, 'cancelled');
  const invalid = await worker.generate({ ...request, attempt: 3 });
  assert.equal(invalid.status, 'failed');
  await assert.rejects(access(record));
  const recursive = await new CodexCliWorker({ env: { JEVRA_WORKER_ACTIVE: '1' } }).generate(request);
  if (recursive.status === 'failed') assert.equal(recursive.reason, 'recursive_dispatch');
  const unavailable = await new CodexCliWorker({ executable: '/nonexistent/jevra-test-executable' }).generate(request);
  assert.equal(unavailable.status, 'failed');
  if (unavailable.status === 'failed') assert.equal(unavailable.reason, 'executable_unavailable');
});

test('standalone user hooks are refused without changing settings or calling a model', async () => {
  const { worker, root, record } = await fixture();
  const authLocation = join(root, 'auth-location');
  await mkdir(authLocation);
  const hooks = JSON.stringify({ hooks: { SessionStart: [{ command: 'PRIVATE_USER_HOOK' }] } });
  await writeFile(join(authLocation, 'hooks.json'), hooks);
  const result = await worker.generate(request);
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') assert.equal(result.reason, 'unsupported_configuration');
  assert.equal(result.receipt.generationInvocations, 0);
  assert.equal(await readFile(join(authLocation, 'hooks.json'), 'utf8'), hooks);
  await assert.rejects(access(record));
});
