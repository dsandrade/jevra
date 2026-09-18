# Reader gate validation v1

> This preflight is used alongside the current [v2 task adapter](task-protocol.md). The [dated single-task report](../reports/2026-09-18-reader-gate-task.md) records collector wiring, non-adoption and the v1 context mismatch. Statements about pending paid-runner wiring below describe the original preflight increment.

Status: executable, zero-inference preflight. This is separate from the frozen first reader pair and is not an efficiency benchmark. It prepares a retained private synthetic workspace and tests the actual built hook in both host payload formats, with broad, targeted, small and unsupported-shell reads. It separately lists the evaluation MCP tools without calling a generation tool.

Pinned Node 24.21.0 and Codex 0.154.0-alpha.6.2. Build before running. Native authentication remains in place; no global plugin/settings changes, credential copies, hook-trust bypass or inference retry. Only `initialize`, `initialized` and `hooks/list` are sent to the native app server. There is no thread or turn creation and no trust-write request. The exact native hook definition is scoped through CLI settings; readiness requires one enabled, trusted definition and no unrelated definitions or configuration errors.

The [official hook documentation](https://learn.chatgpt.com/docs/hooks) describes normal definition review and hash-bound trust. The pinned executable's generated app-server types establish the read-only `hooks/list` method, scope and readiness fields. Its native definition hash is an opaque string; public metadata records a SHA-256 fingerprint rather than assuming a native encoding or exposing the raw value.

```sh
node evals/reader-gate/validate.ts --codex-executable /Applications/ChatGPT.app/Contents/Resources/codex
```

Preparation freezes source/build/protocol hashes before checks, writes private config and a `review-hook.sh` launcher, and retains only allowlisted results. The launcher opens the ordinary CLI without a task prompt. `/hooks` is the official definition-review path if the read-only preflight reports `untrusted` or `modified`. Preparation does not change trust records or assert that direct hook execution is native lifecycle execution. Hash changes require a new preflight; never reuse historical trust/readiness claims.

The gate guidance uses only `paths` plus a requested focused question, compatible with both the product MCP and the strict evaluation MCP. Optional product `sessionId` is not suggested; the server supplies its own default session. This removes unnecessary context and a schema mismatch; it does not prove that the mismatch caused the first pair's non-adoption.

`hostObservations` provides bounded tool-sequence metadata for subsequent adapters. It records broad-read shape, output bytes, helper name/outcome and exposed hook status without command text, paths, questions, citations or output bodies. Duplicate completed tool IDs are ignored. Missing hook events do not imply missing hook execution; truncated observations explicitly report incomplete metadata. This collector is implemented and tested but not yet wired into a paid adoption runner.

After native review, a separately frozen, gate-enabled task experiment must record native hook invocation/delivery, actual helper adoption, full provider journals, source-grounded facts and code checks. Keep any explicit-invocation wiring diagnostic separate from ordinary adoption. No new paid matrix, economic calibration or savings claim follows from this preflight.
