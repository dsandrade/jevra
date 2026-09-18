import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evidenceHash } from '@jevra/core/managed-worker';
import { NodeTestArtifacts } from '../packages/cli/src/test-artifacts.ts';
import { workloads, grammarFor, taskPrompt } from '../evals/artifact-comparison-v2/fixtures.ts';
import { makePlan, baseArms } from '../evals/artifact-comparison-v2/plan.ts';
import { inspectOutput } from '../evals/artifact-comparison-v2/diagnostics.ts';
import { wholeTaskUsage } from '../evals/artifact-comparison-v2/accounting.ts';
import type { Invocation } from '../evals/artifact-comparison-v2/accounting.ts';

const candidate = (task: typeof workloads[number]) => `import test from 'node:test';\nimport assert from 'node:assert/strict';\n`
  + `import { ${task.exportName} } from './${task.sourceName}';\n`
  + task.cases.map((c, i) => `test('required example ${i + 1}', () => { assert.equal(${task.exportName}(${c.args.join(', ')}), ${c.expected}); });`).join('\n') + '\n';

test('offline v2 plans preserve matched repeats and keep the optional hook ablation Claude-only', () => {
  const plan = makePlan();
  assert.deepEqual(plan, makePlan());
  assert.equal(plan.expectedCells, 144);
  assert.equal(plan.executable, false);
  assert.equal(new Set(plan.cells.map(c => c.id)).size, 144);
  const blocks = new Set(plan.cells.map(c => c.blockId));
  assert.equal(blocks.size, 36);
  for (const block of blocks) assert.deepEqual(plan.cells.filter(c => c.blockId === block).map(c => c.arm).sort(), [...baseArms].sort());
  const hooked = makePlan(true);
  assert.equal(hooked.expectedCells, 162);
  const hookCells = hooked.cells.filter(c => c.arm === 'jev-ticket-hook');
  assert.equal(hookCells.length, 18);
  assert.ok(hookCells.every(c => c.host === 'claude-code' && hooked.cells.some(other => other.blockId === c.blockId && other.arm === 'jev-ticket')));
});

test('syntax diagnostics keep unsupported, malformed and missing files distinct without source disclosure or execution', () => {
  const task = workloads[0]!;
  const supported = candidate(task);
  assert.equal(inspectOutput(task, supported, true).category, 'admitted');
  const unsupported = supported + '\nconst PRIVATE_IDENTIFIER = "PRIVATE_LITERAL";\n';
  const inspection = inspectOutput(task, unsupported, true);
  assert.equal(inspection.category, 'unsupported_syntax');
  assert.equal(inspection.coverage, null);
  assert.equal(inspection.functionalCorrectness, 'unknown');
  assert.equal(inspection.syntaxKinds.VariableDeclaration, 1);
  assert.doesNotMatch(JSON.stringify(inspection), /PRIVATE_IDENTIFIER|PRIVATE_LITERAL|node:test/);
  assert.equal(inspectOutput(task, 'test(', true).category, 'invalid_syntax');
  assert.equal(inspectOutput(task, null, true).category, 'missing_output');
  assert.equal(inspectOutput(task, supported, false).category, 'source_changed');
  assert.equal(inspectOutput(task, ' '.repeat(32769), true).category, 'oversized_output');
});

test('normalized lifecycle accounting includes hooks, failures and gross cache input once; missing usage blocks totals', () => {
  const parent: Invocation = { id: 'parent/1', component: 'parent', status: 'completed',
    usage: { input: 100, output: 10, cacheRead: 60, cacheWrite: 20 } };
  const hook: Invocation = { id: 'hook/1', component: 'routing_hook', status: 'failed',
    usage: { input: 20, output: 3, cacheRead: null, cacheWrite: null } };
  const counts = { parent: 1, worker: 0, managed_jev: 0, routing_hook: 1 };
  const result = wholeTaskUsage([parent, hook], counts);
  assert.equal(result.input, 120); assert.equal(result.output, 13); assert.equal(result.totalTokens, 133);
  assert.equal(result.components[3]!.unknownCacheCalls, 1);
  assert.equal(result.actualBilledUsd, null); assert.equal(result.apiEquivalentUsd, null);
  assert.equal(wholeTaskUsage([parent], counts).totalTokens, null, 'Lost hook traces are not zero usage');
  assert.equal(wholeTaskUsage([parent, { ...hook, usage: null }], counts).knownInput, 100);
  assert.equal(wholeTaskUsage([parent, { ...hook, usage: null }], counts).input, null);
  assert.equal(wholeTaskUsage([parent, { ...hook, status: 'started' }], counts).input, null);
  assert.equal(wholeTaskUsage([parent], { ...counts, routing_hook: null }).input, null);
  assert.equal(wholeTaskUsage([], { parent: 0, worker: 0, managed_jev: 0, routing_hook: 0 }).complete, false);
  assert.throws(() => wholeTaskUsage([parent, parent], counts), /duplicate_invocation/);
  assert.throws(() => wholeTaskUsage([{ ...parent, usage: { ...parent.usage!, cacheWrite: 80 } }], counts), /invalid_usage/);
});

test('all workload sizes expose identical runtime grammar, retain requirements and pass baseline plus every seeded mutant', async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'jevra-v2-fixtures-'));
  try {
    assert.equal(workloads.length, 6);
    for (const task of workloads) {
      assert.equal(task.cases.length, task.size === 'small' ? 4 : task.size === 'medium' ? 8 : 24);
      assert.ok(task.requirements.length <= 8 && task.requirements.every(Boolean));
      for (const c of task.cases) assert.ok(task.requirements.some(r => r.includes(
        `Assert ${task.exportName}(${c.args.join(', ')}) equals ${c.expected}.`)));
      const directory = join(root, task.id); await mkdir(directory);
      await writeFile(join(directory, task.sourceName), task.source);
      const validator = await NodeTestArtifacts.create({ sourcePath: join(directory, task.sourceName),
        outputName: task.outputName, exportName: task.exportName, stagingDirectory: join(directory, 'staging'), mutants: task.mutants });
      const request = await validator.prepare({ operationId: 'offline-fixture', task: 'Generate required tests.',
        requirements: task.requirements, instructions: [] });
      assert.deepEqual(request.instructions, grammarFor(task));
      assert.ok(taskPrompt(task).includes(request.instructions.join('\n')));
      const content = candidate(task), inspection = inspectOutput(task, content, true);
      assert.ok(inspection.coverage?.every(Boolean));
      const validation = await validator.validate({ content, sha256: evidenceHash(content), bytes: Buffer.byteLength(content) },
        1, new AbortController().signal);
      assert.equal(validation.requiredChecksPassed, true, task.id);
      assert.equal(validation.checks.filter(c => c.kind === 'mutation' && c.outcome === 'passed').length, 4, task.id);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
