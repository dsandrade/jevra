# Compatibility evidence

Recorded on 2026-09-17. A verified row describes only the surface named in that row.

| Component or capability | Version / surface | Evidence |
| --- | --- | --- |
| Runtime | Node 24.21.0, npm 11.19.0, macOS arm64 | Build, typecheck, 34 behavioral tests, and clean-checkout install/check/eval passed |
| CI | GitHub Actions, Ubuntu and macOS | [Credential-free install, checks, and deterministic evaluation passed](https://github.com/dsandrade/jevra/actions/runs/35249951291) on code commit `ee3157f` |
| TypeSafe | SDK 0.6.0, `jev-1.13.0` | Real synthetic requests and SDK transport fixtures passed |
| Codex input/context | CLI `0.154.0-alpha.6.2`, macOS | Native `UserPromptSubmit` receipt and random context marker returned by model |
| Codex + Jev | Same CLI, bundled Jevra command hook | Real Jev recommendation returned to the host; model echoed the suggested skill name |
| Codex plugin structure | `.codex-plugin/plugin.json`, default `hooks/hooks.json` | Plugin-creator manifest validation and packaged runner tests passed |
| Codex desktop / IDE | Not tested as separate surfaces | CLI evidence is not a desktop or IDE compatibility claim |
| Claude Code | `2.1.259`, macOS | `claude plugin validate` passed; adapter and packaged runner tests passed |
| Claude model context | No authenticated session | Pending; local `claude auth status` reported logged out |
| Native hook trust lifecycle | Codex documentation reviewed | Normal installation, changed-hook re-review, and missing-trust matrix remain pending |
| Skill loading / adherence | Both hosts | Unknown; no later tool observer implemented |
| Installation/upgrades | Both hosts | Manual development setup only; automated lifecycle pending |

The Codex probe uses an isolated temporary `CODEX_HOME`, references existing authentication without copying its contents, and excludes user hook configuration. It vets its own fixed synthetic hook and uses the documented one-invocation trust override. It never writes persistent hook-trust records. This proves context transport, not normal installation trust behavior.

The adapters consume only `UserPromptSubmit`. Codex's observed payload included `cwd`, `hook_event_name`, `model`, `permission_mode`, `prompt`, `session_id`, `transcript_path`, and `turn_id`. Jevra does not read the transcript path. Claude has no assumed stable turn ID; each invocation receives a generated event ID. There is no claim of exactly-once processing.

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
