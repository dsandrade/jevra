# CLI-first worker v1 delivery plan

Date: 2026-09-17. Status: transport, managed generation/ledger and a restricted
test-artifact lifecycle implemented. One live pure-function fixture passed actual
checks and Jev review. Opt-in MCP delivery exists; Codex ordinary adoption and
Claude explicit wiring passed. Repeated ordinary adoption and matched evaluation remain pending.
"V1" is the first complete worker milestone, not a stable framework or a `1.0.0`
release promise. See [SPEC](../SPEC.md), [worker architecture](worker-architecture.md)
and the stable planning IDs in [ISSUES](../ISSUES.md).

The [2026-09-18 architecture review](shunt-architecture-review-2026-09-18.md)
recommends a small focused-reader experiment after measurement repairs to test
the large-corpus opportunity. The owner adopted that sequencing; the [implemented corrections](focused-reader.md) now define the next milestone. The bounded artifact milestone remains available; no large paid matrix or efficiency claim follows.

## Outcome

An ordinary coding task in Codex or Claude Code can delegate a well-specified test
artifact to Luna through the local Codex CLI. Jev selects relevant evidence and
evaluates explicit semantic choices within the managed operation. Jevra returns a
staged artifact and a compact receipt, observes authorized validation and permits
at most one repair. Measure whether the complete path preserves quality while
reducing expensive host generation and total cost per accepted task.

The worker receives a fresh bounded input packet, not the host conversation. The
official CLI retains supported authentication. No Spotify Portal account, hosted
service, new chat UI or durable memory system is required.

## Scope fixed for the first delivery

| Included | Follow-on |
| --- | --- |
| `artifact-writer/tests` and one repair mode | Broad production-code generation, general investigation and generative review |
| `gpt-5.6-luna` through a `codex-cli` adapter | Claude CLI, direct API and automatic model comparison/routing |
| Both parent hosts using the same worker core | Universal control of native host reasoning |
| Jev route/evidence/support/continuation judgments | A mandatory full lifecycle of semantic calls for every task |
| Scoped input, current source hashes, staging, actual checks and receipts | Full repository knowledge graph and automatic knowledge compilation |
| Per-operation accounting and fresh worker context | Durable engineering memory and cross-session learning |
| Existing exact evidence tools remain available | Opt-in focused reader implemented; live comparison next |

The supported initial task family is small TypeScript/Node test additions in
approved fixtures/open-source snapshots, using each repository's existing test
runner. Workers do not install dependencies or choose shell commands. Extend the
language/task matrix only after measuring this path. This does not restrict the
existing evidence-selection tools to that language.

## What already exists and what remains

| Area | Current evidence | Remaining work |
| --- | --- | --- |
| Runtime | TypeScript packages, CLI, host adapters and local stdio MCP | Add generation without changing existing evidence-tool behavior |
| Jev | Source-bound routing, evidence and review with actual check results; one-repair decisions | Calibrate on held-out tasks and verify host adoption |
| Evidence | Bounded files, lexical candidates, Jev ranking and source handles | Build a requirements/instructions/evidence packet; detect missing context |
| Generator | Bounded Codex transport, 21 transport tests, 25 managed tests and live integration diagnostic | Broader capability certification and host invocation |
| Validation | Restricted pure-function profile, 16 artifact tests and one live baseline/mutation diagnostic | Broader task profiles, independent quality evaluation and host review |
| Evaluation | Synthetic retrieval pilot and usage accounting foundation | Include worker usage, CLI overhead, retries, host adoption and independent quality |

The [transport probe](../evals/reports/2026-09-17-cli-worker-probe.md) establishes the
narrow local execution path. It does not establish full isolation across arbitrary
CLI policy setups, efficient complete tasks or ordinary plugin adoption.
Reading-pilot results must not be relabeled as generation results.

## Implementation order

Dependencies below refer to the needed slices of existing issues, not completion
of every older skill-routing or memory acceptance criterion.

| Step | Deliverable | Backlog | Exit evidence |
| --- | --- | --- | --- |
| 1 | Worker request/result contract and Codex subprocess adapter | DR-039; relevant DR-009/020 | Fake executable covers valid/malformed output, limits, cancellation and cleanup; one bounded live probe verifies auth, Luna and fresh context |
| 2 | Minimum worker decision registry, evidence packet and ledger | DR-034, DR-025, DR-020; scoped DR-021 | Managed transitions require current Jev receipts; missing evidence/outage/budget failures cannot silently change judges |
| 3 | Test-artifact profile, staging and one repair | DR-023; scoped DR-015 | A complete fixture produces an artifact, runs authorized checks and records acceptance or unresolved failure |
| 4 | Ordinary plugin adoption in both parent hosts | DR-018, DR-012 | Claude Code and Codex invoke the same worker without requiring the user to issue a special command; native paths and permissions remain available |
| 5 | Paired quality/usage experiment and documented release gate | DR-019, DR-027 | Repeated tasks with independent checks, complete accounting, failure cases and per-host results |

DR-039's transport and the minimum DR-020/034/025 decision/accounting slice are
implemented. See the [managed contracts](managed-worker.md) and
[live diagnostic](../evals/reports/2026-09-17-managed-worker-probe.md): generation
and review ran, but continuation was withheld as uncertain. The subsequent
[artifact slice](test-artifacts.md) adds staging, actual checks and one repair;
its [live diagnostic](../evals/reports/2026-09-17-test-artifact-probe.md) was accepted.
The [opt-in MCP slice](artifact-mcp.md) now provides invocation and artifact delivery
for native review/application. The [host diagnostic](../evals/reports/2026-09-17-artifact-host-probe.md)
observed ordinary Codex adoption, native Claude fallback, and successful explicit
Claude wiring. The subsequent [frozen DR-027 pilot](../evals/artifact-comparison/protocol.md)
completed 12 cells; its [report](../evals/reports/2026-09-17-artifact-comparison.md)
records helper requests in every offered cell but no consistent Jev-arm savings.
The parent host dominated the measured cost. A grammar-guidance asymmetry limits
quality comparison; an unresolved candidate used natively also demonstrates the
boundary between managed acceptance and host behavior.

The [Shunt source audit](shunt-cost-audit.md) led to the opt-in
[compact delivery implementation](artifact-materialization.md): exact source
selection without mandatory discovery, accepted signed tickets and deterministic
application through native permissions. The full artifact need not be read and
regenerated by the parent. Default review delivery remains available.
An opt-in [economic evidence contract](economic-routing.md) now joins the first
Jev batch; its initial synthetic positive case remained uncertain, so it has no
default calibration or promotion. A [scoped Claude hook diagnostic](../evals/reports/2026-09-18-economic-routing.md)
observed compact delivery on an ordinary request, but more gross tokens on the
small fixture. Next review calibration applicability on independent cases, correct
evaluation instruction parity/diagnostics and clarify additional requirement scope.
Capability and adoption alone are insufficient. Then freeze a new
repeated comparison using new tasks. Keep semantic decisions with Jev and preserve
native permissions; do not lower thresholds or relax executable grammar to improve
these scores. Step 5 remains partial. Retain remaining DR-039 capability checks as
an activation gate, and do not silently switch to API billing if transport fails.

## Contracts to implement first

- Request: version, operation/attempt ID, profile, explicit requirements and
  applicable instructions, authorized source handles/hashes, output contract,
  configured model/transport and enforceable resource limits.
- Result: discriminated status, staged artifact handle/hash when present, observed
  model/authentication mode, usage with unknown values preserved, elapsed time and
  sanitized failure code. Credentials and raw sessions are never receipt fields.
- Lifecycle: prepared, generated, awaiting validation, accepted, repair requested
  or unresolved. These are internal states, not mandatory additional public tools.
- Validation: verify syntax, allowed scope and source preimages; collect actual
  authorized command outcomes. A model-written "tests passed" or caller-supplied
  success boolean is not a trusted check receipt.
- Repair: another fresh bounded invocation with the candidate and actual failures;
  at most two generation invocations total. No autonomous tool loop or recursive
  Jevra dispatch inside the worker.
- Limits: set and record finite input bytes, event/output bytes, artifact size,
  active-process time, operation expiry, Jev calls and generation attempts before
  the first live run. Do not claim a hard provider-token cap from a CLI that lacks
  one. Start with one active worker per runtime, without retry storms.

Use existing packages; no public plugin framework or new service is needed.
Resource-limit defaults and exact schema fields are routine implementation choices
to validate in step 1, not open product decisions that block coding.

## Measurement and release

Compare native host execution, the same bounded worker with fixed/deterministic
experimental routing, and the worker with Jev-managed semantic decisions. The
no-Jev arm is only an experimental control. Keep main-host settings, worker model,
scope and budgets matched; record candidate-selection differences explicitly.

For generated tests, passing against the existing implementation is insufficient:
independent checks must verify intended behavior and detection of seeded defects
or mutations. Count failed/interrupted attempts and repairs. Report host usage,
worker usage, Jev usage, cache classes, latency, acceptance and normal adoption.
Keep API-equivalent cost estimates, actual charges and subscription allowance as
different quantities; unavailable telemetry remains unknown.

Use a small diagnostic first. Freeze task set, repeats, quality margin, budget and
cost/latency gate before the broader held-out comparison. The diagnostic is not
statistical proof. Do not enable the worker by default or claim savings solely
because it returns fewer bytes to the host. Retain an opt-in experimental status
if quality or complete-task economics do not meet the declared gate.

## Readiness

There is no outstanding product choice or Portal access requirement preventing
implementation. The first local CLI probe has passed; wider capability and host
integration checks are engineering work, not a prerequisite the user must solve.
Benchmark sizing and numerical promotion gates are fixed after the diagnostic and
before confirmatory runs; they do not block writing and testing the transport.
