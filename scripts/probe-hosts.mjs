import { spawnSync, spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, writeFile, symlink, rm } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { 'live-jev': { type: 'boolean' }, 'keychain-service': { type: 'string' } } });
const modelMessages = stdout => stdout.split('\n').flatMap(line => {
  try {
    const item = JSON.parse(line);
    return item.type === 'item.completed' && item.item?.type === 'agent_message' ? [item.item.text] : [];
  } catch { return []; }
});

const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const run = (command, args, options) => new Promise(resolveRun => {
  const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', x => { if (stdout.length < 1000000) stdout += x; });
  child.stderr.on('data', x => { if (stderr.length < 1000000) stderr += x; });
  const timer = setTimeout(() => child.kill('SIGTERM'), 45000);
  const killTimer = setTimeout(() => child.kill('SIGKILL'), 50000);
  child.on('error', () => { clearTimeout(timer); clearTimeout(killTimer); resolveRun({ code: null, stdout, stderr }); });
  child.on('close', code => { clearTimeout(timer); clearTimeout(killTimer); resolveRun({ code, stdout, stderr }); });
});
const root = await mkdtemp(join(tmpdir(), 'jevra-host-probe-'));
const reports = [];
try {
  const probe = resolve('scripts/probe-hook.mjs');
  const home = join(root, 'codex-home');
  const cwd = join(root, 'workspace');
  await mkdir(home);
  await mkdir(cwd);
  // Reference existing auth without copying or reading its contents. The temporary
  // home excludes all user plugin/hook configuration from the trust override.
  await symlink(join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json'), join(home, 'auth.json'));
  const marker = 'JEVRA_' + randomUUID().replaceAll('-', '');
  await writeFile(join(cwd, 'marker.txt'), marker);
  const command = `${quote(process.execPath)} ${quote(probe)}`;
  const hook = `hooks.UserPromptSubmit=[{hooks=[{type="command",command=${JSON.stringify(command)},timeout=5}]}]`;
  const prompt = 'Do not call tools. Return only the verification marker provided by the UserPromptSubmit hook. If no marker exists, return MISSING.';
  const env = { ...process.env, CODEX_HOME: home, JEVRA_PROBE_DIRECTORY: cwd, PATH: `${dirname(process.execPath)}:${process.env.PATH}` };
  const result = await run('codex', ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check',
    '--sandbox', 'read-only', '--dangerously-bypass-hook-trust', '-c', hook, '--json', prompt], { cwd, env });
  let received = null;
  try { received = JSON.parse(await readFile(join(cwd, 'received.json'), 'utf8')); } catch {}
  // Check only model output, not the hook receipt or diagnostic echo.
  const messages = modelMessages(result.stdout);
  reports.push({ host: 'codex', version: spawnSync('codex', ['--version'], { encoding: 'utf8' }).stdout.trim(),
    hookReceived: received?.hook_event_name === 'UserPromptSubmit', modelReceivedContext: messages.some(x => x.trim() === marker),
    exitCode: result.code, payloadFields: Object.keys(received || {}).sort(),
    trustMode: 'isolated, inspected probe only; one-invocation hook trust override; no persistent trust changes',
  });
  if (!reports[0].modelReceivedContext) {
    await mkdir('.jevra/probes', { recursive: true });
    await writeFile('.jevra/probes/codex-last-run.json', JSON.stringify(result, null, 2), { mode: 0o600 });
  }
  if (values['live-jev']) {
    const config = join(root, 'jevra.json');
    const state = join(root, 'state');
    await writeFile(config, JSON.stringify({ version: 1, mode: 'advise', skillRoots: [resolve('evals/fixtures/skills')],
      stateDirectory: state, keychainService: values['keychain-service'] }), { mode: 0o600 });
    const liveCommand = `${quote(process.execPath)} ${quote(resolve('dist/jevra.mjs'))} hook --host codex --config ${quote(config)}`;
    const liveHook = `hooks.UserPromptSubmit=[{hooks=[{type="command",command=${JSON.stringify(liveCommand)},timeout=15}]}]`;
    const livePrompt = 'Review the proposed patch for correctness and regressions. Before performing the review, reply only with the name of the skill suggested by the UserPromptSubmit hook, or MISSING if none was suggested. Do not call tools in this turn.';
    const liveResult = await run('codex', ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check',
      '--sandbox', 'read-only', '--dangerously-bypass-hook-trust', '-c', liveHook, '--json', livePrompt], { cwd, env });
    let trace = null;
    try {
      const files = await readdir(join(state, 'traces'));
      trace = JSON.parse((await readFile(join(state, 'traces', files[0]), 'utf8')).trim().split('\n')[0]);
    } catch {}
    const liveMessages = modelMessages(liveResult.stdout);
    reports.push({ host: 'codex', kind: 'live-jev-wiring', exitCode: liveResult.code,
      decision: trace?.reasonCode ?? null, providerModel: trace?.providerModel ?? null, usage: trace?.usage ?? null,
      hookLatencyMs: trace?.totalLatencyMs ?? null,
      modelReceivedContext: liveMessages.some(text => text.trim() === 'change-review'),
      limitation: 'Verifies a suggested name reaching the model; does not measure skill loading or task completion.' });
    if (!reports.at(-1).modelReceivedContext || trace?.reasonCode !== 'recommended') process.exitCode = 1;
  }
  let claudeAuth = false;
  try { claudeAuth = JSON.parse(spawnSync('claude', ['auth', 'status'], { encoding: 'utf8' }).stdout).loggedIn === true; } catch {}
  reports.push({ host: 'claude-code', version: spawnSync('claude', ['--version'], { encoding: 'utf8' }).stdout.trim(),
    modelReceivedContext: null, status: claudeAuth ? 'authenticated_live_probe_not_implemented' : 'skipped_missing_authentication',
  });
  const report = { timestamp: new Date().toISOString(), platform: process.platform, probes: reports };
  await mkdir('evals/local-results', { recursive: true });
  await writeFile('evals/local-results/host-probes.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!reports[0].hookReceived || !reports[0].modelReceivedContext) process.exitCode = 1;
} finally { await rm(root, { recursive: true, force: true }); }
