export const components = ['parent', 'worker', 'managed_jev', 'routing_hook'] as const;
export type Component = typeof components[number];
export interface Invocation {
  id: string; component: Component; status: 'started' | 'completed' | 'failed'; usageComplete?: boolean;
  // Input is gross: includes cache reads/creation once. Unknown cache is not zero.
  usage: { input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null } | null;
}
const valid = (n: number | null) => n !== null && Number.isSafeInteger(n) && n >= 0;
/** Trusted harness call counts, never model-supplied declarations of non-invocation. */
export function wholeTaskUsage(entries: Invocation[], expectedCalls: Record<Component, number | null>) {
  const ids = new Set<string>();
  for (const e of entries) {
    if (!components.includes(e.component) || !['started', 'completed', 'failed'].includes(e.status) || ids.has(e.id) || !e.id) throw new Error('invalid_or_duplicate_invocation');
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
    const unknownCalls = calls.filter(e => e.status === 'started' || e.usageComplete === false || !e.usage
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

const count = (n: unknown): number | null => typeof n === 'number' && valid(n) ? n : null;
/** Codex input already includes cached tokens. Never add cached input a second time. */
export function codexUsage(u: { inputTokens: number; outputTokens: number; cachedInputTokens: number | null } | null): Invocation['usage'] {
  if (!u) return null;
  return { input: count(u.inputTokens), output: count(u.outputTokens), cacheRead: count(u.cachedInputTokens), cacheWrite: null };
}
/** Claude input_tokens is uncached input; cache read and creation must each be included once. */
export function claudeUsage(u: { input_tokens?: unknown; output_tokens?: unknown; cache_read_input_tokens?: unknown;
  cache_creation_input_tokens?: unknown } | null): Invocation['usage'] {
  if (!u) return null;
  const uncached = count(u.input_tokens), read = count(u.cache_read_input_tokens), write = count(u.cache_creation_input_tokens);
  return { input: uncached !== null && read !== null && write !== null ? uncached + read + write : null,
    output: count(u.output_tokens), cacheRead: read, cacheWrite: write };
}
export function jevUsage(u: { input_tokens: number; output_tokens: number } | null): Invocation['usage'] {
  return u ? { input: count(u.input_tokens), output: count(u.output_tokens), cacheRead: null, cacheWrite: null } : null;
}
export interface Reservation { id: string; component: Component }
/** Reconcile runtime dispatch reservations with final journals. Missing/failed hooks cannot disappear. */
export function reconcileInvocations(reservations: Reservation[], journals: Invocation[],
  unknownComponents: Component[] = []) {
  if (reservations.some(r => !r.id || !components.includes(r.component)) || unknownComponents.some(c => !components.includes(c))) throw new Error('invalid_reservation');
  if (new Set(reservations.map(r => r.id)).size !== reservations.length) throw new Error('duplicate_reservation');
  if (new Set(journals.map(j => j.id)).size !== journals.length) throw new Error('duplicate_journal');
  for (const j of journals) if (!reservations.some(r => r.id === j.id && r.component === j.component)) throw new Error('unreserved_invocation');
  const entries = reservations.map(r => journals.find(j => j.id === r.id) ?? { ...r, status: 'started' as const, usage: null });
  const expected = Object.fromEntries(components.map(c => [c, unknownComponents.includes(c) ? null : reservations.filter(r => r.component === c).length])) as Record<Component, number | null>;
  return wholeTaskUsage(entries, expected);
}
