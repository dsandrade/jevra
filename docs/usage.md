# Developer setup

Build and configure the CLI using the [README](../README.md). The alpha has manual host setup, not an installer. Use reviewed local skills and begin in observe mode. No marketplace release has been published.

## Codex CLI

The tested integration is a command hook. Add a `PreToolUse` entry for shunt-style reading (or `UserPromptSubmit` for skill routing) to an existing user or trusted project hooks file, preserving unrelated entries. Use the absolute paths to your Node 24 executable and built CLI:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read|Bash|exec_command",
        "hooks": [
          {
            "type": "command",
            "command": "\"/absolute/path/to/node\" \"/absolute/path/to/jevra/dist/jevra.mjs\" hook --host codex",
            "timeout": 3
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

The plugin command uses `node` from the host's `PATH`; make Node 24 available there. The plugin uses the same user Jevra configuration as Codex. Follow native host review and permission requirements. This loading method is documented by [Claude Code](https://code.claude.com/docs/en/plugins); manifest validation and authenticated Claude command-hook tasks were tested. Normal plugin activation and lifecycle remain separate checks; see [compatibility](compatibility.md).

## Enable shunt-style reading

Add `bulkRead` to your user-owned Jevra config; [example](../examples/shunt.config.json):

```json
{
  "bulkRead": {
    "roots": ["/absolute/path/to/approved-project"],
    "backend": "jev",
    "minLines": 350,
    "timeoutMs": 8000
  }
}
```

This fragment merges into the existing config; it is not a complete config. `bulkRead` is absent by default. Choose roots whose requested source text may be sent to TypeSafe. Set the top-level `mode` to `advise` to redirect eligible reads. Observe mode records the gate without blocking or making a gate-triggered API call.

The gate covers full `Read` calls and simple `cat`/`head`/`tail`/`less`/`more` commands. Reads with offset/limit, bounded head/tail commands, shell compositions, small files, and files outside configured limits keep native behavior. Native host permissions apply in every case. The gate never calls the provider itself.

When redirected, the agent receives a call instruction for the configured helper transport, with files and session. `bulkRead.transport` defaults to `"mcp"`; use `"cli"` only when the shell can access the credential store and network. CLI mode supplies a complete, quoted command. MCP mode never suggests switching automatically to the shell. The packaged `bulk-reader` and `code-context` skills explain how to use it. You can also run either helper directly:

```sh
node /absolute/path/to/jevra/dist/jevra.mjs bulk-read --host codex \
  --question "Which retry rules, exceptions and timing constraints apply?" \
  --paths docs/policy.md --paths docs/migration.md

node /absolute/path/to/jevra/dist/jevra.mjs code-context --host claude-code \
  --spec "Implement validation using the existing conventions" \
  --reference src/validation.ts --reference test/validation.test.ts
```

Use repeated file flags. Paths resolve against the helper's working directory and must stay inside configured roots. Both commands accept `--config /absolute/path/config.json`. They return exact selected excerpts with source names and line numbers; the main LLM performs all synthesis and code generation. No `--target` file is written. A fallback response directs the agent to native targeted reads. Excerpts are partial retrieval and can miss requirements.

Default limits: 16 explicit files, 64 KiB per file, 128 KiB total, 128 passages, 3,000 bytes per whole-line chunk, 24 shortlisted passages, four output passages, 8,000 bytes including output metadata, a 64 KiB provider request and a five-second helper deadline (the example uses eight). Oversized individual lines and symlink redirects are rejected. Files exceeding the gate's size cap remain native; there is no silent truncation. No retries or cross-call cache are used. `backend: "deterministic"` selects with BM25 only and sends nothing to TypeSafe through these helpers.

The packaged plugins also contain the existing `UserPromptSubmit` skill router. To run just the shunt experiment, register only the direct `PreToolUse` hook; for Claude, the same JSON structure belongs in its native settings, with `--host claude-code`. Preserve existing hooks. An empty reviewed skill directory can satisfy the current alpha's required `skillRoots` setting when skill routing is unused. Do not register direct and packaged hooks together.

## Host-managed MCP helper

Both plugin directories include `.mcp.json` registering the local `jevra` server. It exposes `bulk_read(question, paths, sessionId?)` and `code_context(spec, references, sessionId?)` using the same bounded selector as the CLI. Normal host MCP trust and tool permissions still apply. The host starts/stops the stdio process; no listening network service or persistent daemon is installed.

This transport is recommended with macOS Keychain credentials. Codex's `workspace-write` tool shell could not access the Keychain service in the measured environment. Its host-managed MCP process could access the service while the tool shell remained sandboxed. Do not weaken the shell sandbox or place the API key in a generated command to work around that boundary. Explicit CLI mode remains useful where its existing credential and network access are available.

For manual Codex setup, add the server alongside the reviewed read hook, using absolute paths:

```toml
[mcp_servers.jevra]
command = "/absolute/path/to/node"
args = ["/absolute/path/to/jevra/dist/jevra.mjs", "mcp", "--host", "codex"]
tool_timeout_sec = 15
```

For manual Claude MCP setup, use its native configuration surface with this server definition:

```json
{
  "mcpServers": {
    "jevra": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/jevra/dist/jevra.mjs", "mcp", "--host", "claude-code"]
    }
  }
}
```

If the hook uses an explicit `--config` file, add that same flag and path to the server's `args`. Otherwise both use the user Jevra config. The tool reads only requested files inside `bulkRead.roots`; it cannot execute arbitrary commands or write target files. One provider request is active at a time per server. It rejects oversized/invalid requests and gives targeted native fallback when unavailable. Only the API-calling server process retrieves the Keychain secret; it is never returned to the model or copied into the agent tool environment.

## Modes and diagnostics

Edit the user config's `mode`:

| Value | Skill router | Bulk-read gate |
| --- | --- | --- |
| `disabled` | No evaluation | No interception; explicit helper disabled |
| `observe` | Evaluate eligible prompts; no suggestion | Trace eligible reads only; no API call |
| `advise` | Evaluate and suggest at most one skill | Redirect eligible reads to the helper |

An explicit helper invocation requests retrieval in either observe or advise mode and may incur TypeSafe usage.

`doctor` reports catalog coverage and local diagnostics. It does not verify Keychain access or host activation. After setup, inspect the native hook manager and a local trace. A trace's `output_prepared` means the runtime prepared JSON; it does not prove host delivery or model adherence.

The catalog covers only configured directories. Symlinks, duplicate names, invalid frontmatter, inaccessible roots, or exceeded limits prevent routing rather than silently turning a partial catalog into advice. Normal host behavior continues. Skill directories must contain bounded `SKILL.md` files with `name` and `description` frontmatter.

Skill-router limits: 64 skills, 64 KiB per skill file, 64 KiB hook JSON, 16,384 prompt characters, 64 KiB provider request, and a 3-second decision deadline. Metadata tracing receives a separate 250 ms waiting allowance. Process startup, config/stdin handling, and OS scheduling are additional overhead. Use a 15-second outer host timeout for `UserPromptSubmit`; the provider-free read gate uses three seconds. The SDK retries zero times. Traces are best effort; a host-killed process can leave no trace.

Model and policy are pinned in configuration. The initial thresholds are provisional: Choice confidence >= 0.75, selected probability >= 0.65, and multi-skill Noul < 0.35. These are not calibrated guarantees.

## Update, disable, and remove

For development updates, pull over SSH, run `npm ci` and `npm run check`, then restart the host. Re-review changed hooks when requested by the host. Keep the checkout at the same path or update the direct hook command. Claude local development loading uses the newly built plugin directory.

Set `mode` to `disabled` to stop evaluations. To remove direct integration, remove only the Jevra handler from the hook file and its `jevra` MCP server entry. For Claude local development, stop passing `--plugin-dir`; remove an installed plugin through its native manager if you installed one separately.

Run `node dist/jevra.mjs clear-traces` before removing the config. This deletes only dated Jevra JSONL files in its trace directory. Config and credentials remain user-owned; no command deletes a Keychain credential or unrelated host settings.
