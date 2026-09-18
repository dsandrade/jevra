import { mkdir, mkdtemp, realpath, lstat, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DecisionError, hash, MODEL } from '@jevra/core';
import type { FailureCode, Host, Provider } from '@jevra/core';
import { ManagedTestOperation } from '@jevra/core/managed-worker';
import type { ManagedTestResult, ManagedOperationReceipt } from '@jevra/core/managed-worker';
import type { WorkerTransport } from '@jevra/core/worker';
import type { ArtifactHandle } from '../../core/src/artifact.ts';
import type { Config } from './config.ts';
import { CodexCliWorker } from './codex-worker.ts';
import { NodeTestArtifacts } from './test-artifacts.ts';
import { prepareMaterialization, issueMaterialization, materializeCommand } from './materialization.ts';
import type { MaterializationHandle, NativeApplicationContext } from './materialization.ts';

export const generateTestsSchema = z.object({
  operationId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  profileId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).optional(),
  source: z.string().trim().min(1).max(4096).optional(),
  task: z.string().trim().min(1).max(8192),
  requirements: z.array(z.string().trim().min(1).max(1024)).max(8).default([]),
}).strict().refine(v => Boolean(v.profileId) !== Boolean(v.source), 'Provide profileId or an exact configured source');
export const readTestArtifactSchema = z.object({
  operationId: generateTestsSchema.shape.operationId,
  artifactId: z.string().uuid(),
}).strict();
type Input = z.infer<typeof generateTestsSchema>;
type Settings = NonNullable<Config['testArtifacts']>;
type Entry = { inputHash: string; profileId: string; createdAt: number; receiptPath?: string;
  artifacts?: NodeTestArtifacts; bindingHash?: string; result?: ManagedTestResult;
  summary?: ReturnType<typeof summarize> & { materialization?: MaterializationHandle; materializeCommand?: string; destination?: string };
  failure?: FailureCode };
const REVIEW_TTL_MS = 600000;

function summarize(result: ManagedTestResult) {
  const handle = result.artifact ?? result.receipt.artifacts.at(-1)?.artifact ?? null;
  return { status: result.status, reason: result.reason, artifact: handle,
    validation: result.receipt.validation,
    checks: result.receipt.artifacts.at(-1)?.checks.map(c => ({ kind: c.kind, outcome: c.outcome,
      reason: c.reason, tests: c.tests, failures: c.failures })) ?? [],
    attempts: result.receipt.generations.length, usage: result.receipt.usage,
    ...(result.receipt.economics ? { economics: { mode: result.receipt.economics.mode,
      metric: result.receipt.economics.metric, judgment: result.receipt.economics.judgment,
      applied: result.receipt.economics.applied, issues: result.receipt.economics.issues } } : {}),
    actualBilledUsd: null, subscriptionUsage: null,
    nextAction: handle ? 'Read the staged artifact for review. Only accepted output is eligible for native application.'
      : 'Continue with the native host. Do not retry with a new operation ID.' };
}

function inScope(root: string, file: string): boolean {
  const path = relative(root, resolve(file));
  return path !== '' && path !== '..' && !path.startsWith('../') && !isAbsolute(path);
}

/** A host-owned process session. No caller-supplied paths, commands, success or approval flags. */
export class ArtifactSession {
  readonly #config: Settings;
  readonly #cwd: string;
  readonly #provider: Provider;
  readonly #worker: WorkerTransport;
  readonly #fullConfig: Config;
  readonly #application: NativeApplicationContext | undefined;
  readonly #host: Host | null;
  readonly #sessionId = randomUUID();
  readonly #entries = new Map<string, Entry>();
  #active = false;
  #directory: string | undefined;

  constructor(config: Config, provider: Provider, cwd: string, worker?: WorkerTransport, application?: NativeApplicationContext, host?: Host) {
    if (config.mode !== 'advise' || !config.testArtifacts?.enabled || config.model !== MODEL
      || process.env.JEVRA_WORKER_ACTIVE === '1') throw new DecisionError('config_invalid');
    this.#config = structuredClone(config.testArtifacts);
    this.#fullConfig = structuredClone(config);
    this.#application = application ? structuredClone(application) : undefined;
    this.#host = host ?? null;
    this.#provider = provider; this.#cwd = resolve(cwd);
    this.#worker = worker ?? new CodexCliWorker({ executable: this.#config.codexExecutable,
      limits: { timeoutMs: 60000, maxArtifactBytes: 32768 } });
  }

  list() {
    return { profile: this.#config.experimentalProfile, maxOperations: this.#config.maxOperations,
      remainingOperations: Math.max(0, this.#config.maxOperations - this.#entries.size),
      profiles: this.#config.profiles.filter(p => inScope(this.#cwd, p.sourcePath)).map(p => ({
        id: p.id, source: relative(this.#cwd, p.sourcePath), exportName: p.exportName,
        output: relative(this.#cwd, join(dirname(p.sourcePath), p.outputName)), requirements: p.requirements,
        alreadyRequested: [...this.#entries.values()].some(e => e.profileId === p.id),
      })), application: 'native_host_only', delivery: this.#config.delivery, reviewExpiryMs: REVIEW_TTL_MS };
  }

  async #initializeDirectory(): Promise<string> {
    if (this.#directory) return this.#directory;
    const directory = this.#config.stagingDirectory;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0
      || await realpath(directory) !== resolve(directory)) throw new DecisionError('config_invalid');
    this.#directory = await mkdtemp(join(directory, 'mcp-session-'));
    return this.#directory;
  }

  async #persist(entry: Entry, receipt?: ManagedOperationReceipt): Promise<void> {
    if (!entry.receiptPath) throw new DecisionError('trace_unavailable');
    const temporary = entry.receiptPath + '.tmp';
    try {
      await writeFile(temporary, JSON.stringify({ schemaVersion: 1, inputHash: entry.inputHash,
        profileHash: hash(entry.profileId), createdAt: entry.createdAt, status: entry.failure ?? entry.result?.status ?? 'started',
        managedStatus: entry.result?.status ?? null, managedReason: entry.result?.reason ?? null, deliveryFailure: entry.failure ?? null,
        receipt: receipt ?? entry.result?.receipt ?? null, application: 'native_host_unobserved' }) + '\n',
      { flag: 'wx', mode: 0o600 });
      await rename(temporary, entry.receiptPath);
    } catch { throw new DecisionError('trace_unavailable'); }
    finally { await rm(temporary, { force: true }); }
  }

  async #fresh(entry: Entry, signal: AbortSignal): Promise<void> {
    if (Date.now() - entry.createdAt > REVIEW_TTL_MS) throw new DecisionError('stale_state');
    signal.throwIfAborted();
    if (entry.artifacts && entry.bindingHash && hash(await entry.artifacts.currentBinding(signal)) !== entry.bindingHash) {
      throw new DecisionError('stale_state');
    }
  }

  async generate(value: unknown, signal: AbortSignal) {
    const parsed = generateTestsSchema.safeParse(value);
    if (!parsed.success) throw new DecisionError('input_invalid');
    const input: Input = parsed.data, inputHash = hash(input);
    // A duplicate cannot start another provider request, including while the first is active.
    const previous = this.#entries.get(input.operationId);
    if (previous) {
      if (previous.inputHash !== inputHash) throw new DecisionError('input_invalid');
      await this.#fresh(previous, signal);
      if (previous.summary) return { operationId: input.operationId, ...structuredClone(previous.summary), replayed: true };
      return { operationId: input.operationId, status: 'unresolved', reason: previous.failure ?? 'operation_in_progress', replayed: true };
    }
    if (this.#active) throw new DecisionError('budget_exceeded');
    if (this.#entries.size >= this.#config.maxOperations) throw new DecisionError('budget_exceeded');
    const matches = this.#config.profiles.filter(p => input.profileId ? p.id === input.profileId
      : p.sourcePath === resolve(this.#cwd, input.source!));
    // Exact configured identity is mechanical. Ambiguous scope never picks the first profile.
    const profile = matches.length === 1 ? matches[0] : undefined;
    if (!profile || !inScope(this.#cwd, profile.sourcePath)) {
      throw new DecisionError('input_invalid');
    }
    if ([...this.#entries.values()].some(e => e.profileId === profile.id)) throw new DecisionError('budget_exceeded');
    signal.throwIfAborted();
    // Reserve before asynchronous preparation; setup failures also consume the session slot.
    const entry: Entry = { inputHash, profileId: profile.id, createdAt: Date.now() };
    this.#entries.set(input.operationId, entry); this.#active = true;
    try {
      if (await realpath(this.#cwd) !== this.#cwd) throw new DecisionError('input_invalid');
      if (this.#config.delivery === 'native-ticket') {
        if (!this.#application) throw new DecisionError('config_invalid');
        await prepareMaterialization(this.#fullConfig, this.#cwd, this.#application);
      }
      const directory = await this.#initializeDirectory();
      entry.receiptPath = join(directory, randomUUID() + '.json');
      await this.#persist(entry);
      const { id: _id, instructions, requirements, ...options } = profile;
      const artifacts = await NodeTestArtifacts.create({ ...options, stagingDirectory: directory });
      entry.artifacts = artifacts;
      const request = await artifacts.prepare({ operationId: input.operationId, task: input.task,
        requirements: [...new Set([...requirements, ...input.requirements])], instructions });
      entry.bindingHash = hash(await artifacts.currentBinding(signal));
      const result = await new ManagedTestOperation({ request, provider: this.#provider, worker: this.#worker,
        packetMode: this.#config.packetMode,
        validator: artifacts, currentBinding: s => artifacts.currentBinding(s), signal,
        ...(this.#config.economics ? { economics: { config: this.#config.economics,
          context: { host: this.#host, delivery: this.#config.delivery } } } : {}) }).run();
      entry.result = result;
      await this.#persist(entry, result.receipt);
      await this.#fresh(entry, signal);
      entry.summary = summarize(result);
      if (this.#config.delivery === 'native-ticket' && result.status === 'accepted' && result.artifact) {
        const ticket = await issueMaterialization(this.#fullConfig, this.#cwd, this.#sessionId, profile.id,
          artifacts, result.artifact, signal);
        entry.summary = { ...entry.summary, materialization: ticket,
          materializeCommand: materializeCommand(this.#application!, ticket),
          destination: relative(this.#cwd, join(dirname(profile.sourcePath), profile.outputName)),
          nextAction: 'Use the materializeCommand under native host permissions and existing task authorization. '
            + 'It creates only the bound absent destination without emitting the file body. '
            + 'Use targeted review and relevant native verification; do not read and retype the entire artifact by default.' };
      }
      return { operationId: input.operationId, ...structuredClone(entry.summary), replayed: false };
    } catch (error) {
      entry.failure = signal.aborted ? 'cancelled' : error instanceof DecisionError ? error.code : 'input_invalid';
      // Retain actual usage if delivery fails; never restart inference on a replay.
      if (entry.receiptPath) await this.#persist(entry).catch(() => {});
      throw new DecisionError(entry.failure);
    } finally { this.#active = false; }
  }

  async read(value: unknown, signal: AbortSignal) {
    const parsed = readTestArtifactSchema.safeParse(value);
    if (!parsed.success) throw new DecisionError('input_invalid');
    const { operationId, artifactId } = parsed.data;
    const entry = this.#entries.get(operationId);
    const handle: ArtifactHandle | undefined = entry?.result?.receipt.artifacts.find(a => a.artifact.id === artifactId)?.artifact;
    if (!entry?.artifacts || !entry.summary || !handle || entry.summary.artifact?.id !== artifactId) {
      throw new DecisionError('input_invalid');
    }
    await this.#fresh(entry, signal);
    const content = await entry.artifacts.read(handle, signal);
    const binding = await entry.artifacts.currentBinding(signal);
    if (hash(binding) !== entry.bindingHash) throw new DecisionError('stale_state');
    const profile = this.#config.profiles.find(p => p.id === entry.profileId)!;
    return { operationId, status: entry.result!.status, artifact: handle, content,
      source: { path: profile.sourcePath, sha256: binding.evidenceHashes.target_source },
      destination: join(dirname(profile.sourcePath), profile.outputName),
      application: 'native_host_only', nextAction: entry.result!.status === 'accepted'
        ? 'Review against the user request. Use native host permissions to create the absent destination with these exact bytes; recheck source hash and output absence immediately before writing. Native edits and checks are outside this managed receipt.'
        : 'Not accepted. Do not apply as validated output. Continue through the native host with the failure evidence.' };
  }
}
