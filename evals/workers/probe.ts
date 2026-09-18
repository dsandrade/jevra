import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { hash } from '@jevra/core';
import { CodexCliWorker } from '../../packages/cli/src/codex-worker.ts';
import type { WorkerRequest } from '../../packages/core/src/worker.ts';

// Explicit live diagnostic, never imported by normal tests or plugin startup.
const { values } = parseArgs({ options: {
  output: { type: 'string', default: `evals/local-results/worker-probe-${Date.now()}.json` },
  executable: { type: 'string', default: 'codex' },
} });
const shutdown = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => shutdown.abort());
const request: WorkerRequest = { schemaVersion: 1, operationId: 'synthetic-transport-probe',
  attempt: 1, profile: 'transport-probe', instructions: ['Write technical artifacts in English.'],
  task: 'Generate the exact TypeScript declaration described in the requirements.',
  requirements: ['Return exactly export const answer = 42; followed by one newline.'], evidence: [] };
const result = await new CodexCliWorker({ executable: values.executable!,
  limits: { timeoutMs: 60000, maxArtifactBytes: 1024 } }).generate(request, shutdown.signal);
const report = {
  kind: 'codex-worker-capability-probe', timestamp: new Date().toISOString(),
  runtime: { node: process.version, platform: process.platform, architecture: process.arch },
  implementationHash: hash(await readFile(new URL('../../packages/cli/src/codex-worker.ts', import.meta.url), 'utf8')),
  status: result.status, failure: result.status === 'failed' ? result.reason : null,
  exactCandidateMatch: result.status === 'generated' && result.candidate.content === 'export const answer = 42;\n',
  receipt: result.receipt,
  scope: 'One synthetic transport request; no Jev call, project access, artifact application or efficiency comparison.',
};
const output = resolve(values.output!);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
if (!report.exactCandidateMatch) process.exitCode = 1;
