# Contributor and Agent Instructions

## Working language

- Converse with the project owner in Portuguese by default.
- Write source code, identifiers, technical documentation, comments, tests, logs, and commit messages in English.

## Project state

- Read `SPEC.md` and `ISSUES.md` before planning implementation.
- This repository contains an experimental skill-routing and shunt-style evidence-selection runtime. Read `docs/compatibility.md` for verified boundaries and pending host validation.
- Preserve stable backlog IDs and distinguish planning IDs from GitHub issue numbers.
- Do not claim compatibility, test results, or efficiency gains without evidence.

## Architecture

- Keep deterministic policy in code, narrow semantic judgments in the provider, and host-specific behavior in adapters.
- Preserve native agent permissions, instruction hierarchy, and user authorization.
- Hooks cannot expose all internal model decisions. Advice delivery is not evidence that a model followed it.
- Skill selection and shunt-style evidence selection have separate evaluations and promotion decisions. Main-LLM generation is the chosen code-context behavior; do not introduce an auxiliary generative model without a scope change.
- Use the TypeSafe skill when it is available in the contributor's environment, and read current official TypeSafe documentation before changing integration contracts or questions.
- Recheck official host documentation and verify behavior on recorded versions before changing adapters.

## Repository operations

- Use Git over SSH or the `gh` CLI for GitHub. Do not use HTTPS Git remotes.
- Do not commit API keys, raw production transcripts, private source captures, local configuration, or evaluation credentials.
- Keep default traces local and minimal. Public datasets must be synthetic or explicitly approved.
- Add meaningful checks for behavior and integration boundaries; use targeted verification for documentation-only changes.
- Update the specification when a product or architecture decision changes, and keep backlog acceptance criteria consistent with it.
