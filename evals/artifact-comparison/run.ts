import { parseArgs } from 'node:util';
import { mkdir, mkdtemp, realpath, writeFile, readFile, readdir, rm, access, lstat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { hash } from '@jevra/core';
import { evidenceHash } from '@jevra/core/managed-worker';
import { runWorkerProcess } from '../../packages/cli/src/worker-process.ts';
import { workerEnvironment } from '../../packages/cli/src/codex-worker.ts';
import { tasks, taskPrompt, comparisonSkill, schedule } from './fixtures.ts';
import type { Task } from './fixtures.ts';
import { judge } from './judge.ts';
import { hostMetrics, managedMetrics, totalMetrics } from './metrics.ts';

const { values } = parseArgs({ options: { 'codex-executable': { type: 'string' },
  'claude-executable': { type: 'string', default: 'claude' }, 'keychain-service': { type: 'string' },
  output: { type: 'string', default: `evals/local-results/artifact-comparison-${Date.now()}` } } });
if (!values['codex-executable']) throw new Error('Specify --codex-executable.');
const output = resolve(values.output!), codex = resolve(values['codex-executable']!), claude = values['claude-executable']!;
const server = resolve('evals/artifact-comparison/server.ts');
const env = workerEnvironment(process.env); delete env.JEVRA_WORKER_ACTIVE;
env.PATH = dirname(process.execPath) + ':' + (env.PATH ?? '');
for (const key of ['USER', 'LOGNAME', 'SHELL', 'CLAUDE_CONFIG_DIR']) if (process.env[key]) env[key] = process.env[key];
const shutdown = new AbortController();
for (const s of ['SIGINT', 'SIGTERM'] as const) process.once(s, () => shutdown.abort());
const execute = (executable: string, args: string[], cwd: string, timeoutMs: number, input?: string) =>
  runWorkerProcess({ executable, args, cwd, env, timeoutMs, signal: shutdown.signal, killGraceMs: 2000,
    maxOutputBytes: 2097152, maxStderrBytes: 65536, ...(input === undefined ? {} : { input }) });
await mkdir(output, { recursive: true, mode: 0o700 });
const files = ['evals/artifact-comparison/protocol.md', 'evals/artifact-comparison/fixtures.ts',
  'evals/artifact-comparison/control.ts', 'evals/artifact-comparison/server.ts', 'evals/artifact-comparison/judge.ts',
  'evals/artifact-comparison/metrics.ts', 'evals/artifact-comparison/run.ts', 'packages/cli/src/artifact-session.ts',
  'packages/core/src/managed-worker.ts', 'packages/cli/src/codex-worker.ts', 'packages/cli/src/test-artifacts.ts',
  'packages/cli/src/test-policy.ts', 'packages/cli/src/worker-process.ts', 'packages/provider-typesafe/src/index.ts',
  'packages/cli/src/config.ts', 'packages/core/src/index.ts', 'packages/core/src/artifact.ts',
  'packages/core/src/worker.ts', 'package.json', 'package-lock.json'];
const manifest = { timestamp: new Date().toISOString(), hashes: Object.fromEntries(await Promise.all(files.map(async p => [p, hash(await readFile(p, 'utf8'))]))),
  skillHash: hash(comparisonSkill), schedule, expectedRuns: 12, runtime: { node: process.version, platform: process.platform, arch: process.arch } };
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
let hooks = false; try { await access(join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'hooks.json')); hooks = true; } catch {}
if (hooks || process.versions.node !== '24.21.0') throw new Error('Unsupported worker environment.');
const versions: Record<string, string> = {};
for (const [host, executable, expected] of [['codex', codex, 'codex-cli 0.154.0-alpha.6.2'], ['claude-code', claude, '2.1.274 (Claude Code)']]) {
  const v = await execute(executable!, ['--version'], process.cwd(), 10000);
  versions[host!] = v.stdout.toString('utf8').trim();
  if (versions[host!] !== expected) throw new Error('Host version differs from the frozen protocol.');
}
const rows: any[] = []; let stopReason: string | null = null; let observedUpperCost = 0;
const started = performance.now();
async function runCell(host: string, arm: string, task: Task) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jevra-paired-'))), cwd = join(root, 'workspace');
  const id = `${host}-${task.id}-${arm}`;
  const progress: any = { id, host, arm, task: task.id, timestamp: new Date().toISOString(), status: 'started',
    protocolHash: manifest.hashes['evals/artifact-comparison/protocol.md'], hostVersion: versions[host],
    actualBilledUsd: null, subscriptionAllowance: null };
  const save = () => writeFile(join(output, id + '.json'), JSON.stringify(progress, null, 2), { mode: 0o600 });
  await save();
  try {
    await mkdir(cwd); await writeFile(join(cwd, task.sourceName), task.source);
    if ((await execute('git', ['init', '--quiet'], cwd, 5000)).exitCode !== 0) throw new Error('Fixture setup failed');
    const skillDirectory = join(cwd, host === 'codex' ? '.agents' : '.claude', 'skills', 'test-artifact');
    if (arm !== 'native') { await mkdir(skillDirectory, { recursive: true }); await writeFile(join(skillDirectory, 'SKILL.md'), comparisonSkill); }
    const config = join(root, 'config.json'), callsFile = join(root, 'calls.json');
    await writeFile(config, JSON.stringify({ version: 1, mode: 'advise', skillRoots: [skillDirectory], traces: false,
      keychainService: values['keychain-service'], testArtifacts: { enabled: true, experimentalProfile: 'node-pure-function-tests/1',
        codexExecutable: codex, stagingDirectory: join(root, 'staging'), maxOperations: 1, profiles: [{
          id: task.id, sourcePath: join(cwd, task.sourceName), outputName: task.outputName, exportName: task.exportName,
          requirements: task.requirements, instructions: ['Write technical artifacts in English.'], mutants: task.mutants.slice(0, 2) }] } }), { mode: 0o600 });
    const serverArgs = [server, '--arm', arm, '--config', config, '--log', callsFile];
    const model = host === 'codex' ? 'gpt-6-astra' : 'claude-sonnet-5';
    let args: string[];
    if (host === 'codex') {
      const settings = ['approval_policy="never"', 'model_provider="openai"', 'forced_login_method="chatgpt"',
        'model_reasoning_effort="low"', 'skills.bundled.enabled=false', 'skills.include_instructions=true',
        'memories.use_memories=false', 'memories.generate_memories=false', 'web_search="disabled"',
        'features.apps=false', 'features.plugins=false', 'features.remote_plugin=false', 'features.multi_agent=false',
        `log_dir=${JSON.stringify(join(root, 'logs'))}`, ...(arm === 'native' ? ['mcp_servers={}'] : [
          `mcp_servers.jevra.command=${JSON.stringify(process.execPath)}`, `mcp_servers.jevra.args=${JSON.stringify(serverArgs)}`,
          `mcp_servers.jevra.cwd=${JSON.stringify(cwd)}`, 'mcp_servers.jevra.tool_timeout_sec=200',
          'mcp_servers.jevra.default_tools_approval_mode="approve"'])];
      args = ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'workspace-write',
        '--model', model, ...settings.flatMap(v => ['-c', v]), '--json', '-'];
    } else {
      args = ['-p', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--model', model,
        '--effort', 'low', '--max-budget-usd', '2', '--permission-mode', 'acceptEdits', '--permission-prompts', 'none',
        '--tools', 'Read,Edit,Write,Glob,Grep,Bash,Skill', '--allowedTools',
        'Read,Edit,Write,Glob,Grep,Bash,Skill,mcp__jevra__test_profiles,mcp__jevra__generate_tests,mcp__jevra__read_test_artifact',
        '--setting-sources', 'project', '--strict-mcp-config', '--mcp-config', JSON.stringify({ mcpServers: arm === 'native' ? {}
          : { jevra: { command: process.execPath, args: serverArgs, cwd } } })];
    }
    const before = performance.now();
    const run = await execute(host === 'codex' ? codex : claude, args, cwd, 240000, taskPrompt(task));
    progress.durationMs = Math.round(performance.now() - before);
    const events: any[] = run.stdout.toString('utf8').split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    progress.hostMetrics = hostMetrics(host, events); progress.configuredModel = model;
    progress.exitCode = run.exitCode; progress.cleanupComplete = run.cleanupComplete;
    progress.failure = run.failure ?? progress.hostMetrics.failure;
    progress.calls = []; try { progress.calls = JSON.parse(await readFile(callsFile, 'utf8')); } catch {}
    const ledger: any[] = [];
    try {
      for (const file of await readdir(join(root, 'staging'))) {
        if (file === 'control.json') ledger.push(JSON.parse(await readFile(join(root, 'staging', file), 'utf8')));
        if (!file.startsWith('mcp-session-')) continue;
        for (const child of await readdir(join(root, 'staging', file))) if (child.endsWith('.json')) {
          ledger.push(JSON.parse(await readFile(join(root, 'staging', file, child), 'utf8')));
        }
      }
    } catch {}
    progress.ledger = ledger;
    progress.managedMetrics = managedMetrics(arm, ledger, progress.calls.some((c: any) => c.name === 'generate_tests'));
    progress.total = totalMetrics(progress.hostMetrics, progress.managedMetrics);
    progress.sourceUnchanged = (await readFile(join(cwd, task.sourceName), 'utf8')) === task.source;
    let content: string | null = null;
    try { const p = join(cwd, task.outputName), s = await lstat(p);
      if (s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && s.size <= 32768) content = await readFile(p, 'utf8'); } catch {}
    const judgeStarted = performance.now();
    progress.quality = await judge(task, content, progress.sourceUnchanged, join(root, 'independent-check'));
    progress.judgeDurationMs = Math.round(performance.now() - judgeStarted);
    const accepted = ledger.find(e => e.status === 'accepted');
    progress.acceptedArtifactApplied = Boolean(content && accepted && evidenceHash(content) === (accepted.receipt ?? accepted).candidateHash);
    progress.outputHash = content === null ? null : evidenceHash(content);
    progress.success = progress.quality.passed && !progress.failure && run.exitCode === 0 && run.cleanupComplete;
    progress.status = 'completed';
  } catch {
    progress.status = 'failed'; progress.failure ??= 'harness_error'; progress.success = false;
    progress.accountingIncomplete = true;
  } finally { await save(); await rm(root, { recursive: true, force: true }); }
  return progress;
}
for (const block of schedule) {
  for (const arm of block.arms) {
    if (shutdown.signal.aborted) stopReason ??= 'operator_interrupted';
    if (performance.now() - started > 1200000) stopReason ??= 'pilot_time_budget';
    if (observedUpperCost >= 8) stopReason ??= 'pilot_cost_scenario_budget';
    if (stopReason) break;
    const row = await runCell(block.host, arm, tasks.find(t => t.id === block.task)!); rows.push(row);
    observedUpperCost += row.total?.cost?.high ?? 0;
    const errors = JSON.stringify([row.failure, ...(row.ledger ?? []).map((e: any) => [e.reason, e.receipt?.decisions?.map((d: any) => d.reason),
      (e.receipt ?? e).generations?.map((g: any) => g.failure)])]);
    if (/authentication|missing_credentials|rate_limited/.test(errors)) stopReason = 'authentication_or_quota';
    if (row.cleanupComplete === false) stopReason = 'cleanup_failed';
    if (row.status === 'failed') stopReason = 'harness_failure';
    await writeFile(join(output, 'results.json'), JSON.stringify({ manifest, rows, stopReason, observedUpperCost }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ id: row.id, success: row.success, failure: row.failure, durationMs: row.durationMs,
      helper: row.calls?.map((c: any) => c.name), applied: row.acceptedArtifactApplied, total: row.total }));
  }
  if (stopReason) break;
}
await writeFile(join(output, 'results.json'), JSON.stringify({ manifest, rows, stopReason, observedUpperCost }, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ output, completed: rows.length, expected: 12, stopReason, observedUpperCost }));
