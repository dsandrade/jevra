# Compact native materialization: host diagnostic

Date: 2026-09-18. [Sanitized observations](2026-09-18-materialization-host-probe.json).
Implementation contract: [compact artifact delivery](../../docs/artifact-materialization.md).

## Result

Codex used the new compact path on its ordinary request: one `generate_tests`
call, one native materialization command, no `test_profiles` or
`read_test_artifact` call. The resulting file matched both the accepted candidate
and the materializer's application receipt. The complete file body was not
observed in its native write/command event payloads.

Claude connected to MCP and advertised the packaged skill, but completed the
request natively without loading that skill or invoking Jevra. Its generated tests
also passed. This observation does not validate Claude's native-ticket wiring or
support a claim of reliable adoption. No forced invocation or model retry followed.

| Observation | Codex | Claude Code |
| --- | --- | --- |
| CLI | `0.154.0-alpha.6.2` | `2.1.274` |
| Configured parent | `gpt-6-astra`, low | `claude-sonnet-5`, low |
| Responding parent in telemetry | Unknown | `claude-sonnet-5` |
| Packaged skill read observed | Yes | No; advertised only |
| Jevra calls | One `generate_tests` | None |
| Jev decisions / Luna generations | 3 / 1 | 0 / 0 |
| Accepted ticket applied | Yes, exact 315 bytes | Not attempted |
| Full exact body in native tool payload | Not observed | Observed |
| Source unchanged | Yes | Yes |
| Baseline rerun | 3 tests passed | 3 tests passed |
| Seeded mutants detected | 2 of 2 | 2 of 2 |
| Host completion / cleanup | Successful / complete | Successful / complete |
| Diagnostic duration | 49.2 s | 10.2 s |

The materializer's `inferenceCalls: 0` describes only application. Generation and
Jev decisions above still consume usage. It reports `postApplyChecks: "not_run"`;
the diagnostic independently revalidates the resulting file. This rerun uses the
same synthetic baseline and mutants, not hidden cases or an independent dataset.

## Usage, without a savings claim

| Component | Codex diagnostic input / output | Claude diagnostic input / output |
| --- | ---: | ---: |
| Parent host | 91,058 / 670 | 90,354 / 613 |
| Luna worker | 2,786 / 177 | 0 / 0 |
| Jev | 4,003 / 306 | 0 / 0 |
| Total | 97,847 / 1,153 | 90,354 / 613 |

Input is cumulative across reported host inference, not the size of one prompt.
Codex parent input includes 71,040 cache-read tokens; cache creation is unknown.
Claude parent input includes 66,457 cache-read, 22,917 cache-creation and 980
uncached tokens. Categories are counted once. Jev cache usage is unknown.
Actual subscription allowance consumed and billed currency are unknown.

These are different host paths with no matched baseline and one observation each.
Do not compare the columns as an efficiency experiment or compare this fixture
with the earlier clamp/shipping pilot. Compact delivery worked in Codex, while
parent context remains a substantial part of its usage. Eliminating file copying
does not eliminate the host's system prompt or subsequent inference.

## Protocol and reproducibility

Before the runs, the [implementation contract](../../docs/artifact-materialization.md)
specified one ordinary synthetic sum-test task per host, no required helper mention,
one configured profile, at most four Jev calls/two fresh Luna generations, and a
240-second host deadline. Each fixture had three requirements and two mutants.
Scope was temporary and explicitly configured: repository skill plus Jevra stdio
MCP, without global installation. Normal authentication locations and native
permissions remained in force. Source data was synthetic; credentials stayed in
the existing API process and official CLIs. Raw streams and local configuration
are not published. Code and skill hashes are in the sanitized JSON.

```sh
npm run check
npm run probe:artifact-host -- --host codex --delivery native-ticket --codex-executable /absolute/path/to/codex --keychain-service your-typesafe-key-service
npm run probe:artifact-host -- --host claude-code --delivery native-ticket --codex-executable /absolute/path/to/codex --keychain-service your-typesafe-key-service
```

Re-running consumes provider/CLI allowance. Do not switch to paid API fallback or
another model on authentication/quota failure. An explicit invocation, if later
performed, must be a separately labeled wiring diagnostic.

The exact-body detector compares the complete final string against native tool
events; absence does not rule out partial reads, different escaping or equivalent
rewrites. The signed application receipt and final hash provide separate evidence
that the deterministic materializer actually published Codex's accepted bytes.
Private MCP operation metadata continues to label native application unobserved;
the separate native receipt is the application observation.

## Local validation and next work

The complete offline suite passed **134 tests**, with successful typecheck/build.
Eight tests cover materialization, including actual restricted Node validation,
an actual standalone CLI command with quoted/spaced paths, direct-source MCP,
unaccepted output, tampering, stale state, expiry, unsafe files, wrong scope,
concurrent publication and one-attempt enforcement. Both updated skills passed
the skill validator.

Next add measured overhead evidence to Jev's eligibility decision and investigate
ordinary Claude adoption. Then freeze a corrected repeated protocol with equal
grammar instructions, complete failure diagnostics and native/same-worker/Jev
controls. Do not change thresholds to favor this fixture or relabel the original
pilot's results. General profiles and DR-039 activation gates remain open.
