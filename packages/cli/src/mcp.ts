import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DecisionError } from '@jevra/core';
import type { Host, Provider } from '@jevra/core';
import type { Config } from './config.ts';
import { bulkRead } from './bulk-read.ts';

/** The host owns this stdio process; credentials stay here, outside tool-shell sandboxes. */
export async function serveMcp(config: Config, host: Host, provider: Provider, cwd = process.cwd()) {
  const server = new McpServer({ name: 'jevra', version: '0.1.0-alpha.2' });
  const sessionId = randomUUID();
  const query = z.string().trim().min(1).max(16384);
  const paths = z.array(z.string().min(1).max(4096)).min(1).max(16);
  const session = z.string().min(1).max(256).optional();
  let active = false;
  const retrieve = async (question: string, files: string[], callerSession: string | undefined, signal: AbortSignal) => {
    if (active) return { isError: true, content: [{ type: 'text' as const, text: 'Jevra is busy. Combine files in one request or use native targeted reads.' }] };
    active = true;
    try {
      const output = await bulkRead({ query: question, paths: files, cwd, host, sessionId: callerSession ?? sessionId, config, provider, signal });
      return { content: [{ type: 'text' as const, text: output.text || JSON.stringify({ status: 'fallback',
        reason: output.result?.reason ?? 'unavailable', nextAction: 'Read the relevant source ranges with native tools.' }) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ status: 'fallback',
        reason: error instanceof DecisionError ? error.code : 'input_invalid', nextAction: 'Use native targeted reads.' }) }] };
    } finally { active = false; }
  };
  const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true };
  server.registerTool('bulk_read', {
    description: 'Select exact evidence from large source files for a focused question. Uses Jev and user-approved file roots. Returns partial original excerpts with line numbers; the main agent interprets them. Use native targeted reads for verification or fallback.',
    inputSchema: z.object({ question: query, paths, sessionId: session }), annotations,
  }, ({ question, paths, sessionId }, extra) => retrieve(question, paths, sessionId, extra.mcpReq.signal));
  server.registerTool('code_context', {
    description: 'Select reference excerpts for an implementation specification. The main agent writes and validates code; this tool never generates or writes target files. References must stay inside configured roots.',
    inputSchema: z.object({ spec: query, references: paths, sessionId: session }), annotations,
  }, ({ spec, references, sessionId }, extra) => retrieve(spec, references, sessionId, extra.mcpReq.signal));
  await server.connect(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 131072 }));
  return server;
}
