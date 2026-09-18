import { parseArgs } from 'node:util';
import { mkdir, mkdtemp, realpath, writeFile, readFile, readdir, rm, access, lstat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { hash } from '@jevra/core';
import { evidenceHash } from '@jevra/core/managed-worker';
import { NodeTestArtifacts } from '../../packages/cli/src/test-artifacts.ts';
import { runWorkerProcess } from '../../packages/cli/src/worker-process.ts';
import { workerEnvironment } from '../../packages/cli/src/codex-worker.ts';
import { hostMetrics, managedMetrics } from '../artifact-comparison/metrics.ts';

// One ordinary synthetic request, explicit scoped MCP setup and a repository skill.
// No global installation, auth copying, trust bypass, model retry or API fallback.
const { values } = parseArgs({ options: {
  host: { type: 'string' }, 'codex-executable': { type: 'string' },
  'claude-executable': { type: 'string', default: 'claude' }, 'keychain-service': { type: 'string' },
  'explicit-invocation': { type: 'boolean', default: false },
  delivery: { type: 'string', default: 'review' },
  'routing-hook': { type: 'boolean', default: false },
  output: { type: 'string', default: `evals/local-results/artifact-host-${Date.now()}.json` },
} });
if (!['codex', 'claude-code'].includes(values.host ?? '') || !values['codex-executable']) {
  throw new Error('Specify --host codex|claude-code and --codex-executable /absolute/path.');
}
if (!['review', 'native-ticket'].includes(values.delivery!)) throw new Error('Unknown delivery mode.');
if (values['routing-hook'] && (values.host !== 'claude-code' || values['explicit-invocation'])) {
  throw new Error('The routing-hook diagnostic requires an ordinary Claude request.');
}
const host = values.host!, codex = resolve(values['codex-executable']!), cli = resolve('dist/jevra.mjs');
const shutdown = new AbortController();
for (const s of ['SIGINT', 'SIGTERM'] as const) process.once(s, () => shutdown.abort());
const env = workerEnvironment(process.env);
delete env.JEVRA_WORKER_ACTIVE;
env.PATH = dirname(process.execPath) + ':' + (env.PATH ?? '');
if (process.env.CLAUDE_CONFIG_DIR) env.CLAUDE_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR;
// Claude's supported Keychain lookup depends on the ordinary login identity.
for (const key of ['USER', 'LOGNAME', 'SHELL']) if (process.env[key]) env[key] = process.env[key];
const execute = (executable: string, args: string[], cwd: string, timeoutMs: number, input?: string) =>
  runWorkerProcess({ executable, args, cwd, env, timeoutMs, signal: shutdown.signal, killGraceMs: 2000,
    maxOutputBytes: 2097152, maxStderrBytes: 65536, ...(input === undefined ? {} : { input }) });
const root = await realpath(await mkdtemp(join(tmpdir(), 'jevra-artifact-host-')));
try {
  // Standalone user hooks are not covered by ignore-user-config; do not bypass trust.
  let hooks = false;
  try { await access(join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'hooks.json')); hooks = true; } catch {}
  if (hooks) throw new Error('Standalone Codex user hooks require a separate capability review.');
  const source = 'export function sum(a: number, b: number): number { return a + b; }\n';
  const cwd = join(root, 'workspace'); await mkdir(cwd);
  await writeFile(join(cwd, 'sum.ts'), source);
  const skillDirectory = join(cwd, host === 'codex' ? '.agents' : '.claude', 'skills', 'test-artifact');
  await mkdir(skillDirectory, { recursive: true });
  const skill = await readFile(`plugins/${host}/jevra/skills/test-artifact/SKILL.md`, 'utf8');
  await writeFile(join(skillDirectory, 'SKILL.md'), skill);
  const git = await execute('git', ['init', '--quiet'], cwd, 5000);
  if (git.exitCode !== 0) throw new Error('Cannot initialize synthetic workspace.');
  const requirements = ['Assert sum(2, 3) equals 5.', 'Assert sum(-2, 3) equals 1.', 'Assert sum(0, 0) equals 0.'];
  const mutants = [{ id: 'subtract', content: source.replace('a + b', 'a - b') },
    { id: 'drop-second', content: source.replace('a + b', 'a') }];
  const configFile = join(root, 'config.json');
  await writeFile(configFile, JSON.stringify({ version: 1, mode: 'advise', skillRoots: [skillDirectory],
    keychainService: values['keychain-service'], traces: values['routing-hook'], stateDirectory: join(root, 'hook-state'),
    testArtifacts: { enabled: true, delivery: values.delivery, experimentalProfile: 'node-pure-function-tests/1', codexExecutable: codex,
      stagingDirectory: join(root, 'staging'), maxOperations: 1, profiles: [{ id: 'sum',
        sourcePath: join(cwd, 'sum.ts'), exportName: 'sum', outputName: 'sum.test.ts', requirements,
        instructions: ['Write technical artifacts in English.'], mutants }] } }), { mode: 0o600 });
  const serverArgs = [cli, 'mcp', '--host', host, '--config', configFile];
  const prompt = (values['explicit-invocation'] ? values.delivery === 'native-ticket'
    ? 'For this integration diagnostic, call Jevra generate_tests with source sum.ts and apply an accepted ticket through native permissions. '
    : 'For this integration diagnostic, call Jevra test_profiles, generate_tests and read_test_artifact. '
      + 'Use the staged accepted artifact with native editing permissions. ' : '')
    + 'Add sum.test.ts for the sum function in sum.ts. Cover adding positive operands (2, 3 => 5), '
    + 'a negative operand (-2, 3 => 1), and zeros (0, 0 => 0). Use node:test and strict assertions. '
    + 'Keep the implementation unchanged, verify the new tests, and report the result briefly.';
  let args: string[];
  const model = host === 'codex' ? 'gpt-6-astra' : 'claude-sonnet-5';
  if (host === 'codex') {
    const settings = ['approval_policy="never"', 'model_provider="openai"', 'forced_login_method="chatgpt"',
      'model_reasoning_effort="low"', 'skills.bundled.enabled=false', 'skills.include_instructions=true',
      'memories.use_memories=false', 'memories.generate_memories=false', 'web_search="disabled"',
      'features.apps=false', 'features.plugins=false', 'features.remote_plugin=false', 'features.multi_agent=false',
      `log_dir=${JSON.stringify(join(root, 'logs'))}`,
      `mcp_servers.jevra.command=${JSON.stringify(process.execPath)}`,
      `mcp_servers.jevra.args=${JSON.stringify(serverArgs)}`, `mcp_servers.jevra.cwd=${JSON.stringify(cwd)}`,
      'mcp_servers.jevra.tool_timeout_sec=200', 'mcp_servers.jevra.default_tools_approval_mode="approve"'];
    args = ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'workspace-write',
      '--model', model, ...settings.flatMap(v => ['-c', v]), '--json', '-'];
  } else {
    const quote = (s: string) => `'${s.replaceAll("'", "'\\''")}'`;
    const hookSettings = { hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', timeout: 15,
      command: [process.execPath, cli, 'hook', '--host', host, '--config', configFile].map(quote).join(' ') }] }] } };
    args = ['-p', '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
      '--model', model, '--effort', 'low', '--max-budget-usd', '2', '--permission-mode', 'acceptEdits',
      '--permission-prompts', 'none', '--tools', 'Read,Edit,Write,Glob,Grep,Bash,Skill',
      '--allowedTools', 'Read,Edit,Write,Glob,Grep,Bash,Skill,mcp__jevra__test_profiles,mcp__jevra__generate_tests,mcp__jevra__read_test_artifact',
      '--setting-sources', 'project', ...(values['routing-hook'] ? ['--settings', JSON.stringify(hookSettings)] : []),
      '--strict-mcp-config', '--mcp-config', JSON.stringify({
        mcpServers: { jevra: { command: process.execPath, args: serverArgs, cwd } } })];
  }
  const executable = host === 'codex' ? codex : values['claude-executable']!;
  const version = await execute(executable, ['--version'], cwd, 10000);
  const started = performance.now();
  const run = await execute(executable, args, cwd, 240000, prompt);
  const events: any[] = run.stdout.toString('utf8').split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const codexItems = events.filter(e => e.type === 'item.completed').map(e => e.item);
  const claudeItems = events.filter(e => e.type === 'assistant').flatMap(e => e.message?.content ?? []).filter(e => e.type === 'tool_use');
  const calls: string[] = host === 'codex' ? codexItems.filter(e => e.type === 'mcp_tool_call').map(e => e.tool)
    : claudeItems.filter(e => e.name.startsWith('mcp__jevra__')).map(e => e.name.replace('mcp__jevra__', ''));
  const ledger: any[] = [];
  try {
    for (const directory of await readdir(join(root, 'staging'))) {
      if (!directory.startsWith('mcp-session-')) continue;
      for (const file of await readdir(join(root, 'staging', directory))) {
        if (file.endsWith('.json')) ledger.push(JSON.parse(await readFile(join(root, 'staging', directory, file), 'utf8')));
      }
    }
  } catch {}
  const applicationReceipts: any[] = [];
  try {
    for (const session of await readdir(join(root, 'staging', 'native-tickets'))) {
      if (!/^[a-f0-9-]{36}$/.test(session)) continue;
      for (const file of await readdir(join(root, 'staging', 'native-tickets', session))) {
        if (!file.endsWith('.applied.json')) continue;
        const receipt = JSON.parse(await readFile(join(root, 'staging', 'native-tickets', session, file), 'utf8'));
        applicationReceipts.push({ status: receipt.status, candidateHash: receipt.candidateHash,
          bytes: receipt.bytes, postApplyChecks: receipt.postApplyChecks, inferenceCalls: receipt.inferenceCalls });
      }
    }
  } catch {}
  let written: string | null = null;
  try {
    const stat = await lstat(join(cwd, 'sum.test.ts'));
    if (stat.isFile() && !stat.isSymbolicLink() && stat.size <= 32768) written = await readFile(join(cwd, 'sum.test.ts'), 'utf8');
  } catch {}
  let quality: unknown = null;
  if (written !== null && Buffer.byteLength(written) <= 32768) {
    const checkRoot = join(root, 'independent-check'); await mkdir(checkRoot);
    await writeFile(join(checkRoot, 'sum.ts'), source);
    const validator = await NodeTestArtifacts.create({ sourcePath: join(checkRoot, 'sum.ts'), outputName: 'sum.test.ts',
      exportName: 'sum', mutants, stagingDirectory: join(root, 'independent-staging') });
    await validator.prepare({ operationId: 'independent-check', task: 'Verify the delivered synthetic tests.', instructions: [], requirements });
    try {
      quality = await validator.validate({ content: written, sha256: evidenceHash(written), bytes: Buffer.byteLength(written) }, 1, shutdown.signal);
    } catch {
      quality = { status: 'validation_unavailable', functionalCorrectness: 'unknown' };
    }
  }
  const end = events.findLast(e => e.type === (host === 'codex' ? 'turn.completed' : 'result'));
  const hostFailure = hostMetrics(host, events).failure;
  const rawUsage = end?.usage ?? null;
  const models: any[] = end?.modelUsage ? Object.values(end.modelUsage) : [];
  const hostUsage = host === 'codex' ? { inputTokens: rawUsage?.input_tokens ?? null,
    cachedInputTokens: rawUsage?.cached_input_tokens ?? null, cacheCreationInputTokens: null,
    outputTokens: rawUsage?.output_tokens ?? null }
    : { inputTokens: models.length ? models.reduce((s, m) => s + m.inputTokens + m.cacheReadInputTokens + m.cacheCreationInputTokens, 0) : null,
      cachedInputTokens: models.length ? models.reduce((s, m) => s + m.cacheReadInputTokens, 0) : null,
      cacheCreationInputTokens: models.length ? models.reduce((s, m) => s + m.cacheCreationInputTokens, 0) : null,
      outputTokens: models.length ? models.reduce((s, m) => s + m.outputTokens, 0) : null };
  const accepted = ledger.find(e => e.receipt && e.status === 'accepted')?.receipt;
  const commands: string[] = host === 'codex' ? codexItems.filter(e => e.type === 'command_execution').map(e => e.command ?? '')
    : claudeItems.filter(e => e.name === 'Bash').map(e => e.input?.command ?? '');
  const bodyForwardedInToolArguments = written === null ? null : host === 'codex'
    ? codexItems.some(e => ['command_execution', 'file_change'].includes(e.type) && JSON.stringify(e).includes(JSON.stringify(written).slice(1, -1)))
    : claudeItems.some(e => JSON.stringify(e.input ?? {}).includes(JSON.stringify(written).slice(1, -1)));
  const managed = managedMetrics('jev', ledger, calls.includes('generate_tests'));
  const routingHook: { requested: boolean; records: unknown[]; accountingComplete: boolean } = {
    requested: values['routing-hook'], records: [], accountingComplete: !values['routing-hook'] };
  if (values['routing-hook']) {
    try {
      for (const file of await readdir(join(root, 'hook-state/traces'))) {
        if (!file.endsWith('.jsonl')) continue;
        const traces = (await readFile(join(root, 'hook-state/traces', file), 'utf8')).trim().split('\n').map(s => JSON.parse(s));
        for (const t of traces) routingHook.records.push({ disposition: t.disposition, reason: t.reasonCode,
          delivery: t.delivery, adherence: t.adherence, evaluationAttempts: t.evaluationAttempts,
          model: t.providerModel, usage: t.usage, durationMs: t.totalLatencyMs });
      }
      routingHook.accountingComplete = routingHook.records.length > 0 && routingHook.records.every((t: any) =>
        t.evaluationAttempts === 0 || t.usage !== null);
    } catch {}
  }
  const report = { kind: 'artifact-host-adoption-diagnostic', timestamp: new Date().toISOString(), host,
    hostVersion: version.stdout.toString('utf8').trim().slice(0, 100), configuredModel: model,
    observedModel: events.find(e => e.type === 'system' && e.subtype === 'init')?.model ?? null,
    codeHash: hash(await readFile(cli, 'utf8')), skillHash: hash(skill),
    setup: values['routing-hook'] ? 'explicit MCP, repository skill and scoped existing Jev routing hook; no installed plugin'
      : 'explicit MCP plus repository skill; no installed plugin', routingHook,
    promptMentionsJevraOrTools: values['explicit-invocation'], delivery: values.delivery,
    skillAdvertised: host === 'claude-code' ? (events.find(e => e.type === 'system' && e.subtype === 'init')?.skills ?? []).includes('test-artifact') : null,
    mcpConnection: host === 'claude-code' ? (events.find(e => e.type === 'system' && e.subtype === 'init')?.mcp_servers ?? [])
      .filter((s: any) => s.name === 'jevra').map((s: any) => ({ name: s.name, status: s.status })) : null,
    skillReadObserved: host === 'codex'
      ? codexItems.some(e => e.type === 'command_execution' && /test-artifact\/SKILL.md/.test(e.command ?? ''))
      : claudeItems.some(e => (e.name === 'Skill' && /test-artifact/.test(e.input?.skill ?? ''))
        || (e.name === 'Read' && /test-artifact\/SKILL.md/.test(e.input?.file_path ?? ''))),
    mcpCalls: calls, exitCode: run.exitCode, failure: run.failure ?? hostFailure, cleanupComplete: run.cleanupComplete,
    terminalResult: host === 'codex' ? end?.type ?? null : end?.subtype ?? null,
    durationMs: Math.round(performance.now() - started), hostUsage,
    actualBilledUsd: null, subscriptionUsage: null, ledger, outputCreated: written !== null,
    managedUsage: { worker: managed.worker, jev: managed.jev, unknownEntries: managed.unknownEntries },
    materialization: { commandCalls: commands.filter(c => c.includes('materialize-test')).length,
      readArtifactCalls: calls.filter(c => c === 'read_test_artifact').length,
      fullExactBodyObservedInNativeToolPayload: bodyForwardedInToolArguments,
      applicationReceipts, outputMatchesApplicationReceipt: written !== null
        && applicationReceipts.some(r => r.status === 'applied' && r.candidateHash === evidenceHash(written!)) },
    outputMatchesAcceptedArtifact: written !== null && accepted ? evidenceHash(written) === accepted.candidateHash : false,
    sourceUnchanged: await readFile(join(cwd, 'sum.ts'), 'utf8') === source, quality,
    limitation: 'One synthetic task per invocation. Native application is independently observed, not authorized or guaranteed by the managed receipt. No matched baseline, efficiency claim, desktop validation or installation-lifecycle claim.',
  };
  const output = resolve(values.output!); await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ report: output, host, mcpCalls: calls, outputCreated: report.outputCreated,
    accepted: Boolean(accepted), outputMatchesAcceptedArtifact: report.outputMatchesAcceptedArtifact,
    hostUsage, routingHook, managedUsage: report.managedUsage, materialization: report.materialization,
    durationMs: report.durationMs, failure: report.failure, terminalResult: report.terminalResult }));
} finally { await rm(root, { recursive: true, force: true }); }
