import { hash } from '@jevra/core';
import { evidenceHash } from '@jevra/core/managed-worker';
import type { ManagedTestRequest } from '@jevra/core/managed-worker';
import { analyzeEconomics, economicConfigSchema } from '../../packages/core/src/economics.ts';

export interface ApplicabilityCase {
  id: string; category: 'related' | 'unrelated' | 'ambiguous' | 'invalid_accounting';
  source: string; task: string; requirements: string[]; family: string | null;
  mutation?: 'negative' | 'unknown' | 'expired' | 'quality' | 'context';
  expectedApplicability: 'yes' | 'no' | 'uncertain';
  expectedDelegate: boolean;
}
const sum = 'export function sum(a: number, b: number): number { return a + b; }\n';
const family = 'Generate a small synchronous test file for a single pure numeric addition function, '
  + 'with one to three explicit literal input/output examples; no repository exploration or production edits.';
const clamp = 'export function bound(x: number, lo: number, hi: number): number { return x < lo ? lo : x > hi ? hi : x; }\n';
const base = { source: sum, task: 'Add a node:test file for sum.ts; keep the source unchanged.',
  requirements: ['Assert sum(2, 3) equals 5.'], family };
export const applicabilityCases: ApplicabilityCase[] = [
  { id: 'literal-addition', category: 'related', ...base, expectedApplicability: 'yes', expectedDelegate: true },
  { id: 'addition-negative-operands', category: 'related', ...base,
    requirements: ['Assert sum(-2, 3) equals 1.', 'Assert sum(0, 0) equals 0.'], expectedApplicability: 'yes', expectedDelegate: true },
  { id: 'renamed-addition', category: 'related', ...base,
    source: sum.replaceAll('sum', 'combine'), task: 'Add combine.test.ts with Node tests for combine.ts.',
    requirements: ['Assert combine(4, 7) equals 11.'], expectedApplicability: 'yes', expectedDelegate: true },
  { id: 'piecewise-range', category: 'related', source: clamp,
    task: 'Add boundary tests for bound.ts without changing its implementation.',
    requirements: ['Assert bound(-1, 0, 10) equals 0.', 'Assert bound(11, 0, 10) equals 10.', 'Assert bound(4, 0, 10) equals 4.'],
    family: 'Generate tests for a pure numeric clamp with two ordered bounds. Cover below, inside and above range using direct literal assertions.',
    expectedApplicability: 'yes', expectedDelegate: true },
  { id: 'currency-table-family', category: 'unrelated', ...base,
    family: 'Generate hundreds of tests for a large currency conversion table with complex rounding rules.',
    expectedApplicability: 'no', expectedDelegate: false },
  { id: 'same-size-different-behavior', category: 'unrelated', ...base,
    source: sum.replace('a + b', 'a * b'), requirements: ['Assert sum(2, 3) equals 6.'],
    expectedApplicability: 'no', expectedDelegate: false },
  { id: 'production-edit-request', category: 'unrelated', ...base,
    task: 'Change sum.ts so the implementation multiplies instead of adding, then add tests.',
    requirements: ['Change production behavior to multiplication.'], expectedApplicability: 'no', expectedDelegate: false },
  { id: 'exploration-request', category: 'unrelated', ...base,
    task: 'Investigate every consumer of sum across the repository and propose a migration before writing tests.',
    requirements: ['Discover all consumers and decide their migration requirements.'], expectedApplicability: 'no', expectedDelegate: false },
  { id: 'ambiguous-family-description', category: 'ambiguous', ...base, family: 'Programming tasks.',
    expectedApplicability: 'uncertain', expectedDelegate: false },
  { id: 'ambiguous-task', category: 'ambiguous', ...base, task: 'Improve this module.',
    requirements: ['Make this better.'], expectedApplicability: 'uncertain', expectedDelegate: false },
  { id: 'missing-family', category: 'invalid_accounting', ...base, family: null,
    expectedApplicability: 'uncertain', expectedDelegate: false },
  { id: 'known-negative-benefit', category: 'invalid_accounting', ...base, mutation: 'negative',
    expectedApplicability: 'yes', expectedDelegate: false },
  { id: 'unknown-worker-usage', category: 'invalid_accounting', ...base, mutation: 'unknown',
    expectedApplicability: 'yes', expectedDelegate: false },
  { id: 'stale-measurements', category: 'invalid_accounting', ...base, mutation: 'expired',
    expectedApplicability: 'yes', expectedDelegate: false },
  { id: 'unequal-quality-checks', category: 'invalid_accounting', ...base, mutation: 'quality',
    expectedApplicability: 'yes', expectedDelegate: false },
  { id: 'incompatible-host-context', category: 'invalid_accounting', ...base, mutation: 'context',
    expectedApplicability: 'yes', expectedDelegate: false },
];

// Fixed counterfactual time and hypothetical component totals: reproducible classifier inputs,
// never real cost evidence or an automatically installable production calibration.
export const COUNTERFACTUAL_TIME = 1800000000000;
export function caseInput(c: ApplicabilityCase) {
  const execution = { host: 'codex', delivery: 'native-ticket', parentModel: 'gpt-6-astra', parentEffort: 'low',
    parentCliVersion: 'synthetic', workerModel: 'gpt-5.6-luna', workerCliVersion: 'synthetic', contextHash: hash('counterfactual-context') };
  const point = (n: number) => ({ low: n, high: n });
  const config = economicConfigSchema.parse({ mode: 'enforce', execution,
    ...(c.family === null ? {} : { calibration: { version: 'economic-route/1', execution,
      metric: 'total_tokens', evidenceHash: hash('hypothetical-only-' + c.id),
      measuredAt: COUNTERFACTUAL_TIME - 1000, expiresAt: COUNTERFACTUAL_TIME + 600000,
      accounting: 'whole_task_including_failures_and_recovery', taskFamily: c.family,
      sourceBytes: { low: 1, high: 10000 }, requirementCount: { low: 1, high: 16 }, equivalentQualityChecks: true,
      pairs: [0, 1, 2].map(i => ({ id: 'hypothetical-' + i, native: { parent: point(1000), worker: point(0), jev: point(0) },
        managed: { parent: point(c.mutation === 'negative' ? 1100 : 300), worker: point(200), jev: point(100) },
        nativeQuality: 'passed', managedQuality: 'passed', helperUsed: true })),
    } }),
  });
  const calibration = config.calibration;
  if (calibration) {
    if (c.mutation === 'unknown') calibration.pairs[0]!.managed.worker = null;
    if (c.mutation === 'expired') calibration.expiresAt = COUNTERFACTUAL_TIME - 1;
    if (c.mutation === 'quality') calibration.equivalentQualityChecks = false;
    if (c.mutation === 'context') calibration.execution.contextHash = hash('other-context');
  }
  const request: ManagedTestRequest = { schemaVersion: 1, operationId: c.id, scopeHash: hash('synthetic-scope'),
    stateRevision: hash(c.source), preference: 'managed', task: c.task, requirements: c.requirements,
    instructions: ['Use synchronous node:test and literal strict assertions; do not change production source.'],
    evidence: [{ id: 'target_source', sourceHash: evidenceHash(c.source), content: c.source }] };
  const economics = analyzeEconomics(config, { host: 'codex', delivery: 'native-ticket' },
    { sourceBytes: Buffer.byteLength(c.source), requirementCount: c.requirements.length }, COUNTERFACTUAL_TIME);
  return { request, economics };
}
