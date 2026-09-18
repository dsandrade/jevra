import { constants } from 'node:fs';
import { open, lstat, realpath, mkdir, mkdtemp, writeFile, rename, rm, link } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DecisionError, hash } from '@jevra/core';
import { evidenceHash, managedTestRequestSchema, sourceBinding } from '@jevra/core/managed-worker';
import type { ManagedTestRequest, SourceBinding } from '@jevra/core/managed-worker';
import { checksPassed } from '../../core/src/artifact.ts';
import type { ArtifactHandle, ArtifactValidation, ArtifactValidator, CheckReceipt } from '../../core/src/artifact.ts';
import { runWorkerProcess } from './worker-process.ts';
import { validatePureModule, validateTestModule } from './test-policy.ts';
import { testArtifactInstructions } from './test-guidance.ts';

const fileName = z.string().regex(/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.ts$/).max(120);
export const testArtifactOptionsSchema = z.object({
  sourcePath: z.string().refine(isAbsolute), outputName: fileName,
  exportName: z.string().regex(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/).max(80),
  stagingDirectory: z.string().refine(isAbsolute),
  mutants: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    content: z.string().min(1).max(32768) }).strict()).min(1).max(4),
  checkTimeoutMs: z.number().int().min(50).max(10000).default(3000),
}).strict();
const optionsSchema = testArtifactOptionsSchema;
export type TestArtifactOptions = z.input<typeof optionsSchema>;
type Record = { handle: ArtifactHandle; path: string; validation: ArtifactValidation; accepted: boolean; applied: boolean };

async function boundedRead(path: string): Promise<string> {
  const fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await fd.stat();
    if (!stat.isFile() || stat.size > 32768 || stat.nlink !== 1) throw new DecisionError('input_invalid');
    const bytes = Buffer.alloc(32769);
    let count = 0;
    while (count < bytes.length) {
      const read = await fd.read(bytes, count, bytes.length - count, count);
      if (!read.bytesRead) break;
      count += read.bytesRead;
    }
    if (count > 32768) throw new DecisionError('input_invalid');
    const raw = bytes.subarray(0, count), text = raw.toString('utf8');
    if (!Buffer.from(text).equals(raw)) throw new DecisionError('input_invalid');
    return text;
  } finally { await fd.close(); }
}
async function absent(path: string): Promise<boolean> {
  try { await lstat(path); return false; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true; throw error; }
}
async function privateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0
    || await realpath(path) !== resolve(path)) throw new DecisionError('input_invalid');
}
async function atomicWrite(path: string, body: string): Promise<void> {
  const temporary = path + '.' + randomUUID() + '.tmp';
  try {
    const fd = await open(temporary, 'wx', 0o600);
    try { await fd.writeFile(body); await fd.sync(); } finally { await fd.close(); }
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}

/** Internal Node/pure-function profile. It cannot accept model paths, commands or check receipts. */
export class NodeTestArtifacts implements ArtifactValidator {
  readonly #options: z.output<typeof optionsSchema>;
  readonly #source: string;
  readonly #scopeHash: string;
  readonly #root: string;
  readonly #arity: number;
  readonly #records = new Map<string, Record>();
  #request: ManagedTestRequest | undefined;
  #bindingHash: string | undefined;
  #busy = false;

  private constructor(options: z.output<typeof optionsSchema>, source: string, root: string, arity: number) {
    this.#options = options; this.#source = source; this.#root = root; this.#arity = arity;
    this.#scopeHash = hash({ profile: 'node-pure-function-tests/1', source: options.sourcePath,
      output: options.outputName, export: options.exportName, mutations: options.mutants.map(m => hash(m)), arity });
  }

  static async create(input: TestArtifactOptions): Promise<NodeTestArtifacts> {
    const parsed = optionsSchema.safeParse(input);
    if (!parsed.success || process.platform === 'win32' || process.versions.node !== '24.21.0') {
      throw new DecisionError('input_invalid');
    }
    const options = parsed.data, directory = dirname(options.sourcePath), name = basename(options.sourcePath);
    if (await realpath(directory) !== directory || !fileName.safeParse(name).success || options.outputName === name
      || !await absent(join(directory, options.outputName))) throw new DecisionError('input_invalid');
    const source = await boundedRead(options.sourcePath);
    let arity: number;
    try {
      arity = validatePureModule(source, options.exportName);
      if (new Set(options.mutants.map(m => m.id)).size !== options.mutants.length
        || new Set(options.mutants.map(m => evidenceHash(m.content))).size !== options.mutants.length
        || options.mutants.some(m => Buffer.byteLength(m.content) > 32768 || m.content === source
          || validatePureModule(m.content, options.exportName) !== arity)) {
        throw new Error('invalid_mutants');
      }
    } catch { throw new DecisionError('input_invalid'); }
    await privateDirectory(options.stagingDirectory);
    const root = await mkdtemp(join(options.stagingDirectory, 'test-artifact-'));
    return new NodeTestArtifacts(options, source, root, arity);
  }

  async currentBinding(signal: AbortSignal): Promise<SourceBinding> {
    signal.throwIfAborted();
    const directory = dirname(this.#options.sourcePath);
    if (await realpath(directory) !== directory) throw new DecisionError('stale_state');
    const content = await boundedRead(this.#options.sourcePath);
    const sourceHash = evidenceHash(content);
    const outputAbsent = await absent(join(directory, this.#options.outputName));
    signal.throwIfAborted();
    return { scopeHash: this.#scopeHash, stateRevision: hash({ sourceHash, outputAbsent }), evidenceHashes: { target_source: sourceHash } };
  }

  async prepare(input: Pick<ManagedTestRequest, 'operationId' | 'task' | 'requirements' | 'instructions'>): Promise<ManagedTestRequest> {
    if (this.#request) throw new DecisionError('input_invalid');
    const binding = await this.currentBinding(new AbortController().signal);
    if (binding.evidenceHashes.target_source !== evidenceHash(this.#source)) throw new DecisionError('stale_state');
    const request = managedTestRequestSchema.parse({ ...input, schemaVersion: 1, preference: 'managed',
      scopeHash: binding.scopeHash, stateRevision: binding.stateRevision,
      evidence: [{ id: 'target_source', sourceHash: evidenceHash(this.#source), content: this.#source }],
      instructions: [...input.instructions, ...testArtifactInstructions(basename(this.#options.sourcePath),
        this.#options.outputName, this.#options.exportName)],
    });
    this.#request = structuredClone(request); this.#bindingHash = hash(sourceBinding(request));
    return request;
  }

  async #fresh(signal: AbortSignal): Promise<void> {
    if (!this.#bindingHash || hash(await this.currentBinding(signal)) !== this.#bindingHash) throw new DecisionError('stale_state');
  }

  async #check(content: string, candidate: string, expectedTests: number, mutation: boolean,
    checkHash: string, signal: AbortSignal): Promise<CheckReceipt> {
    const execution = await mkdtemp(join(this.#root, 'check-'));
    const started = performance.now();
    try {
      await writeFile(join(execution, basename(this.#options.sourcePath)), content, { mode: 0o600, flag: 'wx' });
      await writeFile(join(execution, this.#options.outputName), candidate, { mode: 0o600, flag: 'wx' });
      // Only AST-admitted modules execute. Node permissions are defense in depth,
      // not a security sandbox for arbitrary JavaScript. No inherited environment.
      const result = await runWorkerProcess({ executable: process.execPath,
        args: ['--permission', '--allow-fs-read=' + execution, '--max-old-space-size=64',
          '--test-isolation=none', '--test-reporter=tap', '--test', this.#options.outputName],
        cwd: execution, env: { LANG: 'C', TZ: 'UTC' }, signal, timeoutMs: this.#options.checkTimeoutMs,
        killGraceMs: 100, maxOutputBytes: 32768, maxStderrBytes: 8192 });
      const output = result.stdout.toString('utf8');
      const tests = [...output.matchAll(/^# tests (\d+)$/gm)], failures = [...output.matchAll(/^# fail (\d+)$/gm)];
      const testCount = tests.length === 1 ? Number(tests[0]![1]) : 0;
      const failCount = failures.length === 1 ? Number(failures[0]![1]) : 0;
      let outcome: CheckReceipt['outcome'] = 'unavailable', reason: CheckReceipt['reason'] = 'invalid_report';
      if (!result.cleanupComplete) reason = 'cleanup_failed';
      else if (result.failure) reason = result.failure;
      else if (testCount === expectedTests && failures.length === 1 && failCount <= testCount
        && !/^# (?:cancelled|skipped|todo) [1-9]/m.test(output)) {
        if (result.exitCode === 0 && failCount === 0) {
          outcome = mutation ? 'failed' : 'passed'; reason = mutation ? 'mutant_survived' : 'assertions_passed';
        } else if (result.exitCode === 1 && failCount > 0 && /code: 'ERR_ASSERTION'/u.test(output)) {
          outcome = mutation ? 'passed' : 'failed'; reason = mutation ? 'mutant_detected' : 'assertions_failed';
        }
      }
      return { kind: mutation ? 'mutation' : 'baseline', checkHash, outcome, reason,
        exitCode: result.exitCode, tests: testCount, failures: failCount,
        durationMs: Math.round(performance.now() - started), cleanupComplete: result.cleanupComplete };
    } finally { await rm(execution, { recursive: true, force: true }); }
  }

  async validate(candidate: { content: string; sha256: string; bytes: number }, attempt: 1 | 2,
    signal: AbortSignal): Promise<ArtifactValidation> {
    if (this.#busy || this.#records.size >= 2 || attempt !== this.#records.size + 1
      || !candidate.bytes || candidate.bytes > 32768 || candidate.bytes !== Buffer.byteLength(candidate.content)
      || candidate.sha256 !== evidenceHash(candidate.content)) throw new DecisionError('input_invalid');
    this.#busy = true;
    try {
      await this.#fresh(signal);
      const handle: ArtifactHandle = { id: randomUUID(), candidateHash: candidate.sha256, bytes: candidate.bytes, attempt };
      const directory = join(this.#root, handle.id);
      await mkdir(directory, { mode: 0o700 });
      const path = join(directory, 'candidate.ts');
      await atomicWrite(path, candidate.content);
      const policy = validateTestModule(candidate.content, basename(this.#options.sourcePath), this.#options.exportName, this.#arity);
      const checks: CheckReceipt[] = [{ kind: 'syntax_policy', checkHash: hash({ policy: 'node-pure-function-tests/1', candidate: handle.candidateHash }),
        outcome: policy.valid ? 'passed' : 'failed', reason: policy.valid ? 'valid' : policy.reason,
        exitCode: null, tests: 0, failures: 0, durationMs: 0, cleanupComplete: true }];
      const validation: ArtifactValidation = { schemaVersion: 1, profile: 'node-pure-function-tests/1',
        bindingHash: this.#bindingHash!, artifact: handle, checks, requiredChecksPassed: false };
      const record: Record = { handle, path, validation, accepted: false, applied: false };
      this.#records.set(handle.id, record);
      // Persist the pending candidate before execution so failures retain reviewable work.
      await atomicWrite(join(directory, 'receipt.json'), JSON.stringify(validation, null, 2) + '\n');
      if (policy.valid) {
        checks.push(await this.#check(this.#source, candidate.content, policy.tests, false,
          hash({ source: evidenceHash(this.#source), candidate: candidate.sha256, kind: 'baseline' }), signal));
        if (checks[1]?.outcome === 'passed') for (const mutant of this.#options.mutants) {
          signal.throwIfAborted();
          checks.push(await this.#check(mutant.content, candidate.content, policy.tests, true,
            hash({ mutation: mutant.id, source: evidenceHash(mutant.content), candidate: candidate.sha256 }), signal));
        }
      }
      validation.requiredChecksPassed = checks.length === this.#options.mutants.length + 2 && checksPassed(validation);
      await atomicWrite(join(directory, 'receipt.json'), JSON.stringify(validation, null, 2) + '\n');
      await this.#fresh(signal);
      return structuredClone(validation);
    } finally { this.#busy = false; }
  }

  async #record(handle: ArtifactHandle, signal: AbortSignal): Promise<Record> {
    await this.#fresh(signal);
    const record = this.#records.get(handle.id);
    if (!record || hash(record.handle) !== hash(handle)) throw new DecisionError('input_invalid');
    const content = await boundedRead(record.path);
    if (evidenceHash(content) !== handle.candidateHash || Buffer.byteLength(content) !== handle.bytes) throw new DecisionError('stale_state');
    return record;
  }

  checkpoint(attempt: 1 | 2): ArtifactValidation | null {
    const record = [...this.#records.values()].find(r => r.handle.attempt === attempt);
    return record ? structuredClone(record.validation) : null;
  }

  async accept(handle: ArtifactHandle, signal: AbortSignal): Promise<void> {
    const record = await this.#record(handle, signal);
    if (!record.validation.requiredChecksPassed || !checksPassed(record.validation)) throw new DecisionError('input_invalid');
    record.accepted = true;
    await atomicWrite(join(dirname(record.path), 'accepted.json'), JSON.stringify({ artifact: handle,
      bindingHash: this.#bindingHash, status: 'accepted_for_review' }) + '\n');
  }

  async read(handle: ArtifactHandle, signal: AbortSignal): Promise<string> {
    return boundedRead((await this.#record(handle, signal)).path);
  }

  async exportAccepted(handle: ArtifactHandle, signal: AbortSignal): Promise<{ content: string; binding: SourceBinding }> {
    const record = await this.#record(handle, signal);
    if (!record.accepted || record.applied) throw new DecisionError('input_invalid');
    const content = await boundedRead(record.path), binding = await this.currentBinding(signal);
    if (hash(binding) !== this.#bindingHash || evidenceHash(content) !== handle.candidateHash) throw new DecisionError('stale_state');
    return { content, binding };
  }

  /** Explicit runtime-owned application step. Only the configured, still-absent destination is eligible. */
  async apply(handle: ArtifactHandle, signal: AbortSignal): Promise<{ status: 'applied'; candidateHash: string }> {
    const record = await this.#record(handle, signal);
    if (!record.accepted || record.applied) throw new DecisionError('input_invalid');
    const target = join(dirname(this.#options.sourcePath), this.#options.outputName);
    const temporary = join(dirname(target), '.jevra-' + randomUUID() + '.tmp');
    try {
      await writeFile(temporary, await boundedRead(record.path), { mode: 0o600, flag: 'wx' });
      await this.#fresh(signal);
      // link publishes a complete file atomically and fails if any target, including a symlink, exists.
      await link(temporary, target);
      record.applied = true;
      return { status: 'applied', candidateHash: handle.candidateHash };
    } finally { await rm(temporary, { force: true }); }
  }
}
