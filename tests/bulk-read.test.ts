import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configSchema } from '../packages/cli/src/config.ts';
import { approvedSource, gateBulkRead, quoteArgument, simpleReadPaths } from '../packages/cli/src/bulk-read.ts';

test('bulk-read shell recognition preserves shunt targeting exceptions without executing shell syntax', () => {
  assert.deepEqual(simpleReadPaths('cat "a b.md" c.md'), ['a b.md', 'c.md']);
  assert.deepEqual(simpleReadPaths('cat -n policy.md'), ['policy.md']);
  for (const command of ['head -20 policy.md', 'tail -n 50 policy.md', 'cat a | rg x', 'cat a > out',
    'cat $(echo a)', 'cat a; touch out', 'cat "partial".md', 'cat "unclosed', 'rg keyword a', 'sed -n 1,10p a']) assert.deepEqual(simpleReadPaths(command), []);
  assert.equal(quoteArgument("a'b"), "'a'\\''b'");
});

test('large reads redirect while targeted, small, unconfigured, and observe reads preserve native behavior', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'jevra-gate-')));
  try {
    const large = join(dir, 'large.md'), small = join(dir, 'small.md');
    await writeFile(large, 'source line\n'.repeat(351));
    await writeFile(small, 'source line\n'.repeat(350));
    await mkdir(join(dir, 'skills'));
    const config = configSchema.parse({ version: 1, mode: 'advise', skillRoots: [join(dir, 'skills')],
      traces: false, bulkRead: { roots: [dir] } });
    const event = { hook_event_name: 'PreToolUse', session_id: 'fixture', cwd: dir, tool_name: 'Read', tool_input: { file_path: large } };
    const result = await gateBulkRead(event, 'claude-code', config, '/trusted/jevra.mjs', '/trusted/config.json');
    assert.equal(result.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(result.hookSpecificOutput?.permissionDecisionReason ?? '', /bulk_read MCP/);
    assert.doesNotMatch(result.hookSpecificOutput?.permissionDecisionReason ?? '', /jevra\.mjs/);
    const cliConfig = configSchema.parse({ ...config, bulkRead: { ...config.bulkRead, transport: 'cli' } });
    const cliResult = await gateBulkRead(event, 'claude-code', cliConfig, '/trusted/jevra.mjs', '/trusted/config.json');
    assert.match(cliResult.hookSpecificOutput?.permissionDecisionReason ?? '', /bulk-read/);
    assert.match(cliResult.hookSpecificOutput?.permissionDecisionReason ?? '', /trusted\/jevra\.mjs/);
    for (const input of [{ file_path: large, offset: 1 }, { file_path: large, limit: 40 }, { file_path: small }]) {
      assert.deepEqual(await gateBulkRead({ ...event, tool_input: input }, 'claude-code', config, '/cli', '/config'), {});
    }
    assert.deepEqual(await gateBulkRead(event, 'codex', { ...config, mode: 'observe' }, '/cli', '/config'), {});
    assert.deepEqual(await gateBulkRead(event, 'codex', { ...config, mode: 'disabled' }, '/cli', '/config'), {});
    assert.equal((await gateBulkRead({ ...event, tool_name: 'Bash', tool_input: { command: 'cat large.md' } },
      'codex', config, '/cli', '/config')).hookSpecificOutput?.permissionDecision, 'deny');
    await assert.rejects(approvedSource(large, dir, [join(dir, 'skills')]), /catalog_unavailable/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('bundled bulk-read and code-context commands return reference evidence without changing source files', async () => {
  const { spawnSync } = await import('node:child_process');
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'jevra-helper-cli-')));
  try {
    await mkdir(join(dir, 'skills'));
    const source = '# Validation\nReject a noninteger retry attempt with RangeError.\n';
    await writeFile(join(dir, 'reference.md'), source);
    await writeFile(join(dir, 'config.json'), JSON.stringify({ version: 1, mode: 'observe', skillRoots: [join(dir, 'skills')],
      traces: false, bulkRead: { roots: [dir], backend: 'deterministic' } }));
    for (const [command, queryFlag, fileFlag] of [['bulk-read', '--question', '--paths'], ['code-context', '--spec', '--reference']]) {
      const args = [resolve('dist/jevra.mjs'), command!, queryFlag!, 'retry validation', fileFlag!, 'reference.md', '--config', join(dir, 'config.json')];
      const result = spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8', timeout: 5000 });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Reject a noninteger retry attempt/);
      assert.match(result.stdout, /"source":"reference.md","startLine":1,"endLine":2/);
      assert.equal(await readFile(join(dir, 'reference.md'), 'utf8'), source);
      const invalid = spawnSync(process.execPath, [...args, '--host', 'unknown'], { cwd: dir, encoding: 'utf8', timeout: 5000 });
      assert.equal(invalid.status, 1);
      assert.equal(invalid.stdout, '');
      assert.equal(invalid.stderr, 'jevra: input_invalid\n');
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
