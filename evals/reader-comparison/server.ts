import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { rename, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { DecisionError, hash, validateResult } from '@jevra/core';
import type { Provider, ProviderRequest } from '@jevra/core';
import { createTypeSafeProvider } from '@jevra/provider-typesafe';
import type { WorkerTransport } from '@jevra/core/worker';
import { readerAnswerSchema, readerPacket, resolveReaderCitations } from '../../packages/core/src/reader.ts';
import { loadConfig, readApiKey } from '../../packages/cli/src/config.ts';
import { CodexCliWorker } from '../../packages/cli/src/codex-worker.ts';
import { FocusedReaderSession } from '../../packages/cli/src/reader-session.ts';
import { bulkRead, approvedSource } from '../../packages/cli/src/bulk-read.ts';
import { loadPassages } from '../../packages/cli/src/context.ts';
import { codexUsage, jevUsage } from '../../packages/core/src/accounting.ts';
import type { Invocation, Reservation } from '../../packages/core/src/accounting.ts';

// Explicit evaluation control only. No bypass/fake Jev receipt is added to the plugin.
const { values } = parseArgs({ options: { arm: { type: 'string' }, config: { type: 'string' }, log: { type: 'string' } } });
if (!values.config || !values.log || !['excerpts', 'luna-full', 'jev-full', 'jev-selected'].includes(values.arm ?? '')) throw new Error('invalid_harness_arguments');
const config = await loadConfig(values.config), cwd = process.cwd();
const reservations: Reservation[] = [], journals: Invocation[] = [];
const save = async () => {
  const temporary = values.log! + '.' + randomUUID() + '.tmp';
  await writeFile(temporary, JSON.stringify({ reservations, journals }) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temporary, values.log!);
};
// A restarted server must preserve the previous ledger, not buy a new set of attempts.
await writeFile(values.log!, JSON.stringify({ reservations, journals }) + '\n', { mode: 0o600, flag: 'wx' });
const actualProvider = createTypeSafeProvider({ getApiKey: () => readApiKey(config) });
const provider: Provider = { async evaluate(request: ProviderRequest, signal: AbortSignal) {
  if (reservations.filter(r => r.component === 'managed_jev').length >= 4 || Buffer.byteLength(JSON.stringify(request)) > 49152) throw new DecisionError('budget_exceeded');
  const id = randomUUID(); reservations.push({ id, component: 'managed_jev' });
  const entry: Invocation & { answers?: unknown; requestHash?: string } = { id, component: 'managed_jev', status: 'started', usage: null, requestHash: hash(request) };
  journals.push(entry); await save();
  try {
    const raw = await actualProvider.evaluate(request, signal);
    const u = z.object({ input_tokens: z.number().int().nonnegative().safe(), output_tokens: z.number().int().nonnegative().safe() }).safeParse((raw as { usage?: unknown } | null)?.usage);
    if (u.success) entry.usage = jevUsage(u.data);
    entry.answers = validateResult(raw, request).answers; entry.status = 'completed'; return raw;
  } catch (error) { entry.status = 'failed'; throw error; } finally { await save(); }
} };
const actualWorker = new CodexCliWorker({ executable: config.bulkRead!.reader!.codexExecutable,
  limits: { maxInputBytes: 131072, maxArtifactBytes: 8000, maxOutputBytes: 65536 } });
const worker: WorkerTransport = { async generate(request, signal) {
  if (reservations.some(r => r.component === 'worker')) throw new DecisionError('budget_exceeded');
  const id = randomUUID(); reservations.push({ id, component: 'worker' });
  const entry: Invocation & { receipt?: unknown; failure?: string } = { id, component: 'worker', status: 'started', usage: null };
  journals.push(entry); await save();
  try {
    const r = await actualWorker.generate(request, signal); entry.receipt = r.receipt;
    entry.usage = codexUsage(r.receipt.usage); entry.usageComplete = r.receipt.usageComplete; entry.status = r.status === 'generated' ? 'completed' : 'failed';
    if (r.status === 'failed') entry.failure = r.reason;
    return r;
  } catch (error) { entry.status = 'failed'; throw error; } finally { await save(); }
} };
const session = values.arm!.startsWith('jev-') ? new FocusedReaderSession(config, provider, worker) : undefined;
const server = new McpServer({ name: 'jevra-reader-evaluation', version: '1' });
const shutdown = new AbortController(); server.server.onclose = () => shutdown.abort();
const schema = z.object({ question: z.string().trim().min(1).max(16384), paths: z.array(z.string().min(1).max(4096)).min(1).max(16) }).strict();
let active = false;
const read = async (question: string, paths: string[], signal: AbortSignal, forceExcerpts = false) => {
  if (active) throw new DecisionError('budget_exceeded'); active = true;
  try {
    if (values.arm !== 'luna-full' || forceExcerpts) {
      return await bulkRead({ query: question, paths, cwd, host: 'codex', sessionId: 'comparison', config, provider, signal,
        ...(session ? { readerSession: session } : {}), forceExcerpts: forceExcerpts || values.arm === 'excerpts' });
    }
    const sources = await Promise.all(paths.map(p => approvedSource(p, cwd, config.bulkRead!.roots)));
    const { roots: _roots, reader: _reader, transport: _transport, minLines: _lines, ...context } = config.bulkRead!;
    const passages = await loadPassages({ ...context, sources }, cwd, signal);
    const r = await worker.generate(readerPacket(randomUUID(), question, passages), signal);
    if (r.status !== 'generated') return { text: '', result: { reason: r.reason } };
    if (hash(passages) !== hash(await loadPassages({ ...context, sources }, cwd, signal))) throw new DecisionError('stale_state');
    const answer = readerAnswerSchema.parse(JSON.parse(r.candidate.content));
    return { text: JSON.stringify({ status: answer.status, claims: resolveReaderCitations(answer, passages), gaps: answer.gaps,
      scope: 'Evaluation control: exact citations checked, no semantic Jev review.' }), result: { reason: answer.status } };
  } finally { active = false; }
};
const respond = async (question: string, paths: string[], signal: AbortSignal, forceExcerpts = false) => {
  try { const r = await read(question, paths, AbortSignal.any([signal, shutdown.signal]), forceExcerpts);
    return { content: [{ type: 'text' as const, text: r.text || JSON.stringify({ status: 'fallback', reason: r.result?.reason, nextAction: 'Use native targeted reads.' }) }] };
  } catch { return { isError: true, content: [{ type: 'text' as const, text: 'Use native targeted reads; do not repeat paid generation.' }] }; }
};
server.registerTool('bulk_read', { description: 'Read approved source files for a focused question. Returns cited claims or partial original excerpts. Use targeted source reads before editing or on fallback.',
  inputSchema: schema, annotations: { readOnlyHint: true, openWorldHint: true } }, ({ question, paths }, extra) => respond(question, paths, extra.mcpReq.signal));
server.registerTool('code_context', { description: 'Return exact original reference excerpts; the main agent writes code.',
  inputSchema: z.object({ spec: schema.shape.question, references: schema.shape.paths }).strict(), annotations: { readOnlyHint: true, openWorldHint: true } },
({ spec, references }, extra) => respond(spec, references, extra.mcpReq.signal, true));
for (const s of ['SIGINT', 'SIGTERM'] as const) process.once(s, () => { shutdown.abort(); void server.close(); });
await server.connect(new StdioServerTransport());
