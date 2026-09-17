import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadCatalog } from '../packages/cli/src/catalog.ts';

const directories: string[] = [];
async function root() { const dir = await mkdtemp(join(tmpdir(), 'jevra-catalog-')); directories.push(dir); return dir; }
async function skill(dir: string, folder: string, name: string, description = 'Review code changes.') {
  await mkdir(join(dir, folder), { recursive: true });
  await writeFile(join(dir, folder, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\nPrivate instructions not sent to Jev.\n`);
}
afterEach(async () => { await Promise.all(directories.splice(0).map(d => rm(d, { recursive: true, force: true }))); });

test('catalog reads bounded metadata, handles overlapping roots, and detects updates', async () => {
  const dir = await root();
  await skill(dir, 'review', 'change-review');
  const first = await loadCatalog([dir, dir], 10);
  assert.equal(first.skills.length, 1);
  assert.equal(first.diagnostics.length, 0);
  assert.doesNotMatch(JSON.stringify(first), /Private instructions/);
  await skill(dir, 'review', 'change-review', 'Review patches for security and correctness.');
  const next = await loadCatalog([dir], 10);
  assert.equal(first.skills[0]!.id, next.skills[0]!.id);
  assert.notEqual(first.skills[0]!.contentHash, next.skills[0]!.contentHash);
});

test('catalog skips symlinks and never follows a skill outside the configured root', async () => {
  const dir = await root();
  const outside = await root();
  await skill(outside, 'private', 'private-skill');
  await symlink(join(outside, 'private'), join(dir, 'escape'));
  const result = await loadCatalog([dir], 10);
  assert.equal(result.skills.length, 0);
  assert.equal(result.diagnostics[0]!.code, 'symlink_skipped');
});

test('duplicate names and unsafe YAML metadata cannot silently become candidates', async () => {
  const dir = await root();
  await skill(dir, 'a', 'change-review');
  await skill(dir, 'b', 'CHANGE-REVIEW');
  await skill(dir, 'bad', 'invalid/name');
  const result = await loadCatalog([dir], 10);
  assert.equal(result.skills.length, 0);
  assert.ok(result.diagnostics.some(x => x.code === 'duplicate_name'));
  assert.ok(result.diagnostics.some(x => x.code === 'invalid_skill'));
});

test('catalog limit falls back rather than quietly discarding candidates', async () => {
  const dir = await root();
  await skill(dir, 'a', 'first-skill');
  await skill(dir, 'b', 'second-skill');
  await assert.rejects(loadCatalog([dir], 1), /budget_exceeded/);
});

test('catalog does not crawl reference folders inside a discovered skill', async () => {
  const dir = await root();
  await skill(dir, 'a', 'first-skill');
  await skill(join(dir, 'a'), 'references', 'not-a-top-level-skill');
  assert.equal((await loadCatalog([dir], 10)).skills.length, 1);
});
