# Jevra

An open-source decision layer for coding agents, starting with Codex, Claude Code, and TypeSafe's Jev.

Users keep working in their existing agent. A `UserPromptSubmit` hook sends a bounded skill catalog and the current request to Jev. The runtime validates the result and can suggest one skill to the host LLM.

**Status: executable developer alpha, `0.1.0-alpha.1`.** Codex CLI context delivery has been verified with a real Jev call. Claude Code has adapter tests and a validated plugin manifest; authenticated context delivery is pending. This is not a general decision framework or a production release.

## What works

- Shared TypeScript core, official TypeSafe SDK provider, CLI, and separate host adapters.
- Explicit skill directories, validated YAML metadata, content revisions, and bounded inputs.
- Disabled, observe (default), and advise modes; explicit skill mentions retain native handling.
- Choice selection plus an independent Noul check for requests requiring multiple skills.
- Deadlines, cancellation, no automatic retries, response validation, and native fallback.
- Local metadata traces, retention, deletion, and optional macOS Keychain credentials.
- Synthetic evaluation runner, packaged development hooks, and credential-free tests.

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

See [host setup and removal](docs/usage.md) before enabling a hook. Building or initializing Jevra does not activate it in an existing agent.

## Data sent and recorded

An eligible request sends the current prompt and configured skill names, descriptions, and opaque IDs to TypeSafe. Skill bodies, source paths, transcripts, and other repository files are not sent by this module. Descriptions can still contain private information: choose the catalog deliberately.

The runtime reads skill bodies locally to validate bounded files and compute freshness hashes. Local JSONL traces contain hashed IDs, revisions, policy versions, reason codes, timing, and provider usage. They omit prompts, paths, skill text, and raw judgments. Default retention is seven days. Run `node dist/jevra.mjs clear-traces` to remove owned trace files.

## Evidence and limits

The [initial component report](evals/reports/2026-09-17-component-pilot.md) records 60/60 expected routing outcomes for Jev and 42/60 for a small deterministic baseline. These synthetic, author-labeled cases are a smoke dataset, not independent evidence of general accuracy. Task success, rework, and total LLM plus Jev cost remain unmeasured.

[Compatibility](docs/compatibility.md) distinguishes runtime tests, live host probes, and pending work. Caching, deduplication, durable session budgets, automatic installation/upgrades, skill-adherence measurement, and full-task comparisons remain in the backlog. No savings claim or default promotion to advise has been made.

## Documents and contributions

- [Product and technical specification](SPEC.md)
- [Implementation issues and acceptance criteria](ISSUES.md)
- [Development and evaluation](docs/development.md)
- [Contributor and agent conventions](AGENTS.md)

Reference a stable planning ID from `ISSUES.md` in contributions. These IDs are not GitHub issue numbers. Write implementation and technical documentation in English.

The specification compares Jevra with [Spotify shunt](https://github.com/spotify/portal-ai-plugins/tree/main/plugins/shunt): both delegate work through hooks while retaining the existing agent interface; Jevra's first experiment evaluates bounded skill choices. Spotify code is not a dependency.

## License and service dependency

[MIT](LICENSE) covers this repository's original code and documentation. It does not license Jev model weights or grant TypeSafe API access. Users supply their own credentials.

This is an independent project, not an official OpenAI, Anthropic, Spotify, or TypeSafe product.
