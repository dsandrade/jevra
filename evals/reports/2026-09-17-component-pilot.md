# Initial component pilot — 2026-09-17

This pilot verifies executable skill routing. It does not establish better coding outcomes or lower total system cost.

## Results

| Measure | Keyword baseline | Jev |
| --- | --- | --- |
| Expected routing outcomes | 42 / 60 | 60 / 60 |
| Development cases | 28 / 40 | 40 / 40 |
| Nominal holdout cases | 14 / 20 | 20 / 20 |
| Provider evaluation attempts | 0 | 56 |
| Explicit-reference bypasses | 4 | 4 |
| Routing p50 / p95 | < 1 ms / < 1 ms | 324 ms / 545 ms |
| Observed provider input tokens | 0 | 73,790 |
| Observed provider output tokens | 0 | 10,412 |
| Actual billed dollars | Unknown | Unknown |
| Host LLM usage / task success | Not measured | Not measured |

An outcome is correct only when both the selected skill (or no skill) and disposition match the author label. The four explicit references correctly bypass Jev and retain native handling. Latencies cover the routing component, including Keychain reads on eligible Jev cases, and include the four fast bypass cases. They exclude CLI startup, catalog loading, trace IO, and host task execution. Baseline times round to zero milliseconds in JSON.

The dataset contains six synthetic skills and 60 synthetic prompts: 36 covered tasks, 12 no-match prompts, four explicit mentions, four multi-skill requests, and four ambiguous requests. Labels were authored independently of Jev responses but have not received independent human review. The keyword rules are a limited baseline, not Codex or Claude's native selection behavior. A 60/60 result on these clear synthetic examples does not estimate real-world accuracy.

## Conditions

- Node 24.21.0 on macOS arm64; TypeSafe SDK 0.6.0; model `jev-1.13.0`.
- Question version `skill-selection/1`; policy version `skill-selection/1`.
- One Choice question and one independent Noul question in a single request per eligible case.
- Provisional thresholds: confidence >= 0.75, selected probability >= 0.65, multi-skill Noul < 0.35.
- Three-second per-case deadline, no SDK retries, no Jevra cache, sequential cases.
- One reported run of the final runner; no threshold or semantic-question tuning on these outcomes.
- All 56 provider attempts in this run returned usage. Four bypasses made no attempt.

An earlier wiring run with the same questions and labels also matched 60/60, with p50 326 ms and p95 502 ms. The final run followed stable name ordering and accounting improvements. It is not an independent confirmatory repetition. The holdout split is nominal only: authoring and code inspection exposed the dataset, so it is not a blinded evaluation.

## Host wiring

The separate [host probe](2026-09-17-host-probes.json) confirms that Codex CLI executed a bundled Jevra hook, received a real Jev recommendation, and returned the suggested skill name. Observed hook-runtime latency was 2,471 ms for that one call. This is context-delivery evidence, not proof of skill execution or completion quality. Claude live delivery remains unverified because no authenticated local Claude session was available.

## Reproduce and next decision

Run the commands in [development](../../docs/development.md) from a built checkout. The committed [Jev report](2026-09-17-jev.json) and [baseline report](2026-09-17-deterministic.json) contain per-case results, hashes, usage, and conditions. Opaque candidate IDs depend on canonical local paths; reports identify choices by skill name, and the catalog is ordered by name.

Keep observe mode as default. Before promotion, obtain independently reviewed cases with confusing skills, adversarial and multilingual inputs, realistic catalog sizes, full-task checks, repeated paired host runs, and predetermined quality/overhead budgets. Measure the native host, deterministic routing, and Jev routing with equivalent plumbing. No quality, cost, or latency promotion gate has been passed.
