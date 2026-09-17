import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { DecisionError, hash, withDeadline } from '@jevra/core';
import type { Event, Provider } from '@jevra/core';
import { chunkDocument, CONTEXT_VERSION, renderContext, selectContext } from '@jevra/core/context';
import type { ContextResult, Passage } from '@jevra/core/context';
import { statePath } from './config.ts';
import type { Config, ContextConfig } from './config.ts';
import { appendTrace } from './trace.ts';
import type { ContextTrace } from './trace.ts';

export async function loadPassages(context: ContextConfig, cwd: string, signal?: AbortSignal): Promise<Passage[]> {
  const passages: Passage[] = [];
  let total = 0;
  for (const source of [...new Set(context.sources)].sort()) {
    signal?.throwIfAborted();
    // Explicit files only. Reject redirected sources rather than expanding the scope.
    if (await realpath(source) !== resolve(source)) throw new DecisionError('catalog_unavailable');
    const file = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    let text: string;
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size > context.maxFileBytes) throw new DecisionError('budget_exceeded');
      const bytes = Buffer.alloc(context.maxFileBytes + 1);
      let length = 0;
      while (length < bytes.length) {
        signal?.throwIfAborted();
        const read = await file.read(bytes, length, bytes.length - length, length);
        if (!read.bytesRead) break;
        length += read.bytesRead;
      }
      total += length;
      if (length > context.maxFileBytes || total > context.maxTotalBytes) throw new DecisionError('budget_exceeded');
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length));
      if (text.includes('\0')) throw new DecisionError('input_invalid');
    } finally { await file.close(); }
    passages.push(...chunkDocument(relative(cwd, source), text, context.chunkBytes));
    if (passages.length > context.maxPassages) throw new DecisionError('budget_exceeded');
  }
  return passages;
}

export async function runContext(event: Event, config: Config, provider: Provider, signal?: AbortSignal) {
  const context = config.context;
  if (!context || config.mode === 'disabled') return { text: '', result: null };
  const start = performance.now();
  let passages: Passage[] = [];
  let result: ContextResult = { version: CONTEXT_VERSION, backend: context.backend, reason: 'catalog_unavailable',
    selected: [], candidateCount: 0, shortlistedCount: 0, sourceBytes: 0, outputBytes: 0,
    requestBytes: 0, evaluationAttempts: 0, providerModel: null, usage: null, latencyMs: 0 };
  try {
    passages = await withDeadline(s => loadPassages(context, event.cwd, s), context.timeoutMs, signal);
    const remaining = context.timeoutMs - (performance.now() - start);
    if (remaining <= 0) throw new DecisionError('timeout');
    result = await selectContext({ ...context, query: event.prompt, passages, provider, model: config.model,
      maxRequestBytes: config.maxRequestBytes, timeoutMs: remaining, ...(signal ? { signal } : {}) });
    if (result.selected.length) {
      const remaining = context.timeoutMs - (performance.now() - start);
      if (remaining <= 0) throw new DecisionError('timeout');
      const current = await withDeadline(s => loadPassages(context, event.cwd, s), remaining, signal);
      if (hash(current) !== hash(passages)) throw new DecisionError('stale_state');
    }
  } catch (error) {
    result = { ...result, selected: [], outputBytes: 0,
      reason: signal?.aborted ? 'cancelled' : error instanceof DecisionError ? error.code : 'catalog_unavailable' };
  }
  if (signal?.aborted) result = { ...result, selected: [], outputBytes: 0, reason: 'cancelled' };
  let text = config.mode === 'advise' ? renderContext(result) : '';
  if (Buffer.byteLength(text) > context.maxOutputBytes) {
    result = { ...result, selected: [], outputBytes: 0, reason: 'budget_exceeded' };
    text = '';
  }
  if (config.traces) {
    const trace: ContextTrace = { schemaVersion: 1, timestamp: new Date().toISOString(),
      module: 'context-selection', host: event.host, mode: config.mode, backend: context.backend,
      sessionHash: hash(event.sessionId), eventHash: hash([event.sessionId, event.eventId]),
      stateRevision: hash(passages.map(p => [p.id, p.contentHash])), questionVersion: CONTEXT_VERSION,
      policyVersion: CONTEXT_VERSION, policyHash: hash(context), reasonCode: result.reason,
      disposition: result.selected.length ? 'recommend' : 'fallback', selectedCandidateId: null,
      selectedIds: result.selected.map(p => p.id), candidateCount: result.candidateCount,
      providerModel: result.providerModel, usage: result.usage, evaluationAttempts: result.evaluationAttempts,
      latencyMs: result.latencyMs, totalLatencyMs: Math.round(performance.now() - start),
      delivery: text ? 'output_prepared' : 'none', adherence: 'unknown',
      sourceBytes: result.sourceBytes, outputBytes: Buffer.byteLength(text), requestBytes: result.requestBytes,
      shortlistedCount: result.shortlistedCount };
    try { await withDeadline(() => appendTrace(statePath(config), trace, config.retentionDays), 250); }
    catch { process.stderr.write('jevra: trace_unavailable\n'); }
  }
  return { text: signal?.aborted ? '' : text, result };
}
