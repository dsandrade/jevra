import { parseArgs } from 'node:util';
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { workerEnvironment } from '../../packages/cli/src/codex-worker.ts';
import { runWorkerProcess } from '../../packages/cli/src/worker-process.ts';
import { reconcileInvocations } from '../../packages/core/src/accounting.ts';
import type { Invocation, Reservation } from '../../packages/core/src/accounting.ts';
import { hostMetrics } from '../artifact-comparison/metrics.ts';
import { makeManifest } from './prepare.ts';
import { arms, tasks, taskPrompt } from './fixtures.ts';
import { judge } from './judge.ts';
const { values } = parseArgs({ options: { host: { type: 'string' }, task: { type: 'string' }, arms: { type: 'string' },
  'max-cells': { type: 'string', default: '2' }, 'max-known-input': { type: 'string', default: '300000' },
  'codex-executable': { type: 'string' }, 'claude-executable': { type: 'string', default: 'claude' },
  'keychain-service': { type: 'string' }, output: { type: 'string', default: `evals/local-results/reader-comparison-${Date.now()}` } } });
const maxCells = Number(values['max-cells']), maxInput = Number(values['max-known-input']);
if (process.versions.node !== '24.21.0' || !values['codex-executable'] || !values['keychain-service']
  || !Number.isInteger(maxCells) || maxCells < 1 || maxCells > 40 || !Number.isSafeInteger(maxInput) || maxInput < 1
  || values.host && !['codex', 'claude-code'].includes(values.host) || values.task && !tasks.some(t => t.id === values.task)) throw new Error('invalid_frozen_run_configuration');
const selectedArms = values.arms?.split(',') ?? [...arms];
if (new Set(selectedArms).size !== selectedArms.length || selectedArms.some(a => !arms.includes(a as typeof arms[number]))) throw new Error('invalid_arms');
const codex = resolve(values['codex-executable']), output = resolve(values.output!);
try { await access(join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'hooks.json')); throw new Error('unsupported_standalone_user_hooks'); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const manifest = await makeManifest();
const cells = manifest.cells.filter(c => (!values.host || c.host === values.host) && (!values.task || c.taskId === values.task) && selectedArms.includes(c.arm));
const frozen = { ...manifest, selectedCells: cells, budget: { maxCells, maxKnownInput: maxInput, maxRunMs: 900000 },
  runtime: { node: process.version, workerModel: 'gpt-5.6-luna', parentModels: { codex: 'gpt-6-astra', 'claude-code': 'claude-sonnet-5' }, effort: 'low' } };
await mkdir(output, { recursive: true, mode: 0o700 });
await writeFile(join(output, 'manifest.json'), JSON.stringify(frozen, null, 2), { flag: 'wx', mode: 0o600 });
const env = workerEnvironment(process.env); delete env.JEVRA_WORKER_ACTIVE;
env.PATH = dirname(process.execPath) + ':' + (env.PATH ?? '');
for (const k of ['USER', 'LOGNAME', 'SHELL', 'CLAUDE_CONFIG_DIR']) if (process.env[k]) env[k] = process.env[k];
const shutdown = new AbortController(); for (const s of ['SIGINT', 'SIGTERM'] as const) process.once(s, () => shutdown.abort());
const execute = (executable: string, args: string[], cwd: string, timeoutMs: number, input?: string) => runWorkerProcess({ executable, args, cwd, env,
  signal: shutdown.signal, timeoutMs, killGraceMs: 2000, maxOutputBytes: 2097152, maxStderrBytes: 65536, ...(input !== undefined ? { input } : {}) });
for (const host of [...new Set(cells.map(c => c.host))]) {
  const r = await execute(host === 'codex' ? codex : values['claude-executable']!, ['--version'], process.cwd(), 10000);
  if (r.failure || r.exitCode !== 0 || r.stdout.toString('utf8').trim() !== (host === 'codex' ? 'codex-cli 0.154.0-alpha.6.2' : '2.1.274 (Claude Code)')) throw new Error('unsupported_host_version');
}
const rows: any[] = []; let stopReason: string | null = null, knownInput = 0;
const started = performance.now();
const save = () => writeFile(join(output, 'results.json'), JSON.stringify({ manifest: frozen, rows, stopReason,
  missingCells: cells.filter(c => !rows.some(r => r.id === c.id)).map(c => c.id), actualBilledUsd: null, subscriptionUsage: null,
  promotion: 'not_authorized' }, null, 2), { mode: 0o600 });
await save();
for (const cell of cells) {
  if (rows.length >= maxCells || knownInput >= maxInput || performance.now() - started >= 900000 || shutdown.signal.aborted) {
    stopReason = shutdown.signal.aborted ? 'cancelled' : 'budget_exceeded'; break;
  }
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jevra-reader-eval-'))), cwd = join(root, 'workspace');
  const row: any = { ...cell, status: 'started', success: false, accounting: null, failure: null, helperJournal: null };
  rows.push(row); await save();
  try {
    const task = tasks.find(t => t.id === cell.taskId)!; await mkdir(cwd);
    for (const [p, content] of Object.entries(task.files)) await writeFile(join(cwd, p), content);
    if ((await execute('git', ['init', '--quiet'], cwd, 5000)).exitCode !== 0) throw new Error('setup_failed');
    const skillDirectory = join(cwd, cell.host === 'codex' ? '.agents' : '.claude', 'skills', 'bulk-reader');
    if (cell.arm !== 'native') { await mkdir(skillDirectory, { recursive: true }); await writeFile(join(skillDirectory, 'SKILL.md'),
      '---\nname: bulk-reader\ndescription: Focused reading of large or cross-file source material.\n---\nPrefer bulk_read for a focused question over large supplied files. Recheck exact evidence with native targeted reads before edits. On missing evidence or helper failure continue natively without another paid generation.\n'); }
    const configFile = join(root, 'config.json'), log = join(root, 'invocations.json');
    await writeFile(configFile, JSON.stringify({ version: 1, mode: 'advise', skillRoots: [skillDirectory], traces: false,
      keychainService: values['keychain-service'], stateDirectory: join(root, 'state'), bulkRead: { roots: [cwd],
        backend: cell.arm === 'luna-full' ? 'deterministic' : 'jev', maxFileBytes: 131072, maxTotalBytes: 98304,
        reader: { enabled: cell.arm.startsWith('jev-'), experimentalProfile: 'focused-reader/1', codexExecutable: codex,
          selection: cell.arm === 'jev-selected' ? 'jev' : 'full', maxCorpusBytes: 98304 } } }), { mode: 0o600 });
    const serverArgs = [resolve('evals/reader-comparison/server.ts'), '--arm', cell.arm, '--config', configFile, '--log', log];
    let args: string[];
    if (cell.host === 'codex') {
      const settings = ['approval_policy="never"', 'model_provider="openai"', 'forced_login_method="chatgpt"', 'model_reasoning_effort="low"',
        'skills.bundled.enabled=false', 'skills.include_instructions=true', 'memories.use_memories=false', 'memories.generate_memories=false',
        'web_search="disabled"', 'features.apps=false', 'features.plugins=false', 'features.remote_plugin=false', 'features.multi_agent=false',
        `log_dir=${JSON.stringify(join(root, 'logs'))}`, ...(cell.arm === 'native' ? ['mcp_servers={}'] : [
          `mcp_servers.jevra.command=${JSON.stringify(process.execPath)}`, `mcp_servers.jevra.args=${JSON.stringify(serverArgs)}`,
          `mcp_servers.jevra.cwd=${JSON.stringify(cwd)}`, 'mcp_servers.jevra.tool_timeout_sec=200', 'mcp_servers.jevra.default_tools_approval_mode="approve"'])];
      args = ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'workspace-write', '--model', 'gpt-6-astra',
        ...settings.flatMap(s => ['-c', s]), '--json', '-'];
    } else args = ['-p', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--model', 'claude-sonnet-5', '--effort', 'low',
      '--max-budget-usd', '2', '--permission-mode', 'acceptEdits', '--permission-prompts', 'none', '--tools', 'Read,Edit,Write,Glob,Grep,Bash,Skill',
      '--allowedTools', 'Read,Edit,Write,Glob,Grep,Bash,Skill,mcp__jevra__bulk_read,mcp__jevra__code_context', '--setting-sources', 'project',
      '--strict-mcp-config', '--mcp-config', JSON.stringify({ mcpServers: cell.arm === 'native' ? {} : { jevra: { command: process.execPath, args: serverArgs, cwd } } })];
    const reservation: Reservation = { id: cell.id + '/parent', component: 'parent' };
    row.parentReservation = reservation; await save();
    const cellStarted = performance.now();
    const r = await execute(cell.host === 'codex' ? codex : values['claude-executable']!, args, cwd, Math.min(240000, 900000 - (performance.now() - started)), taskPrompt(task));
    const events = r.stdout.toString('utf8').split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    const { cost: _historicalScenario, ...metrics } = hostMetrics(cell.host, events); row.parent = metrics; row.cleanupComplete = r.cleanupComplete;
    row.failure = r.failure ?? metrics.failure; row.durationMs = Math.round(performance.now() - cellStarted);
    const parent: Invocation = { ...reservation, status: row.failure || r.exitCode !== 0 ? 'failed' : 'completed', usage: metrics.usage };
    let helper: { reservations: Reservation[]; journals: Invocation[] } = { reservations: [], journals: [] };
    let missingHelperJournal = false;
    if (cell.arm !== 'native') { try { helper = JSON.parse(await readFile(log, 'utf8')); } catch { missingHelperJournal = true; } }
    row.helperJournal = helper;
    row.accounting = reconcileInvocations([reservation, ...helper.reservations], [parent, ...helper.journals],
      missingHelperJournal ? ['worker', 'managed_jev'] : []);
    row.helperCalls = events.flatMap(e => cell.host === 'codex' ? e.type === 'item.completed' && e.item?.type === 'mcp_tool_call' ? [e.item.tool] : []
      : e.type === 'assistant' ? (e.message?.content ?? []).filter((i: any) => i.type === 'tool_use' && i.name?.startsWith('mcp__jevra__')).map((i: any) => i.name) : []);
    const observedOutputs: string[] = events.flatMap(e => cell.host === 'codex'
      ? typeof e.item?.aggregated_output === 'string' ? [e.item.aggregated_output] : []
      : e.type === 'user' ? (e.message?.content ?? []).filter((i: any) => i.type === 'tool_result').flatMap((i: any) =>
        typeof i.content === 'string' ? [i.content] : Array.isArray(i.content) ? i.content.filter((c: any) => typeof c.text === 'string').map((c: any) => c.text) : []) : []);
    row.toolOutputBytes = observedOutputs.length ? observedOutputs.reduce((n, s) => n + Buffer.byteLength(s), 0) : null;
    row.observedAgentMessages = events.filter(e => cell.host === 'codex' ? e.type === 'item.completed' && e.item?.type === 'agent_message' : e.type === 'assistant').length;
    row.internalModelPassCount = null;
    row.quality = await judge(task, cwd, join(root, 'judge')); row.success = row.quality.passed && !row.failure && r.exitCode === 0 && r.cleanupComplete;
    row.status = 'completed'; knownInput += row.accounting.knownInput;
    const failures = JSON.stringify([row.failure, helper.journals]);
    if (/authentication|rate_limited|missing_credentials/.test(failures)) stopReason = 'authentication_or_quota';
    if (!row.accounting.complete) stopReason ??= 'accounting_incomplete';
    if (!r.cleanupComplete) stopReason = 'cleanup_failed';
  } catch { row.status = 'failed'; row.failure ??= 'harness_error'; stopReason = 'harness_failure'; }
  finally { await save(); await rm(root, { recursive: true, force: true }); }
  console.log(JSON.stringify({ id: row.id, success: row.success, completeAccounting: row.accounting?.complete ?? false, failure: row.failure }));
  if (stopReason) break;
}
await save(); console.log(JSON.stringify({ output, completedCells: rows.length, selectedCells: cells.length, stopReason }));
