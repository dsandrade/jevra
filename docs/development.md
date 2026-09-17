# Development and evaluation

Use the pinned Node/npm versions and `npm ci`. Workspace packages are private during the alpha. `npm run build` bundles the CLI into `dist/jevra.mjs` and copies it into both plugin directories. Bundles run outside the workspace without `node_modules`; no npm package or GitHub release asset is published yet.

## Boundaries

- `packages/core`: event and judgment contracts, eligibility, questions, deadlines, validation, and policy.
- `packages/provider-typesafe`: official SDK transport with fixed endpoint, disabled logging/retries, and sanitized failures.
- `packages/adapter-*`: independent host event parsing and context output.
- `packages/cli`: user config, catalog, credentials, bounded IO, traces, and commands.
- `plugins`: host manifests and hooks; the build supplies generated executables.
- `evals`: synthetic skills, labeled cases, component runner, and reviewed reports.

There is one internal module, not a public registration framework. No persistent daemon, cache, deduplication store, or cross-event call budget exists. Each eligible event can make one evaluation attempt. Explicit mentions, disabled mode, and invalid/empty catalogs bypass inference. A fallback may have unknown billed usage, even if the local request timed out.

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

Follow DR-009 through DR-012 in [ISSUES.md](../ISSUES.md). Add call-budget/deduplication behavior, then authenticated Claude probes, reviewed full-task cases and three host-level arms: native, deterministic, and Jev. Predeclare quality margins and overhead budgets. Track skill loading separately from context delivery and report failures and harmful suggestions. Keep observe as default until that evidence supports a change.
