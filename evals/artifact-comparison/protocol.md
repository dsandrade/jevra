# Artifact comparison pilot: frozen protocol v1

Frozen before the first run on 2026-09-17. Protocol, fixture, harness, skill and
runtime hashes are recorded in the run manifest. This is a 12-run exploratory
pilot, not a statistically powered confirmatory benchmark or a Spotify comparison.
No result-dependent task, prompt, threshold, order or model edits are permitted.

## Question and arms

Does offering the bounded worker preserve final test quality while reducing
complete-task resource use, and what changes when Jev manages its decisions?

- `native`: existing host tools; no test-helper skill or MCP.
- `worker`: evaluation-only fixed source packet, same Luna CLI, staging and real
  checks; accept when checks pass, otherwise one deterministic repair. No semantic
  evaluator and no fabricated Jev answers or receipts. Never a production fallback.
- `jev`: existing ArtifactSession/ManagedTestOperation, with actual Jev decisions
  and the same configured source, mandatory requirements, validators and Luna.

Both helper arms expose the same three-tool catalog and neutral repository skill.
This controlled catalog excludes unrelated retrieval tools and is not a test of
the complete installed plugin. The user prompt is byte-identical within a task
across all arms and contains no helper names. Native tools stay available. Include
non-adoption, uncertain results and native recovery in each offered arm's outcome;
do not force tool calls, retry failed cells or count explicit invocation as adoption.
Conditional adopted-run comparisons are descriptive and subject to selection bias.

## Tasks, pairing and order

Two synthetic TypeScript pure functions: numeric clamp and membership-dependent
shipping fee. Each requires eight explicit cases. The closed executable grammar
is shared across arms. Each runtime sees two configured mutants; the independent
final-file judge uses all four and verifies each requested literal assertion.
The other two mutants and judge run outside the child workspace, after host exit.
This is holdout from generation, not a sealed adversarial evaluation environment.

One execution per host/task/arm: 2 hosts x 2 tasks x 3 arms = 12 executions.
Pair by host/task. Order is fixed in `fixtures.ts`, rotating arm order across
blocks and alternating hosts. Every run uses a fresh temporary repository/session.
Provider caches are neither flushed nor artificially primed; report observed cache
classes and acknowledge residual order/cache confounding. Two tasks per host are
insufficient for useful grouped confidence intervals. Report individual paired
deltas and descriptive aggregates; choose repetitions and statistical power for a
separate held-out protocol after this pilot, without recycling these tasks.

## Fixed runtime and budget

- Node 24.21.0; Codex CLI 0.154.0-alpha.6.2; Claude CLI 2.1.274.
- Parent Codex: configured gpt-6-astra, low effort. Parent Claude: claude-sonnet-5,
  low effort. Worker: configured gpt-5.6-luna, low effort, official Codex login.
- Existing subscription authentication; no OAuth extraction, model/API fallback,
  permission bypass or global configuration changes. Preserve native permissions.
- One host at a time. 240 seconds per host run, 180 seconds per managed operation,
  at most two 60-second generations and four Jev calls. One operation per runtime.
- At most 12 host runs, 16 worker generations and 16 Jev calls across the pilot.
  The smaller actual counts include non-adoption; no automatic retries.
- Stop the pilot on authentication/quota failure, incomplete process cleanup,
  operator interruption, 20 minutes of live execution, or cumulative $8 in the
  upper API-equivalent scenario below. A just-completed request may exceed this
  observational budget; it is not a hard provider-token or billing cap. Record
  every attempted cell and mark unstarted cells missing, never successful.

## Quality and adoption

A task succeeds only if the host terminates successfully, leaves the implementation
unchanged, creates the requested file within the shared executable grammar, covers
all eight requested argument/expected-value pairs, passes baseline tests and
detects all four mutants through assertion failures. No model-written success
statement is accepted as evidence. Timeouts, runner errors and unknown checks fail.
The independent judge uses the trusted validator for execution and a separate AST
assertion-coverage check; no LLM judge or Jev evaluation influences its label.

Record helper requests, actual worker invocations, Jev calls, accepted handles,
read-for-review calls, exact final-file match and native fallback. Receipt delivery
is not proof of review or user approval. Final quality is independent of whether
the helper's candidate was accepted or ultimately used.

## Accounting and predeclared price scenario

Count host + every worker/repair + every Jev call, including failed attempts.
Unknown usage stays unknown; retain known subtotals and incomplete-ledger flags.
Count host input, cache reads/writes and output separately; receipt input is already
included in host usage and must not be added twice. Independent deterministic judge
time is separate from host completion time. Actual charges and per-task subscription
allowance remain unknown, even if account-level limits change during the pilot.

API-equivalent USD is a scenario using public prices checked 2026-09-17; it is not
subscription billing. Codex streams omit cache writes, service tier and per-request
context size: report a range, lower = Standard short context with no cache-write
uplift, upper = Standard long context with all non-cache-read input charged as
cache writes. Rates per million: Astra input 10/20, cache read 1/2, cache write
12.5/25, output 50/75; Luna input 0.20/0.40, cache read 0.02/0.04, cache write
0.25/0.50, output 1.20/1.80. This is conditional on the configured model and Standard
pricing, not a bound covering every service tier. [OpenAI pricing](https://developers.openai.com/api/docs/pricing).

For Claude use the CLI's complete client-side list-price estimate (including any
auxiliary model accounting), with model usage retained. As a reference, Sonnet 5
is $2 input, $0.20 cache read, $2.50 five-minute/$4 one-hour cache writes and $10
output per million. Do not relabel that estimate as an actual invoice.
[Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing).
Jev's public scenario is $0.042 per million input, output free; include input from
every known call. [TypeSafe pricing](https://typesafe.ai/blog/introducing-system-one-models-and-jev).

## Interpretation and gate

Report quality and adoption per host and arm, totals including failures, cost per
successful task (all attempted cost / number successful), paired gross token and
latency differences, and cost scenarios. No successful tasks means undefined cost
per success, not zero. Do not pool hosts to mask a regression.

No default promotion from this pilot. To justify a larger confirmatory test, require
no paired quality loss, full accounting, and at least 20% lower aggregate upper
cost estimate than native on each host, with aggregate latency no more than 1.5x
native. Robust price-scenario savings additionally require helper upper < native
lower; overlapping ranges cannot establish savings. These are engineering screening
gates, not statistically established effects. Publish negative/null results and
recommend the next change based on observed overhead, not a desired savings target.
