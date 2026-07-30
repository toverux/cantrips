# The docs/adr/ format

One architecture decision record per settled decision, under `docs/adr/` at the project root.
This file is the single source of truth for the format; `/compound` is the store's sole writer and writes against it.

## Naming

`docs/adr/NNNN-<slug>.md` — `NNNN` a four-digit sequential number, one past the highest in the directory, and a kebab-case slug naming the decision.

## Body

Nygard-minimal — the title, then four sections in this order:

```markdown
# <Decision title>

## Status

accepted

## Context

The forces at play: the problem, the constraints, and the alternatives that were live.

## Decision

The choice, stated as a full sentence, with the reasoning that settled it.

## Consequences

What follows from the choice — the good, the bad, and the obligations it creates.
```

## Status vocabulary

`accepted | deprecated | superseded by NNNN` — a freshly written record is `accepted`; the vocabulary has no `proposed` because in this loop the user gate is the acceptance and a written ADR is already decided.

## Supersession

A record is append-only once written; the one in-place edit permitted is a status flip — to `superseded by NNNN`, naming the successor that replaced it, or to `deprecated` when the decision is abandoned with nothing taking its place.
Reversing a standing decision therefore lands as a pair: the new ADR, and the status flip on the record it supersedes.
Walking a chain works in both directions — the old record names its successor, and the new record's Context names what it replaces.
