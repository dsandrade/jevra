# Jev decision architecture and engineering workflow

> Current correction contracts (2026-09-18): see [focused reader and corrected decisions](focused-reader.md). Fixed artifact packets now share route/support; economic routing defaults to narrow membership and code-owned eligibility. Dated diagrams/diagnostics below remain scoped to their recorded version.

> Delivery update (2026-09-17): the [internal managed worker](managed-worker.md) implements routing, evidence and continuation. The [restricted artifact profile](test-artifacts.md) now adds observed checks and one-repair decisions. Host invocation/review is next in [CLI-first worker v1](v1-delivery-plan.md). Memory and broader stages follow incrementally. The ownership policy below is unchanged, and the full stage map is not a mandatory sequence for every operation.

Date: 2026-09-17. Status: owner-adopted target; not implemented in `0.1.0-alpha.2`. This document supersedes earlier target wording that made Jev optional for semantic decisions or assigned final architecture/debugging selection to the principal LLM. It does not rewrite historical experiments or current fallback behavior.

## Decision ownership

Every explicit semantic decision in a Jevra-managed workflow goes through Jev, using Choice, Score or Noul. The principal LLM and optional workers generate candidate requirements, queries, hypotheses, plans, code and findings. Jev evaluates those candidates against bounded evidence and criteria. Deterministic runtime policy interprets the typed results, preserves user instructions and controls execution.

This includes architecture and debugging: the LLM explores and proposes; Jev selects among eligible supplied alternatives or requests more evidence. Candidate generation is consequential: Jev cannot recover an omitted alternative or infer an unseen repository. Record candidate origin, omissions and coverage; evaluate candidate recall as well as selection quality.

This policy covers decisions made through the plugin's managed interfaces. Hooks cannot intercept every internal Codex/Claude judgment. Native conversation, reasoning during generation, unobserved tool choices and final host behavior remain outside that guarantee. Report the observed boundary rather than claiming all host reasoning has moved to Jev.

| Operation | Owner | Example |
| --- | --- | --- |
| Explicit user preference or instruction | User; runtime preserves it | A named framework does not get silently rerouted |
| Deterministic computation and policy | Runtime | Permissions, source hashes, exact lookups, schema validation, arithmetic, quotas, mandatory checks |
| Candidate creation and explanation | Main LLM or configured worker | Two implementation plans with evidence and tradeoffs |
| Semantic evaluation and selection | Jev | Plan choice, evidence relevance, contradiction, finding severity, requirement coverage |
| Execution and observed outcomes | Authorized host/tools | Run a test and record its actual exit status |
| Independent evaluation | External checks and reviewers | Determine whether the full task succeeded; Jev never grades its own benchmark |

Lexical retrieval is candidate generation, not a replacement semantic judge. Deterministic ranking, thresholding and weighted arithmetic may consume Jev outputs under a versioned policy. They cannot silently introduce a new semantic criterion. Required checks, user constraints and authority are not negotiable model scores.

## One decision interface, many bounded questions

Use the existing core and provider; add a versioned decision registry rather than scattering provider calls across hooks. Each entry defines stage, primitive, state schema, candidate source, criteria, evidence requirements, limits, outcome policy and evaluation fixtures.

Proposed internal contract, not the TypeSafe wire schema:

```text
DecisionRequest
  decisionId, stage, questionId, questionVersion, policyVersion
  taskId, stateRevision, scopeHash, evidenceRefs[], evidenceHashes[]
  candidateIds[], candidateSetHash, candidateOrigin
  primitive, modelVersion, deadline, budgetReservation

DecisionReceipt
  requestHash, decisionId, providerRequestId?, modelVersion
  answer, derivedOutcome, evidenceRefs[], sourceRevisions[]
  origin: live_jev | exact_cached_jev
  status: resolved | abstained | invalid | unavailable | stale
  latency, observedUsage?, usageUnknown, cacheOriginReceipt?

TransitionReceipt
  from, to, stateRevision, decisionReceiptIds[], policyVersion
  deterministicCheckRefs[], authorizedActionRefs[], resultRefs[]
  mode: managed | advisory | native_bypass
```

Code rejects unknown candidates, mismatched scopes, changed state, invalid types, expired evidence and missing receipts before a managed semantic transition. A validated receipt establishes that Jev evaluated this state, not that the answer is correct. Local traces remain minimal; storing raw state for replay is separately configured, scoped and retained.

For supported plugin-owned actions, enforce these checks in executable code. For host suggestions, record delivery and observable adoption separately. A proposed plan is not automatically binding on the host, and a hook firing does not prove adoption. Never route around native permissions to enforce this design.

If Jev is unavailable or budget is exhausted, suspend the dependent managed transition with a structured outcome. Preserve checkpoints and permit the normal host workflow to remain usable, visibly marked as a bypass in diagnostics and metrics. Do not silently substitute an LLM judge or count native continuation as Jev-controlled success. Benchmark-only deterministic/no-Jev arms remain valid experimental controls, not the target production semantics.

## Decision map by lifecycle stage

The rows are a registry inventory, not a demand to execute every question on every task. Exact user instructions, inapplicable stages and reusable valid receipts do not require new semantic evaluation.

| Stage | LLM / tools supply | Jev questions | Code and authority boundaries |
| --- | --- | --- | --- |
| Intake and clarification | Request, proposed requirement IDs, known context, unresolved questions | Choice of task route; Noul per unresolved question: does this require missing user information? | Preserve explicit constraints and authorization; do not infer permission from probability |
| Impact and project scope | Authorized repository graph, changed symbols, candidate dependencies | Noul per candidate component: is it affected? Score of expected impact; Choice of next investigation scope | Scope expansion cannot cross authorized roots; user/CI-mandated checks remain required |
| Knowledge ingestion | Changed source spans; generated candidate patterns, rules and flows | Choice of knowledge kind; Choice of source support; Score of reuse usefulness | Exact source/hash validation, incremental updates, deletes and atomic snapshots |
| Retrieval | Lexical/structural candidate passages and memories | Score of relevance; Choice of applicable/conflicting/insufficient; Noul for missing requirement evidence | Enforce token caps and freshness; retrieval absence is not proof of repository absence |
| Planning and architecture | Bounded alternative plans, constraints, dependency graphs and estimated work | Score per dimension of constraint fit or risk; Choice of eligible plan, request alternatives or abstain | Validate DAGs and hard constraints; no plan becomes permission to execute |
| Investigation | Competing hypotheses, reproductions and observed check results | Score of evidential support; Choice of next discriminating experiment | Track unsupported hypotheses as hypotheses; execute only permitted bounded checks |
| Delegation and generation | Eligible modes/models, capabilities, evidence and measured cost estimates | Choice of principal/evidence/summary/artifact route; Choice of references | Model generation remains LLM work; runtime reserves budget, stages artifacts and checks preimages |
| Validation planning | Patch, requirements, test relationships and candidate checks | Noul per semantic impact class: UI/data/API/AI; Choice of additional validation strategy | Existing required checks cannot be skipped; test exit status is observed, not judged |
| Review | Independently generated findings, diff and current source | Choice of supported/contradicted/insufficient finding; Score of severity; Noul per requirement coverage | Evidence requirements and configured gates remain explicit; lack of a citation cannot silently erase a suspected blocker |
| Repair and continuation | Findings, attempt history, checkpoints and changed state | Choice of repair/expand/escalate candidate; Score of remaining evidence gaps | Finite retries, cancellation, branch isolation and state preconditions |
| Memory and learning | Observed outcome, candidate lesson and relevant prior records | Choice of novel/duplicate/conflicting/refinement; Noul for applicability and generalizability | User acceptance cannot be invented; revisioned capture policy, provenance and corrections govern writes |
| Completion | Per-requirement evidence, unresolved findings and actual validation receipts | Choice of supported/contradicted/insufficient coverage per requirement | Mandatory checks and authority still gate completion; partial evidence cannot certify unseen behavior |

Use [Choice](https://docs.typesafe.ai/primitives/choice) for unordered alternatives, including an explicit insufficient/none option where appropriate. Use [Score](https://docs.typesafe.ai/primitives/score) for a single dimension with concrete ordered descriptions; preserve the distribution rather than treating the average as correctness. Use [Noul](https://docs.typesafe.ai/primitives/noul) for a single yes/no proposition; it returns a yes probability without a separate confidence value. Choice/Score confidence describes concentration, not a calibrated guarantee that the selected answer is correct.

Calibrate routing thresholds on held-out examples. A negative support judgment is not automatically proof of contradiction; use a multiway Choice when that distinction matters. Split relevance, support, severity and usefulness into different questions. Independent questions can share useful state in a batch; a question needing another answer must use a later call.

## Engineering workflow

The following modules define Jevra's planned engineering workflow. They will be developed and evaluated in this repository. Their expected benefits are hypotheses, not established quality or token-efficiency results.

| Module | Planned behavior | Expected benefit and cost to measure |
| --- | --- | --- |
| Incremental source-to-knowledge compilation | Derive small source-bound patterns, constraints, flows and counterexamples; Jev classifies, judges support and selects useful candidates | Reuse expensive investigation; count generation, Jev validation, updates and invalidation |
| Metadata search before body reads | Return bounded IDs/descriptors, then read selected source/memory bodies progressively | Reduce repeated full-file reads; measure misses and expansion turns |
| Evidence-backed assumptions | Record requirement, selected option, alternatives, Jev receipt, evidence and unresolved uncertainty | Reduce repeated clarification/rediscovery without inventing missing user preferences |
| Project profiles and impact relationships | Declarative test entry points, accepted standards, dependency edges and contract/parity checks | Avoid wrong conventions and missed cross-component regressions; charge profile maintenance |
| Behavioral validation | Add applicable browser, persisted-data or model-behavior checks beyond compilation/mocks | Reduce accepted defects; additional test cost is justified only by measured risk/quality |
| Isolated review and bounded repair | Independent review context with source-backed findings; Jev evaluates support/severity; code enforces budgets | Reduce self-confirmation and repeated failed cycles; isolation alone is not independence of the model or ground truth |
| Lessons from corrections | Generate candidate lessons linked to observed failures; Jev judges reuse/conflict; version and retrieve only applicable records | Avoid rediscovering known failures; false lessons and overgeneralization must be measured |
| Durable run artifacts | Checkpoints, compact receipts, observed validation, per-attempt costs and resumable work | Avoid restarting investigation; bound storage and retention |

The implementation must reject timestamp-only change discovery, name-derived IDs treated as source freshness, upsert-only synchronization without deletions, lexical similarity treated as semantic confidence, arbitrary precedent-count certainty, newest-example-wins conflict resolution, or blanket acceptance based on counts of finding severities. Jevra requires exact revision/hash bindings, deleted-source reconciliation, explicit uncertainty and independently tested policies.

Do not load a monolithic development playbook or all historical lessons into each host turn. Keep a minimal entry skill and small stage-specific instructions. The runtime assembles bounded evidence; Jev selects applicable optional guidance; user-mandated instructions always remain in force. Retrieved knowledge is data, never authority to change policies or publish code.

## Knowledge and learning contract

Extend the [engineering-memory model](development-brain.md#engineering-memory-model) with derived `pattern`, `workflow` and `anti_pattern` records; project profiles can link to accepted `constraint` records. Suggested additional fields are `sourceSpans`, `sourceSnapshot`, `derivationVersion`, `supportReceiptIds`, `applicability`, `knownCounterexamples` and `supersedes`.

A source compiler inventories authorized files deterministically, computes changed/deleted/renamed spans, and queues only affected derivations. Generation proposes concise records; Jev evaluates their support against original spans and reuse value. Persist accepted derivations atomically with the index cursor. A failed import must not advance the cursor. A changed/deleted source invalidates downstream summaries, lessons and exact caches before reuse; uncertain derivations stay unavailable or explicitly stale.

Separate project facts from reusable practices. A practice that helped once is a scoped candidate, not a global rule. Explicit user acceptance and observed test success are recorded as such; Jev cannot manufacture either. Suggested generalized lessons retain applicability and counterexamples and cannot silently rewrite agent instructions. Promotion beyond project scope follows an explicit configured review policy.

## Efficiency under mandatory semantic ownership

Mandatory Jev ownership does not imply one API request per tool call or replacing every `if` with inference. Optimize state and frequency while retaining semantic provenance:

1. Filter exact eligibility, scope, formats and hard constraints in code before inference. Retrieve a bounded candidate set and required counterexamples.
2. Reuse only exact valid Jev receipts keyed by state, scope, candidates, evidence, model, question and policy versions. Do not guess semantic equivalence with lexical hashes.
3. Batch independent judgments over shared useful evidence; avoid resending a full task transcript for each stage.
4. Return compact results and artifact handles; disclose gaps and provide targeted expansion. Do not repeatedly echo all decisions or worker output to the principal model.
5. Enforce per-stage and per-task call/latency/cost limits. A cheap Jev call can still add costly host turns; include those turns and failed paths.
6. Measure total cost per accepted task and expensive host tokens separately, including cold-start ingestion and amortized repeated-project runs.

This architecture may cost more on simple tasks. Its centrality is a product requirement; its economic advantage is an experimental hypothesis. Optimize the questions, evidence and workflow when an ablation wins, and report the negative result. Do not hide it by presenting context-body reduction as total savings.

## Delivery and evaluation

| Order | Work | Issues and exit evidence |
| --- | --- | --- |
| 1 | Decision registry, typed receipts, managed/advisory/bypass boundaries | DR-034 with DR-003/004/016/020; every exercised managed semantic transition has a valid Jev receipt; unavailable/stale results cannot advance it |
| 2 | First native-memory slice using the registry | DR-028/029/030; explicit save, fresh-host recall with Jev applicability, source edit invalidates reuse |
| 3 | Incremental knowledge and minimal project profiles | DR-035 with DR-021/024/031, then DR-036; source-bound records, deletion/rename handling, progressive retrieval and impact fixtures |
| 4 | Assumptions, competing hypotheses and review/learning loop | DR-037 with DR-032/015, then DR-038; attributable selections, bounded repair, supported scoped lessons |
| 5 | Worker and full-system comparisons | DR-022/023/025/027/033; same-budget candidate/worker controls and independent task outcomes |

The registry is the first prerequisite; it must not require implementing all stages before a small memory slice can ship. Each stage is promoted independently with observable host integration.

Extend the evaluation with missing alternatives, conflicting precedents, stale/deleted sources, false lessons, unknown user values, interrupted review, provider outage, native bypass and mandatory-test omission attempts. Distinguish candidate recall, Jev selection quality, host adoption and final task success.

Report `managed_semantic_transitions_with_valid_jev_receipt / observed_managed_semantic_transitions`, live/cache shares, abstentions and bypass counts; also report which task stages were instrumented. A 100% value for two observed transitions is not 100% of host decisions. Question volume, generation overhead, host turns, all-provider usage and cost per accepted task are required. Independent no-Jev controls test the contribution without becoming the product's default judge.
