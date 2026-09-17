---
name: code-context
description: "Select reference passages with Jev for boilerplate, tests, configuration, or code generation; the main coding agent writes and validates the code."
---

# Code context

Ask Jevra for reference evidence before generating a file:

Prefer the Jevra `code_context` MCP tool with `spec` and `references` when available. Use the equivalent CLI below only in explicitly configured CLI mode. If MCP is unavailable, use native targeted reads.

```sh
node "${PLUGIN_ROOT}/dist/jevra.mjs" code-context --host codex --spec "Write tests matching the existing validation patterns" --reference tests/existing.test.js
```

Repeat `--reference` for more source files. The helper returns original reference excerpts, not generated code. Use the main model to write the requested code, verify exact source context as needed, and run relevant checks. There is no auxiliary generative model and no `--target` write performed by Jevra.
