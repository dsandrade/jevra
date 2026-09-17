import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, realpath, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chunkDocument, contextQuestions, rankLexically, renderContext, selectContext } from '@jevra/core/context';
import { MODEL } from '@jevra/core';
import type { Provider } from '@jevra/core';
import { configSchema, contextConfigSchema } from '../packages/cli/src/config.ts';
import { loadPassages, runContext } from '../packages/cli/src/context.ts';
import { event } from './helpers.ts';

const source = '# Cache\nCache entries expire after 10 seconds.\n\n# Retry\nRetry network failures at most four times.\n';
const passages = chunkDocument('docs/policy.md', source);
const provider: Provider = { async evaluate(request) {
  return { model: request.model, usage: { input_tokens: 100, output_tokens: 20 },
    answers: Object.fromEntries(Object.entries(request.questions).map(([key, q]) => {
      if (q.type !== 'score') throw new Error('unexpected');
      const selected = key === passages[1]!.id ? 3 : 0;
      return [key, { type: 'score', score: selected, confidence: 1,
        legend: Object.fromEntries(q.criteria.map((text, i) => [String(i), text])),
        probabilities: Object.fromEntries(q.criteria.map((_, i) => [String(i), Number(i === selected)])) }];
    })) };
} };
const options = { query: 'Fix retry handling', passages, backend: 'jev' as const, provider, model: MODEL,
  topK: 2, shortlist: 24, maxOutputBytes: 1000, maxRequestBytes: 65536, minScore: 1.5, timeoutMs: 1000 };

test('context chunks retain exact source text and reconstruct line ranges', () => {
  assert.equal(passages.map(p => p.text).join(''), source);
  assert.equal(passages[1]?.startLine, 4);
  assert.equal(passages[1]?.endLine, 5);
  assert.throws(() => chunkDocument('a', 'x'.repeat(500), 256), /budget_exceeded/);
  assert.equal(rankLexically('retry', passages)[0]?.passage.id, passages[1]?.id);
});

test('semantic selection keeps source evidence and excludes local paths from provider state', async () => {
  const request = contextQuestions('retry', passages, MODEL);
  assert.doesNotMatch(JSON.stringify(request), /docs\/policy/);
  const result = await selectContext(options);
  assert.deepEqual(result.selected, [passages[1]]);
  assert.match(renderContext(result), /"startLine":4/);
  assert.equal(result.usage?.input_tokens, 100);
});

test('context budgets, cancellation, and invalid results fall back without excerpts', async () => {
  for (const patch of [
    { maxRequestBytes: 1 },
    { provider: { evaluate: async () => ({}) } },
    { provider: { evaluate: () => new Promise(() => {}) }, timeoutMs: 10 },
    { signal: AbortSignal.abort() },
  ]) {
    const result = await selectContext({ ...options, ...patch });
    assert.deepEqual(result.selected, []);
    assert.equal(renderContext(result), '');
  }
  const deterministic = await selectContext({ ...options, backend: 'deterministic',
    provider: { async evaluate() { throw new Error('must not call'); } } });
  assert.equal(deterministic.evaluationAttempts, 0);
  assert.equal(deterministic.selected[0]?.id, passages[1]?.id);
});

test('configured context sources reject symlinks and oversized corpora', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'jevra-context-')));
  try {
    const file = join(dir, 'policy.md');
    await writeFile(file, source);
    const config = contextConfigSchema.parse({ sources: [file] });
    assert.equal((await loadPassages(config, dir)).length, 2);
    await symlink(file, join(dir, 'redirect.md'));
    await assert.rejects(loadPassages({ ...config, sources: [join(dir, 'redirect.md')] }, dir), /catalog_unavailable/);
    await assert.rejects(loadPassages({ ...config, maxTotalBytes: 1 }, dir), /budget_exceeded/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('observe context stays invisible, traces omit source bodies, stale content suppresses advice', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'jevra-context-')));
  try {
    const file = join(dir, 'policy.md');
    await writeFile(file, source);
    await mkdir(join(dir, 'skills'));
    const config = configSchema.parse({ version: 1, skillRoots: [join(dir, 'skills')], stateDirectory: join(dir, 'state'),
      context: { sources: [file], backend: 'deterministic' } });
    assert.equal((await runContext({ ...event, cwd: dir }, config, provider)).text, '');
    const trace = await readFile(join(dir, 'state/traces', (await readdir(join(dir, 'state/traces')))[0]!), 'utf8');
    assert.doesNotMatch(trace, /network failures|policy\.md|synthetic-session/);
    const stale = await runContext({ ...event, cwd: dir }, { ...config, mode: 'advise', context: { ...config.context!, backend: 'jev' } }, {
      async evaluate(request) {
        await writeFile(file, source + 'Changed source.\n');
        const questions = Object.entries(request.questions);
        return { model: MODEL, usage: { input_tokens: 200, output_tokens: 40 }, answers: Object.fromEntries(questions.map(([id, q]) => {
          if (q.type !== 'score') throw new Error('unexpected');
          return [id, { type: 'score', score: 3, confidence: 1, probabilities: { '0': 0, '1': 0, '2': 0, '3': 1 },
            legend: Object.fromEntries(q.criteria.map((s, i) => [String(i), s])) }];
        })) };
      },
    });
    assert.equal(stale.text, '');
    assert.equal(stale.result?.reason, 'stale_state');
    assert.equal(stale.result?.usage?.input_tokens, 200);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
