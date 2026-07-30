---
name: sync-upstream
description: Reconcile this repo's forked skills with a new upstream release. Use when the user says an upstream (compound-engineering, mattpocock/skills) was updated or asks to merge/sync upstream changes into the forks.
version: 1.0.0
---

Reconcile the forked skills with a new upstream release: merge what belongs, ledger what doesn't, and record the new sync point.

## Step 1: Map the forks in scope

`grep '^source:' skills/*/SKILL.md` lists every fork with its upstream repo, recorded version, and upstream skill name.
Scope the sync to the forks whose `source:` names the updated upstream.

## Step 2: Diff upstream between the two releases

- compound-engineering tags are named `compound-engineering-vX.Y.Z`, never bare `vX.Y.Z` — a bare-tag compare 404s; get exact tag names from `gh release list -R EveryInc/compound-engineering-plugin`.
- List touched files with `gh api repos/<upstream>/compare/<old-tag>...<new-tag>`, then fetch each touched forked-skill file at both tags and diff locally — the compare API's per-file patches and stats can come back empty.

## Step 3: Merge by content, never by the recorded version

Treat `source:` as provenance, not ground truth: a fork may have been cut from upstream main between releases and already contain wording "newer" than its recorded version.
For each upstream delta, read the fork's current text first and merge only what is genuinely absent.
Carry a merged delta **byte-identical** to upstream — verbatim text diffs empty at the next sync, so only real divergence ever shows up.
Every deviation is a decision: a dropped delta goes to the ledger, and a reworded one (this repo's skill names, a deliberate lean rewrite) must be worth the diff noise it re-creates at every future sync.

Consult the ledger below before merging: a delta listed there stays out, zero re-litigation.
A delta tied to an upstream-only convention — caller skills, plan formats, variables this repo lacks — is a new skip: leave it out and add it to the ledger.

## Step 4: Record the sync point

Bump each touched fork's `version` frontmatter (patch for clarifications, minor for new rules) and set its `source:` to the new upstream version — including forks where nothing merged, so the next sync starts from the right baseline.

Done when every in-scope fork's `source:` names the new release and every upstream delta is either merged into the fork or entered in the ledger.

## Skips ledger

Deltas deliberately not carried; each reappears in every future upstream diff, so it stays listed here until the reason lapses.

**compound-engineering** (reconciled at v3.20.0):

- ce-simplify-code "structure pins" paragraph — tied to ce-plan's `session-settled:` plan convention; nothing in this pipeline passes a plan to `/simplify`.
- ce-simplify-code task-tracking paragraph and ce-work/lfg size-gate parenthetical — harness housekeeping and upstream-only callers.
- ce-compound-refresh `references/` and `scripts/` — the fork does not bundle them.

> _Next: `/commit` (user-invoked) — lands the merged deltas and the updated sync points._
