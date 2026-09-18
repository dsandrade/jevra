import { parseArgs } from 'node:util';
import { mkdir, mkdtemp, realpath, writeFile, readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { hash } from '@jevra/core';
import { ManagedTestOperation } from '@jevra/core/managed-worker';
import { createTypeSafeProvider } from '@jevra/provider-typesafe';
import { NodeTestArtifacts } from '../../packages/cli/src/test-artifacts.ts';
import { CodexCliWorker } from '../../packages/cli/src/codex-worker.ts';
import { configSchema, readApiKey } from '../../packages/cli/src/config.ts';

// Explicit synthetic live test only: at most four Jev calls and two CLI invocations.
const { values } = parseArgs({ options: {
  executable: { type: 'string', default: 'codex' }, 'keychain-service': { type: 'string' },
  output: { type: 'string', default: `evals/local-results/artifact-probe-${Date.now()}.json` },
} });
const shutdown = new AbortController();
for (const name of ['SIGINT', 'SIGTERM'] as const) process.once(name, () => shutdown.abort());
const base = resolve('.jevra/artifact-probes');
await mkdir(base, { recursive: true, mode: 0o700 });
const root = await realpath(await mkdtemp(join(base, 'sum-')));
const source = 'export function sum(a: number, b: number): number { return a + b; }\n';
await writeFile(join(root, 'sum.ts'), source, { mode: 0o600, flag: 'wx' });
const artifacts = await NodeTestArtifacts.create({ sourcePath: join(root, 'sum.ts'), exportName: 'sum',
  outputName: 'sum.test.ts', stagingDirectory: join(root, 'staging'),
  mutants: [{ id: 'subtract-instead-of-add', content: source.replace('a + b', 'a - b') },
    { id: 'drop-second-operand', content: source.replace('a + b', 'a') }] });
const request = await artifacts.prepare({ operationId: 'synthetic-artifact-probe',
  task: 'Generate tests for the supplied sum function.', instructions: ['Write technical artifacts in English.'],
  requirements: ['Assert sum(2, 3) equals 5.', 'Assert sum(-2, 3) equals 1.', 'Assert sum(0, 0) equals 0.'] });
const config = configSchema.parse({ version: 1, skillRoots: [resolve('evals/fixtures/skills')],
  keychainService: values['keychain-service'], traces: false });
const result = await new ManagedTestOperation({ request, validator: artifacts, signal: shutdown.signal,
  currentBinding: s => artifacts.currentBinding(s), provider: createTypeSafeProvider({ getApiKey: () => readApiKey(config) }),
  worker: new CodexCliWorker({ executable: values.executable!, limits: { timeoutMs: 60000, maxArtifactBytes: 8192 } }),
  limits: { maxArtifactBytes: 8192, operationTimeoutMs: 180000 },
}).run();
let appliedToSyntheticFixture = false;
if (result.status === 'accepted' && result.artifact) {
  await artifacts.apply(result.artifact, shutdown.signal);
  appliedToSyntheticFixture = true;
}
const implementationFiles = ['packages/core/src/managed-worker.ts', 'packages/core/src/artifact.ts',
  'packages/cli/src/test-artifacts.ts', 'packages/cli/src/test-policy.ts', 'packages/cli/src/codex-worker.ts',
  'packages/cli/src/worker-process.ts', 'packages/provider-typesafe/src/index.ts', 'evals/workers/artifact-probe.ts'];
const report = { kind: 'staged-test-artifact-diagnostic', timestamp: new Date().toISOString(),
  runtime: { node: process.version, platform: process.platform, architecture: process.arch },
  implementationHash: hash(await Promise.all(implementationFiles.map(p => readFile(p, 'utf8')))),
  status: result.status, reason: result.reason, appliedToSyntheticFixture, receipt: result.receipt,
  scope: 'One synthetic pure-function task with two independently authored mutants. No native-host baseline or savings claim.',
};
const output = resolve(values.output!);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
if (result.status !== 'accepted') process.exitCode = 1;
