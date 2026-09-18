export interface Usage { input: number | null; cacheRead: number | null; cacheWrite: number | null; output: number | null }
export interface Cost { low: number; high: number }
const number = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
export function codexCost(u: Usage, model: 'astra' | 'luna'): Cost | null {
  if (u.input === null || u.output === null || u.cacheRead === null || u.cacheRead > u.input) return null;
  const [base, cache, write, out, longOut] = model === 'astra' ? [10, 1, 25, 50, 75] : [0.2, 0.02, 0.5, 1.2, 1.8];
  return { low: ((u.input - u.cacheRead) * base! + u.cacheRead * cache! + u.output * out!) / 1e6,
    high: ((u.input - u.cacheRead) * write! + u.cacheRead * cache! * 2 + u.output * longOut!) / 1e6 };
}
export function hostMetrics(host: string, events: any[]) {
  const end = events.findLast(e => e.type === (host === 'codex' ? 'turn.completed' : 'result'));
  const failed = events.filter(e => ['turn.failed', 'error'].includes(e.type));
  const error = Boolean(end?.is_error) || failed.length > 0;
  const message = JSON.stringify(end?.is_error ? end.result : failed);
  const failure = error ? /quota|rate.?limit|usage.?limit|limit.*reached/i.test(message) ? 'rate_limited'
    : /login|logged in|auth|unauthorized/i.test(message) ? 'authentication' : 'host_error' : end ? null : 'missing_completion';
  const models = end?.modelUsage ?? {};
  const values: any[] = Object.values(models);
  const aggregate = (field: string) => values.length && values.every(m => number(m[field]) !== null)
    ? values.reduce((s, m) => s + m[field], 0) : null;
  const uncached = aggregate('inputTokens'), read = aggregate('cacheReadInputTokens'), write = aggregate('cacheCreationInputTokens');
  const usage: Usage = host === 'codex' ? { input: number(end?.usage?.input_tokens),
    cacheRead: number(end?.usage?.cached_input_tokens), cacheWrite: null, output: number(end?.usage?.output_tokens) }
    : { input: uncached !== null && read !== null && write !== null ? uncached + read + write : null,
      cacheRead: read, cacheWrite: write, output: aggregate('outputTokens') };
  const estimate = number(end?.total_cost_usd);
  const cost = host === 'codex' ? codexCost(usage, 'astra') : estimate === null ? null : { low: estimate, high: estimate };
  const tools = host === 'codex' ? events.filter(e => e.type === 'item.completed').map(e => e.item)
    : events.filter(e => e.type === 'assistant').flatMap(e => e.message?.content ?? []).filter(e => e.type === 'tool_use');
  return { usage, cost, failure, terminal: end?.subtype ?? end?.type ?? null,
    observedModel: events.find(e => e.type === 'system' && e.subtype === 'init')?.model ?? null,
    toolCalls: tools.filter(e => host !== 'codex' || ['mcp_tool_call', 'command_execution', 'file_change'].includes(e.type)).length,
    modelUsage: host === 'claude-code' ? Object.fromEntries(Object.entries(models).map(([name, raw]) => {
      const m = raw as any; return [name, { input: number(m.inputTokens), cacheRead: number(m.cacheReadInputTokens),
        cacheWrite: number(m.cacheCreationInputTokens), output: number(m.outputTokens), estimateUsd: number(m.costUSD) }];
    })) : null };
}
export function managedMetrics(arm: string, ledger: any[], generationRequested: boolean) {
  let input = 0, output = 0, cacheRead = 0, unknown = 0, jevInput = 0, jevOutput = 0, jevCalls = 0, workerCalls = 0;
  let cost: Cost = { low: 0, high: 0 };
  for (const entry of ledger) {
    const r = arm === 'jev' ? entry.receipt : entry;
    if (!r) { unknown++; continue; }
    if (arm === 'jev') {
      jevCalls += r.decisions.length;
      for (const d of r.decisions) {
        if (!d.usage) { unknown++; continue; }
        jevInput += d.usage.inputTokens; jevOutput += d.usage.outputTokens;
        cost.low += d.usage.inputTokens * 0.042 / 1e6; cost.high += d.usage.inputTokens * 0.042 / 1e6;
      }
    }
    for (const g of r.generations) {
      workerCalls += arm === 'jev' ? g.invocations ?? 0 : g.generationInvocations;
      if (!g.usage || !g.usageComplete) { unknown++; if (!g.usage) continue; }
      input += g.usage.inputTokens; output += g.usage.outputTokens;
      cacheRead += g.usage.cachedInputTokens ?? 0;
      const c = codexCost({ input: g.usage.inputTokens, output: g.usage.outputTokens,
        cacheRead: g.usage.cachedInputTokens, cacheWrite: null }, 'luna');
      if (c) { cost.low += c.low; cost.high += c.high; } else unknown++;
    }
    if (entry.status === 'started') unknown++;
  }
  if (generationRequested && !ledger.length) unknown++;
  return { worker: { input, output, cacheRead, calls: workerCalls }, jev: { input: jevInput, output: jevOutput, calls: jevCalls },
    unknownEntries: unknown, knownCost: cost, cost: unknown ? null : cost };
}
export function totalMetrics(host: ReturnType<typeof hostMetrics>, managed: ReturnType<typeof managedMetrics>) {
  return { input: host.usage.input === null || managed.unknownEntries ? null : host.usage.input + managed.worker.input + managed.jev.input,
    output: host.usage.output === null || managed.unknownEntries ? null : host.usage.output + managed.worker.output + managed.jev.output,
    cost: host.cost && managed.cost ? { low: host.cost.low + managed.cost.low, high: host.cost.high + managed.cost.high } : null };
}
