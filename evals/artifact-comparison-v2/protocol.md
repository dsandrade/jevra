# Corrected artifact comparison v2 — offline proposal

Status: fixtures, schedule preparation, syntax inspection and token-accounting
utilities exist. This is not a frozen or executable paid benchmark. No cells have
run. `prepare.ts` only writes an offline manifest; it cannot invoke a host, model
or provider. Preserve the historical v1 protocol, dataset and results.

With the project's pinned Node 24.21.0 runtime, prepare a private local schedule:

```sh
node evals/artifact-comparison-v2/prepare.ts --include-claude-hook
```

Omit `--include-claude-hook` for the 144-cell base proposal. `--output` can select
a fresh local directory. The command refuses to overwrite an existing manifest;
the resulting schedule authorizes no paid execution or promotion.

## Questions and controls

The primary exploratory matrix has two hosts, two function families, three output
workloads (4, 8 and 24 required literal examples), three repetitions and four arms:
144 proposed cells. Repetitions measure within-task variation; these six authored
fixtures do not become 144 independent programming tasks. The number of repetitions
and confirmatory sample still need a budget and adequacy review.

| Arm | Offered behavior | Contrast |
| --- | --- | --- |
| `native` | Ordinary parent performs the complete task | Complete-system baseline |
| `worker-ticket` | Same Luna, deterministic checks, compact native delivery; no managed Jev judgments | Incremental managed Jev overhead/value |
| `jev-review` | Same managed Jev stages; parent reads accepted body and applies it natively | Delivery baseline |
| `jev-ticket` | Same managed Jev stages; parent materializes accepted ticket with native permissions | Delivery effect |
| `jev-ticket-hook` | `jev-ticket` plus existing scoped Jev prompt hook on Claude only | Optional hook/adoption effect |

The optional Claude hook ablation adds 18 cells (162 total), matched to Claude
`jev-ticket` cells in the same block. Codex prompt-hook integration is not assumed.
Its support would require separate adapter validation. `worker-ticket` is an
evaluation-only control, not a shipped Jev-free production decision path. Helper
adoption remains voluntary: count non-use, unresolved outcomes, repairs, native
fallback and unaccepted-candidate reuse in intention-to-offer results. An analysis
limited to successful helper uses cannot support promotion.

Ticket and review skills need equal grammar/requirements and differ only in
delivery guidance. Helper metadata must be matched where possible; document
unavoidable delivery metadata differences. Native has no helper metadata: its
overhead is part of the offered-system comparison. A hook effect also includes its
inference, prompt, skill-load and downstream host overhead.

## Instruction, execution and quality parity

Every parent receives exactly the same ordinary task prompt, without forced helper
invocation. Grammar comes from `testArtifactInstructions`, the same function used
by the runtime when preparing the worker request. Requirements retain all literal
examples and are grouped into at most eight entries; group size is reported. Workload
is required output coverage, not source length (the function source is unchanged
across sizes). No closed-profile safety boundary is relaxed.

Prepare fresh workspaces with identical implementation, user instructions, parent
model/effort, native permissions and tool capabilities. Use normal CLI auth,
no inherited conversation, no API fallback or alternate model. Keep source and
destination binding checks and create-only delivery. Timing includes hook execution,
all host work, failed invocations, repair and bounded native recovery. Limit each
managed attempt to the existing one-repair policy; freeze recovery/time/call limits
before starting. Use trusted started-call journals to reconcile every invocation.

Both host/worker output paths receive the same independent checks: unchanged
source, output existence, closed-profile admission, every literal requirement,
baseline execution and four seeded mutants. The helper sees two runtime mutants;
two additional mutants are judge-only. They are public authored mutations, not a
held-out task corpus or independent human review. Require independent requirement
review and a separate confirmatory dataset before any reliability/promotion claim.

`inspectOutput` returns only category and AST node-kind counts. It never executes
rejected code or exposes node identifiers, values or excerpts. Unsupported grammar,
invalid syntax, unsupported TypeScript, inspection failure, changed source, oversized
or absent output remain distinct. Functional correctness is unknown until admitted
code passes actual checks. Admission/coverage alone does not establish correctness.
Persist the managed termination reason, exact-byte application and accepted/uncertain/
native-bypass attribution, including cases where a native fallback succeeds.

The applicability v1 audit found an evaluator relevance gate of 2 instead of the
production 1.5 and omitted relevance answers from saved rows. Before execution,
derive gates from production defaults and retain every typed answer so scoring is
auditable. Do not replay the paid diagnostic just to hide this finding.

## Accounting and analysis

Journal parent, Luna, managed Jev and routing-hook calls separately. Reconcile
trusted expected counts with observed entries, including failed/started calls.
An empty hook ledger when a hook could have attempted inference is unknown; zero
requires observed non-invocation. Cache classes remain unknown when unavailable.
Codex input already includes cached input; Claude input is uncached + cache read +
cache creation. Add these classes once. Gross input/output, cache classes, latency,
known partial totals and incomplete accounting are separate fields.

`wholeTaskUsage` operates on normalized records and trusted call counts. Host,
managed-receipt and hook adapters/reconciliation still need integration and failure
injection; this utility alone does not prove complete lifecycle accounting.
Unknown tokens prevent a complete total, rather than becoming zero. Never omit a
failed/expensive cell or transform missing usage into a saving. API scenarios need
current official pricing, model/context/cache assumptions and a frozen range before
execution; this preparation reports no USD estimate. Actual bills and subscription
allowance stay unknown.

Pair contrasts within host, family, workload and repetition. Report per-host and
per-workload results, helper adoption, failures and all-provider tokens; do not pool
hosts or let a large-output gain obscure small-task overhead. Cluster any intervals
at task/family level; three repetitions of two families cannot establish broad coding
quality. Define a confirmatory non-inferiority margin and paired cost criterion
before held-out runs. Never construct production calibrations from hypothetical
applicability numbers or from mismatched host/delivery/grammar conditions.

The proposed schedule uses a reproducible hash permutation within matched blocks.
It is not sufficient cache control: freeze cache strata, order, cross-run interference
and session-reset rules, then record actual cache classes. Check usage/auth/version
availability read-only before a budgeted run. No global plugin activation, model
switch, permission bypass, provider retry or budget expansion is authorized by
preparing this manifest. Full execution remains gated by the unresolved items in
`plan.ts`.
