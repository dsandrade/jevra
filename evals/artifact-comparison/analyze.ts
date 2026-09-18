const arms = ['native', 'worker', 'jev'] as const;
const hosts = ['codex', 'claude-code'] as const;
const completeSum = (rows: any[], get: (r: any) => number | null | undefined): number | null => {
  const values = rows.map(get);
  return values.length && values.every(v => typeof v === 'number' && Number.isFinite(v))
    ? values.reduce<number>((sum, v) => sum + v!, 0) : null;
};
const change = (value: number | null, baseline: number | null) =>
  value === null || baseline === null || baseline === 0 ? null : 100 * (value / baseline - 1);

/** Descriptive pilot statistics; missing cells and unknown usage cannot pass a gate. */
export function analyze(data: any) {
  const rows: any[] = data.rows;
  const expected: string[] = data.manifest.schedule.flatMap((b: any) => b.arms.map((a: string) => `${b.host}-${b.task}-${a}`));
  const ids = rows.map(r => r.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !expected.includes(id))) throw new Error('Invalid comparison cells');
  const missing = expected.filter(id => !ids.includes(id));
  const groups = hosts.flatMap(host => arms.map(arm => {
    const cells = rows.filter(r => r.host === host && r.arm === arm);
    const successes = cells.filter(r => r.success === true).length;
    const low = completeSum(cells, r => r.total?.cost?.low), high = completeSum(cells, r => r.total?.cost?.high);
    const helperRequested = cells.filter(r => r.calls?.some((c: any) => c.name === 'generate_tests')).length;
    return { host, arm, attempted: cells.length, expected: expected.filter(id => id.startsWith(host + '-') && id.endsWith('-' + arm)).length,
      successful: successes, helperRequested, acceptedArtifactApplied: cells.filter(r => r.acceptedArtifactApplied).length,
      successfulWithoutAcceptedArtifact: cells.filter(r => r.success && !r.acceptedArtifactApplied).length,
      input: completeSum(cells, r => r.total?.input), output: completeSum(cells, r => r.total?.output),
      hostInput: completeSum(cells, r => r.hostMetrics?.usage?.input), hostCacheRead: completeSum(cells, r => r.hostMetrics?.usage?.cacheRead),
      workerCalls: completeSum(cells, r => r.managedMetrics?.worker?.calls), jevCalls: completeSum(cells, r => r.managedMetrics?.jev?.calls),
      durationMs: completeSum(cells, r => r.durationMs), cost: low === null || high === null ? null : { low, high },
      costPerSuccess: successes && low !== null && high !== null ? { low: low / successes, high: high / successes } : null,
      incompleteAccounting: cells.some(r => r.accountingIncomplete || r.total?.input == null || r.total?.output == null || r.total?.cost == null) };
  }));
  const paired = rows.filter(r => r.arm !== 'native').map(r => {
    const baseline = rows.find(b => b.host === r.host && b.task === r.task && b.arm === 'native');
    return { id: r.id, baselinePresent: Boolean(baseline), qualityLoss: baseline ? baseline.success && !r.success : null,
      inputChangePct: change(r.total?.input ?? null, baseline?.total?.input ?? null),
      outputChangePct: change(r.total?.output ?? null, baseline?.total?.output ?? null),
      latencyChangePct: change(r.durationMs ?? null, baseline?.durationMs ?? null),
      upperCostChangePct: change(r.total?.cost?.high ?? null, baseline?.total?.cost?.high ?? null),
      robustScenarioSaving: r.total?.cost && baseline?.total?.cost ? r.total.cost.high < baseline.total.cost.low : null };
  });
  const gates = groups.filter(g => g.arm !== 'native').map(g => {
    const baseline = groups.find(b => b.host === g.host && b.arm === 'native')!;
    const full = g.attempted === g.expected && baseline.attempted === baseline.expected;
    const noQualityLoss = full && !paired.some(p => p.id.startsWith(g.host + '-') && p.id.endsWith('-' + g.arm) && p.qualityLoss);
    const accounting = full && !g.incompleteAccounting && !baseline.incompleteAccounting;
    const cost = Boolean(g.cost && baseline.cost && g.cost.high <= baseline.cost.high * 0.8);
    const latency = g.durationMs !== null && baseline.durationMs !== null && g.durationMs <= baseline.durationMs * 1.5;
    return { host: g.host, arm: g.arm, noQualityLoss, fullAccounting: accounting, costScreen: cost, latencyScreen: latency,
      qualifiesForLargerTest: noQualityLoss && accounting && cost && latency,
      inputChangePct: change(g.input, baseline.input), latencyChangePct: change(g.durationMs, baseline.durationMs),
      upperCostChangePct: change(g.cost?.high ?? null, baseline.cost?.high ?? null),
      robustScenarioSaving: Boolean(full && g.cost && baseline.cost && g.cost.high < baseline.cost.low) };
  });
  // Explicit allowlist: omit receipts, paths, prompts, account identifiers and raw events.
  const cells = rows.map(r => ({ id: r.id, host: r.host, task: r.task, arm: r.arm, status: r.status,
    success: r.success, failure: r.failure ?? null, hostVersion: r.hostVersion, configuredModel: r.configuredModel,
    durationMs: r.durationMs ?? null, judgeDurationMs: r.judgeDurationMs ?? null, sourceUnchanged: r.sourceUnchanged ?? null,
    acceptedArtifactApplied: r.acceptedArtifactApplied ?? false, outputHash: r.outputHash ?? null,
    stagedCandidateMatched: Boolean(r.outputHash && r.ledger?.some((e: any) => (e.receipt ?? e).candidateHash === r.outputHash)),
    coverage: r.quality?.coverage ?? null, qualityPassed: r.quality?.passed ?? false,
    coverageEstablished: Boolean(r.quality?.validation?.checks?.some((c: any) => c.kind === 'syntax_policy' && c.outcome === 'passed')),
    checks: (r.quality?.validation?.checks ?? []).map((c: any) => ({ kind: c.kind, outcome: c.outcome,
      reason: c.reason, tests: c.tests, failures: c.failures })),
    toolCalls: r.calls ?? [], hostMetrics: r.hostMetrics ?? null, managedMetrics: r.managedMetrics ?? null,
    total: r.total ?? null, managedOutcomes: (r.ledger ?? []).map((e: any) => ({ status: e.status, reason: e.reason,
      deliveryFailure: e.deliveryFailure ?? null, generations: (e.receipt ?? e).generations?.length ?? 0,
      validation: e.receipt?.validation ?? null,
      decisions: (e.receipt?.decisions ?? []).map((d: any) => ({ stage: d.stage, status: d.status, reason: d.reason,
        requirementCount: Object.keys(d.answers ?? {}).filter(k => k.startsWith('requirement_')).length,
        continuation: d.answers?.continuation ? { choice: d.answers.continuation.choice,
          confidence: d.answers.continuation.confidence } : null })) })),
    actualBilledUsd: null, subscriptionAllowance: null }));
  return { schemaVersion: 1, protocolHash: data.manifest.hashes['evals/artifact-comparison/protocol.md'],
    provenance: { startedAt: data.manifest.timestamp, runtime: data.manifest.runtime,
    sourceHashes: data.manifest.hashes, skillHash: data.manifest.skillHash, schedule: data.manifest.schedule },
    attempted: rows.length, expected: expected.length, missing, stopReason: data.stopReason,
    groups, paired, gates, cells };
}
