# Shunt-style full-task pilot — 2026-09-17

**Decision: keep the reading module opt-in.** This report separates successful coding tasks, helper adoption and API-equivalent cost. It does not claim lower subscription charges or production savings.

Attempted 12/12 planned runs. Two synthetic coding tasks, 1 repetition, three arms and two independently measured hosts. The [protocol](../full-task/protocol.md) records the predeclared transport revision and reduced development sample before this comparison; diagnostic wiring pilots are separate. [Sanitized per-run data](2026-09-17-full-task-pilot.json).

Implementation: [438bd85](https://github.com/dsandrade/jevra/commit/438bd85f7f243ac23667a9c207e6c36858172971). The JSON pins the built CLI, fixture and protocol hashes. Reproduce with Node 24.21.0, npm ci, npm run build, then node evals/full-task/run.ts --repetitions 1 --keychain-service your-typesafe-key-service from that revision.

## Results

| Host | Arm | Completed | External checks | Median seconds | Host input / output tokens | Estimated total USD | Redirects / helper calls |
| --- | --- | --- | --- | --- | --- | --- | --- |
| codex | native | 2/2 | 50/50 | 143.9 | 244720 / 8414 | $0.9994–$1.0921 | 0 / 0 |
| codex | deterministic | 2/2 | 50/50 | 155.3 | 324152 / 8749 | $1.0248–$1.0979 | 2 / 2 |
| codex | jev | 2/2 | 50/50 | 150.9 | 331512 / 8385 | $1.0647–$1.1517 | 2 / 2 |
| claude-code | native | 2/2 | 50/50 | 100.2 | 605579 / 21106 | $0.5776 | 0 / 0 |
| claude-code | deterministic | 2/2 | 50/50 | 111.7 | 835288 / 22308 | $0.6493 | 2 / 0 |
| claude-code | jev | 2/2 | 50/50 | 98.6 | 701240 / 19950 | $0.5430 | 2 / 1 |

Costs sum observed whole-run host estimates plus known Jev usage. Input includes cached input; cache counts remain separate in JSON. Missing usage stays unknown, including untraced helper invocations. Compare arms within one host, not host prices against each other.

12/12 tasks completed successfully; 300/300 external checks passed.

codex: Jev-arm host input-token change 35.5%; output-token change -0.3%. Matched low/high price-assumption cost changes are 6.5% / 5.5% (positive means higher cost). Successful helper use: 2/2 Jev tasks. Independent per-arm price bounds are wider and appear below.

claude-code: Jev-arm host input-token change 15.8%; output-token change -5.5%. Matched low/high price-assumption cost changes are -6.0% / -6.0% (positive means higher cost). Successful helper use: 1/2 Jev tasks. Independent per-arm price bounds are wider and appear below.

Compact helper output does not guarantee fewer subsequent source reads or lower total cost. Task path, output generation and cache mix vary; this small sample does not establish a general causal effect or lower subscription quota usage.

## Predeclared gates

codex: promotion **fails**. Estimated savings versus native range from -15.2% to 2.5%; negative savings mean higher cost. Median latency change: 4.8%. Conservative savings versus deterministic: -12.4%. Gate results: plannedRuns=fail, quality=pass, helperUsed=pass, cost=fail, latency=pass.

claude-code: promotion **fails**. Estimated savings versus native range from 6.0% to 6.0%; negative savings mean higher cost. Median latency change: -1.6%. Conservative savings versus deterministic: 16.4%. Gate results: plannedRuns=fail, quality=pass, helperUsed=fail, cost=fail, latency=pass.


The helper-use gate prevents attributing native fallback behavior to Jev. A large-read denial does not establish semantic delegation. Even a passing pilot gate would require broader independent evidence before a global default change.

## Method and scope

- Retry policy: 32 external checks per run, including attempt limits, safety, transient exclusions, server hints and precedence.
- Retention policy: 18 checks per run, including exact age boundaries, legal hold, active sessions, newest-report ties and input immutability.
- Main LLMs generate code and visible tests. The external checker lives outside their workspace and has independent known-good/known-bad validation.
- Native, deterministic BM25 and Jev selection share task prompts and clean repositories. The two active arms share the read gate, host-managed MCP helper and output format. Native registers no Jevra MCP tools; their catalog overhead counts against active arms. No prompt-context injection or auxiliary generator is used.
- Codex uses `gpt-6-astra`, xhigh; Claude uses `claude-sonnet-5`, high. Versions are recorded per run. Hooks are isolated direct command hooks with only the Jevra MCP server in active arms; plugin marketplace lifecycle and normal skill discovery are not measured.
- Order rotates by task/repetition. Provider caches are observed, not controlled cold. Models may take different paths, ignore the helper, or use targeted reads. All attempted final runs remain in this report.
- Deadlines are 300 seconds per task, an eight-second Jev helper limit, and a $2 Claude client-estimated task cap. Only one task per host runs at a time.

## Pricing and accounting

The final comparison recorded 3 Jev evaluation attempts. Their observed input usage totals 23160 tokens; the sum of known Jev estimates is $0.000973. Unknown attempts, if any, are not included in that observed subtotal. The host-model cost is the dominant component here.

Codex figures use [documented GPT-6 Astra Standard API prices](https://developers.openai.com/api/docs/models/gpt-6-astra): $10/M uncached input, $1/M cached input and $50/M output. Because cache-write counts are unavailable, the upper bound prices uncached input at $12.50/M. This assumes every individual request stays below the 272K long-context threshold; cumulative turn input is not context length. No Fast rate is assumed.

Claude figures use the [headless CLI](https://code.claude.com/docs/en/headless) result’s `total_cost_usd`, including reported auxiliary model usage. These are client-side list-price estimates, not Pro charges. Jev uses [the documented model rate](https://docs.typesafe.ai/models) of $0.042/M input with output free. Actual billed USD and subscription quota savings are unavailable for every arm.

## Wiring diagnostics and limitations

Before the frozen comparison, the first two-run wiring pilot found inherited Codex skills and a 180-second timeout; Claude passed through targeted reads. After isolating skills, allowing the helper in fixture instructions, initializing Git and extending the deadline, a second two-run pilot completed in both hosts. Codex invoked the CLI helper but its tool-shell sandbox could not read Keychain; Claude chose targeted reads. Separately, a direct live helper check exposed a Score rounding validation defect, which was fixed with a regression test. The CLI-only comparison was then interrupted after 10 completed and two interrupted runs when the credential boundary became clear. [Preserved CLI-only metrics](2026-09-17-cli-only-interrupted.json) remain separate; interrupted host usage is unknown.

An initial MCP comparison then stopped after eight completed runs because its gate still advertised the shell fallback. Codex selected that alternative despite MCP being connected. [These stopped-run metrics](2026-09-17-mixed-transport-stopped.json) remain separate. The final gate names only the configured transport; the shipped default is MCP, and CLI mode requires explicit configuration. The final 12 tasks use that fixed configuration throughout.

The helper now also runs in a host-managed stdio MCP process. A Codex wiring task completed with real Jev-selected evidence and usage while retaining its shell sandbox. Claude connected to both MCP tools but again chose native targeted reads in the unforced wiring task. An explicit Claude transport probe returned READY after a successful Jev selection (7,826 input tokens, 701 output tokens). [Wiring and direct-helper evidence](2026-09-17-shunt-wiring.json) is kept separate from ordinary task adoption.

A separate live helper check selected the two normative retry sections: 1,773 output bytes from 36,283 source bytes, with 7,728 input tokens and 700 output tokens reported by `jev-1.13.0`, in 1,510 ms. That byte ratio is a retrieval diagnostic, not task-token or task-cost savings. Earlier failed helper diagnostics have unknown aggregate billed usage and are not counted as zero-cost successes.

This is a small, synthetic, author-designed pilot with 2 distinct tasks and 2 runs per observed arm. The sample cannot satisfy the original four-run promotion gate. There is no independent dataset review, statistical significance claim, production repository evidence or Spotify AiKA comparison. Read gates cover only recognized full reads; fallback and helper non-adoption limit attribution. The main model must still check omitted requirements and exact source context.

Next: evaluate normal plugin skill activation and helper adherence, then paired independent real-project tasks with controlled cache reporting. Compare against deterministic retrieval before assigning incremental value to Jev. Keep negative results and preserve native targeted-read fallback.
