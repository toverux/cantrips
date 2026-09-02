---
date: 2026-09-02
status: accepted
---

# Loop control flow as short pseudocode, judgement as prose, an executable model as the oracle

## Context

ADR 0002 rejected a total state table for `skills/review-gate/LOOP.md` and kept the mode as prose with three checkable stop conditions.
The prose form then grew: every `--loop` run over the file surfaced findings, every fix added a rule, and the file reached 120 lines with a 52-line pseudocode block that had crept in as the rules multiplied — a second spec, read by finders as such.
Runs over it did not converge: four delta rounds each surfaced findings no earlier gate call had, and the loop stopped on its own novelty guard.

Two things were live.
Which form the file takes — prose only, pseudocode only, or a split — and what a review of it can use as an oracle, since the project has no checks and the finders are the only judge of prose.

## Decision

LOOP.md states the control flow as one Python-like block of about sixteen lines, the judgement rules as prose bullets under it, and holds the whole file to sixty lines; a throwaway executable model of the block, with scripted gate, checks and user, is the oracle a review of the block runs against.

What settled it is where each form fails.
Pseudocode is not scorable by a prose finder: the block has stayed at sixteen lines through eleven certifying passes while the prose around it absorbed every finding.
Prose judgement stays adaptable: an agent resolves a case the bullets do not enumerate, where a block would need a branch for it.
The model is what closed the run: three control-flow defects (a fix-delta chain with no bound, a red no edit explains, an answered finding parked again) were each reproduced as a failing scenario before the prose was touched, and a candidate the model could not reproduce was settled without a verifier.

The file is guidance for an adaptive agent, not a program.
It states intent and the guardrails the agent cannot infer — when to stop, when to ask, what green proves — and leaves enumerable edge cases to judgement.

## Consequences

A `--loop` run over prose with no oracle does not converge by itself: the line-by-line and cross-file finders produced four to six candidates per pass for seven passes while the removed-behaviour finder and both quality lenses reached zero in three.
The bar that closed it was "a defect a maintainer would refuse to ship", which cut candidates per pass by five; below that bar, a wording finding on guidance is a reading, not a defect, and is skipped with its reason.

The novelty guard trades two failure modes: counting every gate call stops a large diff after four novel rounds, counting only certifying passes leaves a fix-delta chain unbounded.
The first is kept, since a stop is a checkpoint whose pointer relaunches the loop with a fresh count and the second has no exit.

The model lives in a gitignored scratch directory and is not committed; a later edit to the block rebuilds it from the block, which is short enough to make that cheap.
ADR 0002's rule for reviewers still holds — hunt semantics, not case coverage — with the model as the place case coverage is checked.
