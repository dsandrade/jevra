import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DecisionError, hash, MODEL, validateResult, withDeadline } from '@jevra/core';
import type { Json, ProviderRequest } from '@jevra/core';
import { createTypeSafeProvider } from '@jevra/provider-typesafe';
import { analyzeEconomics, economicConfigSchema, economicQuestion } from '../../packages/core/src/economics.ts';
import { configSchema, readApiKey } from '../../packages/cli/src/config.ts';
import { routeEvidenceQuestions, evidenceHash } from '../../packages/core/src/managed-worker.ts';

// Four declared synthetic counterfactuals, one first-stage request each. No worker or parent invocation.
// Values are classifier fixtures, never observations to install as an economic calibration.
const { values } = parseArgs({ options: { 'keychain-service': { type: 'string' },
  output: { type: 'string', default: `evals/local-results/economic-probe-${Date.now()}.json` } } });
if (!values['keychain-service']) throw new Error('Specify the configured Keychain service name.');
const auth = configSchema.parse({ version: 1, skillRoots: [resolve('evals/fixtures/skills')],
  keychainService: values['keychain-service'], traces: false });
const provider = createTypeSafeProvider({ getApiKey: () => readApiKey(auth) });
const shutdown = new AbortController();
for (const s of ['SIGINT', 'SIGTERM'] as const) process.once(s, () => shutdown.abort());
const source = 'export function sum(a: number, b: number): number { return a + b; }';
const request = { schemaVersion: 1 as const, operationId: 'economic-diagnostic', scopeHash: hash('fixture'),
  stateRevision: hash(source), preference: 'managed' as const, task: 'Add a test file for the sum function.',
  instructions: ['Use node:test and strict assertions.'], requirements: ['Assert sum(2, 3) equals 5.'],
  evidence: [{ id: 'target_source', content: source, sourceHash: evidenceHash(source) }] };
const execution = { host: 'codex', delivery: 'native-ticket', parentModel: 'gpt-6-astra', parentEffort: 'low',
  parentCliVersion: 'synthetic', workerModel: 'gpt-5.6-luna', workerCliVersion: 'synthetic', contextHash: hash('synthetic') };
const point = (n: number) => ({ low: n, high: n });
const results: unknown[] = [];
for (const name of ['missing', 'negative', 'positive', 'unrelated'] as const) {
  const config = economicConfigSchema.parse({ mode: 'enforce', execution,
    ...(name === 'missing' ? {} : { calibration: { version: 'economic-route/1', execution,
      metric: 'total_tokens', evidenceHash: hash('synthetic-only-' + name),
      accounting: 'whole_task_including_failures_and_recovery', measuredAt: 1, expiresAt: Date.now() + 600000,
      taskFamily: name === 'unrelated' ? 'Generate hundreds of tests for a large currency conversion table with complex rounding rules.'
        : 'Generate a small test file for a single pure numeric addition function, with one to three explicit arithmetic examples.',
      sourceBytes: { low: 1, high: 10000 }, requirementCount: { low: 1, high: 16 }, equivalentQualityChecks: true,
      pairs: [0, 1, 2].map(i => ({ id: 'synthetic-' + i,
        native: { parent: point(1000), worker: point(0), jev: point(0) },
        managed: { parent: point(name === 'negative' ? 1100 : 300), worker: point(200), jev: point(100) },
        nativeQuality: 'passed', managedQuality: 'passed', helperUsed: true })),
    } }),
  });
  const economics = analyzeEconomics(config, { host: 'codex', delivery: 'native-ticket' },
    { sourceBytes: Buffer.byteLength(source), requirementCount: 1 });
  const query: ProviderRequest = { model: MODEL, state: { task: request.task, instructions: request.instructions,
    requirements: request.requirements, evidence: request.evidence, economics: economics as unknown as Json },
    questions: { ...routeEvidenceQuestions(request), economic_route: economicQuestion(economics) } };
  try {
    const response = validateResult(await withDeadline(s => provider.evaluate(query, s), 10000, shutdown.signal), query);
    const economic = response.answers.economic_route;
    const expected = name === 'positive' ? ['delegate'] : name === 'negative' ? ['native'] : name === 'missing' ? ['insufficient'] : ['native', 'insufficient'];
    results.push({ name, requestHash: hash(query), questionSetHash: hash(query.questions),
      observedModel: response.model, answers: { route: response.answers.route, economic_route: economic },
      expected, matchesExpected: economic?.type === 'choice' && expected.includes(economic.choice),
      decisionMeetsThreshold: economic?.type === 'choice' && economic.confidence >= 0.7 && (economic.probabilities[economic.choice] ?? 0) >= 0.8,
      usage: response.usage ?? null, failure: null });
  } catch (error) {
    results.push({ name, failure: error instanceof DecisionError ? error.code : 'provider_error' });
    break; // No retry, fallback or further spend after a provider failure.
  }
}
const report = { kind: 'synthetic-economic-question-diagnostic', timestamp: new Date().toISOString(),
  implementationHash: hash(await readFile(new URL('../../packages/core/src/economics.ts', import.meta.url), 'utf8')),
  results, parentInvocations: 0, workerInvocations: 0, actualBilledUsd: null,
  limitation: 'Hypothetical classifier inputs, not measured savings, calibrated accuracy or production economic evidence.' };
const output = resolve(values.output!); await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
