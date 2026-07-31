---
name: compound-refresh
description: Garbage-collect the knowledge stores — audit AGENTS.md, and docs/solutions/ where that store is enabled, against the current code.
argument-hint: '[optional: scope — directory, module, or keyword; blank audits everything]'
disable-model-invocation: true
version: 1.1.1
source: EveryInc/compound-engineering-plugin@3.20.0 (ce-compound-refresh)
---

Audit the knowledge stores against the current codebase and prune what no longer earns its place.
Two stores: the project's `AGENTS.md`, always, and `docs/solutions/` when the loop config enables it.
The loop config is `docs/agents/cantrips-loop.md`; when that doc is absent, the solutions store is off.
The opt-in `docs/adr/` store stays out of scope by design — supersession is its own hygiene mechanism.
Every change is user-gated.

## Scope

An argument narrows the sweep to matching `docs/solutions/` docs — try it as a filename, then a frontmatter `area`/`tags` value, then a content keyword.
No argument → every doc plus `AGENTS.md`.
`AGENTS.md` is in scope on every run: when the solutions store is off, or no doc matches the argument, say so in one line and audit `AGENTS.md` alone.

## Audit docs/solutions/

The format contract is [`../compound/solutions-format.md`](../compound/solutions-format.md).
For each doc in scope, cross-check its claims against the current code — cited paths and names still exist, the fix still matches how the code works today, snippets reflect the current implementation — and against its sibling docs for overlap and contradiction.
Verdict per file:

- **Keep** — still accurate and useful.
  No edit: reported as reviewed, zero churn.
- **Update** — the problem is still real but the doc drifted, from moved paths and renamed names up to a fix the current code now contradicts.
  On approval: evidence-backed in-place edits; on a contradicted fix, rewrite the doc to the current truth and present it as the rewrite it is.
- **Consolidate** — two docs overlap so heavily a maintainer must read both to get the truth.
  On approval: merge unique content into the canonical (broadest, most current) doc, delete the other.
- **Delete** — both the implementation _and_ the problem domain are gone, or the doc is fully redundant.
  On approval: delete the file — git history is the archive.

Judgment rules:

- **Match docs to reality, never the reverse.**
  When code and doc disagree, the doc changes; whether the code should have changed is outside this skill.
- **Age alone is clean.**
  A two-year-old doc that still matches the code is a Keep; age only prompts a closer look.
- **Contradictions between docs outrank staleness** — they actively mislead.
  Resolve them first, via Consolidate or Update.
- **Before a Delete, check the problem domain and the inbound links.**
  Implementation gone but the domain still alive (the app still handles what the doc addresses) → Update to the current truth instead.
  Other markdown citing the doc substantively (relying on it for content not stated inline) → Update instead; decorative "see also" citations are cleaned up alongside the delete.
- **Skip cosmetic churn.**
  Typos and wording polish are edits without evidence value.

## Audit AGENTS.md

Read the project's `AGENTS.md` (or the substantive file when one of `AGENTS.md`/`CLAUDE.md` merely includes the other) through three lenses:

- **Bloat** — lines that stopped earning their always-loaded cost: no-ops the model does by default, sediment from finished migrations, duplication of what rules files or skills already say.
  An outgrown glossary section is bloat with a home — propose graduating it to `CONCEPTS.md`, per `compound`'s convention.
- **Contradictions** — entries that conflict with each other, with rules files, or with what the code actually does.
- **Staleness** — references to renamed, moved, or deleted files, tools, or workflows.

Propose the smallest edit that fixes each finding.
Before applying any `AGENTS.md` edit, read [`../writing-great-skills/SKILL.md`](../writing-great-skills/SKILL.md) and hold the edit to it.

## Gate, report, close

Present the verdicts: Keeps as one summarized list; every Update, Consolidate, Delete, and `AGENTS.md` edit individually with its evidence, for the user to approve, adjust, or reject.
Apply only approved changes.

Close with counts (kept / updated / consolidated / deleted / AGENTS.md findings) and a one-liner per touched file.
Changes applied → close with a flow pointer (read [flow-pointers.md](../writing-great-skills/flow-pointers.md) for the format): `/commit` (user-invoked) — to land the refreshed docs.
