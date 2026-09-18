# Economic applicability diagnostic v1

Frozen before live inference on 2026-09-18. Sixteen author-created synthetic cases
compare the current compound economic Choice with an evaluation-only Noul asking
task-family membership. Hypothetical numbers are never measured calibrations.

## Design

One request per case, in the source order, at most 16 requests. Capability,
relevance, current economic Choice and challenger membership Noul share the exact
same state and cannot see each other's answers. This limits calls and isolates
judgment behavior, but cannot estimate per-variant inference cost or exclude
question-interaction effects. No parent or worker invocation occurs.

Cases cover four positive families/examples, four unrelated scopes/behaviors,
two vague tasks/families, and six accounting gaps or unfavorable observations.
Missing, stale, incompatible, unknown, unequal-quality and negative comparisons
cannot delegate under either design, even if semantic membership is yes.

Current Choice gates remain confidence 0.70 and selected probability 0.80.
Challenger membership uses Noul >=0.85 for yes, <=0.15 for no, otherwise uncertain.
This reuses the conservative support boundary without claiming calibration.
Both designs additionally require economic admissibility and a ready `tests`
capability route and one selected evidence item (score 2, confidence >=0.70).
Report economic-only and combined initial-route decisions separately so capability
rejection cannot conceal an erroneous economic judgment. Later packet sufficiency,
generation, validation, review and permissions are not evaluated or authorized.

The challenger performs no financial semantic selection: the runtime already
computes complete-case admissibility, while Jev evaluates the remaining semantic
family relationship. It remains evaluation-only; a promising result would justify
independent validation, not automatic registry replacement or enforce promotion.
Preserve measurement caveats and operator-declared execution metadata in the state.
No threshold/prompt/order/case edits after observing the results of this run.

## Safety and accounting

Use the pinned Jev model and existing TypeSafe provider with configured Keychain
access only inside the API process. One attempt/case, ten-second call deadline,
49,152 bytes/request, 32,000 known input tokens across the run and 120-second
run deadline. Stop on provider failure, cancellation or budget exhaustion; failed
usage remains unknown, never zero. There is no retry or model/transport fallback.
Write manifest, started call and progressive results before further requests.

Reports contain IDs, hashes, typed answers, categories, gates and usage. No keys,
raw source capture, private host/account information or full API streams. Fixtures
are intentionally public synthetic text. Preserve interrupted calls and missing
cases; an incomplete run cannot establish a reliable classifier.

## Interpretation

Report missed positives, unsupported economic/initial-route delegations, family-label
agreement, readiness and all known/unknown usage. Ambiguous labels require an
uncertain membership rather than a confident guess. All expected labels were
authored here; there is no independent reviewer or held-out corpus. The cases are
a component diagnostic, not proof of domain accuracy, forecast accuracy, cost
savings or subscription economics. Do not use these invented totals as production
calibration or alter the production question solely to match this dataset.

Before a whole-task cost benchmark, freeze equal grammar guidance, component/hook
accounting, profile rejection diagnostics, repetition/cache conditions and matched
native/worker/Jev delivery controls. Keep the earlier pilot/report immutable.
