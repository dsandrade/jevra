import { stripTypeScriptTypes } from 'node:module';
import { parse } from 'acorn';
import { validatePureModule, validateTestModule } from '../../packages/cli/src/test-policy.ts';
import { coversCases } from '../artifact-comparison/judge.ts';
import type { Workload } from './fixtures.ts';

/** Inspect syntax without executing rejected code or returning identifiers, values or snippets. */
export function inspectOutput(task: Workload, content: string | null, sourceUnchanged: boolean) {
  const unknown = (category: string) => ({ category, profileAdmitted: false, functionalCorrectness: 'unknown',
    coverage: null, syntaxKinds: {} as Record<string, number>, syntaxKindsTruncated: false });
  if (!sourceUnchanged) return unknown('source_changed');
  if (content === null || content.length === 0) return unknown('missing_output');
  if (Buffer.byteLength(content) > 32768) return unknown('oversized_output');
  let ast: unknown;
  try { ast = parse(stripTypeScriptTypes(content, { mode: 'strip' }), { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch (error) {
    return unknown((error as NodeJS.ErrnoException).code === 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX'
      ? 'unsupported_typescript' : error instanceof SyntaxError ? 'invalid_syntax' : 'parser_failure');
  }
  const counts: Record<string, number> = {}, pending: unknown[] = [ast]; let visited = 0;
  while (pending.length && visited < 4096) {
    const next = pending.pop();
    if (!next || typeof next !== 'object') continue;
    if (Array.isArray(next)) { pending.push(...next); continue; }
    const value = next as Record<string, unknown>;
    if (typeof value.type === 'string') { counts[value.type] = (counts[value.type] ?? 0) + 1; visited++; }
    pending.push(...Object.values(value).filter(v => v !== null && typeof v === 'object'));
  }
  let admitted;
  try { admitted = validateTestModule(content, task.sourceName, task.exportName, validatePureModule(task.source, task.exportName)); }
  catch { return { ...unknown('profile_inspection_failure'), syntaxKinds: counts, syntaxKindsTruncated: pending.length > 0 }; }
  return { category: admitted.valid ? 'admitted' : admitted.reason, profileAdmitted: admitted.valid,
    functionalCorrectness: 'unknown', coverage: admitted.valid ? coversCases(task, content) : null,
    syntaxKinds: counts, syntaxKindsTruncated: pending.length > 0 };
}
