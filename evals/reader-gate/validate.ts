import { parseArgs } from 'node:util';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { hash } from '@jevra/core';
import { workerEnvironment } from '../../packages/cli/src/codex-worker.ts';
import { runWorkerProcess } from '../../packages/cli/src/worker-process.ts';
import { quoteArgument } from '../../packages/cli/src/bulk-read.ts';
import { tasks } from '../reader-comparison/fixtures.ts';
import { inspectHooks } from './inspect-hooks.ts';

const { values } = parseArgs({ options: { 'codex-executable': { type: 'string' },
  output: { type: 'string', default: `evals/local-results/reader-gate-${Date.now()}` } } });
if (process.versions.node !== '24.21.0' || !values['codex-executable']) throw new Error('invalid_gate_validation_configuration');
const output = resolve(values.output!), executable = resolve(values['codex-executable']), cli = resolve('dist/jevra.mjs');
await mkdir(output, { recursive: true, mode: 0o700 });
const root = await realpath(output), cwd = join(root, 'workspace'), config = join(root, 'config.json');
const manifest = { version: 'reader-gate-validation/1', preparedAt: new Date().toISOString(), inference: 'not_dispatched',
  hashes: Object.fromEntries(await Promise.all(['evals/reader-gate/validate.ts', 'evals/reader-gate/inspect-hooks.ts',
    'evals/reader-gate/observations.ts', 'evals/reader-gate/protocol.md', 'packages/cli/src/bulk-read.ts', 'dist/jevra.mjs',
    'evals/reader-comparison/server.ts', 'evals/reader-comparison/fixtures.ts', 'package-lock.json'].map(async p => [p, hash(await readFile(p, 'utf8'))]))),
  node: process.version, hostVersion: 'codex-cli 0.154.0-alpha.6.2', promotion: 'not_authorized' };
await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
await mkdir(cwd); await mkdir(join(root, 'skills'));
const task = tasks.find(t => t.id === 'large-shipping')!;
for (const [path, text] of Object.entries(task.files)) await writeFile(join(cwd, path), text);
await writeFile(join(cwd, 'small.md'), 'small source\n'.repeat(350));
await writeFile(config, JSON.stringify({ version: 1, mode: 'advise', traces: false, skillRoots: [join(root, 'skills')],
  keychainService: 'codex-typesafe-api-key', stateDirectory: join(root, 'state'), bulkRead: { roots: [cwd], maxFileBytes: 131072, maxTotalBytes: 98304,
    reader: { enabled: true, experimentalProfile: 'focused-reader/1', codexExecutable: executable, selection: 'full', maxCorpusBytes: 98304 } } }), { mode: 0o600 });
const env = workerEnvironment(process.env); delete env.JEVRA_WORKER_ACTIVE;
const execute = (command: string, args: string[], input?: string) => runWorkerProcess({ executable: command, args, cwd, env,
  timeoutMs: 10000, killGraceMs: 1000, maxOutputBytes: 65536, maxStderrBytes: 65536, ...(input !== undefined ? { input } : {}) });
const version = await execute(executable, ['--version']);
if (version.failure || !version.cleanupComplete || version.exitCode !== 0 || version.stdout.toString('utf8').trim() !== manifest.hostVersion) throw new Error('unsupported_host_version');
if ((await execute('git', ['init', '--quiet'])).exitCode !== 0) throw new Error('gate_fixture_setup_failed');
const checks = [];
for (const host of ['codex', 'claude-code']) {
  for (const c of [
    { id: 'large-canonical-bash', name: 'Bash', input: { command: 'cat shipping-policy.md' }, redirect: true },
    { id: 'large-unified-exec', name: 'exec_command', input: { cmd: 'cat shipping-policy.md' }, redirect: true },
    { id: 'large-read', name: 'Read', input: { file_path: 'shipping-policy.md' }, redirect: true },
    { id: 'targeted-range', name: 'Bash', input: { command: 'sed -n 1,20p shipping-policy.md' }, redirect: false },
    { id: 'targeted-read', name: 'Read', input: { file_path: 'shipping-policy.md', offset: 1, limit: 20 }, redirect: false },
    { id: 'small-boundary', name: 'Bash', input: { command: 'cat small.md' }, redirect: false },
    { id: 'unsupported-shell', name: 'Bash', input: { command: 'cat shipping-policy.md | head -20' }, redirect: false },
  ]) {
    const payload = { hook_event_name: 'PreToolUse', session_id: 'synthetic-gate-session', cwd, tool_name: c.name, tool_input: c.input };
    const r = await execute(process.execPath, [cli, 'hook', '--host', host, '--config', config], JSON.stringify(payload));
    let actual: any; try { actual = JSON.parse(r.stdout.toString('utf8')); } catch { throw new Error('invalid_bundled_gate_output'); }
    const passed = !r.failure && r.exitCode === 0 && r.cleanupComplete && r.stderr.length === 0
      && Boolean(actual.hookSpecificOutput?.permissionDecision === 'deny') === c.redirect
      && !JSON.stringify(actual).includes('synthetic-gate-session');
    checks.push({ host, case: c.id, passed, expected: c.redirect ? 'redirect' : 'pass_through', inferenceCalls: 0 });
  }
}
const client = new Client({ name: 'jevra-gate-catalog-validation', version: '1' });
let catalog: { name: string; hasQuestion: boolean; hasPaths: boolean; schemaHash: string }[];
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, env: env as Record<string, string>, cwd,
    args: [resolve('evals/reader-comparison/server.ts'), '--arm', 'jev-full', '--config', config, '--log', join(root, 'catalog-invocations.json')], stderr: 'pipe' }));
  catalog = (await client.listTools()).tools.map(t => ({ name: t.name, hasQuestion: Boolean((t.inputSchema.properties as any)?.question),
    hasPaths: Boolean((t.inputSchema.properties as any)?.paths), schemaHash: hash(t.inputSchema) }));
} finally { await client.close(); }
const ledger = JSON.parse(await readFile(join(root, 'catalog-invocations.json'), 'utf8'));
if (ledger.reservations.length || ledger.journals.length) throw new Error('unexpected_catalog_inference');
const hookCommand = [process.execPath, cli, 'hook', '--host', 'codex', '--config', config].map(quoteArgument).join(' ');
const settings = ['features.hooks=true', 'features.plugins=false', 'features.apps=false', 'features.remote_plugin=false',
  'mcp_servers={}', `log_dir=${JSON.stringify(join(root, 'logs'))}`,
  `hooks.PreToolUse=[{matcher="Read|Bash|exec_command",hooks=[{type="command",command=${JSON.stringify(hookCommand)},timeout=3}]}]`];
await writeFile(join(root, 'native-settings.json'), JSON.stringify(settings, null, 2), { mode: 0o600 });
const review = [executable, '--no-alt-screen', '-C', cwd, ...settings.flatMap(s => ['-c', s])].map(quoteArgument).join(' ');
await writeFile(join(root, 'review-hook.sh'), '#!/bin/sh\nexec ' + review + '\n', { mode: 0o700, flag: 'wx' });
let native: unknown;
try { native = await inspectHooks(executable, settings, cwd, hookCommand, env); }
catch (error) { native = { ready: false, failure: error instanceof Error && /^hook_preflight_|^invalid_hook_|^ambiguous_hook_/.test(error.message) ? error.message : 'hook_preflight_failed', inferenceCalls: 0 }; }
const result = { manifest, checks, gateCasesPassed: checks.every(c => c.passed), catalog,
  catalogAvailable: catalog.some(t => t.name === 'bulk_read' && t.hasQuestion && t.hasPaths), native,
  inferenceCalls: { parent: 0, worker: 0, managed_jev: 0, routing_hook: 0 }, actualBilledUsd: null,
  limitations: 'Direct bundled hook and separate MCP catalog checks; native hooks/list is read-only. No model task, native hook execution, adherence or savings is established.' };
await writeFile(join(root, 'results.json'), JSON.stringify(result, null, 2), { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify({ output: values.output, checks: checks.length, gateCasesPassed: result.gateCasesPassed, catalogAvailable: result.catalogAvailable, native, inferenceCalls: 0 }));
if (!result.gateCasesPassed || !result.catalogAvailable) process.exitCode = 1;
