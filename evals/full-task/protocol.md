# Shunt-style full-task pilot protocol

Created before executing the full-task comparisons on 2026-09-17.

## Question

Does a shunt-style large-read gate plus a Jev evidence selector reduce host-model consumption while preserving completed coding-task correctness? A deterministic selector controls for savings caused by the gate, retrieval, or extra guidance alone.

## Arms

1. Native: normal tools; no Jevra reading guidance or interception.
2. Deterministic shunt: identical large-read gate and helper interface, BM25 excerpts, no Jev call.
3. Jev shunt: the same gate/interface and BM25 shortlist, then Jev relevance scoring and verbatim excerpts.

The runner installs reviewed direct command hooks in isolated host settings and disables unrelated plugins/MCP/skills; the active arms register only the Jevra stdio MCP helper. Plugin skill discovery is a separate packaging check; the hook names only the configured MCP helper; CLI mode remains an explicit separate configuration. Fixture instructions permit that configured helper but do not require using it. No proactive context injection is used. The main LLM writes all code and summaries in every arm. The Spotify AiKA service is not a comparison arm because its service and models are not configured. This measures Jevra's implementation, not a reproduction of Spotify's reported percentage.

## Tasks and scoring

Two self-contained synthetic repositories: retry policy and record retention. Each requires reading a large handbook, modifying executable JavaScript, and running visible tests. An independent deterministic checker outside the agent workspace checks normal behavior, boundaries, exceptions, and unchanged-policy protections. The agents cannot pass by rewriting the visible test expectations. Each run gets a fresh workspace and session.

The handbook deliberately mixes task-relevant sections with operational material. These are full coding tasks, but still synthetic and author-designed; they are not independent real-world customer evidence. Report every attempted run, failed task, timeout, helper fallback, and permission failure.

## Planned runs and budgets

Two repetitions per task, per arm, per host: 24 full tasks. First run a Jev wiring pilot per host before the full set; keep pilot results separate if implementation or scoring changes. Use a fixed recorded model/effort per host: the currently configured Codex model (`gpt-6-astra`, xhigh) and authenticated Claude default resolved to `claude-sonnet-5`, high effort. Do not compare different host models as if measuring plugin effectiveness.

Rotate arm order within task/repetition blocks. Use 300-second host deadlines and a $2 client-estimated per-run cap for Claude. Jev uses the pinned `jev-1.13.0`, no retries, bounded files, at most 24 scored candidates per helper request, and an 8-second helper deadline. Abort the suite on authentication/rate-limit failures rather than repeatedly spending on unusable runs. Native tools retain targeted-read fallbacks. Do not force a model to call the helper when it already uses a targeted read.

## Measurements

Record whole-run wall time, correctness checks, tool-call count, edit calls, visible test executions, observed host input/output/cache tokens, actual helper input/output usage, redirect/helper counts, and model identifiers. Claude cost is the CLI's client-side API estimate, including auxiliary model entries; it is not the Pro bill. Codex records API-equivalent cost bounds when cache-write counts are unavailable. Actual subscription marginal charges remain unknown. Token counts from different providers are reported separately.

Also record selected-excerpt bytes versus eligible corpus bytes as a diagnostic. Never label that ratio total-system token or cost savings. Include Jev estimates using its documented input-only rate ($0.042 per million), with actual billed charges unknown. Cached and uncached input are distinct; provider cache state is observed, not controlled or claimed cold.

## Pilot promotion criteria

A promising host-specific result requires all four Jev task runs to complete successfully and use the Jev helper with selected evidence, no quality regression against native or deterministic arms, and at least 15% lower summed API-equivalent cost than native while median latency increases by no more than 15%. Where comparable cost cannot be established, no cost gate passes. Also compare to deterministic shunt to distinguish Jev's incremental value. These are pilot signals, not statistical significance or justification to enable interception globally.

If gates fail, retain the negative result, keep the feature opt-in, and identify the next experiment. Do not tune questions on final results and silently rerun until successful.

## Wiring revisions before the comparison

The first wiring attempt used a 180-second deadline and inadvertently inherited the Codex global skill catalog. Claude completed via native targeted reads without calling Jev; Codex timed out after a patch error without a completed usage record. The fixture also prohibited network calls too broadly. Preserve these two diagnostic runs separately. Before the comparison, disable automatic Codex skill instructions and bundled skills, initialize fixture Git repositories, explicitly permit the configured helper, clarify retrieval-first guidance, and raise the equal host deadline to 300 seconds. These are integration changes before the final task comparison, not excluded final failures.

The second wiring pilot verified a Codex helper invocation, but the provider response exposed two-decimal rounding rejected by the original strict Score validator. A sanitized live response now has a regression test; a separate live helper check retrieved both required policy sections successfully. Claude again completed via targeted native reads. Both wiring pilots remain separate from the frozen comparison.

## MCP transport revision

The first planned CLI-only comparison was stopped after 10 completed runs and two interrupted runs: Codex's tool-shell sandbox could not access the macOS Keychain service. The CLI fell back safely, but the Jev arm was not testing successful semantic retrieval. Keep these results separately as an aborted integration comparison; unknown interrupted usage remains unknown. Earlier Codex wiring also had missing credentials inside its shell, independently of the rounding bug found by the direct helper check.

The runtime now exposes the same bounded helper through a host-managed stdio MCP process using the official SDK. This keeps Keychain access inside the API-calling process and does not relax the shell sandbox or pass the API key to the agent environment. Both active arms use identical MCP tools and gate instructions; native registers no Jevra MCP server. The CLI remains a fallback.

After a two-host wiring check confirms real selected evidence and usage, run a bounded 12-task MCP development comparison: two tasks × one repetition × three arms × two hosts. This smaller post-fix comparison limits additional model consumption after the aborted run. It cannot satisfy the original four-runs-per-arm promotion gate and must remain exploratory even if quality and estimated cost look favorable. Keep both task outcomes and compare within-host totals, including helper overhead. Do not pool it with CLI-only runs or tune the question on comparison results.

A mixed-transport MCP comparison also stopped on a recorded CLI fallback credential failure: a model chose the advertised shell fallback although MCP was connected. The final configuration therefore names only the configured transport (`bulkRead.transport`, MCP by default); CLI mode must be selected explicitly. This changes delivery guidance, not the task, Jev questions, retrieval budgets or output. Preserve the stopped comparison separately and rerun the 12-task design with fixed MCP guidance.
