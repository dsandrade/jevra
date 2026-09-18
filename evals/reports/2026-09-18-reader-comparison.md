# Focused reader: first complete-task pair

Date: 2026-09-18. Status: exploratory integration observation; no efficiency promotion. The offered reader was **not invoked**, so this pair does not measure Luna/Jev reader quality or its contribution to savings.

## Frozen execution

The [reader protocol](../reader-comparison/protocol.md) selected `codex/large-shipping/jev-full` followed by `codex/large-shipping/native`, with one execution per arm. The manifest was frozen at `2026-09-18T06:07:36.748Z`, before inference. Both executions used fresh temporary checkouts, the same authored task/prompt, Node 24.21.0 and the version-checked Codex CLI 0.154.0-alpha.6.2. The requested parent model was `gpt-6-astra`, effort `low`; the host stream did not report an observed model identity. The offered reader pinned `gpt-5.6-luna`, but no worker ran.

The task supplies 59,382 source bytes, asks for exact cited shipping-policy facts, and requires a native edit of `fee.ts`. The authored requirements are a base fee of 7, an expedited surcharge of 5, and a subtotal threshold of 100 that waives only the base fee. Four behavioral examples cover the threshold and surcharge combination. The ordinary native arm may use targeted reads; it was not forced to consume full files.

Frozen limits were two cells, 300,000 known input tokens between cells, 240 seconds per parent cell and 15 minutes per run. The reader had one Luna attempt and at most four Jev requests per cell. No global plugin/settings activation, inference retry, alternate model or credential copying occurred. Both cells finished; `stopReason` is null and no selected cell is missing.

## Observations

| Metric | Native | Reader offered (`jev-full`) |
| --- | ---: | ---: |
| Required facts, citations and unchanged references | Pass | Pass |
| Closed pure-function grammar and behavioral checks | Pass | Pass |
| Complete input/output accounting and process cleanup | Yes | Yes |
| Gross input tokens | 95,790 | 82,403 |
| Output tokens | 946 | 892 |
| Total tokens | 96,736 | 83,295 |
| Reported cache-read input tokens, already included in gross input | 73,344 | 59,392 |
| Gross input minus reported cache reads | 22,446 | 23,011 |
| Observed host tool calls | 5 | 4 |
| Helper calls / Luna invocations / managed Jev requests | 0 / 0 / 0 | 0 / 0 / 0 |
| Observable tool-output bytes | 59,967 | 59,688 |
| Observed agent messages | 2 | 2 |
| Parent-cell duration | 57.285 s | 38.569 s |

All gross input/output usage belongs to the parent. The helper journal exists and contains no reservations or inference journals: the evaluation server initialized, but no helper invocation was observed. This is non-adoption, rather than a failed helper followed by recovery. The brief scoped skill and MCP tools were offered; this evidence does not establish that the skill instructions or catalog were consumed by the parent. Semantic routing hooks and the local large-read gate were not enabled in this scoped pair.

The offered arm used 13.89% fewer total tokens, but its input minus reported cache reads was 2.52% higher. There was no reader execution, the tool-output byte counts were similar, cache conditions were not controlled, and there is only one observation per arm. The total-token and timing differences cannot establish a reader benefit or lower monetary cost. Cache creation is unreported for Codex; subtracting cache reads does not establish an entirely uncached token class. Actual charges, API-equivalent USD and subscription consumption remain null.

The rounded account snapshot showed 4% weekly usage remaining before and after the pair. That shared account measurement cannot attribute quota consumption to this experiment and was not used as a zero-consumption claim. No reset credit or purchase was used. The machine-readable [sanitized results](2026-09-18-reader-comparison.json) retain the frozen hashes, per-component accounting, empty helper journals and authored judge outcomes; no credentials, private account identity, raw host transcript or local temporary paths are published.

## Consequence for the next experiment

1. Verify scoped delivery and adherence of the existing local large-read gate on the pinned host, with ordinary targeted reads remaining available. Record gate invocation, decision delivery, tool availability and helper invocation separately. The current protocol did not exercise this Shunt-style gate, so it cannot test the complete gate-plus-reader mechanism.
2. Add bounded metadata observations for tool sequence and helper responses, including native recovery, without retaining source bodies or credentials. The current result reports counts and bytes but cannot reconstruct why the parent chose its native path.
3. Freeze a separate gate-enabled adoption experiment. A separately labeled explicit-invocation diagnostic can establish real reader/provider wiring, but cannot substitute for ordinary adoption or count as evidence of savings. Keep the same independent-of-runtime authored fact and edit judge and account for any additional inference.

Do not expand to a large matrix, tune thresholds against this result, infer semantic acceptance from the parent success, or ingest an economic calibration from these two cells. Reader support/coverage/continuation judgments have no live observation in this pair. Representative held-out tasks, independently reviewed requirements, repeated comparisons, Claude validation and full activation certification remain open.
