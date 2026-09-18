import { mkdir, writeFile, rename } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { DecisionError, hash, withDeadline } from '@jevra/core';
import { evidenceHash } from '@jevra/core/managed-worker';
import type { WorkerRequest, WorkerReceipt, WorkerTransport } from '@jevra/core/worker';
import { checksPassed } from '../../packages/core/src/artifact.ts';
import type { ArtifactValidation } from '../../packages/core/src/artifact.ts';
import { generateTestsSchema, readTestArtifactSchema } from '../../packages/cli/src/artifact-session.ts';
import { NodeTestArtifacts } from '../../packages/cli/src/test-artifacts.ts';
import type { Config } from '../../packages/cli/src/config.ts';

/** Experimental control only. Not imported by the production bundle; never fabricates Jev answers. */
export class FixedWorkerControl {
  readonly config: NonNullable<Config['testArtifacts']>;
  readonly worker: WorkerTransport;
  readonly generations: WorkerReceipt[] = [];
  readonly validations: ArtifactValidation[] = [];
  inputHash: string | null = null;
  bindingHash: string | null = null;
  artifacts: NodeTestArtifacts | null = null;
  status = 'started';
  reason = 'operation_in_progress';
  createdAt = Date.now();
  summary: any = null;
  operationId: string | null = null;
  constructor(config: Config, worker: WorkerTransport) {
    if (!config.testArtifacts || config.testArtifacts.profiles.length !== 1) throw new DecisionError('input_invalid');
    this.config = structuredClone(config.testArtifacts); this.worker = worker;
  }
  list() {
    const p = this.config.profiles[0]!;
    return { profile: this.config.experimentalProfile, profiles: [{ id: p.id, source: basename(p.sourcePath), exportName: p.exportName,
      output: p.outputName, requirements: p.requirements,
      alreadyRequested: this.inputHash !== null }], maxOperations: 1,
      remainingOperations: this.inputHash === null ? 1 : 0, application: 'native_host_only', reviewExpiryMs: 600000 };
  }
  async persist() {
    await mkdir(this.config.stagingDirectory, { recursive: true, mode: 0o700 });
    const file = join(this.config.stagingDirectory, 'control.json');
    await writeFile(file + '.tmp', JSON.stringify({ kind: 'fixed-worker-control', status: this.status,
      reason: this.reason, inputHash: this.inputHash, bindingHash: this.bindingHash,
      generations: this.generations, artifacts: this.validations, assurance: 'deterministic_checks_only',
      candidateHash: this.validations.at(-1)?.artifact.candidateHash ?? null }) + '\n', { mode: 0o600 });
    await rename(file + '.tmp', file);
  }
  async fresh(signal: AbortSignal) {
    signal.throwIfAborted();
    if (Date.now() - this.createdAt > 600000 || this.artifacts && this.bindingHash
      && hash(await this.artifacts.currentBinding(signal)) !== this.bindingHash) throw new DecisionError('stale_state');
  }
  async generate(value: unknown, signal: AbortSignal) {
    const parsed = generateTestsSchema.safeParse(value);
    if (!parsed.success) throw new DecisionError('input_invalid');
    const input = parsed.data, p = this.config.profiles[0]!;
    if (input.profileId !== p.id) throw new DecisionError('input_invalid');
    if (this.inputHash !== null) {
      if (input.operationId !== this.operationId) throw new DecisionError('budget_exceeded');
      if (hash(input) !== this.inputHash) throw new DecisionError('input_invalid');
      await this.fresh(signal);
      return this.summary ?? { status: 'unresolved', reason: this.reason };
    }
    this.inputHash = hash(input); this.operationId = input.operationId; this.createdAt = Date.now();
    await this.persist();
    let pending: Promise<void> | undefined;
    try {
      const { id: _id, instructions, requirements, ...options } = p;
      const artifacts = this.artifacts = await NodeTestArtifacts.create({ ...options, stagingDirectory: this.config.stagingDirectory });
      const req = await artifacts.prepare({ operationId: input.operationId, task: input.task,
        instructions, requirements: [...requirements, ...input.requirements] });
      this.bindingHash = hash(await artifacts.currentBinding(signal));
      const flow = async (deadline: AbortSignal) => {
        let previous: { content: string; validation: ArtifactValidation } | null = null;
        for (const attempt of [1, 2] as const) {
          await this.fresh(deadline);
          const evidence = [...req.evidence];
          if (previous) {
            for (const [id, content] of [['jevra_previous_candidate', previous.content],
              ['jevra_observed_checks', JSON.stringify(previous.validation.checks)]]) {
              evidence.push({ id: id!, content: content!, sourceHash: evidenceHash(content!) });
            }
          }
          const packet: WorkerRequest = { schemaVersion: 1, operationId: req.operationId,
            attempt, profile: attempt === 1 ? 'artifact-writer/tests' : 'artifact-writer/repair',
            task: req.task, requirements: req.requirements, evidence,
            instructions: previous ? [...req.instructions,
              'Repair the previous candidate using the original requirements and observed check outcomes. '
              + 'Return a complete replacement test file. Do not claim checks passed. There are no further repair attempts.'] : req.instructions };
          if (Buffer.byteLength(JSON.stringify(packet)) > 49152) throw new DecisionError('budget_exceeded');
          const generated = await this.worker.generate(packet, deadline);
          this.generations.push(generated.receipt); await this.persist();
          await this.fresh(deadline);
          if (generated.status !== 'generated') { this.reason = generated.reason; break; }
          const validation = await artifacts.validate(generated.candidate, attempt, deadline);
          this.validations.push(validation); await this.persist();
          await this.fresh(deadline);
          if (checksPassed(validation) && validation.requiredChecksPassed) {
            await artifacts.accept(validation.artifact, deadline); this.status = 'accepted'; this.reason = 'accepted'; break;
          }
          if (validation.checks.some(c => c.outcome === 'unavailable' || !c.cleanupComplete)) {
            this.reason = 'validation_unavailable'; break;
          }
          previous = { content: generated.candidate.content, validation }; this.reason = 'repair_exhausted';
        }
      };
      await withDeadline(deadline => { pending = flow(deadline); return pending; }, 180000, signal);
      await this.fresh(signal);
    } catch (error) {
      if (pending) await withDeadline(() => pending!, 1500).catch(() => {});
      this.status = 'unresolved';
      this.reason = signal.aborted ? 'cancelled' : error instanceof DecisionError ? error.code : 'input_invalid';
    }
    if (this.status !== 'accepted') this.status = 'unresolved';
    await this.persist();
    const last = this.validations.at(-1);
    this.summary = { operationId: input.operationId, status: this.status, reason: this.reason,
      artifact: last?.artifact ?? null, validation: last?.requiredChecksPassed ? 'passed' : 'failed',
      checks: last?.checks.map(c => ({ kind: c.kind, outcome: c.outcome, reason: c.reason, tests: c.tests, failures: c.failures })) ?? [],
      attempts: this.generations.length, assurance: 'deterministic_checks_only',
      nextAction: 'Read the staged artifact for review. Only accepted output is eligible for native application.' };
    return structuredClone(this.summary);
  }
  async read(value: unknown, signal: AbortSignal) {
    const { operationId, artifactId } = readTestArtifactSchema.parse(value), handle = this.validations.at(-1)?.artifact;
    if (!this.artifacts || !handle || handle.id !== artifactId || operationId !== this.operationId || !this.summary) {
      throw new DecisionError('input_invalid');
    }
    await this.fresh(signal);
    const content = await this.artifacts.read(handle, signal);
    await this.fresh(signal);
    const p = this.config.profiles[0]!;
    return { operationId, status: this.status, artifact: handle, content,
      source: { path: p.sourcePath, sha256: (await this.artifacts.currentBinding(signal)).evidenceHashes.target_source },
      destination: join(dirname(p.sourcePath), p.outputName), application: 'native_host_only',
      nextAction: this.status === 'accepted' ? 'Review and create the absent output using native permissions and these exact bytes; verify source hash first.'
        : 'Not accepted. Continue natively with the failure evidence.' };
  }
}
