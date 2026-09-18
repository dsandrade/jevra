import { tasks as pilotTasks } from '../artifact-comparison/fixtures.ts';
import type { Task, TestCase } from '../artifact-comparison/fixtures.ts';
import { testArtifactInstructions } from '../../packages/cli/src/test-guidance.ts';

export interface Workload extends Task { family: 'clamp' | 'shipping'; size: 'small' | 'medium' | 'large' }
const moreClamp: TestCase[] = [
  { args: [-12, -10, -1], expected: -10 }, { args: [-10, -10, -1], expected: -10 },
  { args: [-1, -10, -1], expected: -1 }, { args: [0, -10, -1], expected: -1 },
  { args: [2, 4, 4], expected: 4 }, { args: [4, 4, 4], expected: 4 },
  { args: [-1, 0, 0], expected: 0 }, { args: [0, 0, 0], expected: 0 },
  { args: [1, 0, 0], expected: 0 }, { args: [99, 100, 200], expected: 100 },
  { args: [100, 100, 200], expected: 100 }, { args: [150, 100, 200], expected: 150 },
  { args: [200, 100, 200], expected: 200 }, { args: [201, 100, 200], expected: 200 },
  { args: [0.5, 0, 1], expected: 0.5 }, { args: [1.5, 0, 1], expected: 1 },
];
export const workloads: Workload[] = pilotTasks.flatMap(task => {
  const family = task.id as Workload['family'];
  const large = family === 'clamp' ? [...task.cases, ...moreClamp]
    : [-10, 0, 1, 50, 98, 99, 100, 101, 120, 150, 500, 1000].flatMap(subtotal =>
      [false, true].map(member => ({ args: [subtotal, member], expected: subtotal >= 100 ? 0 : member ? 5 : 10 })));
  const small = family === 'clamp' ? task.cases.slice(0, 4)
    : [task.cases[0]!, task.cases[1]!, task.cases[4]!, task.cases[5]!];
  return (['small', 'medium', 'large'] as const).map(size => {
    const cases = size === 'small' ? small : size === 'medium' ? task.cases : large;
    // Keep at most eight requirements, while retaining every required literal example.
    const grouped = Array.from({ length: Math.min(cases.length, 8) }, (_, i) => cases.slice(i * Math.ceil(cases.length / 8),
      (i + 1) * Math.ceil(cases.length / 8)).map(c => `Assert ${task.exportName}(${c.args.join(', ')}) equals ${c.expected}.`).join(' '));
    return { ...task, id: family + '-' + size, family, size, cases, requirements: grouped };
  });
});
export function grammarFor(task: Workload): string[] {
  return testArtifactInstructions(task.sourceName, task.outputName, task.exportName);
}
/** Same user prompt in every offered arm; no helper invocation or advertised savings. */
export function taskPrompt(task: Workload): string {
  return `Add ${task.outputName} for ${task.exportName} in ${task.sourceName}. Keep the implementation unchanged. `
    + 'Cover every required example, verify the completed tests and report briefly. '
    + 'When generating the test file, follow this restricted profile:\n' + grammarFor(task).join('\n')
    + '\nRequired examples:\n' + task.requirements.join('\n');
}
