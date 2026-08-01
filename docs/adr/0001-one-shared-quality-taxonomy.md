# One shared quality taxonomy for `/simplify` and `/review-gate`

## Status

accepted

## Context

`/simplify` and `/review-gate` both hunt the same three quality defects — duplicated functionality, unnecessary complexity, wasted work — and each carried its own text for them.
`/simplify` held three persona files under `references/`, forked from compound-engineering and written as fixer briefs; `/review-gate` held mechanical lenses in `ANGLES.md`, written as finder briefs and reimplemented from the built-in reviewer.

The two texts had drifted in both directions, not merely in verbosity.
The personas alone named reimplemented standard-library primitives, parameter sprawl, stringly-typed code, unnecessary comments, N+1 queries, TOCTOU existence pre-checks, memory leaks, and how to verify code is genuinely unused.
The lenses alone named speculative abstraction and closures retaining an enclosing scope.
Refining what "reuse" or "efficiency" meant therefore required editing both texts or accepting a widening gap, and the same diff got a different reading depending on which skill looked at it.

Four alternatives were live:

- Fold `/simplify` into `/review-gate` as a quality-lenses preset with `--fix` — one taxonomy by construction, one fewer skill, but it discards the cheap pre-review pass and its preservation contract.
- Host the taxonomy as its own model-invoked vocabulary skill, on the `/codebase-design` model — neutral ownership, at the cost of a roster entry, a sidecar, a version and a README line for something nobody invokes.
- Host it under `/codebase-design`, the existing shared-vocabulary skill — no new skill, but that skill is about deep modules, not duplication and wasted work.
- Keep both texts and add a "keep in sync" note — cheapest edit, and the drift returns on the next refinement, which is the failure this decision answers.

## Decision

The five quality lenses live in one file, `skills/review-gate/QUALITY-LENSES.md`, read by both skills, because a single text is the only arrangement where refining a definition is a one-place edit and the two review paths cannot disagree about the same defect class.

`ANGLES.md` keeps the correctness angles.
Each skill keeps only its own wrapper: `/simplify` its preservation contract and finding format, `/review-gate` its JSON candidate contract and per-lens caps.
The file sits inside `/review-gate` rather than a neutral home, following the plugin's existing precedent for a cross-skill reference — plain Markdown owned by the skill closest to the topic, linked by relative path from elsewhere, as `flow-pointers.md` is.
`/review-gate` owns all five lenses and exclusively uses two of them, which makes it the closer owner.

Every section of that file is self-contained, because both skills dispatch a carrier exactly one lens at a time and a pointer to another section resolves to nothing in the carrier's context.

## Consequences

The three mechanical lenses are the union of what both texts knew, so both skills gained defect classes neither had alone.

`/simplify` now depends on a sibling skill's directory.
Renaming `/review-gate` breaks that reference, which adds an edge to a rename already gated by `AGENTS.md`.

`/simplify` remains a fork of compound-engineering and keeps its `source:` provenance, so upstream improvements are still read — but its persona text is gone, and upstream persona deltas are henceforth evaluated as content candidates for the shared lens file and rewritten in this repo's voice rather than merged as text.
Two passages previously held byte-identical to upstream are compressed and no longer diff clean; `FORKS.md` records this, and the lens file holds the authoritative wording a future sync reconciles against.

The unification aligns coverage, not verdicts: `/simplify` still skips findings whose fix would not preserve behavior or would not be worth its churn, and `/review-gate` still verifies independently and reports what survives.

Design and Conventions moved across unchanged and sit outside the size budget that holds the three merged lenses to roughly six items each, since nothing merges into them.
Neither carries a gloss for agent-facing prose, so altitude — which lives only in the Design lens — is unchecked on prose material.
