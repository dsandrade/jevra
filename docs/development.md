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

Follow DR-009 through DR-012 in [ISSUES.md](../ISSUES.md). Add call-budget/deduplication behavior, broader reviewed real-project cases and normal plugin activation checks in both hosts. Predeclare quality margins and overhead budgets. Track skill loading separately from context delivery and report failures and harmful suggestions. Keep observe as default until that evidence supports a change.

## Full coding-task evaluation

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
