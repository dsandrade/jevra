import { hash } from '@jevra/core';
import { workloads, grammarFor, taskPrompt } from './fixtures.ts';

export const baseArms = ['native', 'worker-ticket', 'jev-review', 'jev-ticket'] as const;
export type Arm = typeof baseArms[number] | 'jev-ticket-hook';
export interface Cell { id: string; blockId: string; host: 'codex' | 'claude-code'; taskId: string; repetition: number; arm: Arm }
export function makePlan(includeClaudeHook = false) {
  const cells: Cell[] = [];
  for (const host of ['codex', 'claude-code'] as const) {
    for (const task of workloads) {
      for (let repetition = 1; repetition <= 3; repetition++) {
        const blockId = `${host}/${task.id}/${repetition}`;
        const offered: Arm[] = [...baseArms, ...(includeClaudeHook && host === 'claude-code' ? ['jev-ticket-hook' as const] : [])];
        const order = offered.sort((a, b) => hash('artifact-v2-proposal/' + blockId + '/' + a)
          .localeCompare(hash('artifact-v2-proposal/' + blockId + '/' + b)));
        for (const arm of order) cells.push({ id: blockId + '/' + arm, blockId, host, taskId: task.id, repetition, arm });
      }
    }
  }
  return { version: 'artifact-comparison/2-proposal', status: 'offline_preparation_only', executable: false,
    includeClaudeHook, expectedCells: cells.length, proposedSeed: 'artifact-v2-proposal',
    promotion: 'not_authorized', actualBilledUsd: null, subscriptionUsage: null,
    pendingGates: ['independent_requirement_review', 'production_gate_parity_and_full_typed_answer_capture',
      'adapters_and_worker_ticket_control', 'bounded_recovery_and_hook_trace_reconciliation',
      'component_accounting_failure_injection', 'cache_and_budget_freeze', 'host_preflight', 'confirmatory_dataset'],
    contrasts: [
      { left: 'jev-ticket', right: 'jev-review', effect: 'compact_delivery' },
      { left: 'jev-ticket', right: 'worker-ticket', effect: 'managed_jev_judgments' },
      { left: 'jev-ticket', right: 'native', effect: 'complete_offered_system' },
      ...(includeClaudeHook ? [{ left: 'jev-ticket-hook', right: 'jev-ticket', effect: 'claude_scoped_prompt_hook' }] : []),
    ],
    tasks: workloads.map(task => ({ id: task.id, family: task.family, size: task.size,
      requiredExamples: task.cases.length, requirements: task.requirements.length, sourceHash: hash(task.source),
      grammarHash: hash(grammarFor(task)), promptHash: hash(taskPrompt(task)),
      runtimeMutants: task.mutants.slice(0, 2).map(m => m.id), judgeOnlyMutants: task.mutants.slice(2).map(m => m.id) })), cells };
}
