import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { configSchema, initializeConfig, loadConfig, readBoundedFile } from '../packages/cli/src/config.ts';
import { runEvent, readBoundedInput } from '../packages/cli/src/index.ts';
import { appendTrace, clearTraces, makeTrace } from '../packages/cli/src/trace.ts';
import { selectSkill } from '@jevra/core';
import { event, fakeProvider, skills } from './helpers.ts';

const dirs: string[] = [];
async function root() { const dir = await mkdtemp(join(tmpdir(), 'jevra-cli-')); dirs.push(dir); return dir; }
afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });

test('configuration initialization never overwrites existing user settings', async () => {
  const dir = await root();
  const path = join(dir, 'config.json');
  await initializeConfig(path, [dir]);
  assert.equal((await loadConfig(path)).mode, 'observe');
  await assert.rejects(initializeConfig(path, ['/different']), { code: 'EEXIST' });
  assert.deepEqual((await loadConfig(path)).skillRoots, [dir]);
  await writeFile(path, '{"private":"DO_NOT_PRINT"}');
  await assert.rejects(loadConfig(path), /config_invalid/);
});

test('hook input is bounded by bytes', async () => {
  assert.equal(await readBoundedInput(Readable.from(['hello'])), 'hello');
  await assert.rejects(readBoundedInput(Readable.from(['x'.repeat(20)]), 10), /input_invalid/);
});

test('file input is bounded before allocation and init stores only the keychain service name', async () => {
  const dir = await root();
  const path = join(dir, 'config.json');
  await initializeConfig(path, [dir], 'synthetic-service');
  assert.equal((await loadConfig(path)).keychainService, 'synthetic-service');
  await assert.rejects(readBoundedFile(path, 2), /input_invalid/);
  await assert.rejects(readBoundedFile(dir, 65536), /input_invalid/);
});

test('catalog failures return native output and are visible in metadata traces', async () => {
  const dir = await root();
  const config = configSchema.parse({ version: 1, mode: 'advise', skillRoots: [join(dir, 'missing')], stateDirectory: dir });
  const result = await runEvent(event, config, { async evaluate() { throw new Error('unreachable'); } });
  assert.deepEqual(result.output, {});
  assert.equal(result.decision?.reasonCode, 'catalog_unavailable');
  assert.equal(result.decision?.requests, 0);
  const file = join(dir, 'traces', (await readdir(join(dir, 'traces')))[0]!);
  assert.match(await readFile(file, 'utf8'), /"reasonCode":"catalog_unavailable"/);
});

test('provider timeout leaves a trace and no delayed advice', async () => {
  const dir = await root();
  const source = join(dir, 'skills');
  await mkdir(source);
  await writeFile(join(source, 'SKILL.md'), '---\nname: change-review\ndescription: Review code changes.\n---\n');
  const config = configSchema.parse({ version: 1, mode: 'advise', skillRoots: [source], stateDirectory: join(dir, 'state'), timeoutMs: 100 });
  const result = await runEvent(event, config, { evaluate: () => new Promise(() => {}) });
  assert.deepEqual(result.output, {});
  assert.equal(result.decision?.reasonCode, 'timeout');
  assert.equal(result.decision?.requests, 1);
  const file = join(dir, 'state', 'traces', (await readdir(join(dir, 'state', 'traces')))[0]!);
  assert.match(await readFile(file, 'utf8'), /"reasonCode":"timeout"/);
});

test('metadata-only traces exclude prompts, local paths, and raw judgments', async () => {
  const dir = await root();
  const decision = await selectSkill({ event, skills, mode: 'observe', provider: fakeProvider() });
  const trace = makeTrace(event, decision, 'observe', 2, false, 20, {});
  await appendTrace(dir, trace, 7);
  const file = join(dir, 'traces', (await readdir(join(dir, 'traces')))[0]!);
  const text = await readFile(file, 'utf8');
  assert.doesNotMatch(text, /Inspect this patch|synthetic-session|\/synthetic|probabilities/);
  assert.match(text, /"adherence":"unknown"/);
  await writeFile(join(dir, 'traces', 'unrelated.txt'), 'keep');
  assert.equal(await clearTraces(dir), 1);
  assert.equal(await readFile(join(dir, 'traces', 'unrelated.txt'), 'utf8'), 'keep');
});

test('trace files reject symlink redirection', async () => {
  const dir = await root();
  const outside = join(dir, 'outside');
  await writeFile(outside, 'unchanged');
  await mkdir(join(dir, 'traces'));
  await symlink(outside, join(dir, 'traces', new Date().toISOString().slice(0, 10) + '.jsonl'));
  const decision = await selectSkill({ event, skills, mode: 'observe', provider: fakeProvider() });
  await assert.rejects(appendTrace(dir, makeTrace(event, decision, 'observe', 2, false, 10, {}), 7));
  assert.equal(await readFile(outside, 'utf8'), 'unchanged');
});

test('full runtime reads catalog, evaluates, checks freshness, and emits bounded advice', async () => {
  const dir = await root();
  const source = join(dir, 'skills', 'review');
  await mkdir(source, { recursive: true });
  await writeFile(join(source, 'SKILL.md'), '---\nname: change-review\ndescription: Review code changes.\n---\nInstructions\n');
  const config = configSchema.parse({ version: 1, mode: 'advise', skillRoots: [join(dir, 'skills')], stateDirectory: join(dir, 'state') });
  const result = await runEvent(event, config, fakeProvider());
  assert.equal(result.decision?.reasonCode, 'recommended');
  assert.match(JSON.stringify(result.output), /change-review/);
  const observed = await runEvent(event, { ...config, mode: 'observe' }, fakeProvider());
  assert.deepEqual(observed.output, {});
  assert.equal((await readdir(join(dir, 'state', 'traces'))).length, 1);
});

test('disabled runtime does not inspect files or call a provider', async () => {
  const config = configSchema.parse({ version: 1, mode: 'disabled', skillRoots: ['/does-not-exist'] });
  const result = await runEvent(event, config, { async evaluate() { throw new Error('unreachable'); } });
  assert.deepEqual(result.output, {});
  assert.equal(result.catalog, null);
});
