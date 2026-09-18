import { hash } from '@jevra/core';
import { economicConfigSchema } from '../../packages/core/src/economics.ts';
import type { EconomicConfig } from '../../packages/core/src/economics.ts';

export function calibration(metric: 'total_tokens' | 'api_equivalent_usd' = 'total_tokens'): EconomicConfig {
  const execution = { host: 'codex', delivery: 'native-ticket', parentModel: 'gpt-6-astra', parentEffort: 'low',
    parentCliVersion: 'synthetic', workerModel: 'gpt-5.6-luna', workerCliVersion: 'synthetic', contextHash: hash('synthetic-context') };
  const zero = { low: 0, high: 0 };
  return economicConfigSchema.parse({ mode: 'enforce', questionProfile: 'compound/1', metric, execution, calibration: {
    version: 'economic-route/1', execution, metric, evidenceHash: hash('synthetic-evidence'),
    accounting: 'whole_task_including_failures_and_recovery', measuredAt: 1, expiresAt: Date.now() + 600000,
    taskFamily: 'PRIVATE_CALIBRATION: bounded arithmetic tests', sourceBytes: { low: 1, high: 2000 },
    requirementCount: { low: 1, high: 8 }, equivalentQualityChecks: true,
    pairs: [0, 1, 2].map(i => ({ id: 'pair-' + i, native: { parent: { low: 100, high: 120 }, worker: zero, jev: zero },
      managed: { parent: { low: 30, high: 40 }, worker: { low: 10, high: 15 }, jev: { low: 1, high: 2 } },
      nativeQuality: 'passed', managedQuality: 'passed', helperUsed: true })),
  } });
}
