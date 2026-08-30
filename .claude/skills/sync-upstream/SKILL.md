---
name: sync-upstream
description: Reconcile this repo's forked skills with a new upstream release. Use when the user says an upstream (compound-engineering, mattpocock/skills) was updated, asks to merge/sync upstream changes into the forks, or wants the forks' divergence audited.
version: 1.2.0
---

Reconcile the forked skills with a new upstream release: disposition every upstream delta, gate every disposition on the user's approval, audit the whole divergence surface, and record the new sync point.
Nothing enters the repository without an approval, and a case these rules do not cover is put to the user rather than improvised on.

## Step 1: Measure

Get the exact new tag from `gh release list -R <upstream>`.
Every measurement comes from `scripts/fork-diff.sh` (through `mise run dev:fork-diff -- …`); fetch nothing by hand.
The tool reads each fork's `source:` frontmatter, re-prefixes its bare pinned version into the real tag, resolves the upstream skill's directory from the repository tree API rather than guessing it, fetches and caches the upstream files under `.scratch/sync/`, and prints a unified diff per file with a divergent-line count.

Run it twice:

- With no skill arguments, against the pins: every fork measured, whether or not upstream moved it.
  This is the audit — a release touching three files still gets all the forks measured, drift nobody has looked at being the audit's whole point.
- With `--tag <new-tag>` and the updated upstream's forks named, since one tag cannot be right for both upstreams.
  Pass the tag exactly as the release lists it, prefix included: the tool uses the override verbatim, re-prefixing only the pinned `source:` version.
  A wrong tag prints `skipped: could not read the tree` per fork and exits zero: an all-skipped second run is a failed measurement, never zero deltas.
  Check each fork's tag line, printed under its `════` header as `<repo>@<version> → <tag>, upstream skill '<name>'`: a tag line still naming the pinned tag means the override named the pin, not the release — the same failure — while identical hunks under the new tag are a real zero-delta release, not a failure.
  A fork with no tag line was skipped, never measured.

First set aside what was not measured: a file or fork the run could not read — `could not fetch`, `upstream copy unreadable`, a `skipped` fork, or an `upstream only` line carrying `(size unknown, fetch failed)` — classifies as nothing, whatever else its label says.
Retry unread files once with `--refresh`; park what a second attempt still cannot read, since an absent measurement is never a delta and never convergence.
Parking is per measurement: a fork skipped at the new tag keeps its pin-run measurement, whose hunks stay audit material.
For the updated upstream's forks, classify each remaining spot by whether upstream moved there, read from the upstream side of the two runs' diffs — hunk headers and context shift with unrelated edits, so compare the quoted upstream lines, never the hunk framing.
Where the upstream side reads the same in both runs, upstream left that text alone: the fork's divergence there is pre-existing — audit material.
Where the upstream sides differ, or a hunk shows in only one run, upstream moved: an upstream delta for Step 2, whose Standing-or-afresh question Step 2's anchoring rule decides.
A file the tool reports whole takes the same both-runs test: the same report in both runs is pre-existing — a never-ported or fork-only file, audit material — while a report in one run alone, pin or new tag, means upstream moved that file: an upstream delta.
Upstream edits inside a file the fork never carried are invisible to these diffs; where a ledgered policy asks for their evaluation — the preamble's persona rule — diff the two cached tags under `.scratch/sync/`.
The non-updated upstream's forks are measured once, against their pins, so every hunk they show is audit material.
Treat `source:` as provenance, not ground truth: a fork may have been cut from upstream main between releases and already contain wording "newer" than its recorded version.
An audit divergence is therefore not proof of local invention: a revert proposal states the divergence and leaves its origin open — for the non-updated upstream the run holds nothing newer than the pin, so origin stays uncheckable until that upstream's own sync.

The orchestrating session reads every diff itself and dispatches no sub-agents: ranking findings and writing the ledger take the whole picture, the tool has already done the measuring, and a sub-agent's summary would stand in for the diff the gate must show.

## Step 2: Disposition every delta

Consult the divergence ledger, [FORKS.md](../../../FORKS.md), then give each delta exactly one of four dispositions:

- **Standing** — a ledgered difference already covers it, or it lands in a section the fork dropped entirely and the recorded skip decides it.
  Zero churn: it bypasses the gate and is reported as reviewed in the Standing summary.
- **Merge** — nothing in this repo's environment forces words different from upstream's current text.
  On approval: the delta lands byte-identical to upstream; where the fork already carries upstream's text — upstream converged — nothing lands and the Merge's whole effect is ending the stale bullet.
  Byte-identity is scoped to the delta — where it lands inside a sentence carrying a fork-wide systematic convention, that convention stays.
- **Rework** — belongs in the fork, but a named environmental forcing demands different words.
  On approval: the reworked text lands and its ledger bullet is written in the same edit.
- **Skip** — tied to an upstream-only convention this repo lacks: a caller skill, a plan format, a file such as `CONTEXT.md`.
  On approval: it stays out and its ledger bullet records the skip, written in the same edit.

Merge is the default and needs no justification.
A Rework must name the file, skill, convention, harness, storage verb or cross-skill name this repo lacks that forces different words; a rework justified only by this repo's authoring standard — leading words, positive phrasing, one sentence per line, pruning — is a Merge, since a carried passage stays byte-identical even where a quality pass finds a real improvement in it.

A bullet covers a delta only while the upstream text it was anchored to survives.
Once upstream rewrites that text, the recorded decision was about wording that no longer exists: judge the delta afresh — which is how a Merge can end a difference the ledger still describes.

Write a Rework's text in full before the gate, so one pass approves the real artifact rather than a promise about it.
Its evidence is a diff against upstream, never against the fork's current text: a Rework's cost is the permanent divergence it re-creates at every future sync, and a diff against the fork's own file hides it.

## Step 3: Gate

Present the run in three sections, in order:

1. **The Standing summary** — one list, a line per Standing delta naming the bullet or dropped-section skip that covers it.
   A bypassed delta whose changed lines reach half the section it lands in appears individually with its diff instead — "already decided" never quietly covers a substantial change.
2. **The delta dispositions** — every Merge, Rework and Skip individually, for the user to approve, adjust, or reject.
   Per delta: the diff and a one-line disposition, and nothing else.
3. **The audit's divergence findings** — every local divergence no bullet covers, every bullet describing a difference that no longer exists, and every divergence justified by house formatting alone (a reflow, a restructure, a reordering, a gloss).
   Ranked by what leaving them costs — behavior above maintenance — capped at ten, with a cut line marking what is worth acting on and the held-back count reported.

Apply only approved dispositions.
Audit findings are proposals for a later `/spec`, and the run applies none of them — the restores and bullet deletions AGENTS.md rule 2 orders for house-formatting divergences included, deferred through the same route rather than applied unapproved.
That house-formatting class travels as one grouped finding with each divergence listed, riding above the cut line, so ranking cannot bury it.
A keep is the user's explicit answer to a presented finding, and what it writes depends on the finding's class.
A kept uncovered divergence gets one ledger bullet per divergence, in its section, recording the user's reason; a kept house-formatting divergence gets its bullet rewritten around that reason, which then justifies more than formatting, so neither the audit's classes nor rule 2 match it again.
A kept stale-bullet proposal — the user declining a deletion — leaves the bullet standing and writes nothing new.
The edit an adjustment asks for still travels to the `/spec`, the bullet recording the intent.
Silence keeps nothing and writes nothing.

## Step 4: Apply and record

- An approved Merge lands byte-identical; where it ends a difference the ledger still describes, delete that bullet in the same edit.
- An approved Rework or Skip lands with its ledger bullet written in the same edit.
- Refresh the `Verified against <tag>.` line of every section the run measured — under the full audit, every fork section, whether or not anything changed — to the newest tag it was fully compared against: the new tag for the updated upstream's forks, the pinned tag for the rest, always the full prefixed tag the stamps already use.
  A section merely consulted keeps its old stamp untouched.
- A section whose findings the run left unresolved — deferred to a spec, or held back by the cap — takes the annotated stamp the ledger's preamble defines, reason `<n> findings unresolved`, so the stamp does not read as a clean verification.
  A measurement the run could not complete — a fork skipped at the new tag, or a file still unread after the retry — adds the reason `not fully compared: <what>` to that same stamp, so the failure survives in the ledger rather than only in this session.
- Advance the updated upstream's pin in the ledger's preamble and set each of its forks' `source:` to the new version, including forks where nothing merged — never one not fully compared at the new tag, which keeps its own `source:` and parks as a question — so the next sync starts from the right baseline.
- Bump each touched fork's `version` for what the sync changed — patch for clarifications, minor for new rules, major for a breaking change — at one bump per skill per release, sized to the largest change in it.
  A fork whose `version:` line already differs from `git show <this repo's last release tag>:skills/<fork>/SKILL.md` (a cantrips `v…` tag, never an upstream one) takes no second bump; where the sync's change is the larger, resize that bump instead.
- A fork whose only change is its `source:` line takes a patch bump where no bump this release already covers it: that line is shipped frontmatter that moved, and left unbumped it would break the property that a fork's recorded version matches what it carries.

Done when every delta carries an approved disposition, every approved disposition has been applied, every kept audit finding carries its ledger bullet, every fully compared section is stamped, every touched fork's `version` carries a bump covering this sync, the sync point is recorded, every parked question has been put to the user, and the sync's diff has been through `/review-gate high --loop` — an invocation handed to the user, the run holding the sync open until that gate has run; it stops short of the rest only by parking a question for the user.

Close with a flow pointer (read [flow-pointers.md](../../../skills/writing-for-agents/flow-pointers.md) for the format): `/review-gate high --loop` (user-invoked) — a byte-level diff spanning many shipped skills is not landed on trust — then `/commit` (user-invoked), then `/spec` (user-invoked) when audit findings survive above the cut line.
