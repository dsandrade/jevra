import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { tasks, schedule } from '../evals/reader-comparison/fixtures.ts';
import { judge } from '../evals/reader-comparison/judge.ts';
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
async function setup(id: string) {
  const t = tasks.find(t => t.id === id)!; const root = await mkdtemp(join(tmpdir(), 'jevra-reader-judge-')); directories.push(root);
  const cwd = join(root, 'workspace'); await mkdir(cwd);
  for (const [p, text] of Object.entries(t.files)) await writeFile(join(cwd, p), text);
  await writeFile(join(cwd, t.target), t.canonical);
  await writeFile(join(cwd, 'answer.json'), JSON.stringify({ status: t.kind === 'no_answer' ? 'missing' : 'resolved', facts: t.facts }));
  return { t, root, cwd, run: () => judge(t, cwd, join(root, 'check')) };
}
test('exploratory reader workloads exercise large, cross-file, conflicting and absent contracts with native edit checks', async () => {
  assert.equal(schedule().length, 40); assert.equal(new Set(schedule().map(c => c.id)).size, 40);
  assert.deepEqual(tasks.map(t => t.kind), ['large_single', 'cross_file', 'conflicting', 'no_answer']);
  for (const t of tasks) {
    assert.ok(Object.values(t.files).some(s => s.split('\n').length > 350));
    assert.ok(Object.values(t.files).reduce((n, s) => n + Buffer.byteLength(s), 0) < 98304);
    const f = await setup(t.id); assert.equal((await f.run()).passed, true, t.id);
  }
});
test('short wrong answers, omitted facts and plausible wrong edits fail the judge independently of runtime Jev acceptance', async () => {
  const f = await setup('large-shipping');
  await writeFile(join(f.cwd, 'fee.ts'), f.t.canonical.replace('>= 100', '> 100'));
  assert.equal((await f.run()).functional, false);
  await writeFile(join(f.cwd, 'fee.ts'), f.t.canonical);
  const facts = { ...f.t.facts }; delete facts.surcharge;
  await writeFile(join(f.cwd, 'answer.json'), JSON.stringify({ status: 'resolved', facts }));
  assert.equal((await f.run()).passed, false);
});
test('superseded rules and invented absent values fail; rejected arbitrary code is not executed or labeled incorrect', async () => {
  const conflict = await setup('conflicting-retry');
  await writeFile(join(conflict.cwd, conflict.t.target), conflict.t.canonical.replace('< 3', '< 10'));
  assert.equal((await conflict.run()).functional, false);
  const missing = await setup('absent-retention');
  await writeFile(join(missing.cwd, 'answer.json'), JSON.stringify({ status: 'resolved', facts: { retentionDays: { value: 30, path: null, quote: null } } }));
  assert.equal((await missing.run()).passed, false);
  await writeFile(join(missing.cwd, missing.t.target), 'process.exit(0);');
  const rejected = await missing.run(); assert.equal(rejected.grammar, false); assert.equal(rejected.functional, null);
});
test('evaluation Luna control runs through stdio, records real simulated transport usage and cannot buy a second generation', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jevra-reader-control-'))); directories.push(root);
  await mkdir(join(root, 'skills')); await writeFile(join(root, 'rules.md'), 'Retries reject nonintegers.\n');
  const executable = join(root, 'codex-fixture'); const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
  await writeFile(executable, '#!/bin/sh\nexec ' + [process.execPath, resolve('tests/fixtures/codex-worker.mjs'), 'reader', join(root, 'calls.jsonl')].map(quote).join(' ') + ' "$@"\n');
  await chmod(executable, 0o700);
  const config = join(root, 'config.json'), log = join(root, 'invocations.json');
  await writeFile(config, JSON.stringify({ version: 1, mode: 'advise', traces: false, skillRoots: [join(root, 'skills')],
    bulkRead: { roots: [root], backend: 'deterministic', reader: { enabled: false, experimentalProfile: 'focused-reader/1', codexExecutable: executable } } }));
  const client = new Client({ name: 'reader-control-test', version: '1' });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, cwd: root,
      args: [resolve('evals/reader-comparison/server.ts'), '--arm', 'luna-full', '--config', config, '--log', log], stderr: 'pipe' }));
    const result = await client.callTool({ name: 'bulk_read', arguments: { question: 'Which retries are rejected?', paths: ['rules.md'] } });
    assert.notEqual(result.isError, true); assert.match(JSON.stringify(result.content), /answered/);
    const second = await client.callTool({ name: 'bulk_read', arguments: { question: 'Explain retries again', paths: ['rules.md'] } });
    assert.equal(second.isError, true);
    const ledger = JSON.parse(await readFile(log, 'utf8'));
    assert.equal(ledger.reservations.length, 1); assert.equal(ledger.journals.length, 1);
    assert.equal(ledger.journals[0].component, 'worker'); assert.equal(ledger.journals[0].usage.input, 125);
    assert.equal(ledger.journals[0].usageComplete, true);
    assert.equal(ledger.journals.some((j: { component: string }) => j.component === 'managed_jev'), false);
  } finally { await client.close(); }
});
