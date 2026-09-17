import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DecisionError, hash, withDeadline } from '@jevra/core';
import type { Host, Provider } from '@jevra/core';
import { readBoundedFile, statePath } from './config.ts';
import type { Config } from './config.ts';
import { runContext } from './context.ts';
import { appendTrace } from './trace.ts';

export const quoteArgument = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

export async function approvedSource(path: string, cwd: string, roots: string[]): Promise<string> {
  const absolute = resolve(cwd, path);
  const canonical = await realpath(absolute);
  if (canonical !== absolute) throw new DecisionError('catalog_unavailable');
  for (const root of roots) {
    const base = await realpath(root);
    const rel = relative(base, canonical);
    if (rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep))) return canonical;
  }
  throw new DecisionError('catalog_unavailable');
}

/** Interpret simple read invocations only; never execute or expand shell text. */
export function simpleReadPaths(command: string): string[] {
  if (/[|><;&`$()\n\r]/.test(command)) return [];
  const tokens: string[] = [];
  let remaining = command.trim();
  while (remaining) {
    const match = /^("[^"\n]*"|'[^'\n]*'|[^\s"'\\]+)(?:\s+|$)/.exec(remaining);
    if (!match) return [];
    tokens.push(match[1]!);
    remaining = remaining.slice(match[0].length);
  }
  if (!['cat', 'head', 'tail', 'less', 'more'].includes(tokens[0] ?? '')) return [];
  const args = tokens.slice(1);
  if (['head', 'tail'].includes(tokens[0]!) && args.some(t => t.startsWith('-'))) return [];
  return args.filter(t => !t.startsWith('-')).map(t => /^(["']).*\1$/.test(t) ? t.slice(1, -1) : t)
    .filter(t => t !== '-' && !/[\\*?\[\]{}~]/.test(t));
}

const toolEventSchema = z.object({ hook_event_name: z.literal('PreToolUse'), session_id: z.string().max(256),
  cwd: z.string().max(4096).refine(isAbsolute), tool_name: z.string().max(256),
  tool_use_id: z.string().max(256).optional(), tool_input: z.record(z.string(), z.unknown()) });

export async function gateBulkRead(payload: unknown, host: Host, config: Config, cliPath: string, configFile: string) {
  if (!config.bulkRead || config.mode === 'disabled') return {};
  const event = toolEventSchema.safeParse(payload);
  if (!event.success) return {};
  const data = event.data;
  let paths: string[] = [];
  if (data.tool_name === 'Read') {
    if (data.tool_input.offset !== undefined || data.tool_input.limit !== undefined) return {};
    if (typeof data.tool_input.file_path === 'string') paths = [data.tool_input.file_path];
  } else if (['Bash', 'exec_command'].includes(data.tool_name)) {
    const command = data.tool_input.command ?? data.tool_input.cmd;
    if (typeof command === 'string') paths = simpleReadPaths(command);
  }
  if (!paths.length || paths.length > 16) return {};
  try {
    const large: { path: string; lines: number }[] = [];
    await withDeadline(async () => {
      for (const path of paths) {
        const source = await approvedSource(path, data.cwd, config.bulkRead!.roots);
        const content = await readBoundedFile(source, config.bulkRead!.maxFileBytes);
        const lines = content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
        if (lines > config.bulkRead!.minLines) large.push({ path: source, lines });
      }
    }, 500);
    if (!large.length) return {};
    const redirect = config.mode === 'advise';
    if (config.traces) {
      try { await withDeadline(() => appendTrace(statePath(config), {
        schemaVersion: 1, timestamp: new Date().toISOString(), module: 'bulk-read-gate', host,
        sessionHash: hash(data.session_id), eventHash: hash([data.session_id, data.tool_use_id ?? randomUUID()]),
        action: redirect ? 'redirect' : 'observe', sourceCount: large.length,
        maxLines: Math.max(...large.map(p => p.lines)), evaluationAttempts: 0,
      }, config.retentionDays), 250); } catch { process.stderr.write('jevra: trace_unavailable\n'); }
    }
    if (!redirect) return {};
    const invocation = [process.execPath, cliPath, 'bulk-read', '--host', host, '--config', configFile,
      '--session-id', data.session_id, ...large.flatMap(p => ['--paths', p.path])].map(quoteArgument).join(' ');
    const instruction = config.bulkRead.transport === 'mcp'
      ? `For this broad read, call the Jevra bulk_read MCP tool with ${JSON.stringify({ paths: large.map(p => p.path), sessionId: data.session_id })} and a focused question. `
      : `For this broad read, use the bulk-reader skill or run ${invocation} --question '<the focused question you need answered>'. `;
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny',
      permissionDecisionReason: `Jevra bulk reader: ${large.length} file(s) exceed ${config.bulkRead.minLines} lines. `
        + instruction
        + 'The helper returns exact excerpts with line numbers for you to interpret. '
        + 'After retrieval, use native targeted reads with offset/limit or a bounded range for exact edits, debugging, or missing evidence. If the helper is unavailable, fall back to native targeted reads.' } };
  } catch { return {}; }
}

export async function bulkRead(options: {
  query: string; paths: string[]; cwd: string; host: Host; sessionId?: string;
  config: Config; provider: Provider; signal?: AbortSignal;
}) {
  const settings = options.config.bulkRead;
  if (!settings || options.config.mode === 'disabled') throw new DecisionError('config_invalid');
  if (!options.query.trim() || options.query.length > 16384 || !options.paths.length || options.paths.length > 16) {
    throw new DecisionError('input_invalid');
  }
  const sources = await Promise.all(options.paths.map(p => approvedSource(p, options.cwd, settings.roots)));
  const { roots: _roots, minLines: _minLines, transport: _transport, ...context } = settings;
  return runContext({ host: options.host, sessionId: options.sessionId ?? 'standalone', eventId: randomUUID(),
    turnId: null, prompt: options.query, cwd: options.cwd },
  { ...options.config, mode: 'advise', context: { ...context, sources } }, options.provider, options.signal);
}
