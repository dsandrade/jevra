# Artifact MCP and host adoption diagnostic

Recorded: 2026-09-17. Synthetic integration evidence, not an efficiency benchmark.

## Setup

Node 24.21.0, macOS arm64, Codex CLI `0.154.0-alpha.6.2`, Claude Code `2.1.274`.
Parent models: configured `gpt-6-astra` at low effort and observed
`claude-sonnet-5` at low effort. The worker remained configured `gpt-5.6-luna`
through fresh Codex CLI, using the existing ChatGPT login. Codex did not attest the
responding model in its stream; configured and observed identity remain distinct.
Jev used `jev-1.13.0` through the existing Keychain-backed provider.

Each task used a new temporary Git repository containing a pure `sum` function,
explicit Jevra MCP configuration and a repository copy of the packaged
`test-artifact` skill. The ordinary prompt requested positive, negative and zero
test cases without mentioning Jevra or its tools. Native tools remained available.
The explicit Claude diagnostic separately instructed use of the three MCP tools.
No plugin was globally installed, authentication copied, permission/trust bypass
used, or source from a real user repository supplied.

Bundled runtime hash (canonical JSON string SHA-256 via the project hash helper):
`10c5b5fb3549bde858ca86f29a5ef7506e8d8c28cf5f47ac941f60b301c39976`.
Skill hash: `4389550d28ce75e8ce30df30e8383d91c3abdf7b20d66f6b671abdacd5101fad`.
The runner's later changes preserve normal login identity variables, classify
Claude `is_error` independently of `subtype: success`, and distinguish explicit
invocation and advertised skill metadata. These changes do not modify the bundled
runtime or skill. The first Codex row predates those runner-only corrections. After the probes,
`doctor` was aligned with tool activation gates and failed-delivery metadata was
separated from managed acceptance. Offline checks cover those final edits; live
results above identify the earlier exact bundle rather than implying a rerun.

## Results

| Run | UTC completion | MCP adoption | Native output and checks | Diagnostic duration |
| --- | --- | --- | --- | --- |
| Codex, ordinary request | 23:03:40 | Skill read; `test_profiles`, `generate_tests`, `read_test_artifact` called | Accepted staged bytes applied exactly; source unchanged; 3 tests pass and both mutants detected | 66.193 s |
| Claude, ordinary request | 23:05:23 | No Jevra calls and no observed skill read | Native test file created; source unchanged; 3 tests pass and both mutants detected | 9.609 s |
| Claude, explicit integration request | 23:07:10 | Skill advertised/read; Jevra connected; all three tools called | Accepted staged bytes applied exactly; source unchanged; 3 tests pass and both mutants detected | 27.406 s |

Each managed run used three Jev calls and one generation, with no repair. Managed
operation durations were 8.987 s for Codex and 9.100 s for Claude. The longer
diagnostic durations include host work and an independent rerun of the validator
against the actual delivered file. Every reported process cleanup completed.
The two seeded defects replace addition with subtraction or drop the second
operand; each produced two assertion failures. This finite fixture is not broad
quality coverage or a held-out task set.

An initial Claude attempt failed to locate its existing login because the runner's
minimal environment omitted ordinary login identity variables. A separate minimal
response probe confirmed the failure. Restoring `USER`, `LOGNAME` and `SHELL`
preserved supported CLI Keychain lookup without accessing OAuth tokens. No user
reauthentication was required. That setup attempt produced no artifact or Jevra
call and has unknown host usage; it is not counted as a successful task. The old
runner reported `subtype: success` without examining `is_error`; that reporting
bug is corrected.

## Usage

Input counts below are gross input, including reported cache classes. Jev cache
telemetry is unavailable; zero in its known-cache subtotal is not proof of no cache.
Host telemetry and managed usage are distinct sources and are not double-counted.

| Run | Host input / output | Host cache-read input | Host cache-write input | Jev input / output | Worker input / output | Worker cache-read input | Combined known input / output |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Codex ordinary | 169,310 / 1,031 | 147,072 | Unknown | 4,500 / 436 | 2,790 / 181 | 1,792 | 176,600 / 1,648 |
| Claude ordinary native | 90,118 / 626 | 66,282 | 22,856 | No calls | No calls | N/A | 90,118 / 626 |
| Claude explicit MCP | 194,416 / 1,272 | 180,795 | 12,599 | 4,788 / 501 | 2,800 / 182 | 0 | 202,004 / 1,955 |

Actual charges and subscription allowance deltas are unknown. No dollar conversion
is asserted. A single small function does not amortize delegation/skill/tool context
well enough to infer a benefit. These rows differ in prompt, host, cache state and
tool trajectory and are not a paired causal comparison. In particular, explicit
Claude invocation cannot be counted as ordinary adoption or a native baseline.

## What is established

The opt-in MCP surface carries managed generation, actual validation, compact
receipts and artifact delivery to both CLIs. The runtime does not apply files.
Native file creation can preserve the accepted candidate exactly; this was
independently observed twice. Codex adopted the workflow once without a tool name
in the prompt. Claude retained a working native fallback and could invoke the same
workflow when explicitly requested. Repeated ordinary Claude adoption remains open.

Credential-free checks cover opt-in/mode gating, strict schemas, concurrent and
identical requests, mutated requests, per-profile/session limits, source/output
changes, foreign handles, expiry, cancellation, failed setup and Jev outage.
The complete local suite passes 118 tests, including the prior transport, decision,
artifact and evidence checks. Both plugin manifests and affected skills validate.

## Next experiment

Freeze a paired per-host protocol before more model runs: native completion,
bounded worker without Jev as an evaluation-only control, and Jev-managed worker.
Use tasks large enough to test the delegation hypothesis, keep model/effort/cache
conditions attributable, and count native fallback, rereads, artifact review and
copying, failed starts, repairs and all providers. Require independent final-file
checks and exact adoption observations. Do not force a tool call in an arm labeled
ordinary adoption or promote generation by default based on this diagnostic.

Broad DR-039 capability certification, plugin installation/trust lifecycle,
cross-process budgets, broader test profiles and live repair quality remain open.
No claim is made for the desktop/IDE surfaces, general code generation, or lower
total token cost. See [MCP contract](../../docs/artifact-mcp.md) and
[v1 delivery plan](../../docs/v1-delivery-plan.md).
