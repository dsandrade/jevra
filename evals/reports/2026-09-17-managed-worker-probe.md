# Managed Jev + Codex CLI diagnostic

Date: 2026-09-17. Result: **generation and review executed; continuation withheld
as uncertain**. This is a synthetic integration diagnostic, not a passed coding
task or an efficiency benchmark.

## Method

`evals/workers/managed-probe.ts` supplied a fixed synthetic `sum.ts` implementation
and three explicit assertions to a managed test-generation operation. Jev chose
the route and evidence, evaluated packet sufficiency and reviewed the generated
candidate. The generator used the existing ChatGPT login through the official
Codex CLI, configured for `gpt-5.6-luna`. The TypeSafe key was read locally through
the existing credential helper. No parent conversation or private project source
was supplied; no generated test was executed, applied or accepted.

The initial command stopped before inference because the default Jevra config did
not exist. Running with an explicit local Keychain service produced the one live
operation below. There were no model retries or threshold adjustments to obtain
a passing outcome.

Recorded at `2026-09-17T21:54:03.698Z`, Node 24.21.0, macOS arm64, compatible Codex
CLI `0.154.0-alpha.6.2`; Jev model `jev-1.13.0`. The responding generator model was
not independently exposed in the JSONL stream (`observedModel: null`).

Implementation hash:
`d10491ea93cd7b1fe160a098135c829337616a5efd7fed0763a62cc8df5647b0`.
This binds the ordered contents of managed-worker, worker-contract, Codex transport,
subprocess and TypeSafe provider source files, as listed in the probe script.

## Observations

| Stage | Observed result | Input tokens | Output tokens |
| --- | --- | ---: | ---: |
| Jev route + evidence | Tests route; source Score 1.94, confidence 0.91 | 793 | 58 |
| Jev packet sufficiency | Per-requirement Noul 0.95, 0.94, 0.94 | 759 | 64 |
| Codex/Luna generation | One candidate; complete usage and cleanup | 2,674 | 201 |
| Jev candidate review + continuation | All three requirements supported; continuation below policy | 1,295 | 177 |
| Observed total for this operation | 3 Jev calls + 1 generator invocation | 5,521 | 500 |

Jev subtotal: 2,847 input / 299 output tokens. Worker subtotal: 2,674 input / 201
output tokens, with zero cached input reported. Jev cache usage was unavailable.
Total elapsed time was 9,370 ms, including 7,369 ms for the generator transport.
No host usage, actual dollar charge or subscription delta was measured.

The continuation Choice selected `validate` with probability **0.78** and
confidence **0.67**. The configured minimums were 0.80 and 0.70, respectively.
The operation returned `unresolved/uncertain`, did not emit an
`awaiting_validation` transition and did not retry generation. The three
requirement-support probabilities were 1.00, 0.95 and 0.98; these semantic
judgments do not establish that the candidate would execute correctly.

## Interpretation

The bounded provider/transport composition, accounting and uncertain-outcome path
were exercised successfully. Candidate acceptance was not achieved or attempted.
This result also exposes a calibration question: a separate continuation judgment
can withhold a candidate whose requirement judgments are positive. Assess that
behavior against independent labeled cases and actual validation outcomes; do not
lower the thresholds solely to make this example pass.

The roughly 6,000 observed tokens are the cost of this development diagnostic,
not a saving. The task is trivial and there is no matched native baseline. Larger
tasks, held-out test-effectiveness cases, retries, host overhead and rejected
candidates must be included before making efficiency claims.

Reproduce with the pinned Node toolchain and an existing local credential setup:

```sh
npm run probe:managed-worker -- --keychain-service your-typesafe-key-service
```

Use `--executable` if Codex is not on PATH. The probe writes a sanitized, mode-0600
report to ignored `evals/local-results`; it does not save candidate/source bodies.
A nonzero exit code means the operation did not reach `awaiting_validation`.
