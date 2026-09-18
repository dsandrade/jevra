import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DecisionError } from '@jevra/core';
import type { Host, Provider } from '@jevra/core';
import { MODEL } from '@jevra/core';
import type { WorkerTransport } from '@jevra/core/worker';
import type { Config } from './config.ts';
import { bulkRead } from './bulk-read.ts';
import { ArtifactSession, generateTestsSchema, readTestArtifactSchema } from './artifact-session.ts';
import type { NativeApplicationContext } from './materialization.ts';
import { FocusedReaderSession } from './reader-session.ts';

/** Dependency injection is internal to credential-free tests, never user/model configuration. */
export function createMcpServer(config: Config, host: Host, provider: Provider, cwd: string, worker?: WorkerTransport,
  application?: NativeApplicationContext) {
  const server = new McpServer({ name: 'jevra', version: '0.1.0-alpha.2' });
  const sessionId = randomUUID();
  const shutdown = new AbortController();
  server.server.onclose = () => shutdown.abort();
  const readerSession = config.mode === 'advise' && config.bulkRead?.reader?.enabled && config.model === MODEL
    && process.env.JEVRA_WORKER_ACTIVE !== '1' ? new FocusedReaderSession(config, provider, worker) : undefined;
  const query = z.string().trim().min(1).max(16384);
  const paths = z.array(z.string().min(1).max(4096)).min(1).max(16);
  const session = z.string().min(1).max(256).optional();
  let active = false;
  const retrieve = async (question: string, files: string[], callerSession: string | undefined, signal: AbortSignal, forceExcerpts = false) => {
    if (active) return { isError: true, content: [{ type: 'text' as const, text: 'Jevra is busy. Combine files in one request or use native targeted reads.' }] };
    active = true;
    try {
      const output = await bulkRead({ query: question, paths: files, cwd, host, sessionId: callerSession ?? sessionId,
        config, provider, signal: AbortSignal.any([signal, shutdown.signal]), forceExcerpts,
        ...(readerSession ? { readerSession } : {}) });
      return { content: [{ type: 'text' as const, text: output.text || JSON.stringify({ status: 'fallback',
        reason: output.result?.reason ?? 'unavailable', nextAction: 'Read the relevant source ranges with native tools.' }) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ status: 'fallback',
        reason: error instanceof DecisionError ? error.code : 'input_invalid', nextAction: 'Use native targeted reads.' }) }] };
    } finally { active = false; }
  };
  const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true };
  server.registerTool('bulk_read', {
    description: 'Read approved source files for a focused question. When the experimental focused reader is configured, Luna summarizes and Jev reviews claims; citations must match exact source text. Otherwise returns partial original excerpts. Use native targeted reads before exact edits or on fallback.',
    inputSchema: z.object({ question: query, paths, sessionId: session }), annotations,
  }, ({ question, paths, sessionId }, extra) => retrieve(question, paths, sessionId, extra.mcpReq.signal));
  server.registerTool('code_context', {
    description: 'Select reference excerpts for an implementation specification. The main agent writes and validates code; this tool never generates or writes target files. References must stay inside configured roots.',
    inputSchema: z.object({ spec: query, references: paths, sessionId: session }), annotations,
  }, ({ spec, references, sessionId }, extra) => retrieve(spec, references, sessionId, extra.mcpReq.signal, true));
  if (config.mode === 'advise' && config.testArtifacts?.enabled && config.model === MODEL
    && process.env.JEVRA_WORKER_ACTIVE !== '1') {
    const artifacts = new ArtifactSession(config, provider, cwd, worker, application, host);
    const respond = async (fn: () => Promise<unknown> | unknown) => {
      try { return { content: [{ type: 'text' as const, text: JSON.stringify(await fn()) }] }; }
      catch (error) { return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({
        status: 'unresolved', reason: error instanceof DecisionError ? error.code : 'input_invalid',
        nextAction: 'Continue with native tools; do not retry generation with another operation ID.',
      }) }] }; }
    };
    server.registerTool('test_profiles', {
      description: 'List explicitly configured pure-function test profiles in this workspace. Includes exact source/output scope and mandatory requirements. No inference or generation.',
      inputSchema: z.object({}).strict(), annotations: { readOnlyHint: true, openWorldHint: false },
    }, () => respond(() => artifacts.list()));
    server.registerTool('generate_tests', {
      description: 'Generate tests for an exact configured source path or profileId; discovery is optional when the source is known. Supply only additional requirements. Jev decides route/evidence/acceptance; Luna generates with fixed checks and at most one repair. Returns a compact receipt without applying files. With native-ticket delivery, execute the returned materializeCommand under native host permissions without reading/retyping the body. Otherwise review with read_test_artifact. Reuse operationId only for identical arguments.',
      inputSchema: generateTestsSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: true },
    }, (input, extra) => respond(async () => {
      if (active) throw new DecisionError('budget_exceeded');
      active = true;
      try { return await artifacts.generate(input, AbortSignal.any([extra.mcpReq.signal, shutdown.signal])); }
      finally { active = false; }
    }));
    server.registerTool('read_test_artifact', {
      description: 'Read the latest staged test artifact for native host review; verifies session ownership, expiry, source freshness and candidate hash. This is delivery for review, not proof of approval or application. Only accepted content is eligible for native application.',
      inputSchema: readTestArtifactSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    }, (input, extra) => respond(() => artifacts.read(input, AbortSignal.any([extra.mcpReq.signal, shutdown.signal]))));
  }
  return server;
}

/** The host owns this stdio process; credentials stay here, outside tool-shell sandboxes. */
export async function serveMcp(config: Config, host: Host, provider: Provider, cwd = process.cwd(), application?: NativeApplicationContext) {
  const server = createMcpServer(config, host, provider, cwd, undefined, application);
  // Give managed subprocesses a chance to handle cancellation on host shutdown.
  const close = () => { void server.close(); };
  const onclose = server.server.onclose;
  server.server.onclose = () => {
    onclose?.();
    process.removeListener('SIGINT', close); process.removeListener('SIGTERM', close);
  };
  process.once('SIGINT', close); process.once('SIGTERM', close);
  await server.connect(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 131072 }));
  return server;
}
