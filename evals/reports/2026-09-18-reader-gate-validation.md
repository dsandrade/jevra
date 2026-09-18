# Reader gate: contract and native trust validation

> Dated preflight observation. The subsequent [single gate task and v2 adapter corrections](2026-09-18-reader-gate-task.md) wire the collector and retain non-adoption; they do not establish native gate execution or savings. The outcomes below remain the original zero-inference increment. The [original preflight protocol](../reader-gate/frozen-v1-validation-protocol.md.txt) matches its frozen manifest hash; the current protocol adds only a subsequent-state notice.

Date: 2026-09-18. Status: scoped integration preflight complete; native task adoption and reader savings remain unproven. No parent task, Luna generation or Jev request was dispatched by this validation.

## Implemented correction

The local gate now suggests only source `paths` plus a focused question. Previously its guidance also suggested optional `sessionId`, which the product MCP supports but the strict reader-evaluation MCP rejects. Omitting that unnecessary field makes guidance compatible with both tools and avoids exposing a session identifier in model context. Server-owned default sessions remain in place. This mismatch cannot explain the first pair's non-adoption: that pair had no gate.

The separate [gate protocol](../reader-gate/protocol.md) and executable `validate.ts` prepare a retained private synthetic workspace, freeze source/build/protocol hashes, exercise the actual built hook, list the helper catalog, and inspect native readiness. A bounded allowlisted observation collector is implemented and tested for future host adapters. It records tool order, broad-read shape, bytes, helper outcome and exposed hook status, without retaining command text, source paths, questions or bodies. It is not yet wired into a paid adoption runner; metadata collection alone does not enforce delegation.

## Observed evidence

| Check | Result |
| --- | --- |
| Direct built-hook cases using Codex payloads | 7/7 passed |
| Direct built-hook cases using Claude Code payloads | 7/7 passed |
| Broad canonical shell / unified execution / Read payloads | Redirected |
| Targeted range / targeted Read / 350-line boundary / unsupported shell syntax | Passed through |
| Independent MCP `tools/list` | `bulk_read` available with question and paths |
| Helper inference ledger after catalog check | Zero reservations and journals |
| Initial native `hooks/list` | One enabled definition; `untrusted`; not ready |
| Normal native CLI definition review | One PreToolUse definition reviewed and trusted |
| Fresh native `hooks/list` after review | One enabled definition; `trusted`; ready |
| Native definition fingerprint before / after | Identical |
| Native warnings / errors / unrelated definitions | 0 / 0 / 0 |

Both payload-format checks invoke the same packaged hook directly; they are not new Claude or Codex model executions. The catalog check uses a separate stdio MCP client and does not establish that a parent model consumed the tools or skill. The read-only native client exchanges only `initialize`, `initialized` and `hooks/list`; it has no generation or trust-write method. Its subprocess cleanup completed.

Pinned environment: Node 24.21.0; Codex CLI 0.154.0-alpha.6.2. The initial native preflight ran with session-scoped CLI hook settings and normal authentication. The ordinary CLI then opened the prepared synthetic workspace without a task prompt, completed its normal project/definition review, and exited normally. No hook-trust exception was used. The CLI persisted its normal project and hook trust records for this prepared scope; no plugin was globally activated or provider credential relocated. This is one scoped definition lifecycle, not complete packaged installation or changed-definition certification. The definition points to mutable local build/config files; readiness must be paired with fresh source/build/config bindings before a future task dispatch.

The reviewed definition's public fingerprint is `3b769562232d60e4a32c8158d10ccd6ad1e86b29563bd203340b2831f425cb31`. The native protocol declares its own current hash as an opaque string; metadata fingerprints that value instead of assuming its encoding. The [official hook contract](https://learn.chatgpt.com/docs/hooks) describes hash-bound definition review and `/hooks`; the installed executable's generated app-server types establish the read-only readiness fields used here. [Sanitized results](2026-09-18-reader-gate-validation.json) preserve the frozen hashes, 14 case outcomes, catalog schema hashes and native transition without private paths, raw definitions, credentials, session identities or transcripts.

Final `npm run check` passed under the pinned Node version: typecheck, both plugin/CLI builds and **180 tests, zero failures/skips**. New checks cover metadata disclosure, duplicate/truncated observations, modified/missing/ambiguous hook readiness, opaque native hashes and the actual subprocess preflight composition with a simulated app server. An initial zero-inference preparation exposed an incorrect assumption about the native hash encoding; the final preparation removed that assumption. Both private observations were retained; no model request was retried.

## Remaining task evidence

The [first reader pair](2026-09-18-reader-comparison.md) remains unchanged: both authored task judges passed, but no helper ran. This increment fixes a contract mismatch and verifies readiness; it does not establish native hook execution, advice delivery, helper adoption, semantic reader quality or savings.

Next wire bounded observations and actual gate journals into a separately frozen gate-enabled task adapter, check native readiness and bindings before dispatch, then run a small scoped task. Preserve native targeted reads, count non-adoption and recovery, and reconcile complete provider journals. Any explicit-invocation diagnostic must remain separate from ordinary adoption. Larger matrices and economic calibration remain deferred.
