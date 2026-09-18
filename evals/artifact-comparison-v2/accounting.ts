export const components = ['parent', 'worker', 'managed_jev', 'routing_hook'] as const;
export type Component = typeof components[number];
export interface Invocation {
  id: string; component: Component; status: 'started' | 'completed' | 'failed';
  // Input is gross: includes cache reads/creation once. Unknown cache is not zero.
  usage: { input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null } | null;
}
const valid = (n: number | null) => n !== null && Number.isSafeInteger(n) && n >= 0;
/** Trusted harness call counts, never model-supplied declarations of non-invocation. */
export function wholeTaskUsage(entries: Invocation[], expectedCalls: Record<Component, number | null>) {
  const ids = new Set<string>();
  for (const e of entries) {
    if (!components.includes(e.component) || ids.has(e.id) || !e.id) throw new Error('invalid_or_duplicate_invocation');
    ids.add(e.id);
    if (e.usage) {
      const u = e.usage;
      if (Object.values(u).some(n => n !== null && !valid(n)) || u.input !== null
        && ((u.cacheRead ?? 0) + (u.cacheWrite ?? 0) > u.input)) throw new Error('invalid_usage');
    }
  }
  const componentRows = components.map(component => {
    const calls = entries.filter(e => e.component === component), expected = expectedCalls[component];
    if (expected !== null && !valid(expected)) throw new Error('invalid_expected_count');
    const countReconciled = expected !== null && calls.length === expected && (component !== 'parent' || expected > 0);
    const unknownCalls = calls.filter(e => e.status === 'started' || !e.usage
      || e.usage.input === null || e.usage.output === null).length;
    return { component, observedCalls: calls.length, expectedCalls: expected, countReconciled, unknownCalls,
      knownInput: calls.reduce((n, e) => n + (e.usage?.input ?? 0), 0),
      knownOutput: calls.reduce((n, e) => n + (e.usage?.output ?? 0), 0),
      knownCacheRead: calls.reduce((n, e) => n + (e.usage?.cacheRead ?? 0), 0),
      knownCacheWrite: calls.reduce((n, e) => n + (e.usage?.cacheWrite ?? 0), 0),
      unknownCacheCalls: calls.filter(e => !e.usage || e.usage.cacheRead === null || e.usage.cacheWrite === null).length };
  });
  const complete = componentRows.every(c => c.countReconciled && c.unknownCalls === 0);
  const knownInput = componentRows.reduce((n, c) => n + c.knownInput, 0);
  const knownOutput = componentRows.reduce((n, c) => n + c.knownOutput, 0);
  return { complete, components: componentRows, knownInput, knownOutput,
    input: complete ? knownInput : null, output: complete ? knownOutput : null,
    totalTokens: complete ? knownInput + knownOutput : null,
    apiEquivalentUsd: null, actualBilledUsd: null, subscriptionUsage: null };
}
