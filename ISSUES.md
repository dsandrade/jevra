# Implementation Backlog

Status: developer alpha implemented; release milestones remain open

Created: 2026-09-17

Source of truth for scope: [SPEC.md](SPEC.md)

These are ready-to-refine issue drafts. IDs such as DR-001 are stable planning identifiers, not GitHub issue numbers. No implementation issue is complete merely because this document exists.

Priority: P0 = foundation or release blocker; P1 = required to validate and ship the initial experiment; P2 = later experiment, subject to evidence. Current implementation status appears below; unchecked acceptance criteria remain outstanding.

## Implementation snapshot — 2026-09-17

See [compatibility](docs/compatibility.md) and [component results](evals/reports/2026-09-17-component-pilot.md). Partial means executable work exists but the issue's full scope or acceptance remains open.

| ID | Status | Evidence and remaining work |
| --- | --- | --- |
| DR-001 | Partial | Codex marker and live Jev context delivery verified; Claude login, lifecycle/trust matrix, and observation probes pending |
| DR-002 | Complete | Clean checkout passed npm ci/check/eval; [CI passed on macOS and Ubuntu](https://github.com/dsandrade/jevra/actions/runs/35249951291) |
| DR-003 | Partial | Typed core, policy, modes, fake provider, revisions; no general module registry |
| DR-004 | Partial | Official SDK, typed validation, sanitized failures, zero retries, live pilot; broader accounting/fault coverage pending |
| DR-005 | Implemented for configured roots | Bounded catalog and diagnostics, explicit references, revision checks; no host-internal registry discovery |
| DR-006 | Partial | Independent adapters and bundled hooks; authenticated Claude and version negotiation pending |
| DR-007 | Partial | Single-call Choice + Noul route and configurable policy; two-stage comparison and calibration pending |
| DR-008 | Partial | Metadata traces, retention, deletion, doctor; no replay capture or automatic trust/adherence detection |
| DR-009 | Partial | Deadlines, cancellation, isolation, stale checks; deduplication, caching, session budgets, host failure matrix pending |
| DR-010 | Partial | 60-case component dataset and two runners; independent review, native/full-task arms, paired repetitions pending |
| DR-011 | Planned | Component smoke report exists; confirmatory quality/efficiency experiment and promotion decision pending |
| DR-012 | Partial | Manifests, local build/config, manual setup/removal; full installation lifecycle pending |
| DR-013 | Partial | Public code/docs and reviewed synthetic results; versioned distribution and release gate pending |
| DR-014–017 | Planned | Later experiments; no implementation yet |

## Milestones and dependencies

| Milestone | Outcome | Issues |
| --- | --- | --- |
| M0: Feasibility | Verified host behavior and implementation foundation | DR-001, DR-002 |
| M1: Observe | Both hosts produce comparable skill-routing observations without guidance | DR-003 through DR-009 |
| M2: Evaluate | Repeated baseline and active runs produce an evidence-backed decision | DR-010, DR-011 |
| M3: Initial release | Installable plugins with reliable lifecycle and public evaluation evidence | DR-012, DR-013 |
| M4: Further experiments | Context selection, completion checks, explicit decisions, and a possible framework | DR-014 through DR-017 |

The primary dependency sequence is DR-001 -> DR-002 -> DR-003 -> DR-004, followed by catalog, adapter, routing, and trace integration. Build both host adapters early. Milestones are outcome gates, not calendar estimates.

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
- [ ] Each run records host/model/settings, repository state, catalog revision, conditions, and repeat index.
- [ ] Runners preserve comparable clean workspaces and support paired repeated tasks.
- [ ] Deterministic and Jev arms share equivalent integration plumbing where applicable.
- [ ] Cold and warm cache conditions are reported separately.
- [x] Actual charges, estimates, subscription usage, and missing values are distinct.
- [ ] Context-size reductions are not reported as total system savings; include auxiliary provider calls and final task outcomes.
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

**Priority:** P2

**Milestone:** M4

**Depends on:** DR-011, DR-013

**Problem:** Agents may spend context and reasoning on irrelevant retrieved evidence.

**Scope:** Add a bounded retrieval surface owned by the runtime, potentially exposed through MCP. Retrieve candidates in code, evaluate relevance with Jev, and return selected passages with provenance.

**Acceptance criteria:**

- [ ] Control is limited to the owned retrieval surface and described accurately.
- [ ] Required evidence and source attribution survive selection.
- [ ] Empty results, conflicting evidence, and no-answer cases have defined behavior.
- [ ] Retrieval plus Jev plus host-tool overhead is included in comparisons.
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

## Traceability

| Specification concern | Issues |
| --- | --- |
| Host compatibility and ordinary user experience | DR-001, DR-006, DR-012 |
| Shared core and provider contracts | DR-002, DR-003, DR-004 |
| Bounded skill selection | DR-005, DR-007 |
| Observability, privacy, and measurement | DR-008, DR-010, DR-011 |
| Failure recovery, isolation, caching, and budgets | DR-004, DR-009 |
| Open-source release | DR-012, DR-013 |
| Future modules and framework decision | DR-014 through DR-017 |
