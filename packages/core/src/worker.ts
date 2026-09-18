import { z } from 'zod';

/** Internal transport contract. A generated candidate is not an accepted artifact. */
export const workerRequestSchema = z.object({
  schemaVersion: z.literal(1),
  operationId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  attempt: z.number().int().min(1).max(2),
  profile: z.enum(['transport-probe', 'artifact-writer/tests', 'artifact-writer/repair', 'context-reader/1']),
  instructions: z.array(z.string().min(1).max(16384)).max(32),
  task: z.string().min(1).max(49152),
  requirements: z.array(z.string().min(1).max(8192)).min(1).max(64),
  evidence: z.array(z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    content: z.string().max(49152),
  }).strict()).max(32),
}).strict();
export type WorkerRequest = z.infer<typeof workerRequestSchema>;

export const workerLimitsSchema = z.object({
  maxInputBytes: z.number().int().min(256).max(131072).default(49152),
  maxOutputBytes: z.number().int().min(256).max(2097152).default(1048576),
  maxStderrBytes: z.number().int().min(256).max(131072).default(32768),
  maxArtifactBytes: z.number().int().min(1).max(131072).default(65536),
  timeoutMs: z.number().int().min(100).max(300000).default(120000),
  killGraceMs: z.number().int().min(10).max(2000).default(250),
}).strict();
export type WorkerLimits = z.infer<typeof workerLimitsSchema>;

export const workerFailureSchema = z.enum(['input_invalid', 'input_limit', 'output_limit', 'artifact_limit',
  'busy', 'recursive_dispatch', 'unsupported_platform', 'unsupported_cli', 'unsupported_configuration',
  'executable_unavailable', 'authentication', 'rate_limited', 'model_unavailable',
  'timeout', 'cancelled', 'invalid_response', 'unexpected_tool', 'process_failed', 'io_failed', 'cleanup_failed']);
export type WorkerFailure = z.infer<typeof workerFailureSchema>;

export interface WorkerUsage {
  inputTokens: number;
  cachedInputTokens: number | null;
  outputTokens: number;
}

export interface WorkerReceipt {
  schemaVersion: 1;
  transport: 'codex-cli';
  requestHash: string | null;
  operationHash: string | null;
  attempt: number | null;
  profile: WorkerRequest['profile'] | null;
  configuredModel: string;
  configuredEffort: 'low';
  isolationProfile: 'codex-generator/1';
  observedModel: string | null;
  cliVersion: string | null;
  authentication: 'chatgpt' | 'unknown';
  inputBytes: number;
  stdoutBytes: number;
  stderrBytes: number;
  generationInvocations: number;
  observedToolItems: number;
  usage: WorkerUsage | null;
  usageComplete: boolean;
  durationMs: number;
  exitCode: number | null;
  cleanupComplete: boolean;
  actualBilledUsd: null;
  subscriptionUsage: null;
}

export type WorkerResult =
  | { status: 'generated'; candidate: { content: string; sha256: string; bytes: number }; receipt: WorkerReceipt }
  | { status: 'failed'; reason: WorkerFailure; receipt: WorkerReceipt };

export interface WorkerTransport {
  generate(request: WorkerRequest, signal?: AbortSignal): Promise<WorkerResult>;
}
