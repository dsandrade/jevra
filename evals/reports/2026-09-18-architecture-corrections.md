# Architecture correction implementation

Date: 2026-09-18. Status: locally validated developer alpha. This is an implementation report, not a new live efficiency benchmark or release promotion.

## Implemented changes

- `managed-test-worker/4` records fixed versus selected packet mode. Configured fixed-source test profiles now batch route and per-requirement sufficiency in one Jev request, then review after actual checks: two requests on success, one additional request for repair. Changed/selected packets retain their dependent sufficiency stage. Source bindings, closed AST execution and native compact-ticket materialization remain enforced.
- Optional economic routing defaults to `family-membership/2`: code computes admissibility first, and Jev receives only the relevant task/family relationship. Ineligible enforce-mode cases use a recorded deterministic native handoff with zero inference. The explicit legacy `compound/1` question remains available; no real default calibration, synthetic-cost ingestion or lowered confidence gates were introduced.
- The separate v2 economic evaluator imports production gates, uses Score 1.5 and retains every typed answer, probability and legend. Six inadmissible authored cases require no provider invocation; ten request semantic evaluation. Failures preserve observable usage. Frozen v1 files/reports were not rewritten. All 16 original request hashes still match the saved report; omitted historical Scores cannot be reconstructed.
- `focused-reader/1` is integrated behind the existing opt-in `bulk_read` operation. The same pinned Luna Codex CLI produces bounded claims with exact source quotes. Runtime validates citations/line handles, freshness, transport bindings and budgets; Jev evaluates support/coverage/continuation. Full mode uses two Jev requests; selected mode uses three. `code_context` remains evidence-only. Unsupported bodies are withheld; native targeted recovery remains available.
- The MCP reader session reserves attempts, reuses identical canonical packets, limits operation capacity and replay TTL, and persists private metadata before paid dispatch. Worker cancellation receives bounded cleanup observation and preserves returned usage. Cross-process caching/deduplication and automatic journal retention are not implemented.
- Whole-task accounting adapters count Codex cached input once and Claude uncached/cache-read/cache-creation input once. Runtime reservations reconcile with completed/failed journals; missing/started/incomplete entries and unknown hook counts block comparable totals. Partial known subtotals remain visible. Actual charges, subscription consumption and cache-dependent USD totals remain null.
- A new executable exploratory reader protocol supplies four authored workloads, five controls/variants, both parent hosts, structured cited answers and subsequent native edit checks. Forty cells are possible, but execution defaults to two; selected cells/model versions/cache interpretation/budgets are frozen before dispatch. The large artifact expansion remains deferred. The evaluation-only Luna control never fabricates a Jev receipt or becomes a product fallback.

## Validation evidence

Final `npm run check` passed under Node 24.21.0: typecheck, CLI/plugin bundle build and **177 tests, zero failures/skips**. Tests include citation forgery, contradictions/omissions, source changes, malformed/unknown usage, fixed-packet parity, deterministic economic refusal, cancellation, idempotency, byte/call budgets, actual MCP/CLI parser composition with simulated providers, stdio Luna-control execution and independent-of-runtime authored code/fact checks.

All four authored canonical reader-task outputs passed exact fact/citation, unchanged-reference and closed pure-function behavioral checks. Wrong boundaries, superseded cutoff selection, omitted facts and invented absent values failed; arbitrary rejected code was not executed and its functional correctness remained unknown. These are authored synthetic oracles, not independent held-out review.

A prior full check observed `cleanup_failed` instead of `invalid_response` on an invalid-JSON subprocess fixture. It was not reproduced in targeted transport checks, 40 parallel stress attempts (all returned `invalid_response`, no signal errors), or the later complete checks. No cleanup assertion or guarantee was weakened; this intermittent observation remains recorded rather than claimed fixed.

Validated 105 local documentation links with no broken targets and `git diff --check`. Offline preparation generated a private hashed 40-cell manifest with promotion explicitly unauthorized. No new real parent, worker or Jev inference was executed for this correction increment; simulated fixture executions consume no model quota. The last read-only account snapshot had 5% weekly usage remaining, so the paid matrix was not automatically started.

## Next evidence

Run the frozen matched small subset described in [the reader protocol](../reader-comparison/protocol.md), then assess ordinary adoption, required-evidence recall, native recovery, cache classes and complete-task usage. Representative held-out projects, independent applicability/requirement labels, repeated statistical validation, full plugin activation certification and real economic calibration remain open. Implementation alone establishes neither savings nor superiority to Spotify.

Current runtime/configuration contracts and architecture diagram: [focused reader](../../docs/focused-reader.md). Dated negative/null reports remain unchanged.
