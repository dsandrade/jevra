# Codex CLI worker transport probe

Date: 2026-09-17. Scope: DR-039 transport only; no artifact-workflow or efficiency claim.

## Result

Two small synthetic invocations returned the exact requested candidate:
`export const answer = 42;` followed by one newline. The second invocation followed
an explicit empty-MCP configuration and accounting refinement. These are development
checks, not independent coding tasks or a matched performance comparison.

Both used Codex CLI `0.154.0-alpha.6.2` on macOS arm64, Node `24.21.0`,
`gpt-5.6-luna` configured with low effort and the existing ChatGPT authentication.
The CLI stream did not independently identify the responding model: receipts keep
`observedModel: null`, distinct from the configured model. The supported official
CLI owns authentication; Jevra did not read, copy or reuse OAuth tokens.

| Observation | Initial probe | Final transport probe |
| --- | ---: | ---: |
| Explicit input packet, UTF-8 bytes | 339 | 339 |
| Reported input tokens | 2,516 | 2,512 |
| Reported cached input tokens | 0 | 0 |
| Reported output tokens | 50 | 22 |
| Total elapsed milliseconds, including preflight/cleanup | 5,227 | 5,118 |
| Generator CLI invocations | 1 | 1 |
| Observed tool items | 0 | 0 |
| Exact candidate match | Yes | Yes |
| Exit code | 0 | 0 |
| Temporary workspace cleanup | Complete | Complete |
| Actual charge / subscription allowance consumed | Unknown | Unknown |

The final generator implementation hash was
`3bde147f320552d4b3d8e0f0965795a17ac504f10a0af43fc412e681b80d3e3f`;
this is the repository's canonical `hash(fileText)` of `codex-worker.ts`.
The two development calls consumed 5,028 reported input tokens and 72 output tokens.
Do not omit the first call from development usage or treat its different output
length as a model-quality comparison.

## Interpretation and limits

The CLI accepts a fresh explicit request and returns a structured candidate through
the subscription login. The 339-byte packet still resulted in roughly 2,500 input
tokens: CLI instructions, environment/tool/schema context and other runtime input
must be counted. Bytes and tokens are different units; this probe does not identify
the exact token contribution of each source. One process is not proof of exactly
one underlying provider request.

No Jev evaluation, repository exploration, code application or test-generation
quality assessment happened in this probe. No tool items appeared in its event
stream. This does not prove that every possible built-in tool is absent or that
every administrative configuration is isolated. The adapter disables the relevant
capabilities, uses a read-only sandbox and rejects unexpected tool events; event
rejection cannot undo a tool action already performed by the CLI.

The initial support boundary is the inspected CLI version on POSIX systems.
Other versions fail explicitly. Standalone user `hooks.json` causes an unsupported
configuration result before inference rather than changing the user's setup or
globally disabling managed hooks. Broader managed-policy/tool-catalog certification
remains open in DR-039 before ordinary plugin activation.

## Offline validation

The 21 transport tests cover stdin-only task delivery, fixed arguments, credential
and inherited-context filtering, output/schema failures, unknown usage, version and
auth rejection, size limits, Unicode stream boundaries, timeout, cancellation,
concurrent-call rejection and process-tree cleanup. A malformed candidate with a
valid completed usage event retains its reported usage; it is not a free failure.
Tests use an owned fake executable and synthetic data, without live credentials.

Run `npm run check` for repository checks and `npm run probe:worker` for the explicit
live diagnostic. The probe consumes model allowance, creates a new sanitized report
under ignored `evals/local-results`, and is never run by normal tests or plugin startup.
It does not save raw model streams, authentication output or candidate bodies in its report.

Sources for the command contract: [Codex noninteractive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
and [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).
The installed CLI help and local runtime observations determine the tested boundary.
