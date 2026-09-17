import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { DecisionError, hash } from '@jevra/core';
import type { Decision, Event, Mode } from '@jevra/core';

export interface Trace {
  schemaVersion: 1;
  timestamp: string;
  host: string;
  mode: Mode;
  sessionHash: string;
  eventHash: string;
  stateRevision: string;
  questionVersion: string;
  policyVersion: string;
  policyHash: string;
  reasonCode: string;
  disposition: string;
  selectedCandidateId: string | null;
  candidateCount: number;
  providerModel: string | null;
  usage: Decision['usage'];
  evaluationAttempts: number;
  latencyMs: number;
  totalLatencyMs: number;
  delivery: 'output_prepared' | 'none';
  adherence: 'unknown';
}

export interface ContextTrace extends Trace {
  module: 'context-selection';
  backend: string;
  selectedIds: string[];
  sourceBytes: number;
  outputBytes: number;
  requestBytes: number;
  shortlistedCount: number;
}

export interface GateTrace {
  schemaVersion: 1; timestamp: string; module: 'bulk-read-gate'; host: string;
  sessionHash: string; eventHash: string; action: string; sourceCount: number; maxLines: number; evaluationAttempts: 0;
}

export function makeTrace(event: Event, decision: Decision, mode: Mode, candidateCount: number,
  outputPrepared: boolean, totalLatencyMs: number, policy: unknown): Trace {
  return {
    schemaVersion: 1, timestamp: new Date().toISOString(), host: event.host, mode,
    sessionHash: hash(event.sessionId), eventHash: hash([event.sessionId, event.eventId]),
    stateRevision: decision.stateRevision, questionVersion: decision.questionVersion,
    policyVersion: decision.policyVersion, policyHash: hash(policy),
    reasonCode: decision.reasonCode, disposition: decision.disposition,
    selectedCandidateId: decision.selectedCandidateId, candidateCount,
    providerModel: decision.providerModel, usage: decision.usage,
    evaluationAttempts: decision.requests, latencyMs: decision.latencyMs,
    totalLatencyMs: Math.round(totalLatencyMs),
    delivery: outputPrepared ? 'output_prepared' : 'none', adherence: 'unknown',
  };
}

export async function traceDirectory(stateDirectory: string): Promise<string> {
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  if ((await lstat(stateDirectory)).isSymbolicLink()) throw new DecisionError('trace_unavailable');
  const directory = join(stateDirectory, 'traces');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await lstat(directory)).isSymbolicLink()) throw new DecisionError('trace_unavailable');
  return directory;
}

export async function appendTrace(stateDirectory: string, trace: Trace | ContextTrace | GateTrace, retentionDays: number): Promise<void> {
  const directory = await traceDirectory(stateDirectory);
  const now = Date.now();
  for (const name of await readdir(directory)) {
    if (!/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)) continue;
    if (now - Date.parse(name.slice(0, 10) + 'T00:00:00Z') > retentionDays * 86400000) {
      try { await unlink(join(directory, name)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
  const file = await open(join(directory, trace.timestamp.slice(0, 10) + '.jsonl'),
    constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | constants.O_NOFOLLOW, 0o600);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > 10 * 1024 * 1024) throw new DecisionError('trace_unavailable');
    await file.appendFile(JSON.stringify(trace) + '\n');
  } finally { await file.close(); }
}

export async function clearTraces(stateDirectory: string): Promise<number> {
  const directory = await traceDirectory(stateDirectory);
  let removed = 0;
  for (const name of await readdir(directory)) {
    if (/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)) { await unlink(join(directory, name)); removed++; }
  }
  return removed;
}
