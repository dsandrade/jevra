import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { parse } from 'acorn';
import { evidenceHash } from '@jevra/core/managed-worker';
import { NodeTestArtifacts } from '../../packages/cli/src/test-artifacts.ts';
import { validatePureModule, validateTestModule } from '../../packages/cli/src/test-policy.ts';
import type { Task } from './fixtures.ts';

export function coversCases(task: Task, content: string): boolean[] {
  if (!validateTestModule(content, task.sourceName, task.exportName, validatePureModule(task.source, task.exportName)).valid) {
    return task.cases.map(() => false);
  }
  const body: any[] = parse(stripTypeScriptTypes(content, { mode: 'strip' }), { ecmaVersion: 'latest', sourceType: 'module' }).body;
  const value = (node: any) => node.type === 'UnaryExpression' ? -node.argument.value : node.value;
  const assertions = body.filter(s => s.type === 'ExpressionStatement')
    .flatMap(s => s.expression.arguments[1].body.body)
    .map(s => ({ args: s.expression.arguments[0].arguments.map(value), expected: value(s.expression.arguments[1]) }));
  return task.cases.map(c => assertions.some(a => JSON.stringify(a.args) === JSON.stringify(c.args) && Object.is(a.expected, c.expected)));
}
export async function judge(task: Task, content: string | null, sourceUnchanged: boolean, root: string) {
  const coverage = content ? coversCases(task, content) : task.cases.map(() => false);
  if (!content || !sourceUnchanged || Buffer.byteLength(content) > 32768) return { passed: false, coverage, validation: null };
  await mkdir(root, { recursive: true }); await writeFile(join(root, task.sourceName), task.source);
  const validator = await NodeTestArtifacts.create({ sourcePath: join(root, task.sourceName),
    outputName: task.outputName, exportName: task.exportName, stagingDirectory: join(root, 'staging'), mutants: task.mutants });
  await validator.prepare({ operationId: 'independent-judge', task: 'Validate delivered tests.', instructions: [], requirements: task.requirements });
  const validation = await validator.validate({ content, sha256: evidenceHash(content), bytes: Buffer.byteLength(content) }, 1, new AbortController().signal);
  return { passed: coverage.every(Boolean) && validation.requiredChecksPassed, coverage, validation };
}
