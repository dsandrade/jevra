# Staged test-artifact diagnostic

Date: 2026-09-17. Result: **accepted after actual checks and Jev review**, then
applied only inside a synthetic fixture. One generation; no repair was needed.

## Method and limits

`evals/workers/artifact-probe.ts` created a TypeScript `sum(a, b)` fixture and asked
for three explicit assertions: positive operands, one negative operand and zero.
The runtime fixed the output path and executable test grammar. Two independently
authored mutations replaced addition with subtraction and dropped the second
operand. Their implementations were not included in the generation packet.

The actual flow used Jev routing/evidence/sufficiency, Codex CLI generation with
Luna configured, AST admission, real Node test executions against original and
mutated sources, and Jev completion review. The fixture's test file was created
only after acceptance. No user project file was changed by this diagnostic.

Recorded at `2026-09-17T22:19:23.816Z`, Node 24.21.0, macOS arm64, compatible
Codex CLI `0.154.0-alpha.6.2`, Jev `jev-1.13.0`, registry `managed-test-worker/2`.
The responding generator model was not independently exposed in JSONL;
`configuredModel` was `gpt-5.6-luna`, `observedModel` was `null`.

Implementation hash:
`d1e168090dc23865e9c380ab8d5dbdd0eafd7fbd5d45ee71e871a8b5a4274265`.
This binds the ordered files listed in the probe script. A subsequent bounded-read
hardening change rejects invalid UTF-8 and is covered by offline tests; the live
diagnostic was not repeated for that change.

## Observed checks

| Check | Result | Tests | Assertion failures | Duration |
| --- | --- | ---: | ---: | ---: |
| Syntax and profile | Admitted | — | — | — |
| Original implementation | Passed | 3 | 0 | 94 ms |
| Subtraction mutant | Detected | 3 | 2 | 69 ms |
| Dropped-operand mutant | Detected | 3 | 2 | 74 ms |

The candidate was 329 UTF-8 bytes. All three processes reported complete cleanup.
Jev's final continuation was `accept`, probability 0.98, confidence 0.96. Its three
requirement-support probabilities were 1.00, 0.98 and 0.98. Policy thresholds were
unchanged from the earlier managed diagnostic: confidence 0.70 and selected Choice
probability 0.80. This new stage supplied actual validation evidence and different
eligible actions; it is not a controlled comparison of prompt or threshold quality.

## Observed usage

| Component | Input tokens | Output tokens |
| --- | ---: | ---: |
| Jev route and evidence | 842 | 58 |
| Jev packet sufficiency | 808 | 64 |
| Codex/Luna generator | 2,721 | 172 |
| Jev review with observed checks | 2,185 | 184 |
| Total observed | 6,556 | 478 |

Jev subtotal: 3,835 input / 306 output tokens in three calls. Worker subtotal:
2,721 input / 172 output in one CLI invocation, with zero cached input reported.
Jev cache usage was unavailable. Operation duration was 10,543 ms, including
7,305 ms for the generator transport; explicit fixture application followed that
operation timer. No actual billing, subscription delta or parent-host usage was
measured.

## Interpretation

This establishes one functioning path from a bounded test-generation request to
an accepted staged artifact with observed test-effectiveness evidence. The one-
repair path is exercised in offline tests with controlled Jev/worker responses and
real Node checks, not in this live run.

The task is small, synthetic and author-selected. Two mutants do not establish
general test quality. There is no matched native-host baseline, no statistical
quality estimate and no demonstrated token saving. The roughly 7,000 observed
tokens are diagnostic expenditure, not a claim of improved economics.

Run explicitly with the pinned toolchain and an existing local Keychain service:

```sh
npm run probe:artifact -- --keychain-service your-typesafe-key-service
```

Supply `--executable` if necessary. Synthetic source/staged files stay in ignored
`.jevra/artifact-probes`; sanitized reports are written to ignored
`evals/local-results` with mode 0600. No credential or raw model/check stream is
stored in the public report.
