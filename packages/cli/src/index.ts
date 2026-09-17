import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { DecisionError, fallbackDecision, revision, selectSkill, withDeadline } from '@jevra/core';
import type { Decision, Event, Provider } from '@jevra/core';
import { parseCodexEvent, codexOutput } from '@jevra/adapter-codex';
import { parseClaudeEvent, claudeOutput } from '@jevra/adapter-claude-code';
import { createTypeSafeProvider } from '@jevra/provider-typesafe';
import { configPath, initializeConfig, loadConfig, readApiKey, readBoundedFile, statePath } from './config.ts';
import type { Config } from './config.ts';
import { loadCatalog } from './catalog.ts';
import type { Catalog } from './catalog.ts';
import { appendTrace, clearTraces, makeTrace } from './trace.ts';
import { bulkRead, gateBulkRead } from './bulk-read.ts';
import { serveMcp } from './mcp.ts';

export async function runEvent(event: Event, config: Config, provider: Provider, signal?: AbortSignal) {
  const started = performance.now();
  if (config.mode === 'disabled') return { output: {}, decision: null, catalog: null };
  let catalog: Catalog | null = null;
  let decision: Decision;
  try {
    catalog = await withDeadline(s => loadCatalog(config.skillRoots, config.maxSkills, s), config.timeoutMs, signal);
    // Invalid or skipped sources mean the configured catalog is not reliable enough
    // to reroute a request. Doctor exposes the details; the hook stays advisory.
    if (catalog.diagnostics.length) throw new DecisionError('catalog_unavailable');
    const elapsed = performance.now() - started;
    if (elapsed >= config.timeoutMs) throw new DecisionError('timeout');
    decision = await selectSkill({
      event, skills: catalog.skills, mode: config.mode, provider, model: config.model,
      policy: config.policy, timeoutMs: Math.max(1, config.timeoutMs - elapsed),
      maxRequestBytes: config.maxRequestBytes, ...(signal ? { signal } : {}),
      currentRevision: async deadline => {
        const current = await loadCatalog(config.skillRoots, config.maxSkills, deadline);
        if (current.diagnostics.length) throw new DecisionError('stale_state');
        return revision(event.prompt, current.skills);
      },
    });
  } catch (error) {
    decision = fallbackDecision(event, catalog?.skills ?? [],
      error instanceof DecisionError ? error.code : 'catalog_unavailable', performance.now() - started);
  }
  if (signal?.aborted) decision = { ...decision, disposition: 'fallback', reasonCode: 'cancelled', selectedCandidateId: null };
  const output = event.host === 'codex'
    ? codexOutput(decision, config.mode, catalog?.skills ?? [])
    : claudeOutput(decision, config.mode, catalog?.skills ?? []);
  if (config.traces) {
    try {
      // Tracing gets a separate bounded allowance so a decision timeout can itself
      // be observed. Filesystem work is best effort and may finish after this wait.
      await withDeadline(() => appendTrace(statePath(config), makeTrace(event, decision, config.mode,
        catalog?.skills.length ?? 0, Object.keys(output).length > 0, performance.now() - started,
        config.policy), config.retentionDays), 250);
    } catch { process.stderr.write('jevra: trace_unavailable\n'); }
  }
  if (signal?.aborted) return { output: {}, decision: { ...decision, disposition: 'fallback' as const,
    reasonCode: 'cancelled' as const, selectedCandidateId: null }, catalog };
  return { output, decision, catalog };
}

export async function readBoundedInput(stream: NodeJS.ReadableStream, limit = 65536): Promise<string> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new DecisionError('input_invalid');
    parts.push(buffer);
  }
  return Buffer.concat(parts).toString('utf8');
}

const HELP = `Jevra 0.1.0-alpha.2 — experimental skill routing and evidence selection

Commands:
  init --skills-root <directory> [--keychain-service <name>] [--config <file>]
  doctor [--config <file>]
  hook --host codex|claude-code [--config <file>]      JSON event on stdin
  evaluate --prompt-file <file> [--config <file>]    explicit local evaluation
  bulk-read --question <query> --paths <file> [--paths <file>] [--config <file>]
  code-context --spec <query> --reference <file> [--reference <file>]
  mcp --host codex|claude-code [--config <file>]    host-managed stdio tools
  clear-traces [--config <file>]

Build with npm run build, then run node dist/jevra.mjs <command>.
Configuration defaults to the user config directory; workspace config is never auto-loaded.
The default mode is observe. Set mode to advise to inject routing suggestions.
State sent to TypeSafe: the current prompt and configured skill names/descriptions/opaque IDs.
Optional bulkRead.roots permits sending requested source excerpts to TypeSafe.
Credentials: TYPESAFE_API_KEY or the explicitly configured macOS keychainService.
`;

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const isHook = argv[0] === 'hook';
  const controller = new AbortController();
  const cancel = () => controller.abort(new DecisionError('cancelled'));
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, strict: true, options: {
      config: { type: 'string' }, host: { type: 'string' }, help: { type: 'boolean' },
      'skills-root': { type: 'string', multiple: true }, 'prompt-file': { type: 'string' },
      'keychain-service': { type: 'string' },
      question: { type: 'string' }, paths: { type: 'string', multiple: true },
      spec: { type: 'string' }, reference: { type: 'string', multiple: true }, 'session-id': { type: 'string' },
    } });
    const command = positionals[0];
    if (values.help || !command) { process.stdout.write(HELP); return; }
    if (positionals.length !== 1) throw new DecisionError('input_invalid');
    const path = configPath(values.config);
    if (command === 'init') {
      await initializeConfig(path, values['skills-root'] ?? [], values['keychain-service']);
      process.stdout.write(JSON.stringify({ configPath: path, mode: 'observe' }) + '\n');
      return;
    }
    const config = await loadConfig(path);
    if (command === 'doctor') {
      const catalog = await withDeadline(s => loadCatalog(config.skillRoots, config.maxSkills, s), config.timeoutMs);
      // Credential availability is checked without reading a Keychain secret.
      process.stdout.write(JSON.stringify({ version: '0.1.0-alpha.2', configPath: path, mode: config.mode,
        model: config.model, catalog: { count: catalog.skills.length, coverage: catalog.coverage, diagnostics: catalog.diagnostics },
        credentialSource: process.env.TYPESAFE_API_KEY?.trim() ? 'environment'
          : config.keychainService && process.platform === 'darwin' ? 'keychain_configured_unverified' : 'missing',
        hookActivation: 'unknown: review the host hook manager and perform a host smoke test',
        stateDirectory: statePath(config), calibratedPolicy: false,
        bulkRead: config.bulkRead ?? 'disabled',
      }, null, 2) + '\n');
      return;
    }
    if (command === 'mcp') {
      if (values.host !== 'codex' && values.host !== 'claude-code') throw new DecisionError('input_invalid');
      await serveMcp(config, values.host, createTypeSafeProvider({ getApiKey: () => readApiKey(config) }));
      return;
    }
    if (command === 'clear-traces') {
      process.stdout.write(JSON.stringify({ removedFiles: await clearTraces(statePath(config)) }) + '\n');
      return;
    }
    if (command === 'bulk-read' || command === 'code-context') {
      if (values.host && !['codex', 'claude-code'].includes(values.host)) throw new DecisionError('input_invalid');
      const result = await bulkRead({ query: (command === 'bulk-read' ? values.question : values.spec) ?? '',
        paths: (command === 'bulk-read' ? values.paths : values.reference) ?? [], cwd: process.cwd(),
        host: values.host === 'claude-code' ? 'claude-code' : 'codex', config,
        ...(values['session-id'] ? { sessionId: values['session-id'] } : {}), signal: controller.signal,
        provider: createTypeSafeProvider({ getApiKey: () => readApiKey(config) }) });
      process.stdout.write((result.text || JSON.stringify({ status: 'fallback', reason: result.result?.reason ?? 'unavailable',
        nextAction: 'Read the relevant source ranges with native tools.' })) + '\n');
      return;
    }
    let event: Event;
    if (command === 'hook') {
      if (values.host !== 'codex' && values.host !== 'claude-code') throw new DecisionError('input_invalid');
      if (config.mode === 'disabled') { process.stdout.write('{}\n'); return; }
      const input = await withDeadline(() => readBoundedInput(process.stdin), 1000, controller.signal);
      let payload: unknown;
      try { payload = JSON.parse(input); } catch { throw new DecisionError('input_invalid'); }
      if ((payload as { hook_event_name?: string })?.hook_event_name === 'PreToolUse') {
        const output = await gateBulkRead(payload, values.host, config, resolve(process.argv[1]!), path);
        process.stdout.write(JSON.stringify(output) + '\n');
        return;
      }
      event = values.host === 'codex' ? parseCodexEvent(payload) : parseClaudeEvent(payload);
    } else if (command === 'evaluate') {
      if (!values['prompt-file']) throw new DecisionError('input_invalid');
      const input = await readBoundedFile(resolve(values['prompt-file']), 65536);
      event = parseCodexEvent({ hook_event_name: 'UserPromptSubmit', prompt: input,
        cwd: process.cwd(), session_id: 'local-evaluation', turn_id: randomUUID() });
    } else throw new DecisionError('input_invalid');
    const result = await runEvent(event, config, createTypeSafeProvider({ getApiKey: () => readApiKey(config) }), controller.signal);
    process.stdout.write(JSON.stringify(command === 'hook' ? result.output : {
      decision: result.decision, output: result.output, candidateCount: result.catalog?.skills.length ?? 0,
    }) + '\n');
  } catch (error) {
    const code = error instanceof DecisionError ? error.code : 'input_invalid';
    process.stderr.write(`jevra: ${code}\n`);
    if (isHook) process.stdout.write('{}\n');
    else process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
    // A timed-out stdin reader must not keep the short-lived hook process alive.
    if (isHook) process.stdin.destroy();
  }
}
