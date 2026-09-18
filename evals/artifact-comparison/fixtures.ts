export interface TestCase { args: (number | boolean)[]; expected: number }
export interface Task {
  id: string; sourceName: string; outputName: string; exportName: string; source: string;
  cases: TestCase[]; requirements: string[];
  mutants: { id: string; content: string }[];
}
const clamp = 'export function clamp(value: number, lower: number, upper: number): number { return value < lower ? lower : value > upper ? upper : value; }\n';
const shipping = 'export function shippingFee(subtotal: number, member: boolean): number { return subtotal >= 100 ? 0 : member ? 5 : 10; }\n';
const define = (id: string, exportName: string, source: string, cases: TestCase[], mutations: [string, string][]): Task => ({
  id, sourceName: id + '.ts', outputName: id + '.test.ts', exportName, source, cases,
  requirements: cases.map(c => `Assert ${exportName}(${c.args.join(', ')}) equals ${c.expected}.`),
  mutants: mutations.map(([name, content]) => ({ id: name, content })),
});
export const tasks: Task[] = [
  define('clamp', 'clamp', clamp, [
    { args: [-1, 0, 10], expected: 0 }, { args: [11, 0, 10], expected: 10 },
    { args: [0, 0, 10], expected: 0 }, { args: [10, 0, 10], expected: 10 },
    { args: [5, 0, 10], expected: 5 }, { args: [-5, -10, -1], expected: -5 },
    { args: [-11, -10, -1], expected: -10 }, { args: [7, 4, 4], expected: 4 },
  ], [
    ['lower-offset', clamp.replace('? lower :', '? lower + 1 :')],
    ['upper-offset', clamp.replace('? upper :', '? upper - 1 :')],
    ['lower-boundary', clamp.replace('value < lower ? lower', 'value <= lower ? lower - 1')],
    ['upper-boundary', clamp.replace('value > upper ? upper', 'value >= upper ? upper + 1')],
  ]),
  define('shipping', 'shippingFee', shipping, [
    { args: [0, false], expected: 10 }, { args: [0, true], expected: 5 },
    { args: [99, false], expected: 10 }, { args: [99, true], expected: 5 },
    { args: [100, false], expected: 0 }, { args: [100, true], expected: 0 },
    { args: [150, false], expected: 0 }, { args: [150, true], expected: 0 },
  ], [
    ['threshold', shipping.replace('subtotal >= 100', 'subtotal > 100')],
    ['member-fee', shipping.replace('member ? 5', 'member ? 7')],
    ['regular-fee', shipping.replace(': 10', ': 8')],
    ['member-free-shipping', shipping.replace('subtotal >= 100', 'subtotal >= 100 && member')],
  ]),
];
export function taskPrompt(task: Task): string {
  return `Add ${task.outputName} for ${task.exportName} in ${task.sourceName}. Use node:test and strict assertions. `
    + 'Keep the implementation unchanged. Cover every case below with explicit synchronous test assertions, '
    + 'verify the completed tests, and report the result briefly.\n' + task.requirements.join('\n');
}
// Identical guidance in both helper arms, with no claim that the control calls Jev.
export const comparisonSkill = `---
name: test-artifact
description: Delegate tests for configured pure-function profiles to the available test helper, then review and apply the staged artifact.
---
# Test artifact
For a test addition, discover configured scope with test_profiles when available.
If a profile covers the request, use generate_tests with an operationId, profileId,
task and additional requirements. Configured requirements are always retained.
Read the returned handle with read_test_artifact. Review accepted content against
the user request, then use native editing permissions to create the absent output
with the exact bytes. Recheck source hash and output absence before writing.
Verify the written file. Changed bytes are outside the managed validation receipt.
If no profile applies, a tool fails or the result is unresolved, continue natively.
Do not create another operation to evade a failure or the one-repair limit.
`;

export const schedule = [
  { host: 'codex', task: 'clamp', arms: ['native', 'worker', 'jev'] },
  { host: 'claude-code', task: 'clamp', arms: ['worker', 'jev', 'native'] },
  { host: 'codex', task: 'shipping', arms: ['jev', 'native', 'worker'] },
  { host: 'claude-code', task: 'shipping', arms: ['native', 'jev', 'worker'] },
] as const;
