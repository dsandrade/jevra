# Economic routing and Claude adoption diagnostics

Date: 2026-09-18. [Sanitized observations](2026-09-18-economic-routing.json).
Contract: [economic routing](../../docs/economic-routing.md).

## What changed

The managed first-stage request can include a Jev economic judgment alongside
capability and relevance. Trusted configuration supplies measured whole-task
ranges; code calculates comparable totals and admissible choices. Missing data
does not become zero. The optional observe/enforce modes retain decisions and
can hand off before Luna generation. No economic configuration is enabled by
default, and no empirical calibration is shipped.

Both packaged test-artifact skill descriptions now lead with the ordinary request
they support: adding/generating unit tests. The skill also distinguishes an unknown
profile from a genuinely unconfigured file. This is a discovery hypothesis, not
a claim that wording forces adoption.

## Jev question behavior

Four synthetic counterfactuals used one first-stage request each, without a parent
or worker invocation. Numbers were deliberately invented classifier inputs, not
measurements and not production calibration. Expected labels were defined before
the requests. All calls returned `jev-1.13.0`.

| Scenario | Expected economic choice | Observed | Confidence | Passes existing decision threshold? |
| --- | --- | --- | ---: | --- |
| Missing measurements | insufficient | insufficient | 0.87 | Yes |
| Complete but negative benefit | native | native | 0.10 | No |
| Positive benefit, related task family | delegate | insufficient | 0.19 | No |
| Positive numbers, unrelated task family | native or insufficient | insufficient | 0.79 | Yes |

Three top labels matched the fixture expectations, but only two decisions met
the existing confidence/probability gate. In enforce mode the uncertain decisions
would return `economic_uncertain` and keep generation native. The positive case
did **not** demonstrate useful delegation. Do not equate top-label agreement with
reliable routing or lower thresholds to make this diagnostic pass.

Total Jev telemetry: **5,764 input / 379 output tokens**, four requests. Parent and
worker invocations: zero. Actual billed currency: unknown. These cases test a new
question contract; they do not measure forecast accuracy or savings. The state
explicitly preserves unverified parent execution metadata and the limits of the
observations. Whether those caveats contribute to abstention is untested; removing
them to obtain a favorable answer would weaken the evidence contract.

## Claude: discovery versus a routing recommendation

Two ordinary sum-test requests used Claude Code `2.1.274`, `claude-sonnet-5`, low
effort, existing CLI authentication, scoped MCP and the updated repository skill.
Neither user prompt mentioned Jevra or required a tool. Economic configuration
was absent in both, to keep this adoption diagnostic distinct from the question
experiment above. Each parent had a 240-second deadline and at most one managed
operation. No forced-call retry or model fallback was performed.

The first request offered skill + MCP only. The second additionally registered
Jevra's existing `UserPromptSubmit` command hook through session-scoped `--settings`.
The hook code was unchanged. It performs Jev skill selection and emits advisory
context; native permissions and the original prompt remain authoritative. Nothing
was globally installed or configured.

| Observation | Revised description only | Revised description + existing routing hook |
| --- | --- | --- |
| MCP connected / skill advertised | Yes / yes | Yes / yes |
| Skill read observed | No | Yes |
| Jev routing hook | Absent | Recommended the skill, one evaluation |
| Managed generation | None | One `generate_tests` call |
| Managed result | Not attempted | Accepted |
| Native materializer | Not attempted | One command, exact accepted bytes |
| Full-body read/rewrite through tool payload | Observed native Write | Not observed; no `read_test_artifact` |
| Independent baseline / mutants | 3 pass / 2 detected | 3 pass / 2 detected |
| Source unchanged / cleanup complete | Yes / yes | Yes / yes |
| Duration | 14.9 s | 43.5 s |

This isolates a missing part of the earlier test setup: MCP connectivity and skill
availability did not exercise Jev's prompt hook. The hook-enabled request observed
the desired path. One result does not establish causal effectiveness, reliable
ordinary adoption, or plugin installation/trust lifecycle compatibility.
The hook trace proves `output_prepared`; it does not by itself prove the host read
the advice. Skill loading, helper use and the materializer receipt are separate
observations supporting the end-to-end result.

## Complete observed usage

| Component | Description only input / output | Hook-enabled input / output |
| --- | ---: | ---: |
| Claude parent | 90,440 / 645 | 121,444 / 958 |
| Luna worker | 0 / 0 | 2,760 / 212 |
| Managed Jev decisions | 0 / 0 | 3,938 / 306 |
| Jev skill-routing hook | 0 / 0 | 670 / 78 |
| Total | 90,440 / 645 | 128,812 / 1,554 |

Parent input is cumulative and includes cache once. The first run had 79,887
cache-read, 9,573 cache-creation and 980 uncached input tokens. The hook run had
108,352 cache-read, 12,110 cache-creation and 982 uncached input tokens.
The worker reported no cached input; Jev cache usage is unknown.

Gross token consumption was higher in the hook-enabled observation. This is a
tiny fixture, one run per setup, with different cache conditions. It is not a
matched repeated efficiency benchmark, and token totals cannot establish CLI
subscription cost. Successful delegation alone is not success on the cost goal.

## Validation and next gate

Typecheck/build and **144 offline tests** pass. Ten new tests cover economic
arithmetic, applicability limits, unknowns, quality, budgets, decision enforcement,
receipt privacy, expiry and MCP host binding. Both updated skills validate; the
Claude plugin manifest also validates.

Keep the economic path opt-in and observation-oriented. Before an efficiency
claim, obtain properly reviewed task-family evidence, evaluate semantic
applicability on independent cases, and run a corrected repeated comparison.
Include routing-hook usage and unchanged native capability as explicit controls;
do not count helper non-adoption as successful delegated work or exclude its cost.
Preserve the original 12-cell pilot and this diagnostic's negative findings.

Reproduce with Node 24.21.0 and existing configured credentials:

```sh
node evals/workers/economic-probe.ts --keychain-service your-typesafe-key-service
npm run probe:artifact-host -- --host claude-code --delivery native-ticket --codex-executable /absolute/path/to/codex --keychain-service your-typesafe-key-service
npm run probe:artifact-host -- --host claude-code --delivery native-ticket --routing-hook --codex-executable /absolute/path/to/codex --keychain-service your-typesafe-key-service
```

The scoped setup follows the official [Claude hook contract](https://code.claude.com/docs/en/hooks#userpromptsubmit)
and [CLI settings interface](https://code.claude.com/docs/en/cli-reference).
Description changes follow the [skill discovery guidance](https://code.claude.com/docs/en/skills#skill-not-triggering).
These sources describe supported surfaces, not proof of Jevra's runtime behavior.
