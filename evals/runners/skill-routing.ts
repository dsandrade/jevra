import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { hasExplicitReference, hash, MODEL, POLICY_VERSION, QUESTION_VERSION, selectSkill } from '@jevra/core';
import { createTypeSafeProvider } from '@jevra/provider-typesafe';
import { loadCatalog } from '../../packages/cli/src/catalog.ts';
import { configSchema, readApiKey } from '../../packages/cli/src/config.ts';

const { values } = parseArgs({ options: {
  backend: { type: 'string', default: 'deterministic' },
  'keychain-service': { type: 'string' }, limit: { type: 'string' }, output: { type: 'string' },
} });
if (!['deterministic', 'jev'].includes(values.backend!)) throw new Error('Unsupported evaluation backend.');
const config = configSchema.parse({ version: 1, mode: 'observe',
  skillRoots: [resolve('evals/fixtures/skills')], keychainService: values['keychain-service'], traces: false,
});
const catalog = await loadCatalog(config.skillRoots, config.maxSkills);
if (catalog.diagnostics.length) throw new Error('Evaluation catalog is invalid.');
const datasetSchema = z.object({ cases: z.array(z.object({
  id: z.string(), split: z.enum(['development', 'holdout']), prompt: z.string(), expectedSkill: z.string().nullable(),
  expectedBehavior: z.enum(['recommend', 'abstain', 'fallback']), category: z.string(),
})) });
const dataset = datasetSchema.parse(JSON.parse(await readFile('evals/datasets/skill-routing.json', 'utf8')));
const limit = values.limit === undefined ? dataset.cases.length : Number(values.limit);
if (!Number.isInteger(limit) || limit < 1 || limit > dataset.cases.length) throw new Error('Invalid case limit.');
const provider = createTypeSafeProvider({ getApiKey: () => readApiKey(config) });
const patterns: [string, RegExp][] = [
  ['change-review', /\b(review|inspect|audit)\b.*\b(diff|patch|pull request|changes)\b/i],
  ['unit-test-author', /\b(write|add|create|extend)\b.*\b(unit tests?|test cases?|tests)\b/i],
  ['bug-diagnosis', /\b(crash|crashing|debug|failing|failure|stack trace|500 error)\b/i],
  ['api-doc-author', /\b(document|documentation|openapi)\b.*\b(endpoint|api|route|request|response)\b/i],
  ['schema-migration', /\b(migration|migrate|rollback|sql|schema)\b/i],
  ['repository-onboarding', /\b(onboard|onboarding|repository structure|codebase layout|new contributor)\b/i],
];
const rows = [];
for (const item of dataset.cases.slice(0, limit)) {
  const started = performance.now();
  let prediction: string | null = null;
  let behavior = 'abstain';
  let reason = 'no_match';
  let usage: { input_tokens: number; output_tokens: number } | null = null;
  let evaluationAttempts = 0;
  if (values.backend === 'jev') {
    const result = await selectSkill({ event: { host: 'codex', sessionId: 'component-evaluation', eventId: item.id,
      turnId: item.id, prompt: item.prompt, cwd: process.cwd() }, skills: catalog.skills, mode: 'observe',
      provider, model: config.model, policy: config.policy, timeoutMs: config.timeoutMs });
    prediction = catalog.skills.find(s => s.id === result.selectedCandidateId)?.name ?? null;
    behavior = result.disposition;
    reason = result.reasonCode;
    usage = result.usage;
    evaluationAttempts = result.requests;
  } else if (hasExplicitReference(item.prompt, catalog.skills)) {
    behavior = 'fallback';
    reason = 'explicit_skill_reference';
  } else {
    const matches = patterns.filter(([, pattern]) => pattern.test(item.prompt));
    prediction = matches.length === 1 ? matches[0]![0] : null;
    behavior = prediction ? 'recommend' : 'abstain';
    reason = matches.length > 1 ? 'multiple_skills' : prediction ? 'recommended' : 'no_match';
  }
  const correct = item.expectedSkill === prediction && item.expectedBehavior === behavior;
  rows.push({ id: item.id, split: item.split, category: item.category, expectedSkill: item.expectedSkill,
    expectedBehavior: item.expectedBehavior, predictedSkill: prediction, behavior, reason, correct,
    latencyMs: Math.round(performance.now() - started), usage, evaluationAttempts });
  if (values.backend === 'jev') process.stderr.write(`Evaluated ${rows.length}/${limit}: ${item.id} (${reason})\n`);
}
const times = rows.map(r => r.latencyMs).sort((a, b) => a - b);
const attempts = rows.reduce((sum, r) => sum + r.evaluationAttempts, 0);
const callsWithKnownUsage = rows.filter(r => r.usage !== null).length;
const observedInputTokens = rows.reduce((sum, r) => sum + (r.usage?.input_tokens ?? 0), 0);
const observedOutputTokens = rows.reduce((sum, r) => sum + (r.usage?.output_tokens ?? 0), 0);
const report = {
  kind: 'component-smoke-evaluation', timestamp: new Date().toISOString(), backend: values.backend,
  providerModel: values.backend === 'jev' ? MODEL : null, questionVersion: QUESTION_VERSION, policyVersion: POLICY_VERSION,
  datasetHash: hash(dataset), catalogHash: hash(catalog.skills.map(({ name, description, contentHash }) => ({ name, description, contentHash })).sort((a, b) => a.name.localeCompare(b.name))),
  policy: config.policy, runtime: process.version, cache: 'disabled', repetitions: 1,
  limitations: ['Synthetic author-labeled cases; not independently reviewed.',
    'Component routing only: no host LLM task execution, task success, or total-system savings measured.',
    'Single run with provisional thresholds; no calibration or promotion decision.'],
  summary: { cases: rows.length, correct: rows.filter(r => r.correct).length,
    development: { cases: rows.filter(r => r.split === 'development').length, correct: rows.filter(r => r.split === 'development' && r.correct).length },
    holdout: { cases: rows.filter(r => r.split === 'holdout').length, correct: rows.filter(r => r.split === 'holdout' && r.correct).length },
    fallbacks: rows.filter(r => r.behavior === 'fallback').length,
    p50Ms: times[Math.floor((times.length - 1) * 0.5)], p95Ms: times[Math.floor((times.length - 1) * 0.95)],
    inputTokens: callsWithKnownUsage === attempts ? observedInputTokens : null,
    outputTokens: callsWithKnownUsage === attempts ? observedOutputTokens : null,
    observedInputTokens, observedOutputTokens, evaluationAttempts: attempts, callsWithKnownUsage,
    actualCost: null, hostLlmUsage: null,
  }, rows,
};
const output = resolve(values.output ?? `evals/local-results/${values.backend}.json`);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ report: output, ...report.summary }, null, 2));
