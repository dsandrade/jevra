import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, writeFile, readFile, rm, readdir, lstat, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DecisionError, hash, MODEL } from '@jevra/core';
import type { ProviderRequest, ProviderResult } from '@jevra/core';
import { ManagedTestOperation, evidenceHash } from '@jevra/core/managed-worker';
import type { WorkerRequest, WorkerResult } from '@jevra/core/worker';
import { NodeTestArtifacts } from '../packages/cli/src/test-artifacts.ts';
import { validatePureModule, validateTestModule } from '../packages/cli/src/test-policy.ts';
import { checksPassed } from '../packages/core/src/artifact.ts';
import type { ArtifactValidation, ArtifactValidator } from '../packages/core/src/artifact.ts';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const source = 'export function sum(a: number, b: number): number { return a + b; }\n';
const good = `import test from 'node:test';
import assert from 'node:assert/strict';
import { sum } from './sum.ts';
test('adds positive operands', () => { assert.equal(sum(2, 3), 5); });
test('adds negative operands', () => { assert.strictEqual(sum(-2, 3), 1); });
test('adds zero', () => { assert.equal(sum(0, 0), 0); });
`;
const candidate = (content: string) => ({ content, sha256: evidenceHash(content), bytes: Buffer.byteLength(content) });
const signal = () => new AbortController().signal;
async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jevra-artifact-test-')));
  roots.push(root);
  const sourcePath = join(root, 'sum.ts'), stagingDirectory = join(root, 'staging');
  await writeFile(sourcePath, source);
  const options = { sourcePath, stagingDirectory, exportName: 'sum', outputName: 'sum.test.ts',
    mutants: [{ id: 'subtract', content: source.replace('a + b', 'a - b') },
      { id: 'drop-second-operand', content: source.replace('a + b', 'a') }] };
  const artifacts = await NodeTestArtifacts.create(options);
  const request = await artifacts.prepare({ operationId: 'artifact-fixture', task: 'Write tests for sum.',
    instructions: ['Write tests in English.'], requirements: ['Test positive operands.', 'Test a negative operand.', 'Test zero operands.'] });
  return { root, options, artifacts, request };
}
function response(request: ProviderRequest): ProviderResult {
  return { model: MODEL, usage: { input_tokens: 100, output_tokens: 20 },
    answers: Object.fromEntries(Object.entries(request.questions).map(([id, q]) => {
      if (q.type === 'noul') return [id, { type: 'noul', noul: 1 }];
      if (q.type === 'score') return [id, { type: 'score', score: 2, confidence: 1,
        probabilities: { 0: 0, 1: 0, 2: 1 }, legend: Object.fromEntries(q.criteria.map((v, i) => [i, v])) }];
      const choice = id === 'route' ? 'tests' : id.startsWith('requirement_') ? 'supported'
        : 'accept' in q.criteria ? 'accept' : 'repair' in q.criteria ? 'repair' : 'native';
      return [id, { type: 'choice', choice, confidence: 1,
        probabilities: Object.fromEntries(Object.keys(q.criteria).map(key => [key, key === choice ? 1 : 0])) }];
    })) };
}
function generated(request: WorkerRequest, content: string): WorkerResult {
  return { status: 'generated', candidate: candidate(content), receipt: {
    schemaVersion: 1, transport: 'codex-cli', requestHash: hash(request), operationHash: hash(request.operationId),
    attempt: request.attempt, profile: request.profile, configuredModel: 'gpt-5.6-luna', configuredEffort: 'low',
    observedModel: null, isolationProfile: 'codex-generator/1', cliVersion: 'synthetic', authentication: 'chatgpt',
    inputBytes: 100, stdoutBytes: 100, stderrBytes: 0, generationInvocations: 1, observedToolItems: 0,
    usage: { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 50 }, usageComplete: true,
    durationMs: 1, exitCode: 0, cleanupComplete: true, actualBilledUsd: null, subscriptionUsage: null,
  } };
}

test('pure source and test AST admission rejects executable escape hatches and vacuous tests', () => {
  assert.equal(validatePureModule(source, 'sum'), 2);
  assert.deepEqual(validateTestModule(good, 'sum.ts', 'sum', 2), { valid: true, tests: 3 });
  for (const content of [
    good + 'process.exit(0);', good.replace("import test from 'node:test';", "import test from 'node:fs';"),
    good.replace("'./sum.ts'", "'../../secret.ts'"), good.replace('() => {', 'async () => {'),
    good.replace('assert.equal(sum(2, 3), 5);', 'console.log("# tests 3");'),
    good.replace('assert.equal(sum(2, 3), 5);', 'assert.equal(5, 5);'),
    good.replace('assert.equal(sum(2, 3), 5);', 'assert.equal(sum.constructor("return process")(), 5);'),
    good.replace('assert.equal(sum(2, 3), 5);', 'assert["equal"](sum(2, 3), 5);'),
    good.replace('() => {', '(t) => {'), good.replace('test(', 'test.skip('),
    good.replace('() => {', '{ skip: true }, () => {'),
    good.replace('assert.equal(sum(2, 3), 5);', 'while (true) {}'),
    'export const nothing = 1;', 'test(', good.replace('sum(2, 3)', 'sum(...[2, 3])'),
  ]) assert.equal(validateTestModule(content, 'sum.ts', 'sum', 2).valid, false);
  for (const content of [source + 'process.exit(0);', source.replace('a + b', 'process.env'),
    source.replace('a + b', 'eval(a)'), source.replace('a + b', 'a.constructor'),
    source.replace('return a + b;', 'while (true) {}')]) assert.throws(() => validatePureModule(content, 'sum'));
});

test('real Node checks pass the baseline and detect both independent mutants; staged output stays private', async () => {
  const f = await fixture();
  const result = await f.artifacts.validate(candidate(good), 1, signal());
  assert.equal(result.requiredChecksPassed, true);
  assert.equal(checksPassed(result), true);
  assert.deepEqual(result.checks.map(c => c.reason), ['valid', 'assertions_passed', 'mutant_detected', 'mutant_detected']);
  assert.equal(result.checks[1]?.tests, 3);
  assert.equal(await f.artifacts.read(result.artifact, signal()), good);
  await assert.rejects(readFile(join(f.root, 'sum.test.ts')));
  const session = (await readdir(f.options.stagingDirectory))[0]!;
  const path = join(f.options.stagingDirectory, session, result.artifact.id, 'candidate.ts');
  assert.equal((await lstat(path)).mode & 0o777, 0o600);
  assert.doesNotMatch(JSON.stringify(result), /import|sum\.ts|\/Users\//);
});

test('passing trivial tests that miss the seeded defects fail effectiveness checks', async () => {
  const f = await fixture();
  const weak = good.replace(/test\('adds positive[^\n]+\n/, '').replace(/test\('adds negative[^\n]+\n/, '');
  const result = await f.artifacts.validate(candidate(weak), 1, signal());
  assert.equal(result.checks[1]?.reason, 'assertions_passed');
  assert.equal(result.checks[2]?.reason, 'mutant_survived');
  assert.equal(result.requiredChecksPassed, false);
  await assert.rejects(f.artifacts.accept(result.artifact, signal()));
});

test('wrong expectations and unsupported syntax are staged but cannot be accepted', async () => {
  const f = await fixture();
  const wrong = await f.artifacts.validate(candidate(good.replace('sum(2, 3), 5', 'sum(2, 3), 9')), 1, signal());
  assert.equal(wrong.checks[1]?.reason, 'assertions_failed');
  assert.equal(wrong.requiredChecksPassed, false);
  const unsafe = await f.artifacts.validate(candidate(good + 'process.exit(0);'), 2, signal());
  assert.equal(unsafe.checks.length, 1);
  assert.equal(unsafe.checks[0]?.reason, 'unsupported_syntax');
  assert.equal(await f.artifacts.read(unsafe.artifact, signal()), good + 'process.exit(0);');
  await assert.rejects(f.artifacts.validate(candidate(good), 2, signal()));
});

test('managed integration accepts only after actual checks and a bound Jev review, with compact artifact output', async () => {
  const f = await fixture();
  const requests: ProviderRequest[] = [];
  const operation = new ManagedTestOperation({ request: f.request, validator: f.artifacts,
    currentBinding: s => f.artifacts.currentBinding(s), provider: { async evaluate(req) { requests.push(req); return response(req); } },
    worker: { async generate(req) { return generated(req, good); } } });
  const result = await operation.run();
  assert.equal(result.status, 'accepted');
  assert.equal(result.candidate, undefined);
  assert.ok(result.artifact);
  assert.equal(result.receipt.validation, 'passed');
  assert.equal(requests.length, 3);
  assert.ok((requests[2]?.state as { validation: ArtifactValidation }).validation.requiredChecksPassed);
  assert.equal(result.receipt.transitions.at(-1)?.to, 'accepted');
  assert.doesNotMatch(JSON.stringify(result), /import test|Write tests|\/Users\//);
  await assert.rejects(readFile(join(f.root, 'sum.test.ts')));
  assert.equal((await f.artifacts.apply(result.artifact!, signal())).status, 'applied');
  assert.equal(await readFile(join(f.root, 'sum.test.ts'), 'utf8'), good);
  await assert.rejects(f.artifacts.apply(result.artifact!, signal()));
});

test('one Jev-selected repair uses a fresh packet containing observed failures and counts both attempts', async () => {
  const f = await fixture();
  const packets: WorkerRequest[] = [];
  const result = await new ManagedTestOperation({ request: f.request, validator: f.artifacts,
    currentBinding: s => f.artifacts.currentBinding(s), provider: { async evaluate(req) { return response(req); } },
    worker: { async generate(req) { packets.push(req); return generated(req,
      req.attempt === 1 ? good.replace('sum(2, 3), 5', 'sum(2, 3), 9') : good); } } }).run();
  assert.equal(result.status, 'accepted');
  assert.deepEqual(packets.map(p => [p.attempt, p.profile]), [[1, 'artifact-writer/tests'], [2, 'artifact-writer/repair']]);
  assert.ok(packets[1]?.evidence.some(e => e.id === 'jevra_previous_candidate'));
  assert.ok(packets[1]?.evidence.some(e => e.id === 'jevra_observed_checks' && e.content.includes('assertions_failed')));
  assert.equal(result.receipt.usage.worker.inputTokens, 2000);
  assert.equal(result.receipt.usage.jev.inputTokens, 400);
  assert.equal(result.receipt.artifacts.length, 2);
  assert.equal(result.receipt.decisions.length, 4);
});

test('second failed candidate has no repair or accept alternative and hands off without a third invocation', async () => {
  const f = await fixture();
  let calls = 0;
  const result = await new ManagedTestOperation({ request: f.request, validator: f.artifacts,
    currentBinding: s => f.artifacts.currentBinding(s), provider: { async evaluate(req) {
      if (++calls === 4) {
        const q = req.questions.continuation;
        assert.equal(q?.type, 'choice');
        if (q?.type === 'choice') assert.deepEqual(Object.keys(q.criteria), ['native', 'abstain']);
      }
      return response(req);
    } }, worker: { async generate(req) { return generated(req, good + 'process.exit(0);'); } } }).run();
  assert.equal(result.status, 'native_handoff');
  assert.equal(result.receipt.generations.length, 2);
  assert.equal(result.receipt.artifacts.length, 2);
});

test('stale source, new output, tampered artifact and foreign handles cannot be applied', async () => {
  for (const mode of ['source', 'output', 'candidate', 'handle']) {
    const f = await fixture();
    const validation = await f.artifacts.validate(candidate(good), 1, signal());
    await f.artifacts.accept(validation.artifact, signal());
    if (mode === 'source') await writeFile(f.options.sourcePath, source.replace('a + b', 'a - b'));
    if (mode === 'output') await writeFile(join(f.root, 'sum.test.ts'), 'existing work');
    if (mode === 'candidate') {
      const session = (await readdir(f.options.stagingDirectory))[0]!;
      await writeFile(join(f.options.stagingDirectory, session, validation.artifact.id, 'candidate.ts'), 'tampered');
    }
    const handle = mode === 'handle' ? { ...validation.artifact, candidateHash: hash('foreign') } : validation.artifact;
    await assert.rejects(f.artifacts.apply(handle, signal()));
    if (mode === 'output') assert.equal(await readFile(join(f.root, 'sum.test.ts'), 'utf8'), 'existing work');
  }
});

test('configuration rejects traversal, symlinks, unsafe source and invalid mutant catalogs', async () => {
  const f = await fixture();
  await symlink(f.options.sourcePath, join(f.root, 'link.ts'));
  for (const override of [{ outputName: '../escape.ts' }, { sourcePath: join(f.root, 'link.ts') },
    { mutants: [] }, { mutants: [{ id: 'same', content: source }] },
    { mutants: [{ id: 'unsafe', content: source.replace('a + b', 'process.env') }] }]) {
    await assert.rejects(NodeTestArtifacts.create({ ...f.options, ...override }));
  }
  await writeFile(f.options.sourcePath, source + 'process.exit(0);');
  await assert.rejects(NodeTestArtifacts.create(f.options));
});

test('a forged validation success flag or foreign candidate binding cannot authorize acceptance', async () => {
  for (const mode of ['flag', 'hash']) {
    const f = await fixture();
    const validator: ArtifactValidator = {
      async validate(c, attempt, s) {
        const v = await f.artifacts.validate(c, attempt, s);
        if (mode === 'flag') { v.checks[0]!.outcome = 'failed'; v.requiredChecksPassed = true; }
        else v.artifact.candidateHash = hash('foreign');
        return v;
      }, async accept() { assert.fail('must not accept'); },
    };
    const result = await new ManagedTestOperation({ request: f.request, validator,
      currentBinding: s => f.artifacts.currentBinding(s), provider: { async evaluate(req) { return response(req); } },
      worker: { async generate(req) { return generated(req, good); } } }).run();
    assert.equal(result.reason, 'invalid_response');
  }
});

test('Jev cannot invent an acceptance alternative after failing actual checks', async () => {
  const f = await fixture();
  const result = await new ManagedTestOperation({ request: f.request, validator: f.artifacts,
    currentBinding: s => f.artifacts.currentBinding(s), provider: { async evaluate(req) {
      const r = response(req);
      if (req.questions.continuation) r.answers.continuation = { type: 'choice', choice: 'accept', confidence: 1,
        probabilities: { accept: 1, native: 0, abstain: 0 } };
      return r;
    } }, worker: { async generate(req) { return generated(req, good + 'process.exit(0);'); } } }).run();
  assert.equal(result.reason, 'invalid_response');
  assert.equal(result.receipt.validation, 'failed');
  assert.equal(result.receipt.generations.length, 1);
});

test('repair admission respects remaining Jev budget and preserves the staged first attempt', async () => {
  const f = await fixture();
  const result = await new ManagedTestOperation({ request: f.request, validator: f.artifacts, limits: { maxJevCalls: 3 },
    currentBinding: s => f.artifacts.currentBinding(s), provider: { async evaluate(req) { return response(req); } },
    worker: { async generate(req) { return generated(req, good + 'process.exit(0);'); } } }).run();
  assert.equal(result.reason, 'budget_exceeded');
  assert.equal(result.receipt.generations.length, 1);
  assert.equal(result.receipt.artifacts.length, 1);
  assert.match(await f.artifacts.read(result.receipt.artifacts[0]!.artifact, signal()), /process.exit/);
});

test('passing checks do not override uncertain or unsupported semantic judgments', async () => {
  for (const mode of ['uncertain', 'unsupported']) {
    const f = await fixture();
    const result = await new ManagedTestOperation({ request: f.request, validator: f.artifacts,
      currentBinding: s => f.artifacts.currentBinding(s), provider: { async evaluate(req) {
        const r = response(req);
        if (req.questions.continuation) {
          const a = r.answers[mode === 'uncertain' ? 'continuation' : 'requirement_0'];
          if (a?.type === 'choice') a.confidence = 0.1;
        }
        return r;
      } }, worker: { async generate(req) { return generated(req, good); } } }).run();
    assert.equal(result.reason, mode === 'uncertain' ? 'uncertain' : 'unsupported_candidate');
    assert.equal(result.receipt.validation, 'passed');
    assert.ok(result.artifact);
    await assert.rejects(f.artifacts.apply(result.artifact!, signal()));
  }
});

test('provider outage after execution preserves the staged artifact and observed check receipts', async () => {
  const f = await fixture();
  const result = await new ManagedTestOperation({ request: f.request, validator: f.artifacts,
    currentBinding: s => f.artifacts.currentBinding(s), provider: { async evaluate(req) {
      if (req.questions.continuation) throw new DecisionError('overloaded');
      return response(req);
    } }, worker: { async generate(req) { return generated(req, good); } } }).run();
  assert.equal(result.reason, 'overloaded');
  assert.equal(result.receipt.artifacts.length, 1);
  assert.equal(result.receipt.usage.jev.unknownUsageEntries, 1);
  const handle = result.receipt.artifacts[0]!.artifact;
  assert.equal(await f.artifacts.read(handle, signal()), good);
  await assert.rejects(f.artifacts.apply(handle, signal()));
});

test('stopped validation checkpoints remain reviewable without permitting continuation', async () => {
  const f = await fixture();
  const controller = new AbortController();
  const validator: ArtifactValidator = {
    async validate(c, attempt, s) {
      const value = await f.artifacts.validate(c, attempt, s);
      controller.abort();
      throw new DecisionError('cancelled');
    }, checkpoint: attempt => f.artifacts.checkpoint(attempt),
    async accept() { assert.fail('must not accept'); },
  };
  const result = await new ManagedTestOperation({ request: f.request, validator, signal: controller.signal,
    currentBinding: s => f.artifacts.currentBinding(s), provider: { async evaluate(req) { return response(req); } },
    worker: { async generate(req) { return generated(req, good); } } }).run();
  assert.equal(result.reason, 'cancelled');
  assert.equal(result.receipt.artifacts.length, 1);
  assert.equal(result.receipt.decisions.length, 2);
});

test('invalid UTF-8 and a symlink destination cannot evade source/preimage validation', async () => {
  const f = await fixture();
  await writeFile(f.options.sourcePath, Buffer.concat([Buffer.from(source + '//'), Buffer.from([0xff])]));
  await assert.rejects(NodeTestArtifacts.create(f.options));
  await writeFile(f.options.sourcePath, source);
  const validation = await f.artifacts.validate(candidate(good), 1, signal());
  await f.artifacts.accept(validation.artifact, signal());
  const other = join(f.root, 'other.ts');
  await writeFile(other, 'untouched');
  await symlink(other, join(f.root, 'sum.test.ts'));
  await assert.rejects(f.artifacts.apply(validation.artifact, signal()));
  assert.equal(await readFile(other, 'utf8'), 'untouched');
});
