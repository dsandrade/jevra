import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hostObservations, summarizeHookList, summarizeNativeContext } from '../evals/reader-gate/observations.ts';
import { inspectHooks, inspectContext } from '../evals/reader-gate/inspect-hooks.ts';
import { quoteArgument } from '../packages/cli/src/bulk-read.ts';
import { withGateConfig } from '../evals/reader-gate/config-lease.ts';
import { hash } from '@jevra/core';

test('adoption observations distinguish broad reads, failures and fallback without retaining source or credentials', () => {
  const events = [
    { type: 'item.completed', item: { id: 'one', type: 'command_execution', command: 'cat private-source.md', aggregated_output: 'PRIVATE_SOURCE_CAPTURE', exit_code: 0 } },
    { type: 'item.completed', item: { id: 'one', type: 'command_execution', command: 'cat private-source.md', aggregated_output: 'PRIVATE_SOURCE_CAPTURE', exit_code: 0 } },
    { type: 'item.completed', item: { id: 'two', type: 'command_execution', command: 'sed -n 1,10p private-source.md', aggregated_output: 'PRIVATE_SOURCE_CAPTURE', exit_code: 0 } },
    { type: 'item.completed', item: { id: 'three', type: 'mcp_tool_call', tool: 'bulk_read', arguments: { question: 'PRIVATE_REQUEST' }, result: { content: [{ type: 'text', text: JSON.stringify({ status: 'fallback', reason: 'PRIVATE_ERROR' }) }] } } },
    { method: 'hook/completed', params: { run: { status: 'blocked', entries: ['PRIVATE_HOOK_CONTENT'] } } },
  ];
  const observed = hostObservations(events); const serialized = JSON.stringify(observed);
  assert.equal(observed.observations.length, 4);
  assert.equal(observed.observations[0]!.readShape, 'simple_broad_read');
  assert.equal(observed.observations[1]!.readShape, 'not_simple_broad_read');
  assert.equal(observed.observations[2]!.outcome, 'fallback');
  assert.equal(observed.observations[3]!.status, 'blocked');
  assert.doesNotMatch(serialized, /PRIVATE_|private-source|sed -n|cat /);
  const truncated = hostObservations(events, 2); assert.equal(truncated.complete, false); assert.equal(truncated.omitted, 2);
  assert.equal(hostObservations([]).observations.length, 0);
  assert.match(hostObservations([]).scope, /absent hook events do not establish/);
});

test('native hook readiness cannot silently accept missing, modified, ambiguous or unrelated definitions', () => {
  const hook = { command: 'fixed reviewed command', eventName: 'preToolUse', matcher: 'Read|Bash|exec_command',
    handlerType: 'command', enabled: true, trustStatus: 'trusted', currentHash: 'a'.repeat(64) };
  const list = (hooks: unknown[]) => ({ data: [{ cwd: '/synthetic', hooks, warnings: ['PRIVATE_CONFIG_WARNING'], errors: [] }] });
  const ready = summarizeHookList(list([hook]), hook.command, '/synthetic'); assert.equal(ready.ready, true);
  const opaque = summarizeHookList(list([{ ...hook, currentHash: 'native-opaque-hash-format' }]), hook.command, '/synthetic');
  assert.equal(opaque.ready, true); assert.match(opaque.definitionFingerprint!, /^[a-f\d]{64}$/);
  assert.doesNotMatch(JSON.stringify(ready), /PRIVATE_|fixed reviewed command|synthetic/);
  for (const hooks of [[], [hook, hook], [hook, { command: 'unrelated' }], [{ ...hook, trustStatus: 'untrusted' }],
    [{ ...hook, trustStatus: 'modified' }], [{ ...hook, enabled: false }], [{ ...hook, currentHash: null }], [{ ...hook, matcher: '*' }]]) {
    assert.equal(summarizeHookList(list(hooks), hook.command, '/synthetic').ready, false);
  }
  assert.throws(() => summarizeHookList({ data: [] }, hook.command, '/synthetic'), /ambiguous_hook_scope/);
});

test('read-only native hook/context preflight exchanges no generation, trust-write or account method', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jevra-hook-preflight-test-')));
  try {
    const calls = join(root, 'calls.jsonl'), script = join(root, 'server.mjs'), executable = join(root, 'codex-fixture');
    await writeFile(script, `import { createInterface } from 'node:readline'; import { appendFileSync } from 'node:fs';
const calls = process.argv[2]; process.once('SIGTERM', () => process.exit(0));
createInterface({ input: process.stdin }).on('line', line => {
 const m = JSON.parse(line); appendFileSync(calls, JSON.stringify(m) + '\\n');
 if (m.id === 1) process.stdout.write(JSON.stringify({ id: 1, result: { userAgent: 'fixture' } }) + '\\n');
 if (m.id === 2 && m.method === 'config/read') { process.stdout.write(JSON.stringify({ id: 2, result: { config: { model_provider: 'openai', mcp_servers: { jevra: { env: { KEY: 'PRIVATE_MATERIAL' } } } } } }) + '\\n'); return; }
 if (m.id === 2) process.stdout.write(JSON.stringify({ id: 2, result: { data: [{ cwd: process.cwd(), warnings: [], errors: [], hooks: [{ command: 'fixed reviewed command', eventName: 'preToolUse', handlerType: 'command', matcher: 'Read|Bash|exec_command', enabled: true, currentHash: 'a'.repeat(64), trustStatus: 'untrusted', secret: 'PRIVATE_MATERIAL' }] }] } }) + '\\n');
});\n`);
    await writeFile(executable, '#!/bin/sh\nexec ' + [process.execPath, script, calls].map(quoteArgument).join(' ') + '\n'); await chmod(executable, 0o700);
    const result = await inspectHooks(executable, [], root, 'fixed reviewed command', { PATH: process.env.PATH });
    assert.equal(result.ready, false); assert.equal(result.trustStatus, 'untrusted');
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|fixed reviewed command/);
    const methods = (await readFile(calls, 'utf8')).trim().split('\n').map(line => JSON.parse(line).method);
    assert.deepEqual(methods, ['initialize', 'initialized', 'hooks/list']);
    const context = await inspectContext(executable, [], root, { PATH: process.env.PATH });
    assert.equal(context.metadata.onlyJevraEnabled, true);
    assert.doesNotMatch(JSON.stringify(context), /PRIVATE_MATERIAL|"KEY"/);
    const allMethods = (await readFile(calls, 'utf8')).trim().split('\n').map(line => JSON.parse(line).method);
    assert.deepEqual(allMethods, ['initialize', 'initialized', 'hooks/list', 'initialize', 'initialized', 'config/read']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('task config lease restores bytes after failure and blocks concurrent or stale dispatch', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jevra-gate-lease-test-'))), config = join(root, 'config.json');
  try {
    const original = '{"traces":false}', active = '{"traces":true}'; await writeFile(config, original);
    await assert.rejects(withGateConfig(config, hash(original), active, async () => {
      assert.equal(await readFile(config, 'utf8'), active);
      await assert.rejects(withGateConfig(config, hash(active), active, async () => { throw new Error('unexpected_dispatch'); }), /EEXIST/);
      throw new Error('synthetic_cancellation');
    }), /synthetic_cancellation/);
    assert.equal(await readFile(config, 'utf8'), original);
    let dispatched = false;
    await assert.rejects(withGateConfig(config, hash('stale'), active, async () => { dispatched = true; }), /changed_gate_configuration/);
    assert.equal(dispatched, false); assert.equal(await readFile(config, 'utf8'), original);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('task config lease preserves an unrelated edit instead of overwriting it during cleanup', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jevra-gate-lease-edit-test-'))), config = join(root, 'config.json');
  try {
    await writeFile(config, 'original');
    await assert.rejects(withGateConfig(config, hash('original'), 'active', async () => { await writeFile(config, 'operator edit'); }), /changed_during_task/);
    assert.equal(await readFile(config, 'utf8'), 'operator edit');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('native context isolation disables unrelated MCPs without retaining credentials or allowing a custom provider', () => {
  const result = summarizeNativeContext({ config: { model_provider: 'openai', mcp_servers: {
    privateServer: { env: { KEY: 'PRIVATE_TOKEN' } }, disabledServer: { enabled: false }, jevra: { enabled: true },
  } } });
  assert.equal(result.metadata.enabledMcpServers, 2); assert.equal(result.metadata.onlyJevraEnabled, false);
  assert.equal(result.disableOverrides.length, 3); assert.doesNotMatch(JSON.stringify(result), /PRIVATE_TOKEN|"KEY"/);
  assert.ok(result.disableOverrides.includes('mcp_servers.privateServer.enabled=false'));
  assert.equal(summarizeNativeContext({ config: { model_provider: 'openai', mcp_servers: { jevra: {} } } }).metadata.onlyJevraEnabled, true);
  assert.equal(summarizeNativeContext({ config: { model_provider: 'openai', model_providers: { openai: { base_url: 'PRIVATE_ENDPOINT' } } } }).metadata.standardOpenAiProvider, false);
  assert.throws(() => summarizeNativeContext({ config: {} }), /invalid_native_context/);
  assert.throws(() => summarizeNativeContext({ config: { model_provider: 'openai', mcp_servers: { 'ambiguous.name': {} } } }), /invalid_native_context/);
  assert.equal(summarizeNativeContext({ config: { model_provider: 'openai', model_providers: { openai: { base_url: null, env_key: 'OPENAI_API_KEY' } } } }).metadata.standardOpenAiProvider, true);
  assert.equal(summarizeNativeContext({ config: { model_provider: 'openai', chatgpt_base_url: 'https://chatgpt.com/backend-api/' } }).metadata.standardOpenAiProvider, true);
});
