export function hostMetrics(host: string, events: any[]) {
  if (host === 'codex') {
    const usage = events.findLast(e => e.type === 'turn.completed')?.usage ?? null;
    const items = events.filter(e => e.type === 'item.completed').map(e => e.item);
    const input = usage?.input_tokens ?? null, cached = usage?.cached_input_tokens ?? null, output = usage?.output_tokens ?? null;
    const costLow = input !== null && cached !== null && output !== null ? ((input - cached) * 10 + cached + output * 50) / 1e6 : null;
    const costHigh = input !== null && cached !== null && output !== null ? ((input - cached) * 12.5 + cached + output * 50) / 1e6 : null;
    return { model: 'gpt-6-astra', effort: 'xhigh', usage,
      totalInputTokens: input, totalOutputTokens: output, cachedInputTokens: cached,
      costEstimateUsdLow: costLow, costEstimateUsdHigh: costHigh,
      costBasis: 'standard API-equivalent bounds; cache-write count unavailable; assumes each request below 272k context',
      helperInvocations: items.filter(i => (i.type === 'command_execution' && /(?:bulk-read|code-context)/.test(i.command ?? ''))
        || (i.type === 'mcp_tool_call' && /(?:bulk_read|code_context)/.test(i.tool ?? ''))).length,
      toolCalls: items.filter(i => ['command_execution', 'file_change', 'mcp_tool_call'].includes(i.type)).length,
      editCalls: items.filter(i => i.type === 'file_change').length,
      testCommands: items.filter(i => i.type === 'command_execution' && /(?:node.*--test|npm test|npm run test)/.test(i.command ?? '')).length,
      terminalResult: events.findLast(e => ['turn.completed', 'turn.failed', 'error'].includes(e.type))?.type ?? null,
      failure: events.filter(e => ['turn.failed', 'error'].includes(e.type)).map(e => JSON.stringify(e)).join(' ').slice(0, 1000) || null,
    };
  }
  const end = events.findLast(e => e.type === 'result');
  const init = events.find(e => e.type === 'system' && e.subtype === 'init');
  const models = end?.modelUsage ?? null;
  const usage = end?.usage ?? null;
  const modelValues: any[] = models ? Object.values(models) : [];
  const calls = events.filter(e => e.type === 'assistant').flatMap(e => e.message?.content ?? []).filter(x => x.type === 'tool_use');
  return { model: init?.model ?? null, effort: 'high', usage, modelUsage: models,
    totalInputTokens: models ? modelValues.reduce((s, m) => s + m.inputTokens + m.cacheReadInputTokens + m.cacheCreationInputTokens, 0) : null,
    totalOutputTokens: models ? modelValues.reduce((s, m) => s + m.outputTokens, 0) : null,
    cachedInputTokens: models ? modelValues.reduce((s, m) => s + m.cacheReadInputTokens, 0) : null,
    costEstimateUsdLow: end?.total_cost_usd ?? null, costEstimateUsdHigh: end?.total_cost_usd ?? null,
    costBasis: 'Claude CLI client-side list-price estimate including auxiliary models; not subscription billing',
    helperInvocations: calls.filter(t => (t.name === 'Bash' && /(?:bulk-read|code-context)/.test(t.input?.command ?? '')) || /^mcp__jevra__(bulk_read|code_context)$/.test(t.name)).length,
    toolCalls: calls.length, editCalls: calls.filter(t => ['Edit', 'Write'].includes(t.name)).length,
    testCommands: calls.filter(t => t.name === 'Bash' && /(?:node.*--test|npm test|npm run test)/.test(t.input?.command ?? '')).length,
    terminalResult: end?.subtype ?? null, failure: end?.is_error ? String(end?.result ?? end?.errors ?? 'host_error').slice(0, 1000) : null,
  };
}
