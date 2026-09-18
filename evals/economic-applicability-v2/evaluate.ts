import { MODEL, hash, validateResult } from '@jevra/core';
import type { Answer, Json, ProviderRequest } from '@jevra/core';
import { economicMembershipQuestion, economicMembershipDecision, ECONOMIC_QUESTION_VERSION } from '../../packages/core/src/economics.ts';
import { managedWorkerLimitsSchema, routeEvidenceQuestions } from '@jevra/core/managed-worker';
import { caseInput } from '../economic-applicability/cases.ts';
import type { ApplicabilityCase } from '../economic-applicability/cases.ts';

export const EVALUATOR_VERSION = 'economic-applicability/2';
export const gates = managedWorkerLimitsSchema.parse({});
export function queryFor(c: ApplicabilityCase): ProviderRequest | null {
  const { request, economics } = caseInput(c);
  if (!economics.admissible) return null;
  return { model: MODEL, state: { task: request.task, requirements: request.requirements,
    instructions: request.instructions, evidence: request.evidence,
    ...(economics.admissible ? { taskFamily: economics.taskFamily as Json } : {}) },
    questions: { ...routeEvidenceQuestions(request),
      ...(economics.admissible ? { economic_route: economicMembershipQuestion() } : {}) } };
}
const ready = (a: Answer | undefined) => a?.type === 'choice' && a.confidence >= gates.minConfidence
  && (a.probabilities[a.choice] ?? 0) >= gates.minChoiceProbability;
export function scoreCase(c: ApplicabilityCase, raw: unknown) {
  const query = queryFor(c), { economics } = caseInput(c);
  if (!query && raw !== null) throw new Error('unexpected_provider_response_for_policy_handoff');
  const response = query ? validateResult(raw, query) : { answers: {} as Record<string, Answer>, model: null,
    usage: { input_tokens: 0, output_tokens: 0 } };
  const capable = ready(response.answers.route) && response.answers.route?.type === 'choice' && response.answers.route.choice === 'tests';
  const relevant = Object.entries(response.answers).some(([id, a]) => id.startsWith('evidence_')
    && a.type === 'score' && a.score >= gates.minEvidenceScore && a.confidence >= gates.minConfidence);
  const judgment = economicMembershipDecision(economics, response.answers.economic_route, gates.minSupportProbability);
  const a = response.answers.economic_route;
  const membership = a?.type === 'noul' ? a.noul >= gates.minSupportProbability ? 'yes'
    : a.noul <= 1 - gates.minSupportProbability ? 'no' : 'uncertain' : 'not_requested';
  return { version: EVALUATOR_VERSION, questionVersion: ECONOMIC_QUESTION_VERSION, id: c.id,
    invocations: query ? 1 : 0, requestHash: hash(query), questionSetHash: hash(query?.questions ?? {}), gatesHash: hash(gates),
    admissible: economics.admissible, issues: economics.issues, expectedDelegate: c.expectedDelegate,
    expectedApplicability: c.expectedApplicability, observedApplicability: membership, judgment,
    capable, relevant, economicDelegate: judgment === 'delegate',
    initialRouteDelegate: capable && relevant && judgment === 'delegate',
    // Full typed answers, including every Score probability, fractional value and legend.
    answers: response.answers, observedModel: response.model, usage: response.usage, failure: null };
}
export type ScoredCase = ReturnType<typeof scoreCase>;
export interface FailedCase { id: string; failure: string; usage: { input_tokens: number; output_tokens: number } | null }
export function summarizeCases(rows: (ScoredCase | FailedCase)[], expected: ApplicabilityCase[]) {
  const ids = new Set<string>();
  if (new Set(expected.map(c => c.id)).size !== expected.length) throw new Error('duplicate_expected_case');
  for (const row of rows) {
    const c = expected.find(c => c.id === row.id);
    if (!c || ids.has(row.id)) throw new Error('duplicate_or_unexpected_result'); ids.add(row.id);
    if ('initialRouteDelegate' in row && (row.expectedDelegate !== c.expectedDelegate
      || row.expectedApplicability !== c.expectedApplicability)) throw new Error('mismatched_expected_label');
  }
  const valid = rows.filter((r): r is ScoredCase => r.failure === null);
  return { version: EVALUATOR_VERSION, attempted: rows.length, expected: expected.length,
    complete: valid.length === expected.length, missing: expected.filter(c => !ids.has(c.id)).map(c => c.id),
    failures: rows.filter(r => r.failure !== null).map(r => r.id),
    positiveDelegated: valid.filter(r => r.expectedDelegate && r.initialRouteDelegate).length,
    missedPositive: valid.filter(r => r.expectedDelegate && !r.initialRouteDelegate).map(r => r.id),
    unsafeDelegation: valid.filter(r => !r.expectedDelegate && r.initialRouteDelegate).map(r => r.id),
    usage: { knownInputTokens: rows.reduce((n, r) => n + (r.usage?.input_tokens ?? 0), 0),
      knownOutputTokens: rows.reduce((n, r) => n + (r.usage?.output_tokens ?? 0), 0),
      unknownCalls: rows.filter(r => !r.usage).length },
    promotion: 'not_authorized_by_this_author_labeled_synthetic_diagnostic' };
}
