# Compatibility evidence

Recorded on 2026-09-17. A verified row describes only the surface named in that row.

| Component or capability | Version / surface | Evidence |
| --- | --- | --- |
| Runtime | Node 24.21.0, npm 11.19.0, macOS arm64 | Alpha.2 build/typecheck and 46 behavioral checks passed locally; alpha.1 clean-checkout evidence retained below |
| CI | GitHub Actions, Ubuntu and macOS | [Credential-free install, 46 checks, and deterministic evaluation passed](https://github.com/dsandrade/jevra/actions/runs/35257430261) on alpha.2 code commit `438bd85` |
| TypeSafe | SDK 0.6.0, `jev-1.13.0` | Real synthetic requests and SDK transport fixtures passed |
| Codex input/context | CLI `0.154.0-alpha.6.2`, macOS | Native `UserPromptSubmit` receipt and random context marker returned by model |
| Codex + Jev | Same CLI, bundled Jevra command hook | Real Jev recommendation returned to the host; model echoed the suggested skill name |
| Codex plugin structure | `.codex-plugin/plugin.json`, default `hooks/hooks.json` | Plugin-creator manifest validation and packaged runner tests passed |
| Codex desktop / IDE | Not tested as separate surfaces | CLI evidence is not a desktop or IDE compatibility claim |
| Claude Code | `2.1.259`, macOS | `claude plugin validate` passed; adapter and packaged runner tests passed |
| Claude authentication and read gate | `2.1.259`, `claude-sonnet-5` | Authenticated complete coding tasks and native PreToolUse redirection observed; model may choose targeted fallback |
| Codex read gate and helper | `0.154.0-alpha.6.2`, `gpt-6-astra` | Native PreToolUse redirection and helper invocation observed in complete-task wiring |
| Bulk helper | `jev-1.13.0`, SDK 0.6.0 | Live selection returned both normative retry sections with usage; exact excerpt and code-context CLI tests passed |
| Claude + Jev MCP | Same CLI/model, official MCP SDK 2.0.0 | Explicit tool probe returned selected evidence and READY; [sanitized wiring evidence](../evals/reports/2026-09-17-shunt-wiring.json) |
| Full coding-task comparison | Both recorded CLIs | [Three-arm pilot](../evals/reports/2026-09-17-full-task-pilot.md); distinguish redirects, helper adoption and final correctness |
| Native hook trust lifecycle | Codex documentation reviewed | Normal installation, changed-hook re-review, and missing-trust matrix remain pending |
| Skill loading / adherence | Both hosts | Unknown; no later tool observer implemented |
| Installation/upgrades | Both hosts | Manual development setup only; automated lifecycle pending |

The Codex probe uses an isolated temporary `CODEX_HOME`, references existing authentication without copying its contents, and excludes user hook configuration. It vets its own fixed synthetic hook and uses the documented one-invocation trust override. It never writes persistent hook-trust records. This proves context transport, not normal installation trust behavior.

The skill adapters consume `UserPromptSubmit`; a shared bounded gate consumes validated `PreToolUse` payloads for `Read` and canonical shell reads. Pass-through returns `{}` rather than granting permission. Large eligible reads in advise mode return `hookSpecificOutput.permissionDecision: "deny"` plus guidance for the configured helper transport. Codex's observed payload included `cwd`, `hook_event_name`, `model`, `permission_mode`, `prompt`, `session_id`, `transcript_path`, and `turn_id`. Jevra does not read the transcript path. Claude has no assumed stable turn ID; each invocation receives a generated event ID. There is no claim of exactly-once processing.

Malformed input, missing config, catalog problems, API failures, and timeouts return empty JSON from the hook, preserving native behavior. Failures after a valid event/config are traced when the local trace store is available. Errors before event parsing cannot be associated with a decision trace.

## Reproduce

```sh
npm run check
claude plugin validate ./plugins/claude-code/jevra
npm run smoke:hosts
npm run smoke:hosts -- --live-jev --keychain-service your-typesafe-key-service
```

The host probe uses existing Codex authentication and consumes model usage. The optional live path also consumes TypeSafe usage. It currently reports Claude authentication state and does not implement a Claude live probe. Results stay in ignored `evals/local-results` unless reviewed for publication.

Sources: [Codex hooks](https://learn.chatgpt.com/docs/hooks), [Claude hooks](https://code.claude.com/docs/en/hooks), [Claude development plugins](https://code.claude.com/docs/en/plugins), and local CLI help. [Published probe result](../evals/reports/2026-09-17-host-probes.json).

## Full-task read-gate verification

`node evals/full-task/run.ts --repetitions 1 --keychain-service your-typesafe-key-service` runs independently checked coding tasks through authenticated hosts. Both have produced read redirects; a Codex MCP wiring task invoked the helper and obtained selected evidence with real Jev usage. The initial Score rounding defect was fixed before the final comparison. The [pilot](../evals/reports/2026-09-17-full-task-pilot.md) reports whether each host actually used selected evidence.

These tests install reviewed direct command hooks, disable unrelated automatic skill guidance, and leave targeted reads available. They do not prove packaged skill activation or normal plugin trust lifecycle. The separate older `smoke:hosts` script still implements only the Codex model-context probe; its Claude-auth status is not a new live-context result. No global user hook/configuration was changed by the full-task runner.

The CLI-only comparison was interrupted when Codex tool-shell Keychain access failed. This is a verified limitation, not an invalid API key. The MCP helper fixes that transport boundary without changing the shell sandbox; it is implemented with the official MCP SDK 2.0.0. The same CLI path remains available in environments with existing credential access.
