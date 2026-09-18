import { randomUUID } from 'node:crypto';
import { mkdir, realpath, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DecisionError, hash, MODEL, withDeadline } from '@jevra/core';
import type { Provider } from '@jevra/core';
import { focusedRead, READER_VERSION } from '../../core/src/reader.ts';
import type { ReaderReceipt, ReaderResult } from '../../core/src/reader.ts';
import type { WorkerTransport } from '@jevra/core/worker';
import { CodexCliWorker } from './codex-worker.ts';
import { loadPassages } from './context.ts';
import { statePath } from './config.ts';
import type { Config, ContextConfig } from './config.ts';

interface Entry { createdAt: number; promise: Promise<ReaderResult> }
/** One MCP/CLI session. Identical packets join one attempt, including failed attempts. */
export class FocusedReaderSession {
  readonly #config: Config;
  readonly #provider: Provider;
  readonly #worker: WorkerTransport;
  readonly #entries = new Map<string, Entry>();
  readonly #directory: string;
  #active = false;
  constructor(config: Config, provider: Provider, worker?: WorkerTransport) {
    const settings = config.bulkRead?.reader;
    if (!settings?.enabled || config.mode !== 'advise' || config.model !== MODEL
      || process.env.JEVRA_WORKER_ACTIVE === '1') throw new DecisionError('config_invalid');
    this.#config = structuredClone(config); this.#provider = provider;
    this.#worker = worker ?? new CodexCliWorker({ executable: settings.codexExecutable,
      limits: { maxInputBytes: settings.maxWorkerBytes, maxArtifactBytes: settings.maxOutputBytes,
        maxOutputBytes: 65536, timeoutMs: Math.min(120000, settings.operationTimeoutMs) } });
    this.#directory = join(statePath(config), 'readers', randomUUID());
  }
  async read(query: string, context: ContextConfig, cwd: string, callerSession: string, signal?: AbortSignal): Promise<ReaderResult> {
    const settings = this.#config.bulkRead!.reader!;
    context = structuredClone(context);
    context.sources = [...new Set(context.sources)].sort();
    const passages = await withDeadline(s => loadPassages(context, cwd, s), context.timeoutMs, signal);
    const scopeHash = hash([resolve(cwd), context, callerSession, this.#config.model, settings]);
    const key = hash([READER_VERSION, query, scopeHash, passages]);
    const existing = this.#entries.get(key);
    if (existing) {
      if (Date.now() - existing.createdAt >= settings.ttlMs) throw new DecisionError('stale_state');
      const result = await existing.promise;
      signal?.throwIfAborted();
      const current = await withDeadline(s => loadPassages(context, cwd, s), context.timeoutMs, signal);
      if (hash(current) !== hash(passages)) throw new DecisionError('stale_state');
      return structuredClone(result);
    }
    if (this.#active || this.#entries.size >= settings.maxOperations) throw new DecisionError('budget_exceeded');
    this.#active = true;
    const operationId = randomUUID();
    // Reserve synchronously; the deferred body cannot start paid work before the entry exists.
    const promise = Promise.resolve().then(async () => {
      try {
        await mkdir(this.#directory, { recursive: true, mode: 0o700 });
        if (await realpath(this.#directory) !== resolve(this.#directory)) throw new DecisionError('config_invalid');
        const persist = async (receipt: ReaderReceipt) => {
          const temporary = join(this.#directory, randomUUID() + '.tmp');
          await writeFile(temporary, JSON.stringify(receipt) + '\n', { flag: 'wx', mode: 0o600 });
          await rename(temporary, join(this.#directory, operationId + '.json'));
        };
        const { enabled: _enabled, experimentalProfile: _profile, codexExecutable: _exe,
          maxOperations: _operations, ttlMs: _ttl, ...policy } = settings;
        return await focusedRead({ operationId, query, passages, scopeHash, policy,
          provider: this.#provider, worker: this.#worker, ...(signal ? { signal } : {}), persist,
          currentPassages: s => loadPassages(context, cwd, s) });
      } finally { this.#active = false; }
    });
    this.#entries.set(key, { createdAt: Date.now(), promise });
    return structuredClone(await promise);
  }
}
