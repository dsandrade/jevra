import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

// Audit the measurement behavior with a deliberately failed local transport.
// This is not an AiKA model evaluation and never invokes a real Portal CLI.
const [checkout, output] = process.argv.slice(2);
if (!checkout || !output) throw new Error('Usage: node evals/shunt-audit.ts <upstream-checkout> <output.json>');
const reviewedCommit = '3c24ca30ff63e1f5bbad1c43fe5324daff579123';
const source = resolve(checkout);
const git = (...args: string[]) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', timeout: 30000 });
assert.equal(git('rev-parse', 'HEAD').trim(), reviewedCommit, 'Audit a new revision explicitly before changing this pin');
const root = await mkdtemp(join(tmpdir(), 'jevra-shunt-audit-'));
try {
  // Git archive excludes local edits; the original checkout remains untouched.
  const archive = join(root, 'source.tar');
  execFileSync('git', ['-C', source, 'archive', '--format=tar', '--output=' + archive, reviewedCommit, 'plugins/shunt'], { timeout: 30000 });
  execFileSync('tar', ['-xf', archive, '-C', root], { timeout: 30000 });
  const plugin = join(root, 'plugins/shunt'), privateTemp = join(root, 'temp');
  await mkdir(privateTemp);
  const stub = join(root, 'failed-portal'), log = join(root, 'invocations.log');
  await writeFile(stub, '#!/bin/sh\nprintf "%s\\n" invoked >> "$SHUNT_AUDIT_LOG"\nprintf "%s\\n" \'{"error":"Synthetic offline failure"}\'\nexit 1\n', { mode: 0o700 });
  const env = { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: root, TMPDIR: privateTemp + '/', LANG: 'C',
    PORTAL_CLI_BIN: stub, SHUNT_AUDIT_LOG: log };
  const invoke = (script: string, args: string[]) => {
    try { return { exitCode: 0, stdout: execFileSync('bash', [join(plugin, script), ...args], {
      cwd: plugin, env, encoding: 'utf8', timeout: 30000, maxBuffer: 2097152, stdio: ['ignore', 'pipe', 'pipe'],
    }) }; } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      return { exitCode: failure.status ?? -1, stdout: String(failure.stdout ?? '') };
    }
  };
  const fixture = join(plugin, 'evals/fixtures/user-service.ts'), target = join(privateTemp, 'direct.test.ts');
  const reader = invoke('scripts/bulk-read', ['--question', 'List exports.', '--paths', fixture]);
  const writer = invoke('scripts/code-write', ['--spec', 'Generate tests.', '--reference', fixture, '--target', target]);
  assert.equal(reader.exitCode, 1); assert.equal(writer.exitCode, 1);
  let targetExists = true; try { await access(target); } catch { targetExists = false; }
  assert.equal(targetExists, false);
  const benchmark = invoke('evals/run.sh', ['--benchmark']);
  const plain = benchmark.stdout.replace(/\x1b\[[0-9;]*m/g, '');
  const names = ['single-large-file', 'multi-file-cross-read', 'source-plus-test', 'code-generation'];
  const rows = plain.split('\n').flatMap(line => {
    const match = line.match(/^\s*(\S+)\s+(.+?)\s+(\d+) tk\s+(\d+) tk\s+(\d+)%\s*$/);
    return match && names.includes(match[1]!) ? [{ name: match[1], withoutEstimate: Number(match[3]),
      withEstimate: Number(match[4]), apparentSavingsPct: Number(match[5]) }] : [];
  });
  assert.equal(benchmark.exitCode, 0); assert.equal(rows.length, 4);
  assert(rows.every(r => r.withEstimate === 0 && r.apparentSavingsPct === 100));
  const invocations = (await readFile(log, 'utf8')).trim().split('\n').length;
  assert.equal(invocations, 6, 'Two helper probes and four benchmark calls must hit the failing stub');
  const files = ['scripts/bulk-read', 'scripts/code-write', 'scripts/lib/aika.sh', 'evals/run.sh', 'evals/benchmarks.json'];
  const hashes = Object.fromEntries(await Promise.all(files.map(async name => [name,
    createHash('sha256').update(await readFile(join(plugin, name))).digest('hex')])));
  const result = { schemaVersion: 1, upstreamCommit: reviewedCommit, sourceHashes: hashes,
    kind: 'offline_failed_transport_audit', liveModelRequests: 0,
    helperReaderExitCode: reader.exitCode, helperWriterExitCode: writer.exitCode, targetCreated: targetExists,
    failedStubInvocations: invocations, benchmarkExitCode: benchmark.exitCode, rows,
    conclusion: 'Helpers reject a failed transport, but the benchmark reports zero response tokens and 100% apparent savings. This does not reproduce or invalidate historical successful model outputs.' };
  await writeFile(resolve(output), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
} finally { await rm(root, { recursive: true, force: true }); }
