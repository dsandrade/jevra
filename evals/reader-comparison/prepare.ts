import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { hash } from '@jevra/core';
import { schedule, tasks, taskPrompt } from './fixtures.ts';
export const manifestFiles = ['evals/reader-comparison/protocol.md', 'evals/reader-comparison/fixtures.ts',
  'evals/reader-comparison/judge.ts', 'evals/reader-comparison/server.ts', 'evals/reader-comparison/run.ts',
  'evals/reader-comparison/accounting.ts', 'evals/reader-comparison/prepare.ts', 'packages/core/src/reader.ts', 'packages/core/src/accounting.ts',
  'packages/core/src/context.ts', 'packages/core/src/index.ts', 'packages/core/src/worker.ts',
  'packages/cli/src/reader-session.ts', 'packages/cli/src/bulk-read.ts', 'packages/cli/src/config.ts',
  'packages/cli/src/codex-worker.ts', 'packages/cli/src/worker-process.ts', 'packages/cli/src/test-policy.ts',
  'packages/provider-typesafe/src/index.ts', 'package-lock.json'];
export async function makeManifest() {
  return { version: 'reader-comparison/1', status: 'exploratory_ready_not_promoted', executable: true,
    preparedAt: new Date().toISOString(), hashes: Object.fromEntries(await Promise.all(manifestFiles.map(async f => [f, hash(await readFile(f, 'utf8'))]))),
    cells: schedule(), tasks: tasks.map(t => ({ id: t.id, kind: t.kind,
      sourceBytes: Object.values(t.files).reduce((n, s) => n + Buffer.byteLength(s), 0),
      sourcesHash: hash(t.files), requirementsHash: hash([t.facts, t.examples]), promptHash: hash(taskPrompt(t)) })),
    cachePolicy: 'fresh_cli_sessions_existing_provider_caches_reported_not_claimed_cold',
    labelSource: 'authored_synthetic_oracle_not_independent_review', promotion: 'not_authorized', actualBilledUsd: null, subscriptionUsage: null };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const { values } = parseArgs({ options: { output: { type: 'string', default: `evals/local-results/reader-plan-${Date.now()}` } } });
  const output = resolve(values.output!); await mkdir(output, { recursive: true, mode: 0o700 });
  const manifest = await makeManifest();
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ output, cells: manifest.cells.length, executable: true, promotion: manifest.promotion }));
}
