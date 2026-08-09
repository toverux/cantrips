---
name: sync-upstream
description: Reconcile this repo's forked skills with a new upstream release. Use when the user says an upstream (compound-engineering, mattpocock/skills) was updated or asks to merge/sync upstream changes into the forks.
version: 1.1.2
---

Reconcile the forked skills with a new upstream release: merge what belongs, ledger what doesn't, and record the new sync point.

## Step 1: Map the forks in scope

`grep '^source:' skills/*/SKILL.md` lists every fork with its upstream repo, recorded version, and upstream skill name.
Scope the sync to the forks whose `source:` names the updated upstream.

## Step 2: Diff upstream between the two releases

- `source:` records a bare version (`@1.2.0`, `@3.21.2`) where the git tag carries a prefix: `v1.2.0` for mattpocock/skills, `compound-engineering-v3.21.2` for compound-engineering, never a bare `vX.Y.Z` there.
  Re-prefix before every `gh` call, and get exact tag names from `gh release list -R <upstream>`.
- An upstream skill's path is not the fork's own path: mattpocock/skills partitions into `skills/engineering/<name>/` and `skills/productivity/<name>/`, compound-engineering is flat at `skills/<name>/`.
  Resolve each path from `gh api repos/<upstream>/git/trees/<tag>?recursive=1` — a guessed path 404s.
- List touched files with `gh api repos/<upstream>/compare/<old-tag>...<new-tag>`, then fetch each touched forked-skill file at both tags and diff locally — the compare API's per-file patches and stats can come back empty.

## Step 3: Merge by content, never by the recorded version

Treat `source:` as provenance, not ground truth: a fork may have been cut from upstream main between releases and already contain wording "newer" than its recorded version.
For each upstream delta, read the fork's current text first and merge only what is genuinely absent.
Carry a merged delta **byte-identical** to upstream — verbatim text diffs empty at the next sync, so only real divergence ever shows up.
Every deviation is a decision recorded in the divergence ledger, [FORKS.md](../../../FORKS.md) at the repo root: a dropped delta as a skip, a reworded one (this repo's skill names, a deliberate lean rewrite) only when worth the diff noise it re-creates at every future sync.

Consult the ledger before merging: a listed difference stands — a skipped delta stays out, a local rewrite stays ours — zero re-litigation.
A delta tied to an upstream-only convention — caller skills, plan formats, variables this repo lacks — is a new skip: leave it out and ledger it.
A local difference absent from the ledger has no recorded decision: raise it to the user, then ledger the outcome.

## Step 4: Record the sync point

Bump each touched fork's `version` frontmatter (patch for clarifications, minor for new rules) and set its `source:` to the new upstream version — including forks where nothing merged, so the next sync starts from the right baseline.

Done when every in-scope fork's `source:` names the new release and every difference — an upstream delta merged or skipped, a local rewrite kept — is either in the fork or in the ledger.

> _Next: `/commit` (user-invoked) — lands the merged deltas and the updated sync points._
