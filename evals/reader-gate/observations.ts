import { simpleReadPaths } from '../../packages/cli/src/bulk-read.ts';
import { hash } from '@jevra/core';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const helper = (value: unknown) => value === 'bulk_read' || value === 'mcp__jevra__bulk_read' ? 'bulk_read'
  : value === 'code_context' || value === 'mcp__jevra__code_context' ? 'code_context' : 'other';

/** Allowlisted metadata only. Never retain arguments, paths, prompts, or result bodies. */
export function hostObservations(events: unknown[], limit = 128) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 128) throw new Error('invalid_observation_limit');
  const observations: RecordValue[] = [], ids = new Set<string>(); let omitted = 0;
  const add = (entry: RecordValue) => { if (observations.length < limit) observations.push({ ordinal: observations.length + 1, ...entry }); else omitted++; };
  for (const raw of events) {
    const event = record(raw), item = record(event.item);
    if (event.type === 'item.completed') {
      if (typeof item.id === 'string') { if (ids.has(item.id)) continue; ids.add(item.id); }
      if (item.type === 'command_execution') {
        const command = typeof item.command === 'string' ? item.command : '';
        add({ kind: 'native_command', readShape: simpleReadPaths(command).length ? 'simple_broad_read' : 'not_simple_broad_read',
          outputBytes: typeof item.aggregated_output === 'string' ? Buffer.byteLength(item.aggregated_output) : null,
          exitCode: typeof item.exit_code === 'number' ? item.exit_code : null });
      } else if (item.type === 'mcp_tool_call') {
        const result = record(item.result), blocks = Array.isArray(result.content) ? result.content.map(record) : [];
        const texts = blocks.filter(b => b.type === 'text' && typeof b.text === 'string');
        let outcome = 'unknown';
        if (result.isError === true || item.error) outcome = 'error';
        else for (const block of texts) {
          try { const status = record(JSON.parse(block.text as string)).status;
            if (status === 'answered' || status === 'fallback' || status === 'insufficient') { outcome = status; break; }
          } catch { /* Unstructured excerpt text has no inferred semantic outcome. */ }
        }
        add({ kind: 'helper', tool: helper(item.tool), outcome,
          outputBytes: texts.length ? texts.reduce((n, b) => n + Buffer.byteLength(b.text as string), 0) : null });
      }
    } else if (event.method === 'hook/completed' || event.type === 'hook.completed') {
      const params = record(event.params), run = record(params.run ?? params.hook);
      add({ kind: 'hook_completed', status: ['completed', 'failed', 'blocked', 'stopped'].includes(String(run.status)) ? run.status : 'unknown' });
    }
  }
  return { version: 'reader-observations/1', observations, omitted, complete: omitted === 0,
    scope: 'Completed command/MCP events and exposed hook completions only; other tool kinds are not covered. Complete means no collector truncation; absent hook events do not establish absent hook execution.' };
}

/** A configured definition is not a runnable definition; preserve missing/ambiguous states. */
export function summarizeHookList(value: unknown, expectedCommand: string, cwd: string) {
  const root = record(value); if (!Array.isArray(root.data)) throw new Error('invalid_hook_list');
  const entries = root.data.map(record).filter(e => e.cwd === cwd);
  if (entries.length !== 1 || !Array.isArray(entries[0]!.hooks)) throw new Error('ambiguous_hook_scope');
  const entry = entries[0]!;
  if (!Array.isArray(entry.errors) || !Array.isArray(entry.warnings)) throw new Error('invalid_hook_list');
  const hooks = (entry.hooks as unknown[]).map(record), matching = hooks.filter(h => h.command === expectedCommand && h.eventName === 'preToolUse');
  const current = matching.length === 1 ? matching[0]! : null;
  const knownTrust = current && ['trusted', 'managed', 'untrusted', 'modified'].includes(String(current.trustStatus));
  // The native protocol declares an opaque string, not a SHA-256 encoding.
  const definitionFingerprint = typeof current?.currentHash === 'string' && current.currentHash.length > 0 && current.currentHash.length <= 256
    ? hash(current.currentHash) : null;
  return { configuredMatches: matching.length, unrelatedDefinitions: hooks.length - matching.length,
    enabled: typeof current?.enabled === 'boolean' ? current.enabled : null,
    trustStatus: knownTrust ? current!.trustStatus : 'unknown',
    definitionFingerprint,
    warningCount: entry.warnings.length, errorCount: entry.errors.length,
    ready: Boolean(current?.enabled === true && definitionFingerprint && current.handlerType === 'command'
      && current.matcher === 'Read|Bash|exec_command' && knownTrust && ['trusted', 'managed'].includes(String(current.trustStatus))
      && entry.errors.length === 0 && hooks.length === 1),
    inferenceCalls: 0 };
}

/** Private adapter data: only server names become CLI keys; never copy provider/credential values. */
export function summarizeNativeContext(value: unknown) {
  const root = record(value), config = record(root.config);
  if (!Object.hasOwn(config, 'model_provider')) throw new Error('invalid_native_context');
  const servers = record(config.mcp_servers), names = Object.keys(servers);
  if (names.length > 64 || names.some(n => !/^[A-Za-z0-9_-]{1,128}$/.test(n))) throw new Error('invalid_native_context');
  const enabled = names.filter(n => record(servers[n]).enabled !== false);
  const providers = record(config.model_providers);
  const openai = record(providers.openai);
  const chatgptDefault = !config.chatgpt_base_url || ['https://chatgpt.com/backend-api/', 'https://chatgpt.com/backend-api'].includes(String(config.chatgpt_base_url));
  const standardOpenAiProvider = (!openai.base_url || openai.base_url === 'https://api.openai.com/v1')
    && !openai.experimental_bearer_token && (!openai.env_key || openai.env_key === 'OPENAI_API_KEY')
    && !openai.auth && (!openai.wire_api || openai.wire_api === 'responses')
    && (!config.openai_base_url || config.openai_base_url === 'https://api.openai.com/v1') && chatgptDefault;
  return { metadata: { configuredMcpServers: names.length, enabledMcpServers: enabled.length,
    onlyJevraEnabled: enabled.length === 1 && enabled[0] === 'jevra', standardOpenAiProvider },
    disableOverrides: names.map(name => `mcp_servers.${name}.enabled=false`) };
}
