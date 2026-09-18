# Development handoff for Claude Code

Date: 2026-09-18. Repository: `git@github.com:dsandrade/jevra.git`, branch `main`. Executable version: `0.1.0-alpha.2`; specification: `0.7`. This is an experimental developer alpha, not a production release.

## Objective and boundaries

Deliver high-quality coding tasks through the user's existing Codex or Claude Code interface while reducing whole-task inference cost. In Jevra-managed workflows, Jev owns explicit semantic Choice/Score/Noul judgments; LLMs generate answers, candidates and code. Deterministic policy, exact validation, execution and authorization remain in code/native hosts. Hooks cannot mediate hidden host reasoning.

The chosen generative worker is `gpt-5.6-luna` through a fresh bounded Codex CLI invocation with normal ChatGPT authentication. The controller developing the repository can be Claude Code; that does not change the worker transport. Codex quota is nearly exhausted on the current administrator machine. **Start with implementation and offline tests; do not automatically launch Codex inference, a benchmark matrix or another paid diagnostic.** A Claude worker would be a separately designed/versioned transport, not a silent model/API fallback.

Memory, new worker roles and the larger development-brain architecture remain deferred until ordinary delegation has repeated quality and whole-task efficiency evidence. Public documentation describes Jevra's own implementation and factual comparisons with public related work; never publish confidential research identities or provenance.

## Read first

1. [Contributor instructions](../AGENTS.md), [specification](../SPEC.md) and [backlog](../ISSUES.md). Stable DR identifiers are planning IDs, not GitHub issue numbers.
2. [Latest managed reader adoption](../evals/reports/2026-09-18-reader-gate-task-v2.md) and its sanitized JSON. Read this before historical reports to avoid mistaking old gaps for current state.
3. [Focused-reader contracts](focused-reader.md), [current task diagnostic protocol](../evals/reader-gate/task-protocol.md) and [development setup](development.md).
4. Read the [Shunt architecture review](shunt-architecture-review-2026-09-18.md), [cost audit](shunt-cost-audit.md) and [worker architecture](worker-architecture.md) only as needed. Load older artifact/economic reports when changing those components rather than importing all historical context into every task.

Use the available TypeSafe skill and relevant live official documentation before changing questions/integration contracts. Recheck official host contracts and pinned executable behavior before changing adapters. Converse in Portuguese; write technical artifacts in English.

## Verified current state

The latest fresh scoped Codex task observed five configured active hook entries, one eligible broad-read redirect and one `bulk_read` MCP call returning `answered`. Luna generated once without worker tools. Two Jev requests selected the reader route and reviewed two claim-support Choices, coverage Noul and continuation Choice. Exact citation checks and the authored task's facts, scope, grammar and functional judge passed. Original config bytes were restored and parent/worker cleanup completed.

| Component | Gross input + output tokens |
| --- | ---: |
| Parent | 106,856 |
| Luna | 16,567 |
| Jev | 5,355 |
| Total | **128,778** |

Known covered parent tool-output bytes were 4,775, including the 1,015-byte helper answer. Shorter tool output is not proof of lower whole-task usage. Parent gross input includes 85,632 reported cache-read tokens; cache writes and Jev cache classes remain unknown. USD charges and attributable subscription consumption are null. Historical native/v1 cells used different host configuration/skill conditions and uncontrolled caches, so they are not matched baselines for this result.

This was the full bounded-corpus arm: 21 passages supplied to Luna, six cited/counterevidence passages reviewed by Jev. Jev-selected retrieval and a Luna-only ablation did not run. Confidence is not calibrated correctness, and bounded semantic review does not attest the whole repository.

The preceding full `npm run check` passed typecheck, CLI/plugin builds and 184 tests. The latest task increment rebuilt and passed all six targeted reader-gate tests. Run a fresh full check after implementation changes; do not infer remote CI success from a local check.

Earlier observations remain relevant: the first reader pair and gate-task v1 passed authored quality but invoked no helper. V1 readiness loaded user configuration while its parent ignored it. V2 corrected that context mismatch, disabled unrelated MCPs with scoped flags and added active invocation traces before parsing. These fixes enabled an observed managed flow, but do not prove the exact cause of v1 non-adoption. The larger artifact pilot had no consistent Jev-arm savings and exposed grammar/scope/native-bypass limitations; those results remain preserved.

## Next concrete increment

Implement a **new, versioned small matched reader comparison**, with preparation defaulting to zero inference. Do not silently repurpose frozen results or the used single-cell scopes.

1. Freeze a protocol for native versus full-reader arms with identical normal user-config loading, host/model/effort, sandbox, instruction/skill condition, disabled unrelated MCPs, fixtures, task prompt and authored quality judge. Specify the intended differences explicitly: reader gate and helper offering. The native arm must retain ordinary targeted reads; do not force full-file reads or helper usage in either task prompt.
2. Implement offline-testable adapters and fake-host tests for effective settings, normal hook readiness, source/build/config bindings, durable reservations, create-only dispatch, deadlines/cancellation and config restoration. Native should have no enabled evaluation MCP; reader should have only its evaluation Jevra server enabled. Reject unrelated edits, incompatible host/provider context and used fixtures before inference.
3. Reconcile parent, every worker and every Jev call, including failures and recovery. Preserve missing usage/cache fields as unknown. Collect bounded allowlisted adoption/tool metadata and available per-step usage without transcripts; mark unavailable telemetry rather than inventing context attribution.
4. Freeze the subset, run order, cache limitations, label provenance and enforceable time/byte/call limits before any future live comparison. Keep the initial subset small; no automatic paid retry, threshold tuning, matrix expansion or promotion follows from passing local tests. No Codex inference should be launched during this handoff increment while its quota is constrained.
5. After a matched baseline exists, investigate parent interactions/instruction/catalog overhead and compare full versus Jev-selected corpus with evidence-recall, contradiction and subsequent-edit checks. Reductions must include delegated input and provider overhead. Memory expansion is not the immediate optimization.

Relevant code: `evals/reader-gate/run.ts` is a one-cell diagnostic, not a matched benchmark; `evals/reader-comparison/` is the historical comparison; `packages/cli/src/reader-session.ts` and `packages/core/src/reader.ts` own reader orchestration; `packages/cli/src/codex-worker.ts` owns isolated generation; `packages/core/src/accounting.ts` owns normalized accounting. Preserve restricted artifact AST admission and native application boundaries if those components are touched.

## Local and publication practices

Use Node **24.21.0** and npm **11.19.0**; the workspace rejects Node 25. Activate the pinned local runtime through PATH or the project's documented toolchain setup. `npm run check` performs typecheck, builds and offline tests; do not confuse it with paid `probe:*` commands. Generated `dist/` and `build/` are ignored and rebuilt locally.

Native credentials remain in their normal locations. The TypeSafe credential uses macOS Keychain service `codex-typesafe-api-key`; only the API-performing process may retrieve it. Never print credentials, put them in prompts/arguments/logs/Git, relocate authentication or synthesize native trust state. Use normal hook review; a command definition's trust hash does not bind mutable referenced files.

Keep private config/captures/journals under ignored runtime/evaluation directories. Publish only sanitized approved synthetic metadata. Preserve the original v1/v2 manifests, negative outcomes and exact-hash plaintext snapshots; historical frozen hashes may refer to archived source or generated builds, not today's mutable files. Do not rescore missing observations or treat diagnostic data as production calibration.

Use Git SSH/`gh`, meaningful tests and English commits. Update current contracts/backlog and publish a report that separates implementation, local checks, actual live observations, cost unknowns and remaining release gates. Work autonomously on authorized reversible changes; ask only for genuinely missing information or authorization beyond the established scope.
