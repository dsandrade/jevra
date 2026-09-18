import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { hash } from '@jevra/core';
import { makePlan } from './plan.ts';

const { values } = parseArgs({ options: { output: { type: 'string', default: `evals/local-results/artifact-v2-plan-${Date.now()}` },
  'include-claude-hook': { type: 'boolean', default: false } } });
const files = ['evals/artifact-comparison-v2/protocol.md', 'evals/artifact-comparison-v2/fixtures.ts',
  'evals/artifact-comparison-v2/plan.ts', 'evals/artifact-comparison-v2/prepare.ts',
  'evals/artifact-comparison-v2/diagnostics.ts', 'evals/artifact-comparison-v2/accounting.ts',
  'evals/artifact-comparison/fixtures.ts', 'packages/cli/src/test-guidance.ts',
  'packages/cli/src/test-policy.ts', 'packages/cli/src/test-artifacts.ts', 'package-lock.json'];
const manifest = { preparedAt: new Date().toISOString(), ...makePlan(values['include-claude-hook']),
  hashes: Object.fromEntries(await Promise.all(files.map(async p => [p, hash(await readFile(p, 'utf8'))]))) };
const output = resolve(values.output!); await mkdir(output, { recursive: true, mode: 0o700 });
await writeFile(join(output, 'plan.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ status: manifest.status, executable: manifest.executable, expectedCells: manifest.expectedCells, output }));
