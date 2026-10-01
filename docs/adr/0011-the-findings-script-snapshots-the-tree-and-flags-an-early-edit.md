---
date: 2026-10-01
status: accepted
---

# The findings script snapshots the working tree, and flags an early edit without refusing it

## Context

`/review-gate --fix` and `--loop` promise that a round's findings reach the user before any of its fixes is written, so the user can interrupt one they object to.
A `--loop` run applied its batches before calling `report`, again after promising the order, and nothing in the gate noticed.
Under `--loop` every batch also stays uncommitted, so a delta round's target was rebuilt from the agent's own account of its edits.

Four forms of defence were live.
Prose alone states the order: the form that had just failed.
A pause before each batch, by a reply or a timed beat: the loop would wait on the user.
Refusing a `report` over a tree that moved, or a `PreToolUse` hook denying edits while one is owed: the user's own edit or a formatter moves the tree too.
Detection that flags and continues, the form chosen below.

For where a snapshot lives, two were live: the repository's own object store, or a side object directory beside the script's state.

## Decision

In a run that applies fixes, the script snapshots the working tree wherever it hands a gate call over: a tree object written through a throwaway copy of the index into the repository's own object store, with no ref, left to git's own pruning.
A `report` over a tree that differs from the one its round was handed opens its block with one fixed line and asks the agent to say what moved it; nothing is refused or restored, and the loop still never waits on the user.
Each delta round is handed a `git diff` from the tree the last gate call reviewed to the one it reviews, so consecutive diffs join end to end and an edit made early falls inside the next round.

What settled it is that the gate never pauses: the order only gives the user the chance to interrupt.
Blocking an early edit would also block the user's own edits and stall the loop, so the script reports the breach and has the next round review it.
The repository's own store keeps the handed diff a plain `git diff` a finder runs with nothing to get wrong.
The user made this call.

## Consequences

A batch's record leaves `LOOP.md` for the script, which ADR 0006's list now reflects, and the snapshots supply the fixed point ADR 0007's delta rounds assumed.
A fixing run needs a repository whose object store it can write: Codex CLI's default sandbox mounts `.git` read-only, so the run faults at `start` there.
`IDEAS.md` holds the side-directory fallback for that case, and adopting it reopens the second half of this decision.
A snapshot copies every untracked, un-ignored file into an object that stays until git prunes it.
A fix that changes nothing git sees, an ignored file's say, is handed no diff, and its round is reported with no candidates.
The tree a `report` is compared against and the tree the next diff starts from are separate references: a round that reviewed nothing leaves the second where it was.
