# Opt-in test artifacts in the parent host

Status: experimental, updated 2026-09-18. The existing evidence tools keep their behavior.
This surface connects the [restricted artifact profile](test-artifacts.md) to
host-owned stdio MCP. It does not certify general worker isolation or enable
generation by default. See DR-018, DR-023 and the remaining DR-039 gates.

## Configuration and data scope

Configure a user-owned Jevra JSON file, passed through `--config` or `JEVRA_CONFIG`.
Workspace configuration is never loaded automatically. Artifact tools appear only
when `mode` is `advise`, `testArtifacts.enabled` is true, the experiment profile is
explicitly acknowledged, the Jev model matches the registry (`jev-1.13.0`) and the
process is not itself a worker. Disabled/observe modes expose no generation tools.

Example for an authorized synthetic source at `/workspace/example/sum.ts`:

```json
{
  "version": 1,
  "mode": "advise",
  "skillRoots": ["/workspace/example/.agents/skills"],
  "keychainService": "your-typesafe-key-service",
  "testArtifacts": {
    "enabled": true,
    "experimentalProfile": "node-pure-function-tests/1",
    "codexExecutable": "/absolute/path/to/codex",
    "stagingDirectory": "/absolute/private/jevra-artifacts",
    "maxOperations": 1,
    "profiles": [{
      "id": "sum",
      "sourcePath": "/workspace/example/sum.ts",
      "exportName": "sum",
      "outputName": "sum.test.ts",
      "requirements": ["Assert sum(2, 3) equals 5."],
      "instructions": ["Write technical artifacts in English."],
      "mutants": [{
        "id": "subtract",
        "content": "export function sum(a: number, b: number): number { return a - b; }\n"
      }]
    }]
  }
}
```

The source must satisfy the closed pure-function grammar. Source directories and
the server's working directory must be canonical; profiles outside that workspace
are excluded. Use Node 24.21.0 and the supported Codex CLI version, with an existing
ChatGPT login. Each source/output/mutant catalog is approved through configuration;
tool arguments cannot add paths, executables, commands, mutants or approval flags.
Configured mandatory requirements and instructions cannot be removed by callers.

Enabling a profile authorizes sending its bounded source, task, requirements,
instructions and candidate to Jev, and a selected packet to the Codex/Luna worker.
Mutant implementations stay in the validator. Credentials remain in the API-calling
process and official CLI authentication; neither history nor OAuth material is
copied into the packet. Review the actual configured scope before enabling it.

## Tool contract

| Tool | Inputs | Result and effect |
| --- | --- | --- |
| `test_profiles` | Empty object | Configured in-workspace profile scope, requirements and remaining operation slots; no inference |
| `generate_tests` | `operationId`, exactly one of `profileId` or `source`, `task`, optional additional `requirements` | Jev decisions, fresh Luna generation, staging and actual checks; compact result, usage and handle; no destination write |
| `read_test_artifact` | `operationId`, `artifactId` | Latest candidate text, exact source hash, destination and acceptance status after freshness/hash/ownership checks |

Generation is annotated as a write-capable, external-calling tool because it stages
files and consumes provider usage. Annotations describe behavior; they are not
authorization. Profile discovery and artifact delivery are read-only tools.
The two evidence tools, `bulk_read` and `code_context`, are unchanged.

When the task already identifies a source, pass that exact configured path to
`generate_tests`; discovery is optional. Ambiguous and unknown sources fail before
inference. Mandatory configured requirements are retained and exact duplicate
strings are removed; callers need supply only additional requirements.

An operation ID binds the normalized request for this MCP process. An identical
completed replay returns its result without new provider work; a different request
with that ID is rejected. A pending duplicate does not start inference. Only one
operation can be active, and each configured profile can be attempted once per
process. Default session capacity is one operation, configurable to at most four.
Setup failures consume the reserved slot. A new ID cannot bypass the profile's
one-repair policy. These are process-local budgets, not durable account quotas;
restarting the server starts a new session.

Managed limits still allow at most four Jev calls and two generations per operation.
Review/replay expires ten minutes after reservation. Cancellation and connection
closure cancel the managed operation; shutdown gives subprocess cleanup a chance
to finish. No alternate model or API-billed transport is started on failure.

## Review and native application

The generation response contains no file body. With the default `delivery: "review"`,
the host requests the artifact when ready to review it. `read_test_artifact` proves delivery of current candidate bytes;
it does not prove that the model reviewed them or that a person approved them.

Only accepted output is eligible for application as Jevra-validated content. The
host uses its own editing tools and existing user authorization, rechecks source
hash and output absence, and creates the new destination without replacing files.
The MCP server deliberately exposes no apply tool and never treats a model-supplied
`approved: true` as authority. No extra human confirmation is required solely because
Jevra was used when the original request already authorizes the edit.

In review delivery, native permissions and editing behavior belong to the host. Jevra
cannot enforce atomic creation, exact-byte application, freshness or subsequent
native edits through this surface. A changed candidate is outside its validation
receipt. The internal `NodeTestArtifacts.apply` method still offers create-only
atomic publication to trusted callers, but is not exposed over MCP. Do not claim
its guarantees for native application. The diagnostic independently compares the
actual written hash and source preimage, then reruns baseline/mutation checks.

With explicit `testArtifacts.delivery: "native-ticket"`, an accepted response also
contains a signed materialization handle and a fixed `materializeCommand`. The
host executes it through native shell permissions, avoiding full-body delivery and
regeneration by default. The deterministic CLI authenticates the candidate, exact
configuration/workspace/source binding, expiry and destination absence, reserves
one attempt and creates the exact bytes atomically without overwriting. MCP still
does not apply files. Configuration and staging must be outside the workspace.
See [compact delivery](artifact-materialization.md) for the trust boundary, native
staging permissions, durable ticket lifetime and failure behavior.

## Receipts and overhead

Mode-0600 metadata files under the configured private staging directory retain
started/completed/failed operations, the final `managedReason` and the managed usage ledger. They omit task,
source, requirements, candidate bodies, raw CLI streams and test logs. Staged
candidate files separately contain the generated code. `traces: false` controls
the legacy hook trace feature; it does not disable these explicit artifact records.
Retention is manual. Legacy review handles cannot be imported after restart or
between hosts. Accepted native tickets remain usable from their bound workspace
for ten minutes after issuance, including after the MCP issuer exits. They do not
provide general operation resume or durable inference budgets.

Host usage remains unknown to the server. The diagnostic combines host telemetry
with the managed receipt; actual billing and subscription allowance remain unknown.
An interrupted started record with no final receipt is incomplete accounting, not
zero usage. Review delivery can add host tokens by reading and copying the whole
candidate. Compact native delivery avoids that required cycle; end-to-end savings
still require a matched repeated evaluation.

## Host setup and verification

Both bundles include `test-artifact` guidance. Existing bundled `.mcp.json` files
start the same server; opt-in configuration determines the additional tool set.
Use a supported Node executable in the host environment. For manually registered
Codex MCP, set `tool_timeout_sec = 200` so the host can accommodate the 180-second
operation deadline and cleanup. Respect native tool permissions. Codex documents
server/tool policies separately from transport; Claude provides scoped tool
permissions and explicit MCP configuration. See [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli),
[Claude MCP](https://code.claude.com/docs/en/mcp) and
[Claude CLI](https://code.claude.com/docs/en/cli-reference).

```sh
npm run check
npm run probe:artifact-host -- --host codex --codex-executable /absolute/path/to/codex --keychain-service your-typesafe-key-service
npm run probe:artifact-host -- --host claude-code --codex-executable /absolute/path/to/codex --keychain-service your-typesafe-key-service
```

Add `--delivery native-ticket` to exercise compact delivery in the same bounded
synthetic diagnostic. This records actual native materializer receipts, full-body
tool payload observations, accepted/output hashes and independent checks. Full-body
absence means the exact complete body was not observed; it does not exclude every
possible partial read, escaped copy or equivalent rewrite.

For the separate Claude prompt-routing diagnostic, add `--routing-hook`. This
registers the existing Jevra `UserPromptSubmit` command for that CLI session and
records its usage separately from managed artifact decisions. It does not change
the ordinary user prompt or globally install a plugin. MCP plus a skill alone
does not exercise this hook. The [recorded diagnostic](../evals/reports/2026-09-18-economic-routing.md)
observed ordinary helper use with the hook and native completion without it; this
is one observation per setup, not reliable adoption or savings evidence.

Optional `testArtifacts.economics` adds [economic evidence screening](economic-routing.md).
Keep it absent for capability-only behavior, or explicitly choose observation or
enforcement. No default calibration is supplied. MCP returns only a compact
economic status; full numeric bounds and hashes remain in the private receipt.

The live runner consumes existing CLI/TypeSafe usage, creates a temporary synthetic
repository, supplies only Jevra MCP and a repository copy of the packaged skill,
and submits an ordinary request with native fallback tools available. It preserves
the official authentication locations and normal login identity variables. It does
not install a plugin globally, extract credentials, bypass hook trust or weaken
Codex's shell sandbox. `--explicit-invocation` is a separate wiring diagnostic and
must never be counted as ordinary adoption. Results stay in ignored local files.

See the [recorded host diagnostic](../evals/reports/2026-09-17-artifact-host-probe.md).
Package installation/trust lifecycle, repeated ordinary adoption, broader profiles
and matched quality/cost evaluation remain separate release gates.
