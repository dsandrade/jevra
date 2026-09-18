import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const [mode, record, ...args] = process.argv.slice(2);
appendFileSync(record, JSON.stringify({ args, cwd: process.cwd(), envKeys: Object.keys(process.env) }) + '\n');
if (args[0] === '--version') {
  console.log(mode === 'old-version' ? 'codex-cli 0.1.0' : 'codex-cli 0.154.0-alpha.6.2');
  process.exit(0);
}
if (args[0] === 'login') {
  console.error(mode === 'api-auth' ? 'Logged in using an API key' : 'Logged in using ChatGPT');
  process.exit(0);
}
const packet = readFileSync(0, 'utf8');
writeFileSync(record + '.packet', packet);
const emit = e => process.stdout.write(JSON.stringify(e) + '\n');
if (mode === 'stderr-limit') { process.stderr.write('s'.repeat(5000)); process.exit(1); }
if (mode === 'stdout-limit') { process.stdout.write('x'.repeat(5000)); process.exit(1); }
if (mode === 'invalid-json') { process.stdout.write('PRIVATE_MALFORMED_STREAM\n'); process.exit(0); }
emit({ type: 'thread.started', thread_id: 'private-thread-id' });
emit({ type: 'turn.started' });
if (mode === 'hang' || mode === 'descendant') {
  const code = `require('fs').writeFileSync(process.argv[1], String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);`;
  spawn(process.execPath, ['-e', code, record + '.child'], { stdio: 'ignore' });
  process.on('SIGTERM', () => {});
  if (mode === 'descendant') { setTimeout(() => process.exit(0), 100); }
  else setInterval(() => {}, 1000);
} else if (mode === 'rate-limited') {
  emit({ type: 'turn.failed', error: { message: 'Usage limit reached PRIVATE_ERROR_TEXT' } });
  process.exitCode = 1;
} else if (mode === 'tool') {
  emit({ type: 'item.started', item: { type: 'command_execution', command: 'PRIVATE_TOOL_TEXT' } });
  setInterval(() => {}, 1000);
} else if (mode === 'different-model') {
  emit({ type: 'item.completed', model: 'other-model', item: { type: 'agent_message', text: '{}' } });
} else {
  const passage = mode === 'reader' ? JSON.parse(JSON.parse(packet).evidence[0].content)[0] : null;
  const content = passage ? JSON.stringify({ status: 'answered', claims: [{ text: 'Retries reject nonintegers.',
    citations: [{ id: passage.id, quote: passage.text.trim() }] }], gaps: [] })
    : mode === 'large-artifact' ? 'x'.repeat(500) : 'export const café = 42;\n';
  const final = mode === 'invalid-artifact' ? '{"unexpected":"PRIVATE_CONTENT"}' : JSON.stringify({ content });
  const msg = JSON.stringify({ type: 'item.completed', item: { id: 'answer', type: 'agent_message', text: final } }) + '\n';
  if (mode === 'split-utf8') {
    const bytes = Buffer.from(msg), i = bytes.indexOf(Buffer.from('é')) + 1;
    process.stdout.write(bytes.subarray(0, i));
    await new Promise(resolve => setTimeout(resolve, 10));
    process.stdout.write(bytes.subarray(i));
  } else process.stdout.write(msg);
  if (mode !== 'truncated') {
    const usage = mode === 'unknown-usage' ? undefined : mode === 'invalid-usage'
      ? { input_tokens: 1, cached_input_tokens: 2, output_tokens: -1 }
      : { input_tokens: 125, cached_input_tokens: 25, output_tokens: 12 };
    const end = JSON.stringify({ type: 'turn.completed', usage });
    process.stdout.write(end + (mode === 'split-utf8' ? '' : '\n'));
    if (mode === 'extra-turn') emit({ type: 'turn.started' });
  }
  if (mode === 'exit-failure') { process.stderr.write('PRIVATE_FAILURE'); process.exitCode = 17; }
}
