# Jevra

An open-source development plugin for Codex and Claude Code, developed from scratch with engineering memory, bounded delegated work, and TypeSafe Jev judgments as its product direction.

Users keep working in their existing agent. An opt-in `PreToolUse` hook redirects large reads to a helper: Jev selects source excerpts, and the main LLM interprets them and writes code. `code-context` selects implementation references. The original `UserPromptSubmit` skill router remains available.

**Status: executable developer alpha, `0.1.0-alpha.2`.** Large-read command hooks have run in authenticated Codex CLI and Claude Code sessions. The Jev selector has a live provider check; complete-task measurements are documented separately. This is not a general decision framework or a production release.

The adopted [decision architecture](docs/decision-architecture.md) assigns every explicit semantic decision in a Jevra-managed workflow to Jev. LLMs propose solutions and produce artifacts; code enforces policy and execution. This broader lifecycle is planned, and hooks cannot control hidden host decisions.

## What works

The [development-brain architecture](docs/development-brain.md) defines the adopted product direction. Native engineering memory, repository indexing and generative workers are planned; the current executable capabilities are listed below.

- Shared TypeScript core, official TypeSafe SDK provider, CLI, and separate host adapters.
- Explicit skill directories, validated YAML metadata, content revisions, and bounded inputs.
- Disabled, observe (default), and advise modes; explicit skill mentions retain native handling.
- Choice selection plus an independent Noul check for requests requiring multiple skills.
- Deadlines, cancellation, no automatic retries, response validation, and native fallback.
- Local metadata traces, retention, deletion, and optional macOS Keychain credentials.
- Shunt-style read gates, host-managed MCP tools plus `bulk-read`/`code-context` CLI commands, and guidance skills packaged for both hosts.
- Exact source passages and line provenance, BM25 retrieval, bounded Jev scoring, and a deterministic comparison backend.
- Component and complete-task evaluation runners, external correctness checks, and credential-free tests.

The LLM still generates code and text and handles open-ended reasoning. Jev evaluates supplied options. Deterministic code controls policy and budgets; the host retains permissions and execution. Hooks do not expose hidden reasoning, and a delivered suggestion does not establish that a skill was used.

## Build and try locally

Use Node **24.21.0** (see `.nvmrc`) and npm **11.19.0**. The core targets macOS and Linux; host validation currently covers macOS only.

```sh
git clone git@github.com:dsandrade/jevra.git
cd jevra
npm ci
npm run check
npm run eval -- --backend deterministic
```

`npm run check` typechecks, builds the standalone CLI and both development plugins, and runs the tests. No API credential is needed. Built files are ignored by Git and must be rebuilt after a checkout or update.

Create a config that points to reviewed skills. This example uses only the synthetic fixture catalog:

```sh
node dist/jevra.mjs init --skills-root "$PWD/evals/fixtures/skills"
node dist/jevra.mjs doctor
```

`init` writes `$XDG_CONFIG_HOME/jevra/config.json` or `~/.config/jevra/config.json`, with mode `observe`, and refuses to overwrite an existing file. Replace `skillRoots` with your chosen absolute directories. Workspace config is never loaded automatically.

Provide `TYPESAFE_API_KEY` through your existing secure environment tooling, or initialize with an existing macOS Keychain service:

```sh
node dist/jevra.mjs init --skills-root "$PWD/evals/fixtures/skills" --keychain-service your-typesafe-key-service
```

These are alternative initialization commands. For an existing config, add `keychainService` manually. Only the service name is saved. The first Keychain access may require macOS authorization; an unattended read that exceeds its deadline falls back.

To evaluate a saved request, run `node dist/jevra.mjs evaluate --prompt-file /absolute/path/to/request.txt`. This command makes a live Jev call when eligible. Set `mode` to `advise` to prepare model-visible advice, or `disabled` to stop evaluation. Observe mode still makes API calls and adds hook latency.

For shunt-style reading, explicitly configure `bulkRead.roots` and the read hook; use [the example config](examples/shunt.config.json) and [shunt architecture](docs/shunt-parity.md). The helper sends shortlisted text from requested files to TypeSafe.

See [host setup and removal](docs/usage.md) before enabling a hook. Building or initializing Jevra does not activate it in an existing agent.

## Data sent and recorded

The skill router sends the current prompt and configured skill names, descriptions, and opaque IDs to TypeSafe. Skill bodies, source paths, transcripts, and other repository files are not sent by this module. Descriptions can still contain private information: choose the catalog deliberately.

The bulk reader and code-context helper send the focused question, opaque passage IDs, and shortlisted original source text from explicitly configured roots. File-path metadata is kept local, but the source text itself can contain paths or private data. The gate sends no source text and makes no API request. Explicit helper calls can consume TypeSafe usage even in observe mode.

The runtime reads skill bodies locally to validate bounded files and compute freshness hashes. Local JSONL traces contain hashed IDs, revisions, policy versions, reason codes, timing, and provider usage. They omit prompts, paths, skill text, and raw judgments. Default retention is seven days. Run `node dist/jevra.mjs clear-traces` to remove owned trace files.

## Evidence and limits

The [initial component report](evals/reports/2026-09-17-component-pilot.md) records 60/60 expected routing outcomes for Jev and 42/60 for a small deterministic baseline. These synthetic, author-labeled cases are a smoke dataset, not independent evidence of general accuracy. They do not measure coding-task quality or total host cost. The [full-task pilot report](evals/reports/2026-09-17-full-task-pilot.md) evaluates those separately with native, deterministic and Jev arms; estimates are not subscription bills.

The current reading pilot completed 12/12 tasks with 300/300 external checks. Claude’s Jev-arm estimate was about 6% lower, but its input tokens increased and it used the helper in only one of two tasks. Codex showed no consistent cost saving. These two synthetic tasks do not justify a default change or a subscription-savings claim.

[Compatibility](docs/compatibility.md) distinguishes runtime tests, live host probes, and pending work. Caching, deduplication, durable session budgets, automatic installation/upgrades, skill-adherence measurement, and broader real-project comparisons remain in the backlog. No savings claim or default promotion to advise has been made.

## Documents and contributions

- [Product and technical specification](SPEC.md)
- [Implementation issues and acceptance criteria](ISSUES.md)
- [Development-brain architecture and first delivery slice](docs/development-brain.md)
- [Jev decision ownership, workflow concepts and stage map](docs/decision-architecture.md)
- [Shunt comparison and token-efficiency experiment plan](docs/token-efficiency-plan.md)
- [Development and evaluation](docs/development.md)
- [Contributor and agent conventions](AGENTS.md)

Reference a stable planning ID from `ISSUES.md` in contributions. These IDs are not GitHub issue numbers. Write implementation and technical documentation in English.

See the [shunt parity map](docs/shunt-parity.md) for the shared control flow and explicit differences. In the current alpha, Jev selects evidence and generation stays in the main model. Optional workers are part of the planned development-brain direction. Spotify code is not a dependency, and its published context-reduction percentages are not Jevra results.

## License and service dependency

[MIT](LICENSE) covers this repository's original code and documentation. It does not license Jev model weights or grant TypeSafe API access. Users supply their own credentials.

This is an independent project, not an official OpenAI, Anthropic, Spotify, or TypeSafe product.
