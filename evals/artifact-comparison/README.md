# Complete-task artifact comparison

This evaluation-only harness compares a native host, a fixed Luna worker without
Jev, and the production Jev-managed operation. The fixed control is never imported
by the shipped runtime. Both helper arms use the same tool descriptions and skill;
neither task prompt requests a helper. Native completion remains possible.

Read the [frozen pilot protocol](protocol.md) before running. It defines the small
synthetic task set, exact runtime versions, budgets, independent final checks,
cache accounting, pricing scenarios and interpretation limits. Do not tune a
running protocol against its outcomes or overwrite an earlier run directory.

## Run and summarize

Use Node 24.21.0 and the protocol's recorded CLI versions with existing supported
subscription logins. Supply only the Keychain service name; no credential belongs
in an argument, output or fixture. This command makes live host, worker and Jev
requests and consumes allowance/credits under the frozen limits.

```sh
npm run eval:artifacts -- \
  --codex-executable /absolute/path/to/codex \
  --keychain-service your-typesafe-key-service \
  --output evals/local-results/artifact-comparison-unique-run

node evals/artifact-comparison/summarize.ts \
  evals/local-results/artifact-comparison-unique-run/results.json \
  evals/local-results/artifact-comparison-unique-run/summary.json
```

Each cell uses a new temporary Git repository and fresh host process. The source
and explicit case requirements are synthetic. Runtime validation receives two
mutants; the independent final check adds two held-out mutants after the host exits.
Only admitted pure-function/test syntax executes in that validator. Native host
commands retain the host's normal permissions.

The runner persists a manifest before inference, records attempted cells, and stops
on authentication/quota errors, cleanup failures or the time/cost scenario budget.
It does not force adoption, retry cells or switch to API billing. It removes each
temporary workspace after recording hashes and metadata. Raw host streams and
generated file bodies are not retained; unsupported-syntax failures therefore do
not preserve enough detail to diagnose the rejected construct after cleanup.

`summarize.ts` emits an allowlisted result without receipt bodies, paths or account
identifiers. Its descriptive aggregates include failed attempts in total cost and
preserve missing cells/usage. Actual subscription cost and per-task allowance are
always unknown. Inspect the sanitized output before publishing it.

## Interpretation boundaries

This is a two-task exploratory pilot with no within-cell repetition, not evidence
of general coding ability or savings. A native file rejected by the executable
grammar is a profile-conformance failure, not demonstrated functional incorrectness.
Coverage is unknown for that file: the judge returns all-false indicators because
it cannot safely inspect/execute the admitted pattern. It does not establish that
the requested assertions were absent.

The worker packet includes exact grammar guidance; the original pilot user prompt
only requests explicit synchronous tests and strict assertions. That instruction
asymmetry must be disclosed when interpreting format failures. A follow-up quality
comparison needs the same full grammar contract in every arm, or an independently
isolated broader checker. Do not relax the production execution boundary to make
native outputs pass a benchmark.

Keep accounting for helper non-adoption and native recovery. Receipt acceptance,
source preservation, final-file match and independent checks are different facts.
Do not call an API list-price scenario a subscription invoice or attribute an
account-level quota change to these tasks alone.
