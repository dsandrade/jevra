# Focused reader: scoped gate task and adapter correction

> Dated v1 observation. A subsequent [fresh v2 task](2026-09-18-reader-gate-task-v2.md) observed managed reader adoption with passing authored quality. The v1 data, original snapshots and offline-only status at this increment remain unchanged; neither observation establishes whole-task savings.

Date: 2026-09-18. Status: exploratory single-cell diagnostic. The authored task passed, but **no helper ran**. Native hook execution and delivery remain inconclusive. This result does not establish reader quality, token savings or a monetary benefit.

## Frozen v1 execution

The manifest froze at `2026-09-18T06:37:08.782Z`, before dispatch: one `codex/large-shipping/jev-full-gate` cell, Node 24.21.0, Codex CLI 0.154.0-alpha.6.2, requested parent `gpt-6-astra` with effort `low`, and offered worker `gpt-5.6-luna`. Observed parent model identity remains unreported. The same authored shipping task and closed code/fact judge used in the [first pair](2026-09-18-reader-comparison.md) supplied 59,382 source bytes and required a native edit of `fee.ts` plus cited policy facts.

The [preflight](2026-09-18-reader-gate-validation.md) verified direct built-hook payloads and one scoped definition's normal trust transition. Fresh read-only readiness was trusted, enabled and bound to the same definition fingerprint before dispatch. The task temporarily enabled private metadata traces through an exclusive configuration lease and restored the original bytes afterwards. The definition hash binds the command, while the frozen manifest additionally binds the referenced build/config/source.

Limits were one parent cell, 240 seconds, one Luna attempt and four Jev requests. Ordinary targeted reads remained available; the prompt did not explicitly require helper invocation. This condition offered the direct gate and MCP tools without the first pair's guidance skill, so it cannot isolate the gate's causal effect. No inference retry, alternate model, trust exception, credential copy or global plugin activation occurred. Existing provider caches were not controlled; monetary/quota ceilings remain unobservable.

## Observed outcome

| Metric | Gate-task v1 |
| --- | ---: |
| Authored fact/citation, scope, grammar and behavioral checks | Pass |
| Parent process cleanup / original config restored | Yes / Yes |
| Gross input tokens | 99,556 |
| Reported cache-read tokens, already included in gross input | 76,160 |
| Output tokens | 1,050 |
| Total tokens | 100,606 |
| Gross input minus reported cache reads | 23,396 |
| Parent reported tool calls | 5 |
| Completed command events covered by the metadata collector | 4 |
| Known output bytes across those command events | 60,038 |
| Largest single command output | 59,382 bytes |
| Helper / Luna / managed Jev calls | 0 / 0 / 0 |
| Eligible gate records observed | 0 |
| Actual native hook invocation count | Unknown |
| Parent-cell duration | 44.880 s |

The MCP inference journal exists and contains no reservations or inference journals. Gross input/output accounting reconciles the parent and zero helper calls. Cache-write usage, actual charges, API-equivalent USD and attributable subscription consumption remain null. Subtracting cache reads does not identify a fully uncached billing class.

The command outputs were 136, 59,382, 436 and 84 bytes. All four command strings fell outside the collector's simple-read recognizer. That classification does not mean they were targeted reads: shell wrappers and compound commands can also fall outside it. Commands and source bodies were deliberately not retained, so the command producing 59,382 bytes cannot be reconstructed from this artifact. Other native tool kinds are outside collector coverage; its `complete` flag means no collector truncation, not coverage of all five parent tool calls.

Zero eligible records do not establish zero hook invocations. V1 recorded only commands that passed parsing, scope and size checks, and its parent stream exposed no hook-completion observations. The task therefore establishes non-adoption, while hook invocation and directive delivery remain unknown.

## Adapter defect and prospective v2

Inspection found a real context mismatch: native readiness loaded normal user configuration, while the paid v1 parent used `--ignore-user-config`. Native review state lives in normal configuration, so the mismatch could change execution readiness. V1 did not retain startup-warning metadata or every gate invocation. Unsupported command parsing remains another explanation. The evidence does **not** prove which explanation caused this result.

The current [v2 task protocol](../reader-gate/task-protocol.md) corrects the mismatch and adds diagnostics:

1. Preflight and parent both load normal user configuration. Unrelated MCPs are disabled with scoped CLI flags, and a read-only effective-config guard requires only the evaluation Jevra server to be enabled. Existing namespace collisions and unsupported provider contexts fail before dispatch.
2. Every configured active gate invocation records only payload validity, allowlisted tool/read shape, hashes and zero inference attempts, before parsing or eligibility returns. Eligible redirects remain separate records. No command text, source path or body is added to traces; disabled/unconfigured gates remain inactive.
3. Parent startup retains only stderr byte count and an observed hook-review-warning flag. Neither absence of a warning nor an invocation record proves delivery or adherence.

An actual zero-inference `config/read` probe verified 3 initially enabled MCPs becoming 1 enabled Jevra server under scoped overrides, with the standard OpenAI/ChatGPT provider context preserved and no persistent configuration change. Normal project/definition review earlier in this increment did persist its ordinary native trust records; the isolation probe did not modify them. The [official sample](https://learn.chatgpt.com/docs/config-file/config-sample) documents the default ChatGPT endpoint accepted by the guard; [official hooks](https://learn.chatgpt.com/docs/hooks) describe native review and definition-bound trust.

Full local `npm run check` passed typecheck, CLI/plugin builds and **184 tests with zero failures/skips**. Subsequent collector wording, source-manifest coverage and read-only config RPC checks passed typecheck and all six reader-gate tests. Tests cover invocation metadata privacy, native context sanitization, actual subprocess read-only RPC composition, lease restoration after failure, concurrent/stale leases and preservation of unrelated edits.

**No v2 model task was dispatched.** The original scope is used and its source/build bindings have been superseded. A future task requires a fresh prepared scope and normal review, freshly frozen hashes and a separately bounded dispatch. This increment stops at local verification rather than repeating the paid task.

## Reproducibility and next gate

The [sanitized JSON](2026-09-18-reader-gate-task.json) preserves the original manifest, accounting, bounded observations, empty helper journals, judge outcomes and prospective v2 metadata. Five plaintext source snapshots match the original paid manifest hashes exactly:

| Original v1 source | Frozen plaintext snapshot |
| --- | --- |
| `evals/reader-gate/run.ts` | [run](../reader-gate/frozen-v1-run.ts.txt) |
| `evals/reader-gate/observations.ts` | [observations](../reader-gate/frozen-v1-observations.ts.txt) |
| `evals/reader-gate/inspect-hooks.ts` | [native inspection](../reader-gate/frozen-v1-inspect-hooks.ts.txt) |
| `evals/reader-gate/task-protocol.md` | [task protocol](../reader-gate/frozen-v1-task-protocol.md.txt) |
| `packages/cli/src/bulk-read.ts` | [product gate](../reader-gate/frozen-v1-bulk-read.ts.txt) |

These are audit snapshots, not executable retry instructions. The first pair and zero-inference report remain dated observations. The next evidence gate is a separately authorized small v2 task that can distinguish hook entry, payload/parser rejection, eligible redirect, observed delivery and actual helper invocation. An explicitly requested helper diagnostic can verify wiring but must remain separate from ordinary adoption and savings. Only after adoption works should matched repeated native/reader tasks evaluate whole-task quality and all inference costs. Larger matrices, independent calibration, Claude confirmation and activation certification remain open.
