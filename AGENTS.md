# Contributor and Agent Instructions

## Working language

- Converse with the project owner in Portuguese by default.
- Write source code, identifiers, technical documentation, comments, tests, logs, and commit messages in English.

## Project state

- Read `SPEC.md` and `ISSUES.md` before planning implementation.
- This repository contains an experimental skill-routing and shunt-style evidence-selection runtime. The owner has adopted a broader development-brain product direction; read `docs/development-brain.md` for planned native memory, workers and complex-task support. Read `docs/compatibility.md` for verified boundaries and pending host validation.
- Preserve stable backlog IDs and distinguish planning IDs from GitHub issue numbers.
- Do not claim compatibility, test results, or efficiency gains without evidence.

## Architecture

- Keep deterministic policy in code and host-specific behavior in adapters. The adopted target assigns every explicit semantic decision in Jevra-managed workflows to Jev; read `docs/decision-architecture.md`. LLMs generate candidates and artifacts. Enforce receipts for managed transitions, and distinguish advisory delivery and native bypass from Jev control.
- Preserve native agent permissions, instruction hierarchy, and user authorization.
- Hooks cannot expose all internal model decisions. Advice delivery is not evidence that a model followed it.
- Skill selection and shunt-style evidence selection have separate evaluations and promotion decisions. Main-LLM generation remains the shipped code-context behavior. The owner has expanded planned scope to native engineering memory and optional generative workers; preserve evidence-only operation and do not present or enable unimplemented capabilities as existing defaults.
- Use the TypeSafe skill when it is available in the contributor's environment, and read current official TypeSafe documentation before changing integration contracts or questions.
- Recheck official host documentation and verify behavior on recorded versions before changing adapters.

## Repository operations

- Use Git over SSH or the `gh` CLI for GitHub. Do not use HTTPS Git remotes.
- Do not commit API keys, raw production transcripts, private source captures, local configuration, or evaluation credentials.
- Jevra is developed from scratch in this repository. Public documentation must describe its own design and requirements, without attributing its origin to confidential research or privately reviewed projects. Do not publish private organization/project identities or local research provenance. Keep public technical comparisons factual and distinct from implementation provenance.
- Keep default traces local and minimal. Public datasets must be synthetic or explicitly approved.
- Add meaningful checks for behavior and integration boundaries; use targeted verification for documentation-only changes.
- Update the specification when a product or architecture decision changes, and keep backlog acceptance criteria consistent with it.
