---
date: 2026-08-03
status: accepted
---

# Loop rules as prose with checkable guards, not a total state table

## Context

`/review-gate --loop` drives review → fix → re-review to a defined green state, and its rules live in `skills/review-gate/LOOP.md`, loaded only when the flag is passed.
The mode is stateful: certifying passes, delta rounds, a findings queue, a parked set, dispositions and stop conditions all interact.

Two forms were built and reviewed against each other.
The first specified the mode as a total state machine — a states list, a transition table of roughly twenty first-match rows, and an exits list — at 110 lines.
The second states the same rules as prose with three checkable stop conditions, at 71 lines.

## Decision

The loop's rules are stated as prose with three checkable stop conditions, and the transition table is rejected.

The two forms fail differently, and that is what settled it.
The table failed by structural incompleteness — unreachable rows, overlapping conditions, a guard with no row to fire from, a conjunct unsatisfiable on a project with no checks — and every repair opened a fresh interaction, at fix-to-new-defect ratios of 8→12, 10→6 and 6→6 over three review rounds.
The prose form fails by omission: eight rules dropped in compression were restored in one batch, none of those fixes disturbing another.
Omissions converge because restoring a clause does not change what its neighbours mean, and interactions do not because changing a row does.

A second effect confirmed it.
The table absorbed review attention — finders spent their budget checking case coverage and missed semantic defects that a blind read of the prose form surfaced at once, including that the mode silently degraded to a one-shot review on a harness without sub-agents.

## Consequences

The mode gives up determinism about which action an agent takes when several conditions hold at once.
The three stop conditions stay formal in exchange, since a run has to end on a rule rather than on a judgement.
A case the rules do not cover is resolved by asking the user rather than by improvising.

Reviews of this file should hunt semantics and its seam with `skills/review-gate/SKILL.md` rather than case coverage.
A reviewer reporting "this case is unspecified" is reporting a defect only where leaving it unspecified would cause concrete harm — a destructive action, a false claim to the user, or a run that never ends.
