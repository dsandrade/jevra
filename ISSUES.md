# Implementation Backlog

> Delivery decision (2026-09-18): implement the [accepted architecture corrections](docs/focused-reader.md) and make the smaller [reader comparison](evals/reader-comparison/protocol.md) the next experiment. Preserve compact artifacts and historical negative/null results. Independent calibration, live adoption/quality/cost validation and DR-039 activation gates remain open; memory and the large artifact expansion are deferred.

> First reader observation (2026-09-18): the [matched Codex pair](evals/reports/2026-09-18-reader-comparison.md) passed authored code/fact checks with reconciled accounting, but the offered helper was never invoked. The scoped protocol enabled no read gate. Prioritize scoped gate delivery/adherence and adoption metadata before another matrix; no reader benefit or economic calibration follows.

> Gate preflight (2026-09-18): [14 built-hook cases and catalog availability passed](evals/reports/2026-09-18-reader-gate-validation.md), and one scoped definition completed normal Codex trust review. The optional session guidance mismatch is corrected. Bounded observations exist, but paid-runner wiring, native gate execution/delivery and ordinary helper adoption remain open. No new model inference or savings measurement occurred.

> Subsequent gate task (2026-09-18): the [wired single-cell diagnostic](evals/reports/2026-09-18-reader-gate-task.md) passed authored quality checks with 100,606 total tokens, but invoked no helper. Native gate execution/delivery remains unknown. The v1 preflight/parent user-config mismatch is corrected in v2, with scoped MCP isolation and all configured active invocation metadata; local checks passed 184 tests. No v2 paid task or savings claim follows. Preserve v1 snapshots and require fresh preparation before any separately bounded dispatch.

> First managed reader adoption (2026-09-18): a [fresh v2 cell](evals/reports/2026-09-18-reader-gate-task-v2.md) observed five gate entries, one redirect and one answered helper with passing authored task checks. One Luna generation and two Jev requests reconciled to 128,778 total tokens across all components. Compact delivery works in this scope; whole-task savings remain unproven. Next freeze a small matched native/reader comparison under the same corrected host context, before selected-corpus or memory expansion. No automatic paid retry or promotion follows.

Status: developer alpha implemented; release milestones remain open

Created: 2026-09-17

Source of truth for scope: [SPEC.md](SPEC.md)

The owner adopted the [2026-09-18 corrections](docs/focused-reader.md): production-gate/full-answer evaluation, narrow economic membership, fixed-packet batch reduction and an opt-in focused reader. Implementation does not authorize efficiency claims or automatic calibration promotion.

These are ready-to-refine issue drafts. IDs such as DR-001 are stable planning identifiers, not GitHub issue numbers. No implementation issue is complete merely because this document exists.

Priority: P0 = foundation or release blocker; P1 = required to validate and ship the initial experiment; P2 = later experiment, subject to evidence. Current implementation status appears below; unchecked acceptance criteria remain outstanding.

## Implementation snapshot — 2026-09-17

See [compatibility](docs/compatibility.md) and [component results](evals/reports/2026-09-17-component-pilot.md). Partial means executable work exists but the issue's full scope or acceptance remains open.

| ID | Status | Evidence and remaining work |
| --- | --- | --- |
| DR-001 | Partial | Codex marker and live Jev context delivery verified; authenticated read gates verified in both hosts; full lifecycle/trust and observation probes pending |
| DR-002 | Complete | Clean checkout passed npm ci/check/eval; [CI passed on macOS and Ubuntu](https://github.com/dsandrade/jevra/actions/runs/35257430261) |
| DR-003 | Partial | Typed core, policy, modes, fake provider, revisions; no general module registry |
| DR-004 | Partial | Official SDK, typed validation, sanitized failures, zero retries, live pilot; broader accounting/fault coverage pending |
| DR-005 | Implemented for configured roots | Bounded catalog and diagnostics, explicit references, revision checks; no host-internal registry discovery |
| DR-006 | Partial | Independent adapters and bundled hooks; authenticated read gates in both CLIs; version negotiation and normal installation pending |
| DR-007 | Partial | Single-call Choice + Noul route and configurable policy; two-stage comparison and calibration pending |
| DR-008 | Partial | Metadata traces, retention, deletion, doctor; no replay capture or automatic trust/adherence detection |
| DR-009 | Partial | Deadlines, cancellation, isolation, stale checks; deduplication, caching, session budgets, host failure matrix pending |
| DR-010 | Partial | 60-case component dataset plus two full coding tasks with native/deterministic/Jev arms, paired repetitions and external judges; independent real-world data pending |
| DR-011 | Partial | Component smoke and shunt full-task pilot; confirmatory skill-routing quality/efficiency experiment remains pending |
| DR-012 | Partial | Manifests, local build/config, manual setup/removal; full installation lifecycle pending |
| DR-013 | Partial | Public code/docs and reviewed synthetic results; versioned distribution and release gate pending |
| DR-014 | Experimental implementation | Shunt-style hooks, bounded bulk-read/code-context, Jev relevance scoring, exact provenance and full-task pilot; broader evidence and adoption gaps remain |
| DR-015–017 | Planned | Completion checks, explicit decisions and public framework remain unimplemented |
| DR-018 | Partial | Shunt hook/helper/skill architecture plus host-managed MCP for Keychain access; native plugin activation and helper adoption need further validation |
| DR-019 | Planned | Independently reviewed real-project cost/quality evaluation |
| DR-020/025 | Partial | Internal operation ledger and managed Jev routing/review exist; host reconciliation, session budgets and calibration remain pending |
| DR-023 | Partial | Restricted test artifacts, actual checks and one repair; opt-in MCP review/native application verified, broader profiles and ordinary adoption remain open |
| DR-027 | Partial | Frozen 12-cell artifact pilot completed; no consistent Jev-arm savings; grammar parity, repeated independent tasks and broader controls remain open |
| DR-021/024 | Planned in scoped increments | Start with required evidence/freshness; broader structure and reuse remain separate experiments |
| DR-022 | Partial | Fresh v2 gate cell observed ordinary answered-reader adoption and passing authored quality with 128,778 all-component tokens; repeated matched quality/cost, selected-corpus comparison and general activation remain open |
| DR-026 | Follow-on | Optional external-memory adapter |
| DR-028–033 | Planned | Adopted development-brain direction: contracts, native engineering memory, cross-host continuity, repository context, complex-task support and lifecycle evaluation; see [architecture](docs/development-brain.md) |
| DR-034 | Partial | First source-bound worker decision/transition registry, 25 offline tests and a live uncertain-outcome diagnostic; wider stages remain pending |
| DR-035–038 | Planned | Source-bound knowledge compilation, project profiles, assumption receipts and review-driven learning |
| DR-039 | Partial | Bounded Codex/Luna transport, 21 offline tests and two exact-output synthetic probes; broader policy/tool-catalog certification remains open |

## Milestones and dependencies

| Milestone | Outcome | Issues |
| --- | --- | --- |
| M0: Feasibility | Verified host behavior and implementation foundation | DR-001, DR-002 |
| M1: Observe | Both hosts produce comparable skill-routing observations without guidance | DR-003 through DR-009 |
| M2: Evaluate | Repeated baseline and active runs produce an evidence-backed decision | DR-010, DR-011 |
| M3: Initial release | Installable plugins with reliable lifecycle and public evaluation evidence | DR-012, DR-013 |
| M4: Further experiments | Context selection, completion checks, explicit decisions, and a possible framework | DR-014 through DR-017 |
| M5: Native development brain | Authorized technical memory survives host/session changes and detects stale source context | DR-034, DR-028, DR-029, DR-030, DR-031/035, plus DR-018/020 |
| M6: Measured development workflow | Bounded workers and complex-task support preserve quality with attributable full-lifecycle costs | DR-022, DR-023, DR-025, DR-032, DR-033, DR-036–038, plus DR-027 |

M0–M6 retain the historical outcome groups; their numbering is not the current
implementation order. The next delivery is the bounded worker slice of M6 before
M5 memory, as specified in the [v1 plan](docs/v1-delivery-plan.md). V1 dependencies
mean the required slices of existing issues; they do not require completing every
older skill-routing or memory criterion. No existing issue is renumbered or marked
complete by this sequencing change. Milestones are outcome gates, not calendar estimates.

## DR-001: Verify Codex and Claude Code integration capabilities

**Priority:** P0

**Milestone:** M0

**Depends on:** None

**Problem:** Documented hook names do not establish reliable behavior on actual installed versions and supported product surfaces.

**Scope:** Create a minimal non-semantic probe for each host. Verify request input, context delivery, tool observations, trust requirements, payload limits, timeouts, interruption, and plugin discovery. Inspect catalog discovery and available usage evidence.

**Acceptance criteria:**

- [x] Record tested host versions, OS, surface, commands, and sanitized fixtures.
- [ ] Demonstrate `UserPromptSubmit` guidance reaching the model in both hosts.
- [ ] Document reliable and unreliable ways to observe skill loading.
- [x] Publish a capability matrix distinguishing documented, verified, and unsupported behavior.
- [ ] Confirm that installation does not bypass native hook trust or permissions.
- [x] Record a supported fallback for unavailable catalog or transcript interfaces.
- [x] Review Spotify shunt's hook/script/skill separation as related work without assuming equivalent decision semantics or copying its host behavior unverified.

**Validation:** A minimal reproducible request in each host, plus missing-trust and malformed-output cases. No Jev call is required.

## DR-002: Scaffold the TypeScript workspace and CI

**Priority:** P0

**Milestone:** M0

**Depends on:** DR-001

**Problem:** The project needs an executable foundation whose version assumptions are reproducible.

**Scope:** Create the package layout from the specification, pin a supported Node.js LTS release and package manager, establish build/typecheck/test commands, and add CI. Select the official TypeSafe SDK or document a justified transport choice.

**Acceptance criteria:**

- [x] A clean checkout installs from a committed lockfile and builds with documented commands.
- [x] Package boundaries keep host schemas and provider transport out of the core.
- [x] CI runs relevant static checks and tests without live API credentials.
- [x] Runtime and dependency versions are pinned or constrained intentionally.
- [x] README documents actual commands and supported development platforms.

**Validation:** Run the clean-checkout workflow locally and in GitHub Actions.

## DR-003: Implement normalized decision contracts and the core pipeline

**Priority:** P0

**Milestone:** M1

**Depends on:** DR-002

**Problem:** Provider answers and host-specific outputs need a shared, testable boundary.

**Scope:** Define validated event, state, candidate, judgment, and result schemas. Implement module registration, deterministic eligibility, state revisions, policy application, and disabled/observe/advise modes.

**Acceptance criteria:**

- [x] Results separate raw judgments, runtime disposition, and host delivery.
- [x] Schema, question, policy, and state versions are carried through evaluation.
- [x] Unknown or stale candidates cannot become applied recommendations.
- [x] Noul is supported without a fabricated confidence field.
- [x] A fake provider can exercise the complete pipeline without a host or network.
- [x] Observe mode cannot emit model-visible routing advice.

**Validation:** Behavioral tests for recommendation, abstention, fallback, stale results, invalid candidates, and isolated concurrent sessions.

## DR-004: Implement the Jev provider with bounded calls

**Priority:** P0

**Milestone:** M1

**Depends on:** DR-003

**Problem:** A provider request must respect hook deadlines and preserve the meaning of typed judgments.

**Scope:** Implement authenticated evaluation, response validation, usage capture, model identification, error mapping, cancellation, deadlines, and bounded retries against the current documented API.

**Acceptance criteria:**

- [x] Choice, Noul, and Score responses map accurately to normalized judgments.
- [x] Independent questions can share a request without assuming sequential reasoning.
- [x] Total retry time and call count cannot exceed the configured budget.
- [x] Authentication, validation, rate-limit, overload, timeout, and malformed-response failures are distinguishable.
- [x] Credentials and raw request bodies do not appear in default logs or errors.
- [ ] Evaluations record the configured and returned model identifiers.

**Validation:** Transport fixtures for success and failure paths; a separately enabled live smoke check using a user-provided key.

## DR-005: Build a bounded skill catalog and state collector

**Priority:** P0

**Milestone:** M1

**Depends on:** DR-001, DR-003

**Problem:** Jev needs an accurate set of candidates and sufficient evidence without unrestricted file ingestion.

**Scope:** Discover skills through verified host interfaces or configured directories. Normalize IDs, descriptions, source paths, hashes, and optional bounded excerpts. Preserve explicit user choices and distinguish partial catalog coverage.

**Acceptance criteria:**

- [x] Catalog sources are explicit and constrained to configured roots.
- [x] Duplicate names, missing files, invalid metadata, symlinks, and changed content have defined behavior.
- [x] Catalog coverage and source failures are visible in diagnostics.
- [x] Explicitly selected known skills bypass semantic rerouting.
- [x] Multi-skill and unresolved requests use a documented fallback.
- [x] Inputs exclude full transcripts and full repositories by default.
- [x] Skill content cannot become an executable command or overwrite runtime policy.

**Validation:** Sanitized fixture catalogs with similar skills, no-match requests, duplicate names, out-of-root paths, and content changes.

## DR-006: Implement host adapters and hook entry points

**Priority:** P0

**Milestone:** M1

**Depends on:** DR-001, DR-003

**Problem:** Native hook protocols differ and need independent mappings around a common core.

**Scope:** Implement Codex and Claude Code input/output adapters and a small CLI hook runner. Produce short routing advice for the verified pre-response event. Normalize observation events without claiming unsupported skill-use coverage.

**Acceptance criteria:**

- [ ] Each adapter validates the host-specific payload and declares capabilities by tested version.
- [x] Supported guidance is delivered in the native output shape and bounded in size.
- [x] Disabled mode performs no provider request; observe mode injects no recommendation.
- [ ] Unavailable fields and unsupported versions have an explicit fallback and diagnostic.
- [x] Both adapters preserve native permissions and unrelated user hooks.
- [x] stdout carries only the host protocol; diagnostics use the appropriate separate channel.

**Validation:** Contract fixtures from DR-001 and real host smoke checks with a deterministic fake decision module.

## DR-007: Implement skill-selection questions and policy

**Priority:** P1

**Milestone:** M1

**Depends on:** DR-004, DR-005, DR-006

**Problem:** The first module must make one well-defined choice and expose its uncertainty and errors.

**Scope:** Rank eligible skills, assess applicability, and return at most one recommendation. Support no-match and abstention. Make single-call and shortlist-plus-verification strategies independently measurable.

**Acceptance criteria:**

- [x] Questions have stable IDs/versions and explicitly defined options and criteria.
- [x] No-match behavior does not force the nearest unsuitable skill.
- [x] Thresholds are configurable and documented as provisional until calibrated.
- [x] The module preserves explicit user skill selection and native instruction priority.
- [x] Advice identifies a validated catalog entry without copying the entire catalog into context.
- [x] Runtime explanations use observed facts and reason codes, not invented Jev reasoning.
- [x] Provider calls, questions, and input sizes respect configured limits.

**Validation:** Development fixtures spanning correct matches, close matches, no-match, uncertain, and multi-skill requests; compare strategy overhead.

## DR-008: Add local traces, privacy controls, and diagnostics

**Priority:** P1

**Milestone:** M1

**Depends on:** DR-003, DR-004, DR-006

**Problem:** The experiment needs inspectable evidence without silently retaining user content or overstating observed behavior.

**Scope:** Add local structured traces, bounded retention, deletion, safe diagnostic reports, and opt-in sanitized replay captures. Track recommendation delivery separately from adherence.

**Acceptance criteria:**

- [x] Default traces contain correlation IDs, versions, hashes, disposition, timing, and usage, excluding raw prompts and code.
- [x] Known, ignored, and unknown skill adherence remain distinct.
- [ ] Diagnostics identify inactive/untrusted hooks, missing credentials, unsupported versions, and partial catalogs.
- [x] Logs have a documented location, retention policy, and deletion path.
- [ ] Replay capture requires explicit opt-in and records enough sanitized state to reproduce a decision.
- [x] Reports never substitute zero for unavailable usage or outcomes.

**Validation:** Secret-marker and source-content fixtures verify default redaction; retained captures can replay a deterministic fixture end to end.

## DR-009: Harden lifecycle, fallback, concurrency, and caching

**Priority:** P0

**Milestone:** M1

**Depends on:** DR-004, DR-006, DR-007, DR-008

**Problem:** A consultative decision module must not hang a normal task or apply another event's result.

**Scope:** Add duplicate detection, per-session isolation, recursion protection, stale-result rejection, bounded failure handling, and version-aware caching. Expose cancellation and deadlines consistently.

**Acceptance criteria:**

- [x] Service errors, exhausted budgets, and malformed results return to native routing.
- [x] An interrupted request cannot later inject an obsolete recommendation.
- [x] Concurrent sessions cannot share mutable decisions or misattribute usage.
- [ ] Duplicate events do not create uncontrolled repeated API calls.
- [ ] Cache keys include relevant state, catalog, question, policy, and model identities.
- [ ] Cache behavior is observable, bounded, and separately measurable from fresh inference.
- [x] SDK retries cannot outlive the hook's total deadline.

**Validation:** Failure injection, concurrent session fixtures, interruption during evaluation, changed-catalog cache invalidation, and real-host timeout checks.

## DR-010: Build evaluation datasets and comparable baseline runners

**Priority:** P1

**Milestone:** M2

**Depends on:** DR-001, DR-006, DR-008

**Problem:** A plausible architecture is insufficient evidence of a useful product.

**Scope:** Build an initial 50-100-task pilot with provenance and independently reviewed labels. Add original-agent, deterministic-routing, and Jev-routing arms plus an optional oracle diagnostic. Capture full-task outcomes and available usage.

**Acceptance criteria:**

- [ ] Cases include close matches, no match, explicit skill selection, ambiguity, multi-skill requests, and coding outcomes.
- [x] Calibration and held-out cases are separated.
- [x] Each run records host/model/settings, repository state, catalog revision, conditions, and repeat index.
- [x] Runners preserve comparable clean workspaces and support paired repeated tasks.
- [x] Deterministic and Jev arms share equivalent integration plumbing where applicable.
- [ ] Cold and warm cache conditions are reported separately.
- [x] Actual charges, estimates, subscription usage, and missing values are distinct.
- [x] Context-size reductions are not reported as total system savings; include auxiliary provider calls and final task outcomes.
- [x] Success labels do not rely solely on Jev evaluating its own result.

**Validation:** Reproduce a small deterministic evaluation end to end before spending on full live runs.

## DR-011: Run observe and advise experiments and make the promotion decision

**Priority:** P1

**Milestone:** M2

**Depends on:** DR-007, DR-009, DR-010

**Problem:** We need to establish whether the decision layer improves quality, efficiency, both, or neither.

**Scope:** Run a pilot, calibrate policy on development cases, predefine overhead budgets and acceptable quality margins, then execute held-out repeated comparisons for both hosts.

**Acceptance criteria:**

- [ ] Observe-mode reports distinguish judgment quality from effects that require applied advice.
- [ ] Advise-mode reports include final task outcomes and examples of harmful suggestions.
- [ ] Reports include routing error rates, abstention, delivery/adherence, rework, total latency, and total usage/cost where available.
- [ ] Sample sizes, variation, exclusions, failures, versions, and budget settings are published.
- [ ] Single-call and two-stage routing are compared before selecting a default.
- [ ] The promotion decision uses the predeclared budgets/margins and records limitations.
- [ ] A negative or mixed result is retained rather than converted into a success claim.

**Validation:** Re-run a documented subset from a clean checkout using the published dataset and settings.

## DR-012: Package installation, configuration, upgrades, and removal

**Priority:** P1

**Milestone:** M3

**Depends on:** DR-006, DR-009, DR-011

**Problem:** Users need the same ordinary agent experience with a reversible integration lifecycle.

**Scope:** Finalize separate plugin manifests, CLI configuration, native trust guidance, user-owned credentials, compatibility diagnostics, upgrade handling, disable, and uninstall.

**Acceptance criteria:**

- [ ] A fresh installation works through a documented path in each supported host.
- [x] Setup clearly lists state sent to TypeSafe and how credentials are stored.
- [ ] Hook activation uses the host's supported review/trust flow.
- [ ] Existing unrelated hooks and configuration survive install, reinstall, upgrade, and removal.
- [ ] Unsupported versions produce a clear diagnostic without silently claiming support.
- [x] Disabling stops decisions; uninstall removes only owned configuration and offers documented data cleanup.
- [ ] Package contents exclude secrets, captures, local state, and development-only artifacts.

**Validation:** Fresh-profile lifecycle checks in both hosts, including installation alongside an unrelated hook.

## DR-013: Prepare the initial public release and contributor workflow

**Priority:** P1

**Milestone:** M3

**Depends on:** DR-011, DR-012

**Problem:** An open-source release needs accurate claims, reproducible evidence, and a maintainable support surface.

**Scope:** Update the README, usage guide, compatibility matrix, contribution guidance, bug templates, release notes, and evaluation report. Prepare versioned release artifacts; treat marketplace submission as a separate distribution choice.

**Acceptance criteria:**

- [x] README reflects actual implemented behavior and known limitations.
- [x] Public claims link to project measurements rather than borrowing provider benchmark results.
- [ ] The release identifies supported host, runtime, SDK, and provider model versions.
- [x] Evaluation data is synthetic or approved and free of credentials/private content.
- [ ] Contributors can build, test, and reproduce a small evaluation from a clean checkout.
- [x] License and third-party service requirements are clear.
- [x] Release notes state the default mode and how to disable or remove the integration.

**Validation:** Execute the documented onboarding and reproduction steps against the release candidate.

## DR-014: Experiment with controlled context selection

**Priority:** P1 (advanced by owner scope change)

**Milestone:** M2 / experimental alpha

**Depends on:** DR-004, DR-006, DR-008; promotion still requires DR-011

**Problem:** Agents may spend context and reasoning on irrelevant retrieved evidence.

**Scope:** Add a shunt-style PreToolUse read gate and explicit bulk-read/code-context CLI surface. Retrieve candidates in code, evaluate relevance with Jev, and return selected original passages with provenance. The main LLM writes code and summaries; no auxiliary generator is introduced.

**Acceptance criteria:**

- [x] Control is limited to the owned retrieval surface and described accurately.
- [ ] Required evidence and source attribution survive selection.
- [x] Empty results, conflicting evidence, and no-answer cases have defined behavior.
- [x] Retrieval plus Jev plus host-tool overhead is included in comparisons.
- [ ] Held-out full-task evaluations show whether the module merits release.

**Validation:** Paired retrieval/answer tasks with independent evidence labels and final-answer checks.

## DR-015: Experiment with bounded completion checks

**Priority:** P2

**Milestone:** M4

**Depends on:** DR-011, DR-013

**Problem:** An agent may stop with explicit requirements incomplete, but excessive continuation can also harm quality and cost.

**Scope:** Check requirements individually against observed artifacts and execution evidence. Use deterministic checks first and narrow semantic judgments where needed. Map verified findings to native stop-hook behavior.

**Acceptance criteria:**

- [ ] Observed test results remain distinct from assistant claims about tests.
- [ ] Missing evidence and uncertainty are represented explicitly.
- [ ] Continuations identify a specific unmet requirement and supporting evidence.
- [ ] A hard attempt limit prevents indefinite loops and respects user interruption.
- [ ] Evaluation measures both recovered omissions and unnecessary continued work.

**Validation:** Fixtures for incomplete work, completed work, unavailable evidence, false alarms, and repeated stop events in both hosts.

## DR-016: Add an experimental explicit decision MCP tool

**Priority:** P2

**Milestone:** M4

**Depends on:** DR-011, DR-013

**Problem:** Some useful decisions have candidates created during LLM reasoning rather than known before the request.

**Scope:** Expose a bounded `decision.evaluate` contract with caller-supplied candidates, evidence, and supported question templates. Document that the LLM must invoke it and that it does not own hidden reasoning.

**Acceptance criteria:**

- [ ] Inputs and outputs are typed and size-limited, with no-acceptable-option behavior.
- [ ] Candidate generation and evaluation costs are accounted for separately.
- [ ] Results cannot authorize actions or bypass native permissions.
- [ ] Tests cover missing candidates, poor evidence, and adversarial candidate text.
- [ ] A concrete benchmark establishes whether explicit evaluation adds value.

**Validation:** Paired bounded-choice tasks comparing native decisions with explicit Jev-assisted decisions.

## DR-017: Decide whether to publish a general framework API

**Priority:** P2

**Milestone:** M4

**Depends on:** DR-013 and at least one validated later module from DR-014, DR-015, or DR-016

**Problem:** A reusable library may help other integrations, but premature abstraction can freeze the wrong contracts.

**Scope:** Review actual repeated patterns, host differences, and external contribution needs. Decide whether to support a public module/provider API or keep the core internal.

**Acceptance criteria:**

- [ ] The decision is justified by at least two implemented and evaluated module use cases.
- [ ] Public contracts, capability negotiation, versioning, and compatibility guarantees are explicit if approved.
- [ ] A standalone example uses the core without relying on Codex or Claude Code internals.
- [ ] Unsupported enforcement claims and hidden host assumptions are absent.
- [ ] Keeping the core internal is an acceptable documented outcome.

**Validation:** A small independent integration demonstrates the proposed API before declaring it stable.

## DR-018: Validate shunt-style integration and helper adoption

**Priority:** P1

**Milestone:** M2 / experimental alpha

**Depends on:** DR-006, DR-014

**Problem:** Large-read interception can succeed while the host chooses targeted native reads instead of invoking Jev. Hook delivery alone is insufficient evidence of delegation or savings.

**Scope:** Preserve the hook/helper/skill split from Spotify shunt; validate normal plugin skill discovery and trust activation independently in Codex and Claude. Measure helper adoption and native fallback without blocking legitimate targeted reads.

**Acceptance criteria:**

- [x] Large full reads redirect; small and targeted reads retain native permissions.
- [x] Shell handling does not execute or expand model-proposed text.
- [x] Both plugins package bulk-reader and code-context guidance and the equivalent stdio MCP tools.
- [x] The API-calling MCP process can read Keychain without weakening Codex tool-shell permissions or exporting the credential to the model environment.
- [x] Code-context returns source references; the main LLM generates and validates code.
- [x] Configured roots, bounded files, exact excerpts, native fallback and upload fields are documented.
- [x] Read gates are observed in authenticated command-hook sessions in both CLIs.
- [x] Opt-in artifact MCP delivers reviewed candidates to both CLIs; a synthetic diagnostic distinguishes ordinary Codex adoption, native Claude fallback and explicit Claude invocation.
- [ ] Native plugin activation, skill discovery and changed-hook trust lifecycle are verified on both hosts.
- [ ] Helper adoption improves in ordinary tasks without forced reads or removal of native fallback.
- [ ] Measure native rereads after selection and test clearer coverage/provenance output without implying completeness or hiding uncertainty.
- [ ] Compare extra tool turns and context overhead against avoided reading before expanding default interception.
- [ ] Context/body reduction is accompanied by evidence of lower complete-task cost at preserved quality.

**Validation:** [Parity map](docs/shunt-parity.md), packaged CLI checks and [full-task pilot](evals/reports/2026-09-17-full-task-pilot.md). Native lifecycle and adoption remain separate from these command-hook results.

## DR-019: Measure independently reviewed real-project tasks

**Priority:** P1

**Milestone:** M2

**Depends on:** DR-010, DR-014, DR-018

**Problem:** Two author-designed synthetic tasks cannot establish general savings, and gate-only behavior cannot establish Jev's incremental value.

**Scope:** Build a reviewed task set using approved open-source snapshots, independent outcome checks, repeated paired runs and explicit cache conditions. Compare native, deterministic and Jev reading under normal plugin activation.

**Acceptance criteria:**

- [ ] Task provenance and allowed provider-upload scope are explicit.
- [ ] At least two independent reviewers validate required evidence and correctness checks.
- [ ] Tasks include multiple files, obsolete/conflicting evidence, code references, no useful result and helper failures.
- [ ] Runs separately record gate redirects, helper invocations, successful selections, fallback reads and unknown usage.
- [ ] Runtime, model, effort, cache conditions and budget settings are recorded with task and code revisions.
- [ ] Promotion requires preserved task quality, observed helper use and predefined conservative cost/latency gates.
- [ ] Negative outcomes and differences against deterministic retrieval remain published.

**Validation:** Reproduce a reviewed paired subset before spending on the full experiment; publish sanitized results and keep actual bills distinct from estimates.

## DR-020: Attribute whole-task context and delegation overhead

**Priority:** P0. **Depends on:** DR-008; DR-018 for ordinary host adoption evidence. **Status:** partial: internal per-operation ledger implemented.

Link redirect, helper call, selected evidence, tool result, native reread and repair to a session. Include idle plugin/tool-catalog overhead and source sizes without collecting private bodies by default.

Implemented slice: [managed operation ledger](docs/managed-worker.md) separates
Jev and CLI usage, failed calls, unknown usage/cache entries and unmeasured host/
billing/quota telemetry. It is in-memory accounting with explicit diagnostic
reports, not durable host/session reconciliation.

**Acceptance criteria:**

- [ ] Distinguish delivered, invoked, selected, reread and unknown events in both hosts.
- [ ] Record provider-specific input/cache/output and unknown usage; reconcile with whole-run totals without double counting.
- [ ] Attribute main-host, CLI-worker and Jev usage separately, including startup/context overhead, extra internal turns, failed attempts and repair; keep actual charges, API estimates and quota telemetry distinct.
- [ ] Validate ordinary plugin activation, not only direct command hooks.
- [ ] Publish a small paired diagnostic with native and active plugin sessions at the same model/effort.

## DR-021: Retrieve complete useful evidence under a token budget

**Priority:** P1. **Depends on:** DR-014, DR-020. **Status:** proposed.

Add language-aware symbol/section boundaries, relevant neighbors and progressive targeted reads. Use bounded lexical/structural candidate retrieval before Jev ranking in the managed workflow. Treat broader or oversized sources explicitly instead of silently assuming the current file cap covers them.

**Acceptance criteria:**

- [ ] Required-evidence recall and exact edit context are checked independently on cross-file, contradictory and no-answer cases.
- [ ] The same shortlist/output budget supports a deterministic comparison.
- [ ] Results expose partial coverage and versioned next-read handles; source changes invalidate handles.
- [ ] Native reads remain available; token and reread reductions include all extra calls.

## DR-022: Prototype a bounded generative bulk-reader

**Priority:** P1. **Depends on:** DR-020, DR-021, DR-025, DR-039. **Status:** partial: opt-in full/selected reader implemented; local boundary checks exist; live quality/cost validation remains open.

Reuse DR-039's versioned worker/transport interface for an opt-in focused-answer helper. Keep the existing evidence-only mode. Begin without worker tools or autonomous loops. This reader is not a prerequisite to DR-023.

The 2026-09-18 review proposes prioritizing this experiment to test the Shunt
large-corpus mechanism. It calls for matched ordinary native targeted reads,
existing excerpts, a full bounded-corpus reader and Jev-selected-corpus reader,
with exact citation checks, explicit gaps and subsequent-edit validation. Budget,
independent requirements and promotion gates must be frozen before paid calls;
the owner adopted this priority. The exploratory runner freezes selected subsets and defaults to two cells; independent review and confirmatory promotion remain pending.

The [first complete-task pair](evals/reports/2026-09-18-reader-comparison.md)
completed with both authored quality judges passing, but the parent made no helper
call. The evaluation server initialized with an empty inference ledger. No read
gate was enabled, so the complete gate-plus-reader mechanism was not exercised.
Next certify scoped native gate delivery/adherence and record bounded adoption
metadata. A separately labeled explicit reader diagnostic may establish wiring;
it cannot substitute for ordinary adoption or establish savings.

The [gate preflight](evals/reports/2026-09-18-reader-gate-validation.md) now
verifies the built gate's 14 synthetic cases, separate tool availability and one
normal scoped native trust transition. Guidance uses only common helper arguments.
The subsequently [wired gate cell](evals/reports/2026-09-18-reader-gate-task.md)
passed authored quality checks but adopted no helper. Native invocation/delivery
remains inconclusive. V2 corrects the readiness/parent user-config mismatch,
isolates unrelated MCPs with scoped flags and records configured active gate
invocations before parsing. Offline/zero-inference checks passed; no v2 paid task
ran. Preserve the original manifest and source snapshots; its used/superseded
scope cannot be reused. Next use fresh preparation and native review before a
separately bounded v2 adoption diagnostic. This is not full plugin activation,
native task-adherence certification or reader savings evidence.

The [fresh v2 cell](evals/reports/2026-09-18-reader-gate-task-v2.md) subsequently
observed five gate invocation records, one redirect and one answered helper. Its
full-corpus Luna generation and two Jev route/review requests passed authored
quality and reconciled accounting. Total usage was 128,778 tokens; no matched
contemporaneous baseline or savings claim follows. Next compare native and reader
under the same corrected configuration/instructions with all inference counted,
then evaluate Jev-selected corpus recall and contradiction handling. Preserve the
original v2 protocol snapshot; no automatic expansion or activation follows.

**Acceptance criteria:**

- [x] Mode pins model/instructions, input scope, output format, deadline and byte/call limits; monetary/quota limits remain unobservable.
- [x] Empty/failing responses cannot count as context savings; provider usage and failures remain visible.
- [x] Claims point to original evidence; exact edits use source text, not generated line numbers.
- [ ] Compare the same worker with full bounded corpus and selected corpus; measure coverage, repairs and complete-task cost.

## DR-023: Delegate predictable code into reviewable artifacts

**Priority:** P1. **Depends on:** DR-039 and the worker slices of DR-020/025/034. **Status:** partial: restricted profile and opt-in MCP delivery implemented; per-host diagnostics exist, broader delivery remains open.

Start with bounded TypeScript/Node test generation from explicit requirements and reference patterns, using Luna through Codex CLI. Return a staged artifact receipt instead of echoing the entire generated file into the host context. Fixtures/config/stubs are later extensions; no reader or durable-memory implementation is required.

Implemented [pure-function profile](docs/test-artifacts.md): runtime-owned source
bindings and fixed output, private staged candidates, closed AST admission, real
Node baseline/mutation checks, source-bound Jev review, at most one repair and a
separate create-only apply capability. Sixteen artifact tests passed. The
[live diagnostic](evals/reports/2026-09-17-test-artifact-probe.md) accepted and
applied one synthetic artifact; it needed no repair and establishes no savings.
The subsequent [MCP surface](docs/artifact-mcp.md) adds bounded process-local
idempotency and artifact delivery for native application. [Host results](evals/reports/2026-09-17-artifact-host-probe.md)
verify exact accepted bytes in both CLIs but do not guarantee native atomic writes
or repeated ordinary adoption.

The [Shunt cost audit](docs/shunt-cost-audit.md) led to the opt-in
[compact native-ticket path](docs/artifact-materialization.md): accepted signed
tickets, exact configured-source selection and a deterministic native-permission
materializer. Eight additional offline tests cover its acceptance/integrity,
freshness, scope, durable handoff and create-only boundary. MCP still cannot write
the target. Repeated host adoption and measured savings remain unproven.
The [compact host diagnostic](evals/reports/2026-09-18-materialization-host-probe.md)
observed one-call generation and exact-byte native materialization in Codex.
Claude connected but completed natively; its compact-path adoption is unverified.

**Acceptance criteria:**

- [x] Initial pure-function profile has no arbitrary model-selected output path, overwrite, command or permission expansion.
- [ ] Source/preimage hashes, authorized apply, atomic writes and stale-state rejection are defined per host.
- [ ] Syntax, independent task checks, compact validation receipts and selective host review cover accepted output.
- [ ] Default successful delivery avoids full-body helper output and parent regeneration; a bound native materializer preserves acceptance, hashes, destination, expiry and permission checks, with targeted review available.
- [x] Routine invocation can resolve an already-configured source/profile without a mandatory discovery turn; exact ambiguous matches fail before inference, while future semantic selection belongs to Jev.
- [ ] A single bounded repair policy and native escalation are measured, including failed attempts.
- [x] Internal generation and repair each receive a fresh explicit packet, with at most two invocations; broader DR-039 host/config isolation certification remains open.
- [x] Initial profile keeps candidates pending until actual required checks and Jev's requirement review finish; independently supplied mutants test effectiveness beyond a passing baseline.
- [ ] Debugging, architectural changes and sensitive operations retain the main-agent path by policy.

## DR-024: Reuse evidence and compact deterministic tool results

**Priority:** P1. **Depends on:** DR-009, DR-020, DR-021. **Status:** proposed.

Implement exact revision-aware caches, concurrent deduplication and optional wrappers for large diffs/test logs. Emit a compact result with an accessible original, keeping exit status and failures. Do not assume generic hooks can replace every native tool result.

**Acceptance criteria:**

- [ ] Keys cover scope/access, source hash, query, model/mode/question version and relevant budgets.
- [ ] Edits, withdrawals, permission changes and session compaction cannot serve stale or inaccessible evidence as current.
- [ ] Cache hits, misses and saved API requests are measured; provider prompt caching stays a separate category.
- [ ] Errors, warnings and failing tests survive compaction; unsupported host surfaces stay native.

## DR-025: Route eligible work with Jev judgments and cost accounting

**Priority:** P1. **Depends on:** minimum DR-020 accounting and DR-034 receipts. **Status:** partial: managed test-generation route implemented; calibration and session budgets pending.

Apply deterministic eligibility first, then use Jev for every required semantic routing/support judgment through DR-034. Add a session budget and circuit breaker; reuse existing DR-015 for bounded completion checks.

Define and test the initial route against fixed worker capabilities before those
workers are fully implemented. Do not create a dependency on finishing DR-022/023
before their own semantic route can exist. Expand registered routes incrementally.

**Acceptance criteria:**

- [x] Initial test-worker Choice includes native/abstention; relevance Score and requirement judgments use explicit candidates and exact evidence.
- [x] Initial worker confidence gates only candidate delivery; it grants no permissions and cannot replace trusted tests.
- [ ] Cost admission counts worker/Jev calls, added host turns, cache classes, reviews and repair; missing usage remains unknown.
- [ ] An identical worker pipeline without Jev isolates the incremental effect of Jev on held-out tasks.
- [ ] Independent judgments share useful state; dependent steps have separate bounded calls and calibrated thresholds.

Selected-packet operations use three bounded batches; configured fixed packets use two, plus one if repair is needed. Per-operation budgets and full typed answers exist. The first live diagnostic
stopped at uncertain continuation; thresholds remain provisional. See the
[recorded result](evals/reports/2026-09-17-managed-worker-probe.md). Session-wide
cost admission and matched controls remain open.

The 2026-09-18 [economic contract](docs/economic-routing.md) adds an optional
first-batch Choice backed by trusted whole-task component ranges, quality/adoption
checks, fixed bounds and explicit unknowns. Observe/enforce modes and compact
native handoff are implemented. Ten added offline tests pass. The four-case
[live question diagnostic](evals/reports/2026-09-18-economic-routing.md) included
positive-case uncertainty; no default calibration, confidence tuning or economic
promotion follows. Automatic calibration ingestion and independently validated
applicability remain open.

The subsequent [16-case comparison](evals/reports/2026-09-18-economic-applicability.md)
accepted 0/4 authored positives under the current economic Choice versus 4/4 under
an evaluation-only membership Noul plus computed admissibility. Neither accepted
12 blocking cases. Preserve the evaluator defect (relevance 2 instead of runtime
1.5; omitted relevance answers): combined route conclusions are invalid and cannot
be rescored from saved data. The frozen results/questions remain unchanged. The new [v2 evaluator](evals/economic-applicability-v2/protocol.md) uses production gates/full typed answers; runtime economic routing now defaults to narrow membership plus deterministic eligibility. Independent applicability/calibration validation remains open.

## DR-026: Add an optional versioned memory-provider contract

**Priority:** P2. **Depends on:** DR-021, DR-024. **Status:** proposed.

Design a read-only adapter for external organizational memory with search/read, source revisions, provenance and access-scoped caching. Keep private deployments outside the public core. This connector is separate from the native engineering memory adopted in DR-028–030; it does not satisfy that requirement.

**Acceptance criteria:**

- [ ] The plugin works without an external brain service; no organization endpoint, credential or private content enters public fixtures.
- [ ] Authorization precedes candidate selection and cache reuse; project configuration is not treated as record-level ACL.
- [ ] Memory freshness and retrieval omissions are explicit; memory does not silently override current source code or permissions.
- [ ] Measure incremental value and overhead on repeated-project tasks; do not attribute unrelated worker savings to memory.

## DR-027: Compare native, retrieval, worker and Jev pipelines

**Priority:** P1. **Depends on:** DR-019, DR-020, DR-023, DR-025; DR-022 for the adopted next reader comparison. **Status:** partial: exploratory artifact pilot completed; confirmatory validation remains open.

Extend DR-019 with the staged protocol and proposed promotion gates in the [architecture plan](docs/token-efficiency-plan.md#evaluation-that-can-support-a-superiority-claim). Confirm budget and statistical adequacy before freezing a confirmatory sample.

The [artifact pilot](evals/reports/2026-09-17-artifact-comparison.md) completed all
12 planned cells with known host/worker/Jev usage. All eight offered helper cells
requested generation. Jev's aggregate upper cost scenario increased 1.4% on Codex
and 26.0% on Claude versus native. One native output failed grammar admission;
the unequal grammar guidance prevents a quality-superiority interpretation. One
Jev-unresolved artifact was applied through native bypass. Keep these observations
separate from acceptance and from the older read-gate experiment.

**Acceptance criteria:**

- [x] Separate context-body compression, all-provider tokens, complete-task cost, actual charges and subscription quota evidence; unobservable charges/allowance remain unknown.
- [x] Preserve native and same-worker-without-Jev controls for the artifact pilot, including failed attempts; deterministic retrieval remains in the separate reading experiment.
- [ ] An actual Spotify comparison requires authenticated AiKA; otherwise label the control shunt-style reproduction.
- [ ] Independent task checks, grouped paired intervals, cache reporting, repeated runs and per-host gates are frozen before results.
- [x] The artifact comparison records transport/authentication/model/CLI versions and verifies admitted generated-test effectiveness against independent seeded mutations.
- [x] Record null/negative results in sanitized repository artifacts; never claim superiority from different datasets, an empty answer or a bytes-only ratio.
- [ ] Correct grammar-instruction parity across arms and record a sanitized rejected-syntax category before the next protocol; do not reinterpret the original failure as functional incorrectness.
- [ ] Preserve final managed termination reasons and measure unaccepted-candidate reuse separately from accepted application.
- [ ] Compare a shorter parent handoff with the existing three-tool flow while preserving Jev transitions, source binding and native permissions.
- [ ] Compare compact artifact tickets/native materialization, not just fewer full-body responses; measure retained host work and small-task cases where delegation should be declined.
- [ ] Calibrate requirement scope and abstention on new correct/incorrect candidates, then freeze repeated tasks and cache conditions; no threshold tuning against this pilot.

The [v2 proposal](evals/artifact-comparison-v2/protocol.md) has six 4/8/24-example
workloads, shared runtime/parent grammar, reproducible proposed block orders,
delivery/managed-Jev/hook contrasts, non-executing rejected-syntax diagnostics and
normalized parent/worker/Jev/hook accounting utilities. All six authored canonical
outputs passed baseline and four seeded-mutant checks offline. `prepare.ts` only
writes a manifest (144 proposed base cells; 162 with the optional Claude hook).
No paid cells ran. This large proposal is deferred in favor of [the smaller reader comparison](evals/reader-comparison/protocol.md). Artifact expansion still needs matching adapters/worker-ticket control,
independent review, production gate/full-answer parity, failure-injection accounting,
cache/budget freeze and confirmatory validation; utilities alone do not close the
acceptance criteria above.

## DR-028: Define engineering-memory and task-state contracts

**Priority:** P0. **Depends on:** DR-003. **Status:** planned; adopted product direction.

Define the [development-brain](docs/development-brain.md) record types, lifetimes and authority boundaries. Separate repository-derived evidence, durable technical memory and temporary task state.

**Acceptance criteria:**

- [ ] Technical decisions, constraints, observations, investigations, attempts, validations and questions have versioned schemas.
- [ ] Lifecycle and evidence status are distinct; hypotheses and unsuccessful attempts never become verified facts by summarization alone.
- [ ] Repository, worktree, source revision/hash, dirty-checkout and permission scope are explicit; directory names alone do not identify repositories.
- [ ] Capture policies distinguish authorized explicit writes from optional observed-event capture and candidate lessons.
- [ ] Idempotency, conflict/supersession, withdrawal/purge and stale-source behavior are specified with synthetic examples.

## DR-029: Build the local engineering-memory store

**Priority:** P1. **Depends on:** DR-028. **Status:** planned.

Implement an embedded store with lexical search and exact source provenance. Evaluate a SQLite/FTS5 binding within the existing Node/TypeScript stack; keep deployments and private organization data out of the public package.

**Acceptance criteria:**

- [ ] The supported macOS/Linux installation can create, migrate, search and read the store without a cloud account or embedding provider.
- [ ] Transactional writes return revisioned receipts and enforce idempotency/revision preconditions.
- [ ] Concurrent host processes, interrupted writes, corruption diagnostics and stale handles have bounded tested behavior.
- [ ] Correction/withdrawal invalidates retrieval and caches; explicit purge removes retained payloads and derived indexes under documented backup policy.
- [ ] Backup/restore and scoped export/import round trips preserve records and provenance; uninstall does not silently delete memory.
- [ ] User memory stores and source captures stay outside Git by default; publication checks verify the repository contains only intended public artifacts.

## DR-030: Verify memory continuity between Codex and Claude

**Priority:** P1. **Depends on:** DR-018, DR-029. **Status:** planned.

Expose bounded memory operations through existing host-managed MCP. Deliver a minimal context pack in a fresh session using authorized search/read, with optional hook guidance only where verified.

**Acceptance criteria:**

- [ ] Save an explicit technical decision in one host; retrieve it in a fresh session of the other without replaying the prior transcript.
- [ ] Correct and withdraw the record, then demonstrate that neither host receives the obsolete version as active.
- [ ] Editing a source, switching a worktree and revoking scope trigger the expected applicability/invalidation behavior.
- [ ] Two unrelated repositories cannot retrieve each other's records; explicitly bound workspaces can share authorized records.
- [ ] Record actual memory invocation and delivered bytes/tokens; a hook firing or cursor advancing is not comprehension evidence.
- [ ] Capture respects existing authorization; unavailable memory leaves native coding usable.

## DR-031: Index current repository structure incrementally

**Priority:** P1. **Depends on:** DR-021, DR-028, DR-029. **Status:** planned.

Add revision-aware local file/symbol/reference/test candidates to the context engine. Start with explicitly supported languages and a lexical fallback; use memory and code as separately attributed sources.

**Acceptance criteria:**

- [ ] Authorized roots, excludes and secret/build/vendor exclusions are enforced before indexing or provider upload.
- [ ] Content changes, dirty worktrees, deletions and renames update or invalidate the derived index.
- [ ] Candidate recall includes required neighboring definitions and counterexamples on independent cross-file fixtures.
- [ ] Evidence packs include original spans, hashes, scope, stale/partial warnings and progressive-read handles.
- [ ] Index/update/retrieval overhead is reported; embeddings remain optional until measured against the lexical/structural baseline.

## DR-032: Support bounded complex-task investigation

**Priority:** P1. **Depends on:** DR-020, DR-028, DR-030. **Status:** planned.

Implement visible task state for requirements, competing hypotheses, evidence, attempts, validation and next steps. The main agent generates candidate plans and integrates artifacts; Jev evaluates/selects semantic alternatives through DR-034. Optional workers are bounded generators, not a replacement conversation loop.

**Acceptance criteria:**

- [ ] Task lifecycle supports collect/investigate/propose/validate/accept/repair/escalate/stop with cancellation and finite repair budgets.
- [ ] Hypotheses retain their evidence state and cannot be promoted solely by worker self-report or Jev confidence.
- [ ] Validation receipts refer to actual artifacts, commands, source revisions and observed outcomes.
- [ ] The principal LLM generates complex debugging/architecture alternatives; Jev evaluates/selects or abstains. Independent generative delegation remains optional and measured.
- [ ] Accepted findings can become scoped durable memory under the capture policy; unresolved work resumes without full-chat storage.
- [ ] Native authority applies to all execution and artifact writes; costs include unsuccessful investigations and repair.

## DR-033: Evaluate development-brain quality and lifecycle cost

**Priority:** P1. **Depends on:** DR-027, DR-030, DR-031, DR-032. **Status:** planned.

Extend the whole-task study to continuity, memory applicability and complex programming. Freeze quality/cost targets per task family before confirmatory runs.

**Acceptance criteria:**

- [ ] Independently reviewed tasks include multi-file defects, architectural constraints, stale/misleading memory and cross-host continuation.
- [ ] Memory-only, worker-without-Jev and worker-with-Jev ablations isolate each contribution against native/deterministic controls.
- [ ] Correctness checks remain independent of the worker and Jev; source freshness, memory isolation and regressions are separately scored.
- [ ] Full-lifecycle accounting includes initial indexing, updates, retrieval, all providers, repair and failed attempts; single-use and repeated-project results are separate.
- [ ] Report quality/cost tradeoffs rather than promising simultaneous improvements on every task; negative/inconclusive results remain visible.
- [ ] Install, upgrade, backup/restore, withdrawal/purge and uninstall are verified before claiming complete-product readiness.

## DR-034: Centralize managed semantic decisions in Jev

**Priority:** P0. **Depends on:** DR-003, DR-004, DR-020. **Status:** partial: first managed worker registry implemented.

Implement the [decision registry and receipts](docs/decision-architecture.md) in the existing core. All explicit managed semantic decisions use Jev. Extend DR-016's explicit tool without requiring a public framework or unsupported host interception.

**Acceptance criteria:**

- [ ] Each registered question declares stage, primitive, versioned criteria/state, candidate origin, limits and outcome policy; no hidden LLM semantic fallback exists in a managed transition.
- [ ] The transition runner requires matching Jev receipts or exact valid cached receipts; reject stale evidence/state, unknown candidates and changed scope.
- [ ] Permissions, mandatory checks, exact operations, user choices and arithmetic stay deterministic. A model answer cannot override them.
- [ ] Test provider outage, malformed results, missing alternatives, abstention, budget exhaustion and native bypass without losing task checkpoints.
- [ ] Report managed/advisory/bypass outcomes, instrumented stages and observable adoption; never claim coverage of hidden host decisions.
- [x] First internal slice covers worker routing, evidence relevance/support and bounded continuation, with offline fixtures and operation accounting. Memory applicability/retrieval follows later.

`managed-test-worker/2` enforces locally owned, source-bound Jev receipts without
receipt import or LLM fallback. Twenty-five offline tests passed. One live run
generated a candidate and reviewed it but withheld continuation as uncertain.
Broader registry stages, persistent checkpoints/cache, calibrated quality and
ordinary host adoption remain open; see [implementation details](docs/managed-worker.md).
The optional artifact profile now adds review with actual validation evidence and
an eligible-action set that prevents acceptance after failed checks or a third generation.

## DR-035: Compile source-bound engineering knowledge incrementally

**Priority:** P1. **Depends on:** DR-028, DR-029, DR-031, DR-034. **Status:** planned.

Extend the repository index with small derived patterns, flows and anti-patterns. LLMs propose records; Jev evaluates kind, source support and reuse usefulness. Implement the module from scratch against the versioned Jevra contracts.

**Acceptance criteria:**

- [ ] Each derived record binds exact source spans/hashes, worktree/snapshot, derivation version and Jev support receipts; generation date or title hash alone is insufficient.
- [ ] Renames, deleted files, dirty checkouts and corrections invalidate dependent records/caches; failed updates cannot advance the index cursor.
- [ ] Unchanged sources skip regeneration; changed modules reconcile absent records, rather than only upserting new ones.
- [ ] Retrieval returns metadata before bounded selected bodies, with progressive expansion and explicit partial coverage.
- [ ] Independent fixtures detect unsupported summaries and required counterexamples; evaluate cold ingestion, updates and repeated-use economics separately.

## DR-036: Define project profiles and semantic impact checks

**Priority:** P1. **Depends on:** DR-028, DR-031, DR-034. **Status:** planned.

Add small declarative profiles for supported stacks, test entry points, accepted constraints and dependency/contract relationships. Jev evaluates semantic applicability and candidate impact; explicit project requirements remain binding.

**Acceptance criteria:**

- [ ] Profiles have versions, scope and provenance; load only applicable optional guidance instead of a monolithic playbook.
- [ ] Cross-component fixtures cover API consumers/producers, schema and frontend behavior without relying on private project identities.
- [ ] UI, persisted-data and AI behavior impacts can request appropriate behavioral checks; mandatory checks cannot be dropped by Jev.
- [ ] Unmapped components and partial dependency coverage remain explicit; scope expansion cannot grant access to another repository.
- [ ] Report context overhead, missed impacts and test cost against the same tasks without profiles.

## DR-037: Track evidence-backed assumptions and clarification

**Priority:** P1. **Depends on:** DR-028, DR-032, DR-034. **Status:** planned.

Extend task state with candidate alternatives, Jev selections, evidence and unresolved information. Retrieve applicable context before requesting information already available, while preserving real user decisions and explicit constraints.

**Acceptance criteria:**

- [ ] Each managed assumption records requirement, alternatives, selected option or abstention, supporting/contradicting evidence and Jev receipt.
- [ ] Missing user/business values, conflicting requirements and omitted candidates cannot be silently filled by repository precedent.
- [ ] Neither precedent counts, lexical similarity nor newest-file timestamps are treated as calibrated correctness confidence.
- [ ] Dependent questions use updated state; exact repeated decisions can reuse valid receipts without replaying the transcript.
- [ ] Independent tasks measure unnecessary questions, necessary questions preserved, incorrect assumptions, candidate recall and whole-task quality/cost.

## DR-038: Add bounded independent review and scoped learning

**Priority:** P1. **Depends on:** DR-015, DR-029, DR-032, DR-034. **Status:** planned.

Implement an optional isolated review mode and a correction-to-lesson lifecycle. A reviewer generates findings; Jev evaluates support, severity and coverage. Runtime policy governs finite repair and memory writes.

**Acceptance criteria:**

- [ ] Review context contains relevant requirements, current sources and diff without the author's full conversation; isolation does not count as independent ground truth.
- [ ] Unsupported serious findings trigger evidence retrieval or an unresolved status, not automatic downgrade and acceptance; thresholds are versioned and independently evaluated.
- [ ] Every repair references the prior finding, actual validation receipts and source revision; cancellation/outage resumes from a consistent checkpoint.
- [ ] Lessons distinguish observed facts, proposed explanations and reusable practices. Jev evaluates novelty/conflict/applicability; configured write/review policy governs promotion.
- [ ] A single successful attempt cannot silently become a global rule; corrections, counterexamples and source invalidation affect retrieval.
- [ ] Measure recurring-error prevention, false-lesson retrieval and all review/repair/capture costs; learning failure cannot rewrite a successful task outcome.

## DR-039: Build a fresh noninteractive CLI worker transport

**Priority:** P0. **Depends on:** existing DR-003/008 contracts and the relevant DR-009 lifecycle controls. **Status:** partial; transport implemented and locally probed, broader capability certification pending.

Implement the [fresh request execution contract](docs/worker-architecture.md#fresh-request-execution-contract)
with Codex CLI and `gpt-5.6-luna` first. Separate model/profile from transport, while
keeping only one transport required for v1. The parent host may be Claude Code or
Codex. Claude CLI and direct provider adapters remain follow-on work.

**Acceptance criteria:**

- [x] Versioned request/result types distinguish generated candidates, unavailable/auth/limit failures, cancellation, timeout and invalid output; usage can be unknown.
- [x] Launch the configured executable with an argument array and bounded stdin, without interpolating task text into a shell command.
- [ ] Start fresh noninteractive sessions, disable session persistence, and verify that parent history, unrelated plugins/MCP/hooks and worker recursion are absent; preserve applicable instructions and managed policy.
- [ ] Inspect effective tool access and residual prompt overhead on recorded CLI versions. Ephemeral/read-only flags alone cannot pass the isolation gate.
- [x] Use supported CLI authentication without extracting login tokens; prevent unintended API credential overrides and silent paid/model/transport fallback.
- [x] Bound input, event/output bytes, artifact size, concurrency and time; cancellation cleans up the process tree and cannot publish a late result.
- [x] Parse structured events/results, preserve failures and actual model metadata, and attribute usage without conflating estimates with subscription charges.
- [x] Fake-child fixtures cover malformed/truncated streams, nonzero exits, limits, timeout, cancellation and cleanup without credentials or provider calls.
- [x] A bounded synthetic live probe verifies Luna output, intended authentication and observed context/tool behavior; publish sanitized findings and limitations before the artifact integration.

**Validation:** Offline transport tests first; then one small capability probe.
Do not modify the user's global CLI settings or infer end-to-end compatibility
from `--help`, login status or the cached model listing alone.

**Evidence:** [Local probe report](evals/reports/2026-09-17-cli-worker-probe.md),
`tests/worker.test.ts`, internal contracts in `packages/core/src/worker.ts` and the
transport in `packages/cli/src/codex-worker.ts`. No tool items were observed in the
two probes; an exhaustive available-tool audit across managed configurations has
not been completed. Standalone user hooks fail before inference. The responding
model is unknown when the stream omits it; the configured Luna model is recorded
separately. The subsequent managed artifact workflow and opt-in MCP surface reuse this transport; broader capability certification remains open.

## Traceability

| Specification concern | Issues |
| --- | --- |
| Host compatibility and ordinary user experience | DR-001, DR-006, DR-012 |
| Shared core and provider contracts | DR-002, DR-003, DR-004 |
| Bounded skill selection | DR-005, DR-007 |
| Observability, privacy, and measurement | DR-008, DR-010, DR-011 |
| Failure recovery, isolation, caching, and budgets | DR-004, DR-009 |
| Open-source release | DR-012, DR-013 |
| Shunt-style reading and evidence selection | DR-014, DR-018, DR-019 |
| Future modules and framework decision | DR-015 through DR-017 |
| Proposed token-efficiency expansion and matched worker controls | DR-020 through DR-027 |
| Native engineering memory and cross-host continuity | DR-028, DR-029, DR-030 |
| Repository-aware complex programming and lifecycle evaluation | DR-031, DR-032, DR-033 |
| Managed semantic ownership and decision coverage | DR-034, DR-003/004/016/020/025 |
| CLI-first artifact worker v1 | DR-039, scoped DR-020/034/025, DR-023, DR-018/012, DR-019/027 |
| Source-bound knowledge, impact profiles, assumptions and scoped learning | DR-035, DR-036, DR-037, DR-038 |
