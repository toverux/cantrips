---
date: 2026-10-01
status: accepted
---

# `/review-gate` has an inline pass and a dispatched `low`

## Context

`low` was one inline pass by the session that wrote the diff: no sub-agent, no verifier, no arbiter, so `low --fix` applied nothing and a `--loop` round at `low` applied fixes nobody judged.
The next level, `medium`, dispatches six finders and a verifier per file or section: on some 240 lines of skill prose, each certifying pass cost five finders and five to ten verifiers and surfaced a dozen novel candidates on unchanged text.

Two forms were live for the level between them.
One agent that both finds and verifies: one dispatch, but the finder judges its own candidates, the bias the pipeline exists to route around.
A finder and a verifier of their own, the form chosen below.

This revises ADR 0005, which ran the arbiter at `medium` and `high` only, and corrects the consequences of ADRs 0007 and 0008; all three were amended in place.

## Decision

The inline pass keeps its behaviour under the name `inline`, and `low` becomes one finder carrying Angles A–D and every lens — picking those the diff calls for, hunting one at a time, capped at 8 candidates in total — then one verifier over every candidate, at `medium`'s precision with a report cap of 4.
Every run that applies fixes has an arbiter, dispatched at `low`, `medium` and `high` and run by the session itself at `inline`, so `--fix` applies at every level.
A run invoked above `inline` makes every gate call at `low` or above, and the findings script rejects an `inline` call in one.
The review-tail pointers suggest `low`, `medium` or `high`, never `inline`, which stays a level the user picks deliberately.

What settled it is that a small change deserves an independent finder and verifier, and three agents at most buy both.

## Consequences

`low` changed meaning under an argument users already type, so it shipped as a breaking change.
A `--loop` delta round over a few lines costs a finder and a verifier where an inline pass once did; in exchange, a dispatched run's green rests on verified rounds throughout.
The `inline` arbiter is not independent: the author rules on its own diff, a bias `inline` accepts.
