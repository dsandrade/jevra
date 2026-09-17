import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const { values } = parseArgs({ options: {
  input: { type: 'string', default: 'evals/local-results/full-task-mcp-final/results.json' },
  output: { type: 'string', default: 'evals/reports/2026-09-17-full-task-pilot' },
} });
const implementationRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const source = JSON.parse(await readFile(resolve(values.input!), 'utf8'));
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), half = Math.floor(sorted.length / 2);
  return sorted.length ? sorted.length % 2 ? sorted[half]! : (sorted[half - 1]! + sorted[half]!) / 2 : null;
};
const sumKnown = (rows: any[], key: string) => rows.every(r => typeof r[key] === 'number' && Number.isFinite(r[key]))
  ? rows.reduce((sum, r) => sum + r[key], 0) : null;
// Publish only synthetic task metrics; never raw host streams, paths, identities or error bodies.
const rows = source.rows.map((r: any) => ({
  id: r.id, host: r.host, arm: r.arm, task: r.task, repetition: r.repetition, hostVersion: r.hostVersion,
  model: r.model, effort: r.effort, durationMs: r.durationMs, exitCode: r.exitCode, timedOut: r.timedOut,
  taskCompleted: r.taskCompleted, quality: r.quality, totalInputTokens: r.totalInputTokens,
  totalOutputTokens: r.totalOutputTokens, cachedInputTokens: r.cachedInputTokens,
  costEstimateUsdLow: r.costEstimateUsdLow, costEstimateUsdHigh: r.costEstimateUsdHigh,
  totalEstimateUsdLow: r.totalEstimateUsdLow, totalEstimateUsdHigh: r.totalEstimateUsdHigh,
  actualBilledUsd: null, toolCalls: r.toolCalls, editCalls: r.editCalls, testCommands: r.testCommands,
  terminalResult: r.terminalResult, failure: r.timedOut ? 'host_timeout' : r.failure ? 'host_error' : null,
  redirects: r.redirects, helperInvocations: r.helperInvocations, helperCalls: r.helperCalls,
  untracedHelperCalls: r.untracedHelperCalls, helperOutcomes: r.helperOutcomes, jev: r.jev,
}));
const summaries: any[] = [];
for (const host of ['codex', 'claude-code']) for (const arm of ['native', 'deterministic', 'jev']) {
  const group = rows.filter((r: any) => r.host === host && r.arm === arm);
  if (!group.length) continue;
  summaries.push({ host, arm, runs: group.length, completed: group.filter((r: any) => r.taskCompleted).length,
    checksPassed: group.reduce((s: number, r: any) => s + r.quality.checks.filter((c: any) => c.passed).length, 0),
    checksTotal: group.reduce((s: number, r: any) => s + r.quality.checks.length, 0),
    medianDurationMs: median(group.map((r: any) => r.durationMs)),
    inputTokens: sumKnown(group, 'totalInputTokens'), outputTokens: sumKnown(group, 'totalOutputTokens'),
    cachedInputTokens: sumKnown(group, 'cachedInputTokens'),
    estimateUsdLow: sumKnown(group, 'totalEstimateUsdLow'), estimateUsdHigh: sumKnown(group, 'totalEstimateUsdHigh'),
    redirects: sumKnown(group, 'redirects'), helperCalls: sumKnown(group, 'helperCalls'),
    jevAttempts: group.reduce((s: number, r: any) => s + r.jev.attempts, 0),
    successfulHelperRuns: group.filter((r: any) => r.helperOutcomes.some((o: any) => o.reason === 'selected')).length,
  });
}
const decisions = ['codex', 'claude-code'].map(host => {
  const native = summaries.find(s => s.host === host && s.arm === 'native');
  const deterministic = summaries.find(s => s.host === host && s.arm === 'deterministic');
  const jev = summaries.find(s => s.host === host && s.arm === 'jev');
  if (!native || !deterministic || !jev) return { host, promotion: false, reason: 'incomplete_arms' };
  const savingsLow = jev.estimateUsdHigh !== null && native.estimateUsdLow > 0 ? 1 - jev.estimateUsdHigh / native.estimateUsdLow : null;
  const savingsHigh = jev.estimateUsdLow !== null && native.estimateUsdHigh > 0 ? 1 - jev.estimateUsdLow / native.estimateUsdHigh : null;
  const incrementalSavingsLow = jev.estimateUsdHigh !== null && deterministic.estimateUsdLow > 0 ? 1 - jev.estimateUsdHigh / deterministic.estimateUsdLow : null;
  const latencyChange = jev.medianDurationMs / native.medianDurationMs - 1;
  const checks = { plannedRuns: native.runs === 4 && deterministic.runs === 4 && jev.runs === 4,
    quality: jev.completed === jev.runs && jev.completed / jev.runs >= native.completed / native.runs
      && jev.completed / jev.runs >= deterministic.completed / deterministic.runs,
    helperUsed: jev.successfulHelperRuns === jev.runs, cost: savingsLow !== null && savingsLow >= 0.15, latency: latencyChange <= 0.15 };
  return { host, savingsLow, savingsHigh, incrementalSavingsLow, latencyChange, checks, promotion: Object.values(checks).every(Boolean) };
});
const reviewed = { implementationRevision, kind: 'shunt-full-task-pilot', expectedRuns: source.expectedRuns, attemptedRuns: rows.length, repetitions: source.repetitions ?? null, transport: source.transport ?? 'cli-only',
  interruptedRuns: (source.interruptedRuns ?? []).map((r: any) => ({ id: r.id, host: r.host, status: r.status, usage: null, actualBilledUsd: null })),
  abortReason: source.abortReason, codeHash: source.codeHash, fixtureHash: source.fixtureHash, protocolHash: source.protocolHash,
  actualBilledUsd: null, summaries, decisions, rows };
await writeFile(resolve(values.output! + '.json'), JSON.stringify(reviewed, null, 2) + '\n');
const dollars = (low: number | null, high: number | null) => low === null || high === null ? 'unknown' : low === high ? `$${low.toFixed(4)}` : `$${low.toFixed(4)}–$${high.toFixed(4)}`;
const pct = (n: number | null | undefined) => n === null || n === undefined ? 'unknown' : `${(n * 100).toFixed(1)}%`;
const interpretations = ['codex', 'claude-code'].flatMap(host => {
  const native = summaries.find(s => s.host === host && s.arm === 'native');
  const jev = summaries.find(s => s.host === host && s.arm === 'jev');
  if (!native || !jev) return [];
  const change = (key: string) => native[key] > 0 && jev[key] !== null ? jev[key] / native[key] - 1 : null;
  return [`${host}: Jev-arm host input-token change ${pct(change('inputTokens'))}; output-token change ${pct(change('outputTokens'))}. Matched low/high price-assumption cost changes are ${pct(change('estimateUsdLow'))} / ${pct(change('estimateUsdHigh'))} (positive means higher cost). Successful helper use: ${jev.successfulHelperRuns}/${jev.runs} Jev tasks. Independent per-arm price bounds are wider and appear below.`, ''];
});
const lines = [
  '# Shunt-style full-task pilot — 2026-09-17', '',
  '**Decision: keep the reading module opt-in.** This report separates successful coding tasks, helper adoption and API-equivalent cost. It does not claim lower subscription charges or production savings.', '',
  `Attempted ${rows.length}/${source.expectedRuns} planned runs. Two synthetic coding tasks, ${source.repetitions ?? "unrecorded"} ${source.repetitions === 1 ? "repetition" : "repetitions"}, three arms and two independently measured hosts. The [protocol](../full-task/protocol.md) records the predeclared transport revision and reduced development sample before this comparison; diagnostic wiring pilots are separate. [Sanitized per-run data](2026-09-17-full-task-pilot.json).`, '',
  `Implementation: [${implementationRevision.slice(0, 7)}](https://github.com/dsandrade/jevra/commit/${implementationRevision}). The JSON pins the built CLI, fixture and protocol hashes. Reproduce with Node 24.21.0, npm ci, npm run build, then node evals/full-task/run.ts --repetitions 1 --keychain-service your-typesafe-key-service from that revision.`, '',
  '## Results', '',
  '| Host | Arm | Completed | External checks | Median seconds | Host input / output tokens | Estimated total USD | Redirects / helper calls |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...summaries.map(s => `| ${s.host} | ${s.arm} | ${s.completed}/${s.runs} | ${s.checksPassed}/${s.checksTotal} | ${(s.medianDurationMs / 1000).toFixed(1)} | ${s.inputTokens ?? 'unknown'} / ${s.outputTokens ?? 'unknown'} | ${dollars(s.estimateUsdLow, s.estimateUsdHigh)} | ${s.redirects} / ${s.helperCalls} |`), '',
  'Costs sum observed whole-run host estimates plus known Jev usage. Input includes cached input; cache counts remain separate in JSON. Missing usage stays unknown, including untraced helper invocations. Compare arms within one host, not host prices against each other.', '',
  `${rows.filter((r: any) => r.taskCompleted).length}/${rows.length} tasks completed successfully; ${summaries.reduce((n, s) => n + s.checksPassed, 0)}/${summaries.reduce((n, s) => n + s.checksTotal, 0)} external checks passed.`, '',
  ...interpretations,
  'Compact helper output does not guarantee fewer subsequent source reads or lower total cost. Task path, output generation and cache mix vary; this small sample does not establish a general causal effect or lower subscription quota usage.', '',
  '## Predeclared gates', '',
  ...decisions.flatMap(d => [`${d.host}: promotion **${d.promotion ? 'passes the pilot gates only' : 'fails'}**. Estimated savings versus native range from ${pct(d.savingsLow)} to ${pct(d.savingsHigh)}; negative savings mean higher cost. Median latency change: ${pct(d.latencyChange)}. Conservative savings versus deterministic: ${pct(d.incrementalSavingsLow)}. Gate results: ${d.checks ? Object.entries(d.checks).map(([k, v]) => `${k}=${v ? 'pass' : 'fail'}`).join(', ') : d.reason}.`, '']), '',
  'The helper-use gate prevents attributing native fallback behavior to Jev. A large-read denial does not establish semantic delegation. Even a passing pilot gate would require broader independent evidence before a global default change.', '',
  '## Method and scope', '',
  '- Retry policy: 32 external checks per run, including attempt limits, safety, transient exclusions, server hints and precedence.',
  '- Retention policy: 18 checks per run, including exact age boundaries, legal hold, active sessions, newest-report ties and input immutability.',
  '- Main LLMs generate code and visible tests. The external checker lives outside their workspace and has independent known-good/known-bad validation.',
  '- Native, deterministic BM25 and Jev selection share task prompts and clean repositories. The two active arms share the read gate, host-managed MCP helper and output format. Native registers no Jevra MCP tools; their catalog overhead counts against active arms. No prompt-context injection or auxiliary generator is used.',
  '- Codex uses `gpt-6-astra`, xhigh; Claude uses `claude-sonnet-5`, high. Versions are recorded per run. Hooks are isolated direct command hooks with only the Jevra MCP server in active arms; plugin marketplace lifecycle and normal skill discovery are not measured.',
  '- Order rotates by task/repetition. Provider caches are observed, not controlled cold. Models may take different paths, ignore the helper, or use targeted reads. All attempted final runs remain in this report.',
  '- Deadlines are 300 seconds per task, an eight-second Jev helper limit, and a $2 Claude client-estimated task cap. Only one task per host runs at a time.', '',
  '## Pricing and accounting', '',
  `The final comparison recorded ${rows.reduce((n: number, r: any) => n + r.jev.attempts, 0)} Jev evaluation attempts. Their observed input usage totals ${rows.reduce((n: number, r: any) => n + r.jev.observedInputTokens, 0)} tokens; the sum of known Jev estimates is $${rows.reduce((n: number, r: any) => n + (r.jev.estimateUsd ?? 0), 0).toFixed(6)}. Unknown attempts, if any, are not included in that observed subtotal. The host-model cost is the dominant component here.`, '',
  'Codex figures use [documented GPT-6 Astra Standard API prices](https://developers.openai.com/api/docs/models/gpt-6-astra): $10/M uncached input, $1/M cached input and $50/M output. Because cache-write counts are unavailable, the upper bound prices uncached input at $12.50/M. This assumes every individual request stays below the 272K long-context threshold; cumulative turn input is not context length. No Fast rate is assumed.', '',
  'Claude figures use the [headless CLI](https://code.claude.com/docs/en/headless) result’s `total_cost_usd`, including reported auxiliary model usage. These are client-side list-price estimates, not Pro charges. Jev uses [the documented model rate](https://docs.typesafe.ai/models) of $0.042/M input with output free. Actual billed USD and subscription quota savings are unavailable for every arm.', '',
  '## Wiring diagnostics and limitations', '',
  'Before the frozen comparison, the first two-run wiring pilot found inherited Codex skills and a 180-second timeout; Claude passed through targeted reads. After isolating skills, allowing the helper in fixture instructions, initializing Git and extending the deadline, a second two-run pilot completed in both hosts. Codex invoked the CLI helper but its tool-shell sandbox could not read Keychain; Claude chose targeted reads. Separately, a direct live helper check exposed a Score rounding validation defect, which was fixed with a regression test. The CLI-only comparison was then interrupted after 10 completed and two interrupted runs when the credential boundary became clear. [Preserved CLI-only metrics](2026-09-17-cli-only-interrupted.json) remain separate; interrupted host usage is unknown.', '',
  'An initial MCP comparison then stopped after eight completed runs because its gate still advertised the shell fallback. Codex selected that alternative despite MCP being connected. [These stopped-run metrics](2026-09-17-mixed-transport-stopped.json) remain separate. The final gate names only the configured transport; the shipped default is MCP, and CLI mode requires explicit configuration. The final 12 tasks use that fixed configuration throughout.', '',
  'The helper now also runs in a host-managed stdio MCP process. A Codex wiring task completed with real Jev-selected evidence and usage while retaining its shell sandbox. Claude connected to both MCP tools but again chose native targeted reads in the unforced wiring task. An explicit Claude transport probe returned READY after a successful Jev selection (7,826 input tokens, 701 output tokens). [Wiring and direct-helper evidence](2026-09-17-shunt-wiring.json) is kept separate from ordinary task adoption.', '',
  'A separate live helper check selected the two normative retry sections: 1,773 output bytes from 36,283 source bytes, with 7,728 input tokens and 700 output tokens reported by `jev-1.13.0`, in 1,510 ms. That byte ratio is a retrieval diagnostic, not task-token or task-cost savings. Earlier failed helper diagnostics have unknown aggregate billed usage and are not counted as zero-cost successes.', '',
  `This is a small, synthetic, author-designed pilot with ${new Set(rows.map((r: any) => r.task)).size} distinct tasks and ${[...new Set(summaries.map(s => s.runs))].join('/')} runs per observed arm. ${summaries.every(s => s.runs === 4) ? 'The original four-run sample-size condition is met, but the sample is still small.' : 'The sample cannot satisfy the original four-run promotion gate.'} There is no independent dataset review, statistical significance claim, production repository evidence or Spotify AiKA comparison. Read gates cover only recognized full reads; fallback and helper non-adoption limit attribution. The main model must still check omitted requirements and exact source context.`, '',
  'Next: evaluate normal plugin skill activation and helper adherence, then paired independent real-project tasks with controlled cache reporting. Compare against deterministic retrieval before assigning incremental value to Jev. Keep negative results and preserve native targeted-read fallback.', '',
];
await writeFile(resolve(values.output! + '.md'), lines.join('\n'));
console.log(JSON.stringify({ runs: rows.length, decisions, report: values.output! + '.md' }));
