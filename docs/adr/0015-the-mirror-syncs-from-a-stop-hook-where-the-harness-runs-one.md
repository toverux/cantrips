---
date: 2026-11-17
status: accepted
---

# The mirror syncs from a Stop hook where the harness runs one

## Context

The GitHub mirror first rested on prose: the loop config told the agent to sync after each write verb, `/commit` to sync once more, and the closing line to close through two skills.
Five probe rounds on Sonnet at medium effort held each such step at 70 to 90 percent, and each rewording moved the failure to another step, while every deterministic step — a script printing the next step, the clone's mark check, the hashes that make a repeated sync a no-op — held every time.
Keeping hooks out had been the mirror spec's own choice, for parity between harnesses.

## Decision

A step that must happen runs from a hook or a script wherever the harness offers one, and parity with a harness that has none is no reason to keep it in prose there: on Claude Code a Stop hook runs `mirror.ts catch-up` at each turn's end, as ADR 0006 already had a script pace `/review-gate`'s loop.

## Consequences

Prose keeps only what the agent alone can do, and every step on a harness that runs no plugin hook; `skills/storage/SKILL.md` and AGENTS.md rule 5 name which.
Catch-up first-publishes a folder only once it holds a ticket, since `/spec` drafts at the spec's own path; the comment above `catchUp` in `skills/storage/scripts/mirror.ts` carries the gate.
