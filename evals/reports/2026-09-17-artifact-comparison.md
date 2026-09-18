# Complete-task artifact pilot: no consistent savings yet

All 12 planned cells completed: two synthetic test-writing tasks, three arms and
two hosts. The Jev arm did **not** meet the predeclared economic screening gate on
either host. Relative to native completion, aggregate input increased 28.0% on
Codex and 135.3% on Claude; the upper API-equivalent cost scenario increased 1.4%
and 26.0%, respectively. Keep the artifact path experimental and opt-in.

The [sanitized data](2026-09-17-artifact-comparison.json),
[frozen protocol](../artifact-comparison/protocol.md) and
[reproduction instructions](../artifact-comparison/README.md) accompany this report.
The source hashes recorded before inference still matched after the runs. Analysis
code was added separately and did not alter the frozen tasks or runtime.

## What was compared

- **Native:** normal host tools, without the artifact helper or its skill.
- **Worker:** the same Luna CLI, source packet, validators and one-repair limit,
  with deterministic check-based continuation. This control exists only in the
  evaluation harness; it is not an alternative production semantic judge.
- **Jev:** the production managed operation, with actual Jev route/evidence,
  sufficiency and candidate/continuation decisions.

Both helper arms exposed identical three-tool catalogs and a neutral repository
skill. Ordinary task prompts did not mention a helper. Every helper cell invoked
discovery, generation and artifact reading without a forced retry. This is scoped
catalog/skill adoption, not evidence about marketplace installation or all default
plugin tools.

Runtime: Node 24.21.0, macOS arm64, Codex CLI 0.154.0-alpha.6.2, Claude Code 2.1.274.
Configured parent models were gpt-6-astra and claude-sonnet-5, both low effort;
the worker was gpt-5.6-luna, low effort, and Jev was jev-1.13.0. Codex did not attest
the responding model in these streams; configured identity remains a conditional
assumption. Official existing subscription authentication was retained. No global
configuration, permission bypass, API-billing fallback or model switch was used.

## Aggregate observations

Each row contains two complete attempted tasks, including failures and native
continuation. Input includes cache reads. Tokens are provider-reported totals,
not a common tokenizer or unique-context measurement. Time excludes the independent
post-run judge. Dollar values are scenarios, **not subscription charges**.

| Host | Arm | Protocol passes | Input | Output | Host time, seconds | API-equivalent USD |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Codex | Native | 1/2* | 260,120 | 2,539 | 118.0 | 0.8711–1.9477 |
| Codex | Worker | 2/2 | 284,090 | 2,885 | 127.4 | 0.6917–1.5000 |
| Codex | Jev | 2/2 | 333,056 | 4,163 | 130.6 | 0.8829–1.9744 |
| Claude | Native | 2/2 | 170,838 | 1,826 | 26.2 | 0.1757 |
| Claude | Worker | 2/2 | 409,093 | 3,948 | 59.0 | 0.2647–0.2664 |
| Claude | Jev | 2/2 | 401,947 | 6,132 | 92.0 | 0.2192–0.2214 |

*The Codex native clamp file was rejected as `unsupported_syntax`, before functional
execution. Its implementation stayed unchanged. This is a profile-conformance
failure, **not demonstrated incorrect test logic**. Its coverage indicators are
unestablished, not evidence that all eight assertions were missing. The original
prompt requested explicit synchronous assertions, but the worker additionally
received the full closed-grammar instructions. That asymmetry prevents interpreting
the 1/2 versus 2/2 difference as a coding-quality advantage. The file body was not
retained, so the exact rejected construct cannot be recovered from this report.

The other 11 final files covered all eight requested cases, passed their baselines
and detected all four seeded mutants, including the two omitted from runtime
validation. All 12 implementations remained unchanged. There were no timeouts,
authentication/quota failures, incomplete cleanup or missing usage ledgers.

For completeness, cost per protocol-passing task, with all attempted costs in the
numerator: Codex native $0.8711–1.9477, worker $0.3459–0.7500, Jev $0.4415–0.9872;
Claude native $0.0878, worker $0.1324–0.1332, Jev $0.1096–0.1107. The format asymmetry
makes this a protocol statistic rather than a fair quality-adjusted efficiency claim.

## Paired results and cache

Percentages compare each offered helper arm with its native host/task cell.

| Host | Task | Arm | Input change | Upper cost change | Time change |
| --- | --- | --- | ---: | ---: | ---: |
| Codex | Clamp | Worker | −17.2% | −10.8% | −9.8% |
| Codex | Clamp | Jev | +9.9% | +18.7% | −12.2% |
| Codex | Shipping | Worker | +50.7% | −33.9% | +33.2% |
| Codex | Shipping | Jev | +56.6% | −14.2% | +43.2% |
| Claude | Clamp | Worker | +153.4% | +45.8% | +108.8% |
| Claude | Clamp | Jev | +109.9% | −2.0% | +214.5% |
| Claude | Shipping | Worker | +125.5% | +61.5% | +147.2% |
| Claude | Shipping | Jev | +160.7% | +73.6% | +300.5% |

Aggregate host cache-read counts, native/worker/Jev respectively: Codex
206,336 / 244,480 / 263,808; Claude 136,656 / 362,149 / 353,288. Cache writes and
per-model Claude details remain in the data. Caches were not flushed; fixed rotated
ordering does not eliminate cache/order confounding. Lower estimated cost alongside
higher gross input is therefore possible and is not a subscription-quota result.

Only the Codex worker control passed the numerical pilot screen: upper cost −23.0%,
time +7.9%, complete accounting and no observed paired protocol regression. Its
cost interval overlaps native, and the quality-format limitation still applies.
The Jev arm had time +10.7% on Codex and +251.1% on Claude; neither passed the cost
screen. No helper arm achieved robust aggregate separation of helper upper cost
below native lower cost. No default activation follows from this pilot.

## What the managed receipts show

There were eight Luna generations, no repairs, and 12 Jev calls. Worker-control
validation accepted 4/4 candidates; Jev accepted 3/4. Exact accepted bytes appeared
in six of the eight helper final files:

- Claude's worker/shipping result changed the accepted candidate's bytes. The final
  file passed the independent judge; it remains outside that acceptance receipt.
- Claude's Jev/clamp candidate passed runtime checks, but the continuation answer
  favored repair with confidence 0.39, below the fixed 0.70 threshold. The operation
  remained unresolved. The host read and applied the same candidate through its
  native path; the final file passed the independent checks. This is observed
  native bypass, **not Jev acceptance** and not a second worker generation.

The unresolved review evaluated 16 requirements: eight configured and eight supplied
by the host. Other Jev cells evaluated eight or nine. Raw additional requirement
text was not retained. This motivates investigating requirement scope/duplication,
but does not establish that those additional requirements were invalid or redundant.
The current metadata stores status and decision receipts but omits the final managed
reason; add that sanitized field before diagnosing more complex failures.

All eight helper cells spent at least 97.65% of their upper cost scenario on the
**parent host** and at least 93.91% of gross input there. All Luna and Jev calls
combined contributed only $0.00868–0.01635 of the pilot scenario. Jev alone consumed
25,472 input tokens, equivalent to $0.00107 under the declared public rate. Removing
Jev's direct inference fee cannot address the dominant overhead.

These observations support an overhead hypothesis, not a causal attribution of
every additional parent token to one tool. Host trajectories and cache state vary.
The parent still discovers the profile, requests generation, reads the candidate,
checks source state, writes and verifies it. A cheaper generator does not remove
those parent interactions automatically.

## Next implementation order

1. **Repair measurement parity.** Give all arms the same exact executable grammar
   contract in a new protocol, record a safe syntax-rejection category and preserve
   managed termination reasons. Keep the original failed cell and hashes unchanged.
   Use new tasks and predeclare repetitions/cache treatment before further inference.
2. **Reduce parent interactions.** Prototype one bounded generation/review response
   that includes an accepted candidate and compact check receipt. Profile lookup can
   use validated configuration. Retain source binding, native edit permissions,
   explicit unresolved status, budgets and every Jev-managed transition. Compare
   it with the existing discovery/generate/read flow; do not introduce auto-apply.
3. **Clarify semantic requirement scope.** Keep configured requirements authoritative;
   distinguish additional artifact requirements from host execution steps. Prevent
   exact duplicate IDs deterministically; any semantic equivalence or scope decision
   remains with Jev. Calibrate false abstention on separate cases, including wrong
   candidates. Do not lower acceptance thresholds to pass this dataset.
4. **Measure the delegation break-even point.** Include tasks large enough to test
   useful context reduction alongside small tasks where native completion is cheap.
   Let Jev use measured overhead/capability evidence when choosing native versus
   worker. Keep deterministic safety/budget limits outside semantic inference.

Retain DR-039's outstanding isolation/installation gates. Memory, more worker
roles and autonomous development loops do not solve the measured parent overhead
and remain outside the next increment. DR-027 remains partial until corrected,
repeated, independently checked comparisons establish an attributable benefit.

## Limits and cost basis

This is 12 cells with only two task groups per host and no within-cell repetition.
It provides no useful grouped confidence intervals, production-project result,
general quality superiority, Spotify benchmark comparison or subscription savings
claim. The tasks contain complete source in tiny packets; they cannot establish
the benefit of selective retrieval in a large codebase.

Total recorded scenario: $3.10536–6.08552, below the $8 observation budget. The 12
host durations total 553.267 seconds. Actual charges and per-task subscription
allowance remain unknown. The experiment ran through CLI subscription auth; these
figures are not a bill. Codex pricing is conditional on configured models, Standard
service and the predeclared short/long-context/cache-write range. Claude uses its
CLI's complete client-side list-price estimate; Jev uses the public input rate.
See the exact rates and assumptions in the [protocol](../artifact-comparison/protocol.md),
with official [OpenAI](https://developers.openai.com/api/docs/pricing),
[Claude](https://platform.claude.com/docs/en/about-claude/pricing) and
[TypeSafe](https://typesafe.ai/blog/introducing-system-one-models-and-jev) sources.

Offline validation: the existing 118 checks plus six harness/judge/accounting tests
and two analysis tests passed, with build and TypeScript checks. This is local
unreleased working-tree evidence, separate from published CI.
