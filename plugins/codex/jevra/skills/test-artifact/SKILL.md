---
name: test-artifact
description: Add or generate unit tests for TypeScript/Node pure functions using Jevra when its generate_tests MCP tool is available. Use for requests to create a new test file or cover function behavior; Jevra checks configured scope and eligibility before generation.
---

# Test artifact

For a request to add tests, use the available `generate_tests` tool with `source`
set to the requested source file. It must match exactly one configured profile.
Use `test_profiles` only when scope is unknown, then pass `profileId` instead of
`source`. If no profile covers the request, continue natively; do not configure
new scope or weaken the task to force delegation.

Do not infer that a file is unconfigured merely because its profile has not been
listed. The tool resolves an exact configured source. If Jev returns
`native_handoff`, continue natively without retrying or overriding its decision.

Pass a new operation ID, the user's task and only additional requirements;
configured mandatory requirements are included automatically. Jev evaluates eligibility and
evidence, Luna generates, and the runtime runs fixed checks. Keep the operation
ID and identical arguments if retrieving a completed result. Do not start another
operation to evade a failure, uncertainty or the built-in one-repair limit.

Only `accepted` content is eligible for application as Jevra-validated output.
For unresolved work, preserve the reason and continue through the native host;
an unresolved candidate cannot be applied as Jevra-accepted output.

When the accepted response includes `materializeCommand`, check its destination
against the task and execute that exact command through the host's native shell
permissions and existing user authorization. It verifies the signed ticket, current
source, configuration, expiry and destination absence, then creates the file with
the accepted bytes. Do not read the whole artifact or recreate it in a Write/Edit
call by default. Use targeted inspection when needed and run relevant native checks;
the command does not rerun tests. Do not override paths or bypass a permission denial.

For the default review delivery without a command, use `read_test_artifact`, review
the content, recheck the returned source hash and destination absence, and create
the file through native editing permissions, preserving exact bytes. If the source
changed or the destination exists, stop that application and reassess natively.
Native changes to the accepted bytes fall outside the managed receipt.

MCP tools stage files and consume Jev/CLI usage but never write the destination.
They do not receive conversation history or choose shell commands. Acceptance is
evidence for this restricted profile, not proof of comprehensive coverage or lower
total task cost. An exposed tool or loaded skill does not guarantee adoption.
