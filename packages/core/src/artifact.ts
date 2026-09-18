import { z } from 'zod';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const artifactHandleSchema = z.object({ id: z.string().uuid(), candidateHash: digest,
  bytes: z.number().int().min(1).max(32768), attempt: z.union([z.literal(1), z.literal(2)]) }).strict();
export type ArtifactHandle = z.infer<typeof artifactHandleSchema>;
export const checkReceiptSchema = z.object({
  kind: z.enum(['syntax_policy', 'baseline', 'mutation']),
  checkHash: digest,
  outcome: z.enum(['passed', 'failed', 'unavailable']),
  reason: z.enum(['valid', 'invalid_syntax', 'unsupported_syntax', 'assertions_passed', 'assertions_failed',
    'mutant_detected', 'mutant_survived', 'invalid_report', 'timeout', 'cancelled', 'output_limit',
    'process_failed', 'executable_unavailable', 'cleanup_failed']),
  exitCode: z.number().int().nullable(),
  tests: z.number().int().nonnegative(),
  failures: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  cleanupComplete: z.boolean(),
}).strict();
export type CheckReceipt = z.infer<typeof checkReceiptSchema>;
export const artifactValidationSchema = z.object({
  schemaVersion: z.literal(1), profile: z.literal('node-pure-function-tests/1'),
  bindingHash: digest, artifact: artifactHandleSchema,
  checks: z.array(checkReceiptSchema).min(1).max(6),
  requiredChecksPassed: z.boolean(),
}).strict();
export type ArtifactValidation = z.infer<typeof artifactValidationSchema>;
/** Runtime-owned validator, never a tool argument containing a claimed test result. */
export interface ArtifactValidator {
  validate(candidate: { content: string; sha256: string; bytes: number }, attempt: 1 | 2,
    signal: AbortSignal): Promise<ArtifactValidation>;
  accept(artifact: ArtifactHandle, signal: AbortSignal): Promise<void>;
  checkpoint?(attempt: 1 | 2): ArtifactValidation | null;
}

/** Mandatory completion is computed from actual observed checks, independently of Jev. */
export function checksPassed(validation: ArtifactValidation): boolean {
  const checks = validation.checks;
  return checks.filter(c => c.kind === 'syntax_policy').length === 1
    && checks.filter(c => c.kind === 'baseline').length === 1
    && checks.filter(c => c.kind === 'mutation').length >= 1
    && new Set(checks.map(c => c.checkHash)).size === checks.length
    && checks.every(c => c.outcome === 'passed' && c.cleanupComplete
      && (c.kind === 'syntax_policy' ? c.reason === 'valid'
        : c.kind === 'baseline' ? c.reason === 'assertions_passed' && c.exitCode === 0 && c.tests > 0 && c.failures === 0
          : c.reason === 'mutant_detected' && c.exitCode === 1 && c.tests > 0 && c.failures > 0));
}
