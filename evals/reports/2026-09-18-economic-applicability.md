# Economic applicability diagnostic — 2026-09-18

The narrow, evaluation-only Jev Noul accepted family applicability for all four
authored positive cases (0.94–0.96). Combined with deterministic financial
admissibility, it accepted 4/4 at the **economic-only** gate; the current compound
economic Choice accepted 0/4. Neither design accepted any of the 12 cases labeled
non-delegable. This is a component diagnostic using hypothetical totals, not a
complete-task benchmark or a production promotion.

## Recorded execution

Sixteen cases completed, one pinned Jev request each, no retries, no provider
failures and no missing usage. Cases, question text, thresholds, order and manifest
were frozen before inference under the [v1 protocol](../economic-applicability/protocol.md).
Every request included capability, evidence relevance, current economic Choice
and challenger membership Noul with the same state and measurement caveats.
Question answers are unavailable to each other. Hypothetical comparison totals
and a fixed counterfactual time make classifier inputs reproducible; they are
never measured savings or installable production calibration.

| Economic-only design | Accepted positives | Unsupported delegations | Missed positives |
| --- | ---: | ---: | ---: |
| Current compound Choice + admissibility | 0/4 | 0/12 | 4/4 |
| Membership Noul + admissibility | 4/4 | 0/12 | 0/4 |

Family-label agreement was 14/16. Multiplication with an addition-family
description returned uncertain (0.48), rather than the expected no. Missing family
returned no (0.03), rather than expected uncertain. Both blocked economic delegation.
The two vague-task/family cases returned uncertain (0.82 and 0.78). A membership yes
in an unfavorable, unknown, stale, unequal-quality or incompatible comparison
could not override deterministic financial rejection. The current Choice had
6/16 decisions above its frozen confidence/probability gates; the only
positive case with top label delegate still fell below them.

Known usage was **26,174 input + 1,904 output tokens**, 16 Jev calls,
zero parent and zero Luna invocations. No API-dollar scenario, actual billed USD
or subscription-quota estimate is reported. Batching both variants cannot isolate
the Noul's inference cost or rule out question interactions.

## Evaluator defect and limits

The frozen evaluator added a relevance threshold of **2**, while production uses
**1.5**. It also saved only route/economic/applicability answers, omitting relevance
answers. Its recorded combined initial-route counters reject every case and are
**invalid as a comparison of production routing**. The saved answers cannot support
an honest rescore. Preserve these counters and hashes as audit evidence; do not
silently lower the threshold or rerun to replace the result. Economic-only booleans
do not depend on this relevance check and support only the component comparison
above. The [JSON report](2026-09-18-economic-applicability.json) records this audit
and the original counters explicitly.

All expected labels were authored with these public synthetic fixtures; no
independent reviewer, held-out corpus, real cost calibration, multi-step workflow
or later Jev transition was tested. Four positives and zero observed false
delegations cannot establish domain accuracy or forecast reliability.

## Next step

Keep the production compound Choice, optional economic configuration and all
thresholds unchanged. The narrower membership formulation deserves a new,
independently reviewed applicability dataset, with production-derived gates and
every typed answer retained. Financial arithmetic remains deterministic; semantic
family judgment stays with Jev, and neither grants native permissions.

The [corrected whole-task proposal](../artifact-comparison-v2/protocol.md) now has
shared grammar guidance, six 4/8/24-example workloads, matched repeats, delivery/
managed-Jev/hook contrasts, syntax categories and offline token-accounting
utilities. Its manifest is preparation only; adapters, failure-injection accounting,
independent review, cache conditions, budgets and confirmatory checks remain gates.
No new full host benchmark or global plugin activation occurred.
