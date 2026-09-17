---
name: bulk-reader
description: "Select exact evidence from large files with Jev before reading whole files into context. Use for files over 350 lines or questions spanning several large files."
---

# Bulk reader

Run the helper with a focused question and the files you need:

Prefer the Jevra `bulk_read` MCP tool with `question` and `paths` when available. It uses the same selector in a host-managed process, so API credentials stay outside the model tool shell. Use the CLI below only when the user configured `bulkRead.transport: "cli"` and its credential store/network are accessible. When MCP is unavailable, use native targeted reads instead of switching transports automatically.

```sh
node "${CLAUDE_PLUGIN_ROOT}/dist/jevra.mjs" bulk-read --host claude-code --question "Which rules govern retries and their exceptions?" --paths docs/policy.md
```

Repeat `--paths` for additional files. The helper uses user-configured allowed roots and returns selected original excerpts with line numbers. It does not generate a summary. Interpret the evidence in the main conversation.

Use native targeted reads for exact edits, debugging, missing context, ambiguous evidence, or helper failure. A selected excerpt does not establish that omitted text is irrelevant. Preserve native permissions. Each helper call is independent and may use paid TypeSafe inference; avoid repeating an identical call without new evidence or a different question.
