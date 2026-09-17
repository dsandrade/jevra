# Developer setup

Build and configure the CLI using the [README](../README.md). The alpha has manual host setup, not an installer. Use reviewed local skills and begin in observe mode. No marketplace release has been published.

## Codex CLI

The tested integration is a command hook. Add a `UserPromptSubmit` entry to an existing user or trusted project hooks file, preserving unrelated entries. Use the absolute paths to your Node 24 executable and built CLI:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"/absolute/path/to/node\" \"/absolute/path/to/jevra/dist/jevra.mjs\" hook --host codex",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

Choose `~/.codex/hooks.json` or a trusted repository's `.codex/hooks.json`. Review and trust the entry through Codex `/hooks`. Installation alone does not establish trust. Avoid registering both a direct hook and a plugin hook, because both would run. See the official [Codex hook documentation](https://learn.chatgpt.com/docs/hooks).

The manifest and generated bundle in `plugins/codex/jevra` are development packaging. Marketplace discovery, installation, upgrade, and removal still need lifecycle validation; this alpha documents direct hook setup instead.

## Claude Code

From a built checkout:

```sh
claude plugin validate ./plugins/claude-code/jevra
claude --plugin-dir ./plugins/claude-code/jevra
```

The plugin command uses `node` from the host's `PATH`; make Node 24 available there. The plugin uses the same user Jevra configuration as Codex. Follow native host review and permission requirements. This loading method is documented by [Claude Code](https://code.claude.com/docs/en/plugins); Jevra's manifest and standalone hook output were tested, but a logged-in Claude model session has not been verified here.

## Modes and diagnostics

Edit the user config's `mode`:

| Value | API calls | Model-visible suggestion |
| --- | --- | --- |
| `disabled` | None | None |
| `observe` | For eligible requests | None |
| `advise` | For eligible requests | At most one validated skill |

`doctor` reports catalog coverage and local diagnostics. It does not verify Keychain access or host activation. After setup, inspect the native hook manager and a local trace. A trace's `output_prepared` means the runtime prepared JSON; it does not prove host delivery or model adherence.

The catalog covers only configured directories. Symlinks, duplicate names, invalid frontmatter, inaccessible roots, or exceeded limits prevent routing rather than silently turning a partial catalog into advice. Normal host behavior continues. Skill directories must contain bounded `SKILL.md` files with `name` and `description` frontmatter.

Default limits: 64 skills, 64 KiB per skill file, 64 KiB hook JSON, 16,384 prompt characters, 64 KiB provider request, and a 3-second decision deadline. Metadata tracing receives a separate 250 ms waiting allowance. Process startup, config/stdin handling, and OS scheduling are additional overhead. The outer host timeout is 15 seconds. The SDK retries zero times. Traces are best effort; a host-killed process can leave no trace.

Model and policy are pinned in configuration. The initial thresholds are provisional: Choice confidence >= 0.75, selected probability >= 0.65, and multi-skill Noul < 0.35. These are not calibrated guarantees.

## Update, disable, and remove

For development updates, pull over SSH, run `npm ci` and `npm run check`, then restart the host. Re-review changed hooks when requested by the host. Keep the checkout at the same path or update the direct hook command. Claude local development loading uses the newly built plugin directory.

Set `mode` to `disabled` to stop evaluations. To remove direct integration, remove only the Jevra handler from the hook file. For Claude local development, stop passing `--plugin-dir`; remove an installed plugin through its native manager if you installed one separately.

Run `node dist/jevra.mjs clear-traces` before removing the config. This deletes only dated Jevra JSONL files in its trace directory. Config and credentials remain user-owned; no command deletes a Keychain credential or unrelated host settings.
