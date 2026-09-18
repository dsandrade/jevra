import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { hash } from '@jevra/core';
import { createTypeSafeProvider } from '@jevra/provider-typesafe';
import { evidenceHash, ManagedTestOperation, sourceBinding } from '@jevra/core/managed-worker';
import type { ManagedTestRequest } from '@jevra/core/managed-worker';
import { CodexCliWorker } from '../../packages/cli/src/codex-worker.ts';
import { configPath, configSchema, loadConfig, readApiKey } from '../../packages/cli/src/config.ts';

// Opt-in live diagnostic. No project source, candidate execution, application or host activation.
const { values } = parseArgs({ options: {
  output: { type: 'string', default: `evals/local-results/managed-worker-probe-${Date.now()}.json` },
  executable: { type: 'string', default: 'codex' },
  config: { type: 'string' },
  'keychain-service': { type: 'string' },
} });
const shutdown = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => shutdown.abort());
const content = 'File: sum.ts\nexport function sum(a: number, b: number): number { return a + b; }\n';
const request: ManagedTestRequest = { schemaVersion: 1, operationId: 'synthetic-managed-test-probe',
  scopeHash: hash('synthetic-sum-fixture/1'), stateRevision: hash('synthetic-sum-revision/1'), preference: 'managed',
  task: 'Generate one TypeScript test file, sum.test.ts, for the supplied sum.ts module.',
  instructions: ['Use the Node.js built-in node:test runner and node:assert/strict; no external dependencies.',
    'The test file will sit beside sum.ts; import sum from ./sum.ts.',
    'Return only the complete test file content. Do not execute checks or claim they passed.'],
  requirements: ['Assert that sum(2, 3) equals 5.', 'Assert that sum(-2, 3) equals 1.',
    'Assert that sum(0, 0) equals 0.'],
  evidence: [{ id: 'sum_module', sourceHash: evidenceHash(content), content }] };
if (values.config && values['keychain-service']) throw new Error('Choose config or keychain-service, not both.');
const config = values['keychain-service']
  ? configSchema.parse({ version: 1, skillRoots: [resolve('evals/fixtures/skills')],
    keychainService: values['keychain-service'], traces: false })
  : await loadConfig(configPath(values.config));
const result = await new ManagedTestOperation({ request, signal: shutdown.signal,
  provider: createTypeSafeProvider({ getApiKey: () => readApiKey(config) }),
  worker: new CodexCliWorker({ executable: values.executable!, limits: { timeoutMs: 60000, maxArtifactBytes: 8192 } }),
  currentBinding: async () => sourceBinding(request), limits: { operationTimeoutMs: 100000, maxArtifactBytes: 8192 },
}).run();
const report = { kind: 'managed-worker-contract-probe', timestamp: new Date().toISOString(),
  runtime: { node: process.version, platform: process.platform, architecture: process.arch },
  implementationHash: hash(await Promise.all([
    '../../packages/core/src/managed-worker.ts', '../../packages/core/src/worker.ts',
    '../../packages/cli/src/codex-worker.ts', '../../packages/cli/src/worker-process.ts',
    '../../packages/provider-typesafe/src/index.ts',
  ].map(path => readFile(new URL(path, import.meta.url), 'utf8')))),
  status: result.status, reason: result.reason, candidateBytes: result.candidate?.bytes ?? null,
  receipt: result.receipt,
  scope: 'Synthetic contract diagnostic only. No trusted checks, repairs, host adoption, baseline or savings measurement.',
};
const output = resolve(values.output!);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
if (result.status !== 'awaiting_validation') process.exitCode = 1;
