import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DecisionError, hash, withDeadline } from '@jevra/core';
import { createTypeSafeProvider } from '@jevra/provider-typesafe';
import { configSchema, readApiKey } from '../../packages/cli/src/config.ts';
import { applicabilityCases } from '../economic-applicability/cases.ts';
import { z } from 'zod';
import { queryFor, scoreCase, summarizeCases } from './evaluate.ts';
import type { ScoredCase, FailedCase } from './evaluate.ts';

const { values } = parseArgs({ options: { 'keychain-service': { type: 'string' },
  output: { type: 'string', default: `evals/local-results/economic-applicability-v2-${Date.now()}` } } });
if (!values['keychain-service']) throw new Error('Specify a configured Keychain service name.');
const output = resolve(values.output!); await mkdir(output, { recursive: true, mode: 0o700 });
const files = ['evals/economic-applicability-v2/protocol.md', 'evals/economic-applicability/cases.ts',
  'evals/economic-applicability-v2/evaluate.ts', 'evals/economic-applicability-v2/run.ts',
  'packages/core/src/economics.ts', 'packages/core/src/managed-worker.ts', 'packages/core/src/index.ts',
  'packages/provider-typesafe/src/index.ts', 'packages/cli/src/config.ts', 'package-lock.json'];
const manifest = { timestamp: new Date().toISOString(), hashes: Object.fromEntries(await Promise.all(files.map(async p =>
  [p, hash(await readFile(p, 'utf8'))]))), cases: applicabilityCases.map(c => c.id), expectedCalls: applicabilityCases.filter(c => queryFor(c)).length };
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const config = configSchema.parse({ version: 1, skillRoots: [resolve('evals/fixtures/skills')],
  keychainService: values['keychain-service'], traces: false });
const provider = createTypeSafeProvider({ getApiKey: () => readApiKey(config) });
const shutdown = new AbortController();
for (const s of ['SIGINT', 'SIGTERM'] as const) process.once(s, () => shutdown.abort());
const rows: (ScoredCase | FailedCase)[] = [];
let knownInput = 0, stopReason: string | null = null;
const started = performance.now();
const save = () => writeFile(join(output, 'results.json'), JSON.stringify({ manifest, rows, stopReason,
  summary: summarizeCases(rows, applicabilityCases), parentInvocations: 0, workerInvocations: 0,
  actualBilledUsd: null, subscriptionUsage: null }, null, 2) + '\n', { mode: 0o600 });
await save();
for (const c of applicabilityCases) {
  if (shutdown.signal.aborted || performance.now() - started >= 120000 || knownInput >= 32000) {
    stopReason = shutdown.signal.aborted ? 'cancelled' : 'budget_exceeded'; break;
  }
  const query = queryFor(c);
  if (!query) {
    rows.push(scoreCase(c, null)); await save(); continue;
  }
  if (Buffer.byteLength(JSON.stringify(query)) > 49152) { stopReason = 'request_budget_exceeded'; break; }
  const callFile = join(output, c.id + '.json');
  await writeFile(callFile, JSON.stringify({ id: c.id, status: 'started', requestHash: hash(query), usage: null }), { flag: 'wx', mode: 0o600 });
  let observedUsage: FailedCase['usage'] = null;
  try {
    const raw = await withDeadline(s => provider.evaluate(query, s), Math.min(10000, 120000 - (performance.now() - started)), shutdown.signal);
    const usage = z.object({ input_tokens: z.number().int().nonnegative().safe(), output_tokens: z.number().int().nonnegative().safe() }).safeParse((raw as { usage?: unknown } | null)?.usage);
    if (usage.success) observedUsage = usage.data;
    const row = scoreCase(c, raw); rows.push(row); knownInput += row.usage.input_tokens;
    await writeFile(callFile, JSON.stringify({ ...row, status: 'completed' }), { mode: 0o600 });
  } catch (error) {
    const row: FailedCase = { id: c.id, failure: error instanceof DecisionError ? error.code : 'provider_error', usage: observedUsage };
    rows.push(row); stopReason = row.failure;
    await writeFile(callFile, JSON.stringify({ ...row, status: 'failed' }), { mode: 0o600 });
  }
  await save();
  if (stopReason) break;
}
await save();
console.log(JSON.stringify({ output, stopReason, summary: summarizeCases(rows, applicabilityCases) }, null, 2));
