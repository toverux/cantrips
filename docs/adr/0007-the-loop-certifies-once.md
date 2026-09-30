---
date: 2026-09-30
status: accepted
---

# The loop certifies once and converges on delta rounds

## Context

`/review-gate --loop` declared green only on a certifying pass — the full gate over the whole target — that surfaced nothing new, so every recorded fix owed another full pass.
At `high` no certifying pass came back empty: eleven finders and a sweep over an unchanged tree always surfaced something, each fix re-armed the pass, and the run ended only on a stop guard.

Three forms were live.
Later certifying passes run a level down: cheaper, and still unbounded.
The arbiter's converged trajectory ends the loop: an ending resting on one agent's word.
The run certifies once and the delta rounds carry it to green, the form chosen below.

## Decision

A run certifies the whole target once, then converges on delta rounds: it is green once nothing is queued, a delta round has re-reviewed every recorded fix, no certifying pass is due and the checks are not red.
A `--loop` start over a stopped run owes a certifying pass again, and the arbiter's reply may ask for one more, granted once per run, where the fixes reach further than the delta rounds over them could see.
A `fourth_novel_round` stop lapses where its round ends with nothing left, since a run with nothing standing has converged.

What settled it is that a delta round reviews exactly what changed since the pass that certified the rest, so a second full pass reviews mostly text it already cleared and pays for its own false novelty.
The user made this call.

## Consequences

Green rests on the delta rounds, so a fix stays on the record until a round names it, and a round with nothing to rule wakes no arbiter.
The last fixes of a `high` run may be reviewed at the level their batch earned, `low` included; the closing report names the rounds that ran unverified, and the arbiter's extra pass is the valve.
A run continued by `answers` after a stop owes no certifying pass, where a relaunch does.
The rule lives in the findings script, as ADR 0006 has it, in the one function that names what still blocks an ending.
