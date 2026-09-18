# Development and evaluation

Use the pinned Node/npm versions and `npm ci`. Workspace packages are private during the alpha. `npm run build` bundles the CLI into `dist/jevra.mjs` and copies it into both plugin directories. Bundles run outside the workspace without `node_modules`; no npm package or GitHub release asset is published yet.

## Boundaries

- `packages/core`: event and judgment contracts, eligibility, questions, deadlines, validation, and policy.
- `packages/provider-typesafe`: official SDK transport with fixed endpoint, disabled logging/retries, and sanitized failures.
- `packages/adapter-*`: independent host event parsing and context output.
- `packages/cli`: user config, catalog, credentials, bounded IO, traces, and commands.
- `plugins`: host manifests and hooks; the build supplies generated executables.
- `evals`: synthetic skills, labeled cases, component runner, complete-task runners and external judges, and reviewed reports.

There are two internal modules: skill routing and evidence selection. They are not a public registration framework. No persistent daemon, cache, deduplication store, or cross-event call budget exists. Each eligible skill event or explicit Jev helper call can make one evaluation attempt. The large-read gate itself makes none. Explicit mentions, disabled mode, and invalid/empty catalogs bypass inference. A fallback may have unknown billed usage, even if the local request timed out.

## Checks

`npm run check` typechecks and runs behavioral tests using fake providers and SDK fetch fixtures. Tests cover provider boundaries, no retries, cancellation, stale candidates, multi-skill/uncertainty abstention, data boundaries, file limits, catalog failures, trace privacy, host output, and standalone bundles. CI runs these checks plus deterministic evaluation on macOS and Ubuntu, without credentials.

For a real host-context probe, see [compatibility](compatibility.md). Normal tests never read Keychain or call a live provider.

## Component evaluation

```sh
npm run eval -- --backend deterministic
npm run eval -- --backend jev --keychain-service your-typesafe-key-service
```

The Jev runner can instead use `TYPESAFE_API_KEY` supplied through secure environment tooling. `--limit 3` restricts the run; `--output` selects a report file. Live calls send only the synthetic dataset and synthetic skill metadata. Default outputs are ignored under `evals/local-results`.

Each report records dataset/catalog hashes, model, question/policy versions, policy values, runtime, per-case outcomes, latency, and observed provider tokens. `evaluationAttempts` counts calls into the provider, not verified HTTP requests. Missing credentials can count as an attempt without network traffic. Aggregate usage is null when an attempt has unavailable usage; observed subtotals remain separately labeled. Dollar charges and host LLM usage are unknown in component evaluations.

The deterministic baseline is a small keyword rule set, not the original host's native router. Both arms use the same prompts, labels, catalog, and explicit-mention guard, but this runner does not execute either host's task loop. Latencies exclude hook startup, catalog discovery, and the host LLM. A zero-millisecond deterministic result is integer rounding, not zero work.

The dataset has 60 synthetic, author-labeled prompts: 36 covered tasks, 12 no-match tasks, four explicit references, four multi-skill requests, and four ambiguous requests. The nominal split is 40 development / 20 holdout. It has no independent labeling review, confusable real-world catalog, adversarial coverage, full-task tests, or statistical power claim. Expand it before drawing product conclusions.

## Next validation gate

For the next implementation, follow [CLI-first worker v1](v1-delivery-plan.md).
DR-039's fresh Codex transport and the scoped managed decision/accounting contracts
exist. The first managed live diagnostic stopped at uncertain continuation; the
later restricted artifact diagnostic passed actual baseline/mutation checks and
Jev review. [Opt-in MCP invocation/review](artifact-mcp.md) now exists, with one
ordinary Codex adoption and explicit Claude wiring. Claude's ordinary probe used
native tools. Next freeze the paired worker comparison and measure ordinary adoption.
The older DR-009 through DR-012
release obligations remain open in [ISSUES.md](../ISSUES.md); no generator or new
default is enabled by the documentation. Predeclare quality margins and overhead
budgets before held-out runs, and preserve the existing evidence-only behavior.

## Experimental CLI worker transport

The [artifact validator](test-artifacts.md) executes only its closed pure-function
test grammar on pinned Node 24.21.0. Offline coverage is in `tests/artifacts.test.ts`.
The explicit live diagnostic creates, validates and, if accepted, applies a file
only in its synthetic fixture:

```sh
npm run probe:artifact -- --keychain-service your-typesafe-key-service
```

It permits at most four Jev calls and two Codex/Luna generations. See the
[live result](../evals/reports/2026-09-17-test-artifact-probe.md). MCP remains evidence-only
unless the experimental artifact configuration is explicitly enabled.

The internal [managed worker](managed-worker.md) now composes the transport with
Jev decisions and a per-operation ledger. Run `node --test tests/managed-worker.test.ts`
for its offline tests. The explicit diagnostic below uses live Jev requests and
the existing Codex model allowance; it writes sanitized metadata only:

```sh
npm run probe:managed-worker -- --keychain-service your-typesafe-key-service
```

Alternatively supply `--config` for an existing Jevra config. Do not supply both.
See the [recorded outcome](../evals/reports/2026-09-17-managed-worker-probe.md),
including its uncertain continuation and complete observed usage.

`packages/core/src/worker.ts` defines the internal versioned request/result schemas.
`packages/cli/src/codex-worker.ts` implements a fresh Codex/Luna generation call;
`worker-process.ts` handles bounded IO and POSIX process-group lifecycle. The
opt-in MCP surface exposes `test_profiles`, `generate_tests` and
`read_test_artifact`; startup alone does not dispatch workers. There is no MCP
apply tool. See [configuration and diagnostics](artifact-mcp.md) and the
[recorded host results](../evals/reports/2026-09-17-artifact-host-probe.md).

Run `node --test tests/worker.test.ts` for the offline transport fixtures. They do
not read real credentials or call a provider. The explicit `npm run probe:worker`
diagnostic consumes existing Codex model allowance and saves a sanitized report in
ignored `evals/local-results`. It sends a fixed synthetic packet; no project code
or parent conversation is supplied. See the [probe report](../evals/reports/2026-09-17-cli-worker-probe.md)
and [transport limits](worker-architecture.md#implemented-transport-boundary).

The current adapter accepts the inspected CLI version with ChatGPT login on POSIX.
It refuses API-key login, different CLI versions and standalone user hooks. It
neither edits user settings nor extracts auth tokens. Unknown responding-model and
usage fields remain null. General tool-catalog/managed-policy certification and
normal plugin adoption remain open; do not expose this transport as an unrestricted
model-selected command runner.

## Full coding-task evaluation

For the credential-free Shunt measurement audit, read the
[source comparison](shunt-cost-audit.md). Run
`node evals/shunt-audit.ts /absolute/path/to/portal-ai-plugins evals/local-results/shunt-measurement-audit.json`
against its pinned upstream commit. It runs tracked upstream scripts in a temporary
copy with an always-failing local transport and asserts how failures affect the
benchmark. It makes no real model calls and does not measure AiKA quality or cost.

For the newer test-artifact worker comparison, see the dedicated
[artifact harness](../evals/artifact-comparison/README.md) and
[frozen protocol](../evals/artifact-comparison/protocol.md). Run it with
`npm run eval:artifacts -- --codex-executable /absolute/path/to/codex --keychain-service your-typesafe-key-service --output evals/local-results/unique-artifact-run`.
It compares native completion, the same fixed worker without Jev, and Jev-managed
generation with a shared helper catalog. The fixed control is evaluation-only.
It preserves supported auth locations, uses no hook-trust bypass, and counts
non-adoption, native recovery, failures and every known provider request. The
closed test grammar is an execution boundary; its rejection cannot be relabeled
as proof of functional incorrectness. Do not merge these results with the older
read-gate experiment below.

Read the [protocol](../evals/full-task/protocol.md) before running:

```sh
npm run build
node evals/full-task/run.ts --repetitions 1 --keychain-service your-typesafe-key-service \
  --output evals/local-results/new-comparison
node evals/full-task/report.ts --input evals/local-results/new-comparison/results.json \
  --output evals/local-results/new-comparison/report
```

This consumes existing authenticated Codex/Claude model usage and TypeSafe usage. The command above runs 12 synthetic coding tasks: two tasks, one repetition, three arms and two hosts. Omitting `--repetitions 1` requests the original 24-run design. Narrow an integration check with `--hosts claude-code --tasks retry-policy --arms jev --repetitions 1`. Use `--output` for a new ignored results directory and `--timeout` for an explicitly recorded run budget. SIGINT/SIGTERM stop active runs and preserve partial records; authentication and rate-limit failures stop further runs. Never merge differently configured runs into the same comparison.

The runner creates and removes temporary fixture repositories, references existing Codex authentication without copying it, disables automatic Codex skill instructions and unrelated Claude skills/MCP, and configures the reviewed command hook plus only the Jevra MCP helper in active arms. It uses Codex's per-invocation hook trust override only for that fixed hook; it does not modify persistent trust or user settings. Agents retain their native tool permissions and can choose targeted-read fallback. The test does not validate marketplace installation. The MCP transport keeps Keychain credentials outside the model tool shell; the shell sandbox remains in place.

`fixtures.ts` supplies tasks and visible tests; `judge.mjs` checks resulting code from outside the agent workspace. Unit tests prove the judge rejects original broken fixtures and accepts independent reference implementations. A task is complete only when the host finishes successfully before the deadline and the external checks pass.

Raw model streams and synthetic solution snapshots remain local under `evals/local-results`. Review before publication: streams can include local paths, session identifiers, account details, or inherited host context. Publish sanitized metrics, not raw sessions. Per-run reports preserve timeouts, missing usage, helper calls, actual helper outcomes and cache tokens. Helper invocations without a corresponding trace leave Jev cost unknown.

The runner uses standard API-equivalent Codex price bounds and Claude's own client-side estimate, including auxiliary models. Codex cache-write counts are unavailable; the range prices uncached input at the documented input/cache-write rates. These are neither actual bills nor a measurement of subscription quota savings. See the report for model/rate sources and the provisional promotion decision.

## Corrected reader checks and exploratory preparation

Use the pinned Node runtime, then run `npm run check`. `node evals/reader-comparison/prepare.ts` creates a private hashed manifest without inference. Read [the protocol](../evals/reader-comparison/protocol.md) before choosing the first matched two-cell subset. `node evals/economic-applicability-v2/run.ts --keychain-service codex-typesafe-api-key` is a new development diagnostic, not a repair or promotion of the frozen v1 results. See [reader configuration](focused-reader.md); enabling it sends admitted source data to Luna and cited/counterevidence to Jev. No global host configuration or plugin installation is performed by this preparation.
