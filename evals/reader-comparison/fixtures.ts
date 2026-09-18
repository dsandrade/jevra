import { hash } from '@jevra/core';
export interface Fact { value: number | boolean | null; path: string | null; quote: string | null }
export interface ReaderTask {
  id: string; kind: 'large_single' | 'cross_file' | 'conflicting' | 'no_answer';
  files: Record<string, string>; paths: string[]; question: string;
  target: string; exportName: string; canonical: string; facts: Record<string, Fact>;
  examples: { args: (number | boolean)[]; expected: number | boolean }[];
}
const filler = (prefix: string, count: number) => Array.from({ length: count }, (_, i) =>
  `Archive ${prefix}-${i}: Historical workflow notes without a pricing, eligibility, retry or retention contract.\n`).join('');
const doc = (prefix: string, rules: string[]) => rules.map((r, i) =>
  `# Section ${prefix}-${i}\n${filler(prefix + i, 180)}${r}\n`).join('');
const feeRules = ['The current base delivery fee is 7.', 'Expedited delivery adds 5 to the base fee.', 'An order subtotal of at least 100 waives the base fee, but keeps the expedited surcharge.'];
const eligibleRule = 'An applicant is eligible only when age meets MIN_AGE and completed projects meets MIN_PROJECTS.';
const currentRetry = 'Current policy: allow another retry only while attempts is strictly less than 3.';
const retiredRetry = 'Retired policy: allow another retry while attempts is less than 10. Superseded by current-policy.md.';
export const tasks: ReaderTask[] = [
  { id: 'large-shipping', kind: 'large_single', files: { 'shipping-policy.md': doc('shipping', feeRules),
    'fee.ts': 'export function fee(subtotal: number, expedited: boolean): number { return 0; }\n' },
    paths: ['shipping-policy.md', 'fee.ts'], question: 'What base fee, expedited surcharge and free-base threshold govern fee(subtotal, expedited), including the exception?',
    target: 'fee.ts', exportName: 'fee', canonical: 'export function fee(subtotal: number, expedited: boolean): number { return (subtotal >= 100 ? 0 : 7) + (expedited ? 5 : 0); }\n',
    facts: { base: { value: 7, path: 'shipping-policy.md', quote: feeRules[0]! },
      surcharge: { value: 5, path: 'shipping-policy.md', quote: feeRules[1]! },
      freeThreshold: { value: 100, path: 'shipping-policy.md', quote: feeRules[2]! } },
    examples: [{ args: [99, false], expected: 7 }, { args: [100, false], expected: 0 }, { args: [150, true], expected: 5 }, { args: [20, true], expected: 12 }] },
  { id: 'cross-file-eligibility', kind: 'cross_file', files: { 'eligibility.md': doc('eligibility', [eligibleRule, 'Thresholds are defined in limits.ts; documentation values are not substitutes for that module.']),
    'limits.ts': 'export const MIN_AGE = 18;\nexport const MIN_PROJECTS = 3;\n',
    'eligible.ts': 'export function eligible(age: number, projects: number): boolean { return false; }\n' },
    paths: ['eligibility.md', 'limits.ts', 'eligible.ts'], question: 'Which two thresholds determine eligible(age, projects), where are they defined, and must both conditions hold?',
    target: 'eligible.ts', exportName: 'eligible', canonical: 'export function eligible(age: number, projects: number): boolean { return age >= 18 && projects >= 3; }\n',
    facts: { minAge: { value: 18, path: 'limits.ts', quote: 'export const MIN_AGE = 18;' },
      minProjects: { value: 3, path: 'limits.ts', quote: 'export const MIN_PROJECTS = 3;' },
      bothRequired: { value: true, path: 'eligibility.md', quote: eligibleRule } },
    examples: [{ args: [18, 3], expected: true }, { args: [17, 4], expected: false }, { args: [30, 2], expected: false }, { args: [22, 5], expected: true }] },
  { id: 'conflicting-retry', kind: 'conflicting', files: { 'current-policy.md': doc('retry', [currentRetry, 'This is the authoritative policy; old-policy.md is retained as superseded history.']),
    'old-policy.md': retiredRetry + '\n', 'retry.ts': 'export function allowRetry(attempts: number): boolean { return false; }\n' },
    paths: ['current-policy.md', 'old-policy.md', 'retry.ts'], question: 'What is the current retry cutoff and comparison operator? Resolve the conflict with the retired policy explicitly.',
    target: 'retry.ts', exportName: 'allowRetry', canonical: 'export function allowRetry(attempts: number): boolean { return attempts < 3; }\n',
    facts: { cutoff: { value: 3, path: 'current-policy.md', quote: currentRetry },
      exclusive: { value: true, path: 'current-policy.md', quote: currentRetry },
      supersededCutoff: { value: 10, path: 'old-policy.md', quote: retiredRetry } },
    examples: [{ args: [2], expected: true }, { args: [3], expected: false }, { args: [8], expected: false }] },
  { id: 'absent-retention', kind: 'no_answer', files: { 'retention.md': doc('retention', ['Retention duration is intentionally unspecified. No approved retention-days value appears in the supplied sources.', 'Do not infer retention duration from archive identifiers or migration dates.']),
    'retention.ts': 'export function retentionDays(unused: number): number { return 0; }\n' }, paths: ['retention.md', 'retention.ts'],
    question: 'What approved number of retention days is specified? If absent, say it is missing and do not invent a value.',
    target: 'retention.ts', exportName: 'retentionDays', canonical: 'export function retentionDays(unused: number): number { return 0; }\n',
    facts: { retentionDays: { value: null, path: null, quote: null } }, examples: [{ args: [0], expected: 0 }] },
];
export function taskPrompt(t: ReaderTask) {
  return `Inspect ${t.paths.join(', ')} to answer this focused question: ${t.question}\n`
    + (t.kind === 'no_answer' ? `Leave ${t.target} unchanged if the approved value is missing.\n`
      : `Implement ${t.exportName} in ${t.target} according to the supplied contract. Keep its signature and all other files unchanged. Use a single pure return expression; no imports, calls, loops, I/O or new dependencies.\n`)
    + `Write answer.json with exactly {status: "resolved"|"missing", facts: {${Object.keys(t.facts).map(k => `"${k}": {value: number|boolean|null, path: string|null, quote: string|null}`).join(', ')}}}. `
    + 'Every known value needs a verbatim contiguous source quote (at most 2048 characters) and its relative file path. Unknown values use null for value/path/quote. Verify the change and report briefly. Native targeted searches and reads are available.';
}
export const arms = ['native', 'excerpts', 'luna-full', 'jev-full', 'jev-selected'] as const;
export type Arm = typeof arms[number];
export function schedule() {
  return (['codex', 'claude-code'] as const).flatMap(host => tasks.flatMap(t =>
    [...arms].sort((a, b) => hash(host + '/' + t.id + '/' + a).localeCompare(hash(host + '/' + t.id + '/' + b)))
      .map(arm => ({ id: `${host}/${t.id}/${arm}`, host, taskId: t.id, arm }))));
}
