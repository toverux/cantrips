---
date: 2026-09-29
status: accepted
---

# The findings script paces the loop, and `LOOP.md` keeps only the judgement it cannot make

## Context

This replaces ADR 0004, which stated `/review-gate --loop`'s control flow as a short pseudocode block in `LOOP.md`, the judgement rules as prose beside it, and a throwaway executable model as the oracle a review of the block ran against.

`/review-gate` then gained a findings script that holds the run's findings ledger and prints every surface the user reads.
Under `--loop` it also evaluates the three stop conditions from the agent's `same_as` tags and the user's answers, and after each call it prints what the loop does next.
The spec for that work kept ADR 0004 unrevised, which left two readings of one control flow: the block and the script's suggestions.
They drifted before the work was done: the block's stop check had to be reworded to fall where the script's does, at the end of a round.

Three forms were live.
The block stays the authority and the script only advises: two statements of the loop's order, kept in step by hand.
All control moves into the script and `LOOP.md` goes: the script cannot observe the checks, a batch's size, a red run or what needs the user.
The split chosen below.

## Decision

The script's `next:` lines carry the loop's order — certify the whole target once, apply the next batch, run a delta round over what it fixed, close once nothing is left of either — and `LOOP.md` holds only the judgement the script cannot make: the checks and their baseline, what a gate call is and the level a delta round earns, tagging re-finds `same_as`, a batch's record, a red batch, what to park, and the conduct once the run ends.

What settled it is that the script already had to encode the order to suggest it and to evaluate the stops, and that its reading is shipped and covered by CLI tests, where the block's was checked against a model nobody committed.
One statement of the order removes the drift instead of policing it.
The user made this call, reversing the reporting spec's standing decision, on the ground that the gate should carry only what it needs.

## Consequences

`LOOP.md` shrinks from sixty lines to under thirty, and the sixty-line budget ADR 0004 set stays as its ceiling.
A change to the loop's order is now a change to the script and its tests; a gate run over `LOOP.md` reviews judgement only, and the prose finders that ADR 0004 kept away from the block have no order left to churn.
The script no longer only suggests: the agent follows its `next:` lines and departs from them only where `LOOP.md`'s judgement calls for it, so a wrong line in the script misleads every run until it is fixed.
The script's tests take over the executable model's role as the oracle for the loop's order.
ADR 0002's rule for reviewers — hunt semantics, not case coverage — holds for what remains of `LOOP.md`.
