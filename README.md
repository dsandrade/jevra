# Jevra

An open-source decision layer for coding agents, starting with Codex, Claude Code, and TypeSafe's Jev.

Users keep working in their existing agent. Lifecycle hooks call a shared runtime that prepares focused questions for Jev and maps the answers back to supported host behavior.

**Status: specification and implementation backlog. No executable plugin or runtime is available yet.**

## Responsibility split

- **The LLM** generates code, text, and candidate solutions, and handles open-ended reasoning.
- **Jev** evaluates bounded semantic questions over explicit state and candidates.
- **The runtime** owns deterministic rules, execution policy, budgets, fallback behavior, and measurements.
- **The host agent** retains its native permissions, sandbox, instruction hierarchy, and user experience.

Hooks expose lifecycle events, not every internal decision made by a model. This project will measure the value of delegating specific decisions instead of claiming to replace all LLM reasoning.

## First experiment

Select an applicable skill before the agent responds, including the possibility that no skill applies. Compare the original agent, a deterministic routing baseline, and Jev-assisted routing on the same tasks.

Measure task quality, skill-selection errors, rework, end-to-end latency, and total LLM plus Jev usage. No performance or savings claims have been established for this project.

## Project documents

- [Product and technical specification](SPEC.md)
- [Implementation issues and acceptance criteria](ISSUES.md)
- [Contributor and agent conventions](AGENTS.md)

The backlog uses stable planning IDs. These are not GitHub issue numbers. It separates the initial skill-routing release from later context-selection and completion-checking experiments.

The specification also compares the architecture with [Spotify shunt](https://github.com/spotify/portal-ai-plugins/tree/main/plugins/shunt), a related example of delegating work through hooks while keeping the existing agent interface.

## Proposed implementation

A shared TypeScript core, a Jev provider, a small command-line hook runner, and separate Codex and Claude Code adapters. MCP is a later integration surface for explicit decision requests and controlled context retrieval.

The initial runtime should be a local process invoked by hooks. A persistent service is an optimization to consider only if measurements justify it. Users supply their own TypeSafe API credentials.

## Development

There are no install, build, or test commands yet. The first implementation milestone will select and pin the runtime, package manager, and dependencies and add verified commands here.

Contributions should reference a planning ID from [ISSUES.md](ISSUES.md), state the expected behavior, and include evidence appropriate to the change. Keep implementation and documentation in English.

## License and service dependency

The project is licensed under [MIT](LICENSE). This license covers the repository's original code and documentation. It does not license Jev model weights, grant TypeSafe API access, or change the terms of third-party services.

This is an independent project, not an official OpenAI, Anthropic, or TypeSafe product.
