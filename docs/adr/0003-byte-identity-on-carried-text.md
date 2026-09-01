---
date: 2026-09-01
status: accepted
---

# Byte-identity outranks the authoring standard on carried upstream text

## Context

Most of this plugin's forks are carried upstream text with edits, and the repo holds its own prose to `/writing-for-agents`; upstream does not.
Every carried passage therefore invites an edit the standard calls an improvement, and each one is defensible on its own.

Taken together they are not.
The fork divergence cleanup of August 2026 measured the accumulated cost: a sixth of carried fork text diverged, most of it by shape alone — reflows, restructures, reorderings, glosses — each carrying a `FORKS.md` bullet, and bullets rot.
`/sync-upstream` reads a bullet as a settled verdict, so a bullet whose reason was never true, or that quotes an upstream the pin never contained, is preserved at every sync.
A reflow turns an upstream touch to one sentence into a whole-paragraph conflict.
And an edit made under the standard can drop a guard while reading as an improvement: positive phrasing turned two `/commit` prohibitions into preferences.

`AGENTS.md` rule 2 states the rule in both directions — a carried passage stays byte-identical, and an existing divergence justified only by house formatting reverts.
This record holds why, since each individual edit still looks worth taking.
[ADR 0001](0001-one-shared-quality-taxonomy.md) recorded one such compression as a deliberate consequence of the shared lens file; its consequence claims are corrected in a note appended there.

Four alternatives were live:

- Hold carried text to the standard and pay the sync cost — the status quo, which produced the drift and re-litigates the same edits at every sync.
- Byte-identity with no exception — the cheapest sync, at the cost of keeping upstream's genuine no-ops, the defect this plugin's product exists to remove from agent-facing prose.
- Rewrite wholesale — what `/review-gate`, `/implement`, `/simplify`, `/commit` and `/compound-refresh` are; a per-fork choice with a permanent, documented cost, and no answer for a fork that wants nine-tenths of upstream.
- Byte-identity with one exception, an edit that buys something repo-specific — chosen.

## Decision

On carried upstream text, byte-identity outranks this repo's authoring standard: a divergence stands where it buys something repo-specific, and everything else takes upstream's words.

The test is observable from the edit alone.
A divergence earns its place where an agent behaves differently for it — a pruned no-op upstream states twice, a rule upstream has no counterpart for, a restored guard — or where this repo's environment forces the words: a file, skill, convention or harness upstream assumes, a storage verb, a cross-skill name.
A divergence that changes shape alone reverts, and its bullet goes in the same edit.
`/sync-upstream` carries the same test as its Merge-over-Rework rule.

Byte-identity wins because its cost is paid once, at the edit, while a divergence's cost is paid at every sync by an agent that cannot tell a deliberate difference from an accident without a bullet that stays true.
The standard's improvements to carried text are real and small; the sync cost compounds.

## Consequences

Carried text reads off-standard inside a plugin whose product is agent-facing prose, and a quality pass on it skips the finding and names this rule as the reason.

A fork that wants house style throughout takes the wholesale-rewrite route; the choice is per fork, never per paragraph.
