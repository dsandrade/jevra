import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { DecisionError } from '@jevra/core';
import { createTypeSafeProvider } from '@jevra/provider-typesafe';
import { loadConfig, readApiKey } from '../../packages/cli/src/config.ts';
import { ArtifactSession, generateTestsSchema, readTestArtifactSchema } from '../../packages/cli/src/artifact-session.ts';
import { CodexCliWorker } from '../../packages/cli/src/codex-worker.ts';
import { FixedWorkerControl } from './control.ts';

const { values } = parseArgs({ options: { config: { type: 'string' }, arm: { type: 'string' }, log: { type: 'string' } } });
if (!values.config || !values.log || !['worker', 'jev'].includes(values.arm ?? '')) throw new Error('Invalid evaluation server options.');
const config = await loadConfig(values.config);
const worker = new CodexCliWorker({ executable: config.testArtifacts!.codexExecutable, limits: { timeoutMs: 60000, maxArtifactBytes: 32768 } });
const session = values.arm === 'jev'
  ? new ArtifactSession(config, createTypeSafeProvider({ getApiKey: () => readApiKey(config) }), process.cwd(), worker)
  : new FixedWorkerControl(config, worker);
const server = new McpServer({ name: 'jevra', version: '0.1.0-eval' });
const shutdown = new AbortController();
server.server.onclose = () => shutdown.abort();
for (const s of ['SIGINT', 'SIGTERM'] as const) process.once(s, () => { shutdown.abort(); void server.close(); });
const calls: { name: string; status: 'started' | 'completed' | 'failed' }[] = [];
async function invoke(name: string, fn: () => unknown | Promise<unknown>) {
  const entry = { name, status: 'started' as 'started' | 'completed' | 'failed' }; calls.push(entry);
  const persist = () => writeFile(values.log!, JSON.stringify(calls), { mode: 0o600 });
  await persist();
  try {
    const result = await fn(); entry.status = 'completed'; await persist();
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
  } catch (error) {
    entry.status = 'failed'; await persist();
    return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ status: 'unresolved',
      reason: error instanceof DecisionError ? error.code : 'input_invalid', nextAction: 'Continue natively; do not start another generation operation.' }) }] };
  }
}
server.registerTool('test_profiles', {
  description: 'List configured pure-function test profiles, source/output scope, and mandatory requirements.',
  inputSchema: z.object({}).strict(), annotations: { readOnlyHint: true, openWorldHint: false },
}, () => invoke('test_profiles', () => session.list()));
server.registerTool('generate_tests', {
  description: 'Generate staged TypeScript tests for a configured profile using a bounded Luna worker. Runs fixed baseline and mutant checks, with at most one repair. Returns a compact receipt and handle, never writes the destination. Review with read_test_artifact and apply accepted content using native permissions. Reuse an operation ID only for the identical request.',
  inputSchema: generateTestsSchema, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
}, (input, extra) => invoke('generate_tests', () => session.generate(input, AbortSignal.any([extra.mcpReq.signal, shutdown.signal]))));
server.registerTool('read_test_artifact', {
  description: 'Read the latest staged candidate for native review after source/hash checks. Only accepted content is eligible for application; this tool does not approve or apply edits.',
  inputSchema: readTestArtifactSchema, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
}, (input, extra) => invoke('read_test_artifact', () => session.read(input, AbortSignal.any([extra.mcpReq.signal, shutdown.signal]))));
await server.connect(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 131072 }));
