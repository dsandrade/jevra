import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { hash } from '@jevra/core';
import { validatePureModule } from '../../packages/cli/src/test-policy.ts';
import { runWorkerProcess } from '../../packages/cli/src/worker-process.ts';
import { readBoundedFile } from '../../packages/cli/src/config.ts';
import type { ReaderTask } from './fixtures.ts';
/** Authored oracle: exact required facts/citations and closed pure-function behavior. No model success claims. */
export async function judge(t: ReaderTask, cwd: string, checkDirectory: string) {
  let facts = false, scope = false, grammar = false, functional: boolean | null = null, failure: string | null = null;
  try {
    const answer = z.object({ status: z.enum(['resolved', 'missing']), facts: z.record(z.string(), z.object({
      value: z.union([z.number(), z.boolean()]).nullable(), path: z.string().max(4096).nullable(),
      quote: z.string().min(1).max(2048).nullable() }).strict()) }).strict().parse(JSON.parse(await readBoundedFile(join(cwd, 'answer.json'), 16384)));
    facts = answer.status === (t.kind === 'no_answer' ? 'missing' : 'resolved')
      && hash(Object.keys(answer.facts).sort()) === hash(Object.keys(t.facts).sort())
      && Object.entries(t.facts).every(([key, expected]) => {
        const actual = answer.facts[key]!;
        return actual.value === expected.value && actual.path === expected.path
          && (expected.quote === null ? actual.quote === null : actual.quote !== null
            && actual.quote.includes(expected.quote) && t.files[expected.path!]!.includes(actual.quote));
      });
    scope = (await Promise.all(Object.entries(t.files).filter(([p]) => p !== t.target).map(async ([p, text]) =>
      await readFile(join(cwd, p), 'utf8') === text))).every(Boolean);
    const source = await readBoundedFile(join(cwd, t.target), 4096);
    if (Buffer.byteLength(source) > 4096) throw new Error('source_limit');
    if (t.kind === 'no_answer' && source !== t.files[t.target]) scope = false;
    validatePureModule(source, t.exportName); grammar = true;
    await mkdir(checkDirectory, { recursive: true, mode: 0o700 });
    const execution = await realpath(checkDirectory);
    await writeFile(join(execution, 'target.ts'), source, { mode: 0o600 });
    await writeFile(join(execution, 'package.json'), '{"type":"module"}');
    const checks = `import assert from 'node:assert/strict';\nimport { ${t.exportName} as target } from './target.ts';\n`
      + t.examples.map(e => `assert.equal(target(${e.args.map(a => JSON.stringify(a)).join(',')}), ${JSON.stringify(e.expected)});`).join('\n');
    await writeFile(join(execution, 'check.mjs'), checks, { mode: 0o600 });
    const r = await runWorkerProcess({ executable: process.execPath, args: ['--permission', '--allow-fs-read=' + execution, 'check.mjs'],
      cwd: execution, env: { PATH: process.env.PATH }, timeoutMs: 5000, killGraceMs: 100, maxOutputBytes: 8192, maxStderrBytes: 8192 });
    functional = r.exitCode === 0 && r.cleanupComplete && !r.failure;
    if (!functional) failure = r.failure ?? 'behavior_failed';
  } catch { failure ??= grammar ? 'judge_unavailable' : 'invalid_answer_or_grammar'; }
  return { passed: facts && scope && grammar && functional === true, facts, scope, grammar, functional, failure,
    labelSource: 'authored_synthetic_oracle_not_independent_review' };
}
