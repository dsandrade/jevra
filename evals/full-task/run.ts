import { parseArgs } from 'node:util';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, symlink, realpath, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { hash } from '@jevra/core';
import { quoteArgument } from '../../packages/cli/src/bulk-read.ts';
import { prepareFixture, tasks } from './fixtures.ts';
import { hostMetrics } from './metrics.ts';

const { values } = parseArgs({ options: {
  hosts: { type: 'string', default: 'codex,claude-code' }, arms: { type: 'string', default: 'native,deterministic,jev' },
  tasks: { type: 'string', default: tasks.map(t => t.id).join(',') }, repetitions: { type: 'string', default: '2' },
  'keychain-service': { type: 'string' }, output: { type: 'string', default: 'evals/local-results/full-task-mcp' },
  timeout: { type: 'string', default: '300' },
} });
const hosts = values.hosts!.split(',');
const arms = values.arms!.split(',');
const selectedTasks = tasks.filter(t => values.tasks!.split(',').includes(t.id));
const repetitions = Number(values.repetitions), timeout = Number(values.timeout) * 1000;
if (hosts.some(h => !['codex', 'claude-code'].includes(h)) || arms.some(a => !['native', 'deterministic', 'jev'].includes(a))
  || !selectedTasks.length || !Number.isInteger(repetitions) || repetitions < 1 || repetitions > 5 || !Number.isFinite(timeout) || timeout < 10000 || timeout > 300000) throw new Error('Invalid evaluation settings.');
const output = resolve(values.output!);
await mkdir(output, { recursive: true });
const cli = resolve('dist/jevra.mjs');
const judge = resolve('evals/full-task/judge.mjs');
const codeHash = hash(await readFile(cli, 'utf8'));
const protocolHash = hash(await readFile('evals/full-task/protocol.md', 'utf8'));
const fixtureHash = hash(await readFile('evals/full-task/fixtures.ts', 'utf8'));
const shutdown = new AbortController();
let abortReason: string | null = null;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { abortReason = 'operator_interrupted'; shutdown.abort(); });

type Execution = { code: number | null; timedOut: boolean; stdout: string; stderr: string; durationMs: number };
async function execute(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, maxMs: number): Promise<Execution> {
  const start = performance.now();
  return new Promise(resolveRun => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let stdout = '', stderr = '', timedOut = false;
    child.stdout.on('data', data => { if (stdout.length < 8_000_000) stdout += data; });
    child.stderr.on('data', data => { if (stderr.length < 2_000_000) stderr += data; });
    const stop = (signal: NodeJS.Signals) => { try { process.kill(-child.pid!, signal); } catch {} };
    let abortKill: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => { stop('SIGTERM'); abortKill = setTimeout(() => stop('SIGKILL'), 5000); };
    shutdown.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => { timedOut = true; stop('SIGTERM'); }, maxMs);
    const killTimer = setTimeout(() => stop('SIGKILL'), maxMs + 5000);
    child.once('error', () => { shutdown.signal.removeEventListener('abort', onAbort); clearTimeout(abortKill); clearTimeout(timer); clearTimeout(killTimer); resolveRun({ code: null, timedOut, stdout, stderr, durationMs: performance.now() - start }); });
    child.once('close', code => { shutdown.signal.removeEventListener('abort', onAbort); clearTimeout(abortKill); clearTimeout(timer); clearTimeout(killTimer); resolveRun({ code, timedOut, stdout, stderr, durationMs: performance.now() - start }); });
  });
}

const parseEvents = (stdout: string): any[] => stdout.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });

async function runCase(host: string, arm: string, task: typeof tasks[number], repetition: number) {
  const id = `${host}-${task.id}-${repetition}-${arm}`;
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jevra-task-')));
  const cwd = join(root, 'workspace');
  const traceRoot = join(cwd, '.jevra/state');
  try {
    await prepareFixture(cwd, task.id);
    const initialized = spawnSync('git', ['init', '--quiet'], { cwd, encoding: 'utf8' });
    if (initialized.status !== 0) throw new Error('Fixture Git initialization failed.');
    const config = join(root, 'config.json');
    await writeFile(config, JSON.stringify({ version: 1, mode: arm === 'native' ? 'disabled' : 'advise',
      skillRoots: [join(cwd, 'skills')], stateDirectory: traceRoot, keychainService: values['keychain-service'],
      bulkRead: { roots: [cwd], transport: 'mcp', backend: arm === 'jev' ? 'jev' : 'deterministic', timeoutMs: 8000 } }), { mode: 0o600 });
    const hookCommand = [process.execPath, cli, 'hook', '--host', host, '--config', config].map(quoteArgument).join(' ');
    const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH}` };
    delete env.ANTHROPIC_API_KEY; delete env.OPENAI_API_KEY; delete env.CODEX_API_KEY;
    let args: string[];
    if (host === 'codex') {
      const codexHome = join(root, 'codex-home');
      await mkdir(codexHome);
      await symlink(join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json'), join(codexHome, 'auth.json'));
      env.CODEX_HOME = codexHome;
      const hook = `hooks.PreToolUse=[{matcher="Read|Bash|exec_command",hooks=[{type="command",command=${JSON.stringify(hookCommand)},timeout=3}]}]`;
      args = ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'workspace-write',
        '--dangerously-bypass-hook-trust', '-c', 'approval_policy="never"', '-c', 'sandbox_workspace_write.network_access=true',
        '-c', 'skills.include_instructions=false', '-c', 'skills.bundled.enabled=false',
        ...(arm === 'native' ? [] : ['-c', `mcp_servers.jevra.command=${JSON.stringify(process.execPath)}`,
          '-c', `mcp_servers.jevra.args=${JSON.stringify([cli, 'mcp', '--host', host, '--config', config])}`,
          '-c', 'mcp_servers.jevra.tool_timeout_sec=15']),
        '-m', 'gpt-6-astra', '-c', 'model_reasoning_effort="xhigh"', '-c', hook, '--json', task.prompt];
    } else {
      const settings = { hooks: { PreToolUse: [{ matcher: 'Read|Bash', hooks: [{ type: 'command', command: hookCommand, timeout: 3 }] }] } };
      args = ['-p', task.prompt, '--output-format', 'stream-json', '--verbose', '--include-hook-events', '--no-session-persistence',
        '--model', 'claude-sonnet-5', '--effort', 'high', '--max-budget-usd', '2', '--permission-mode', 'acceptEdits',
        '--permission-prompts', 'none', '--tools', 'Read,Edit,Write,Glob,Grep,Bash', '--allowedTools', 'Read,Edit,Write,Glob,Grep,Bash,mcp__jevra__bulk_read,mcp__jevra__code_context',
        '--setting-sources', '', '--settings', JSON.stringify(settings), '--strict-mcp-config', '--mcp-config', JSON.stringify({ mcpServers: arm === 'native' ? {} : { jevra: { command: process.execPath, args: [cli, 'mcp', '--host', host, '--config', config] } } }), '--disable-slash-commands'];
    }
    const run = await execute(host === 'codex' ? 'codex' : 'claude', args, cwd, env, timeout);
    const events = parseEvents(run.stdout);
    const metrics = hostMetrics(host, events);
    const judged = spawnSync(process.execPath, [judge, task.id, cwd], { encoding: 'utf8', timeout: 10000 });
    let quality: any = { passed: false, checks: [], judgeError: true };
    try { quality = JSON.parse(judged.stdout); } catch {}
    const traces: any[] = [];
    try { for (const file of await readdir(join(traceRoot, 'traces'))) traces.push(...parseEvents(await readFile(join(traceRoot, 'traces', file), 'utf8'))); } catch {}
    const helper = traces.filter(t => t.module === 'context-selection');
    const attempts = helper.reduce((s, t) => s + t.evaluationAttempts, 0);
    const known = helper.filter(t => t.usage !== null).length;
    const input = helper.reduce((s, t) => s + (t.usage?.input_tokens ?? 0), 0);
    const outputTokens = helper.reduce((s, t) => s + (t.usage?.output_tokens ?? 0), 0);
    const untracedHelperCalls = Math.max(0, metrics.helperInvocations - helper.length);
    const jevCost = attempts === known && (arm !== 'jev' || untracedHelperCalls === 0) ? input * 0.042 / 1e6 : null;
    const record = { id, host, arm, task: task.id, repetition, codeHash, fixtureHash, protocolHash,
      hostVersion: spawnSync(host === 'codex' ? 'codex' : 'claude', ['--version'], { encoding: 'utf8' }).stdout.trim(),
      timestamp: new Date().toISOString(), durationMs: Math.round(run.durationMs), exitCode: run.code, timedOut: run.timedOut,
      quality, ...metrics,
      taskCompleted: quality.passed && !run.timedOut && run.code === 0 && ['turn.completed', 'success'].includes(metrics.terminalResult),
      failure: run.timedOut ? 'host_timeout' : metrics.failure ?? (run.code !== 0 ? 'host_process_failed' : null),
      actualBilledUsd: null,
      jev: { attempts, callsWithKnownUsage: known, observedInputTokens: input, observedOutputTokens: outputTokens,
        estimateUsd: jevCost, actualBilledUsd: null },
      totalEstimateUsdLow: metrics.costEstimateUsdLow === null || jevCost === null ? null : metrics.costEstimateUsdLow + jevCost,
      totalEstimateUsdHigh: metrics.costEstimateUsdHigh === null || jevCost === null ? null : metrics.costEstimateUsdHigh + jevCost,
      redirects: traces.filter(t => t.module === 'bulk-read-gate' && t.action === 'redirect').length,
      helperCalls: helper.length, untracedHelperCalls, helperOutcomes: helper.map(t => ({ reason: t.reasonCode, sourceBytes: t.sourceBytes,
        outputBytes: t.outputBytes, candidateCount: t.candidateCount, shortlistedCount: t.shortlistedCount, usage: t.usage })),
    };
    await writeFile(join(output, `${id}.json`), JSON.stringify(record, null, 2) + '\n');
    await writeFile(join(output, `${id}.raw.jsonl`), run.stdout, { mode: 0o600 });
    await writeFile(join(output, `${id}.stderr.log`), run.stderr, { mode: 0o600 });
    const sourceFile = task.id === 'retry-policy' ? 'retry.mjs' : 'retention.mjs';
    await writeFile(join(output, `${id}.solution.mjs`), await readFile(join(cwd, 'src', sourceFile)));
    console.log(JSON.stringify({ id, passed: quality.passed, checks: `${quality.checks.filter((c: any) => c.passed).length}/${quality.checks.length}`,
      durationMs: record.durationMs, inputTokens: metrics.totalInputTokens, outputTokens: metrics.totalOutputTokens,
      estimateUsd: [record.totalEstimateUsdLow, record.totalEstimateUsdHigh], redirects: record.redirects,
      helperCalls: record.helperCalls, jevCalls: attempts, failure: metrics.failure }));
    return record;
  } finally { await rm(root, { recursive: true, force: true }); }
}

const rows: any[] = [];
const expectedRuns = hosts.length * arms.length * selectedTasks.length * repetitions;
let saving = Promise.resolve();
const save = () => {
  const snapshot = JSON.stringify({ kind: 'shunt-full-task-pilot', expectedRuns, repetitions, hosts, arms, transport: 'mcp', abortReason, codeHash, fixtureHash, protocolHash, rows }, null, 2) + '\n';
  saving = saving.then(() => writeFile(join(output, 'results.json'), snapshot));
  return saving;
};
// One run at a time per host; hosts are independent benchmark subjects.
await Promise.all(hosts.map(async host => {
  for (let repetition = 0; repetition < repetitions; repetition++) {
    for (const [index, task] of selectedTasks.entries()) {
      const offset = (index + repetition) % arms.length;
      for (const arm of [...arms.slice(offset), ...arms.slice(0, offset)]) {
        if (abortReason) return;
        const row = await runCase(host, arm, task, repetition);
        rows.push(row);
        if (row.failure && /auth|login|rate.limit|usage.limit/i.test(row.failure)) abortReason = 'authentication_or_rate_limit';
        if (row.helperOutcomes.some((o: any) => ['missing_credentials', 'authentication', 'rate_limited'].includes(o.reason))) abortReason = 'helper_authentication_or_rate_limit';
        await save();
      }
    }
  }
}));
await save();
console.log(JSON.stringify({ status: rows.length === expectedRuns ? 'completed' : 'incomplete', runs: rows.length, expectedRuns, abortReason, report: join(output, 'results.json') }));
