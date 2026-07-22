---
name: general-code-style
description: Load before writing or editing any source file, in any language, the moment a task will create or modify code and before the first edit. Covers line breaks, the 100-character line limit, comments, and docblocks. The trigger is writing; a session that only reads code leaves it unloaded.
version: 2.0.0
---

# General Code Style

Language-agnostic style rules.
Apply every rule below to all code you write or edit.

## Formatting

- Let the code breathe: separate logical blocks, and a variable's assignment from its usage, with single blank lines (never consecutive ones).
- Break every `{}` block across multiple lines, even a short one.
- Pass at most 4 parameters to a function; beyond that, group them into an object.
  Symmetry with neighboring code wins over this rule.
- Punctuate prose in comments, docblocks, and docs with commas, semicolons, or colons; never em dashes (—).
  When you meet an em dash, remove it or find a simpler formulation.
- Enforce a strict 100-character line length limit in source files, comments and docblock decoration included.
  Exceptions:
  - One-line lint warning suppression comments.
  - Long strings that would read worse split across lines.
  - AGENTS.md and other Markdown documents intended for agents (ex. skills, rules).
  - Any file where the limit is not applicable or desirable.

  On Claude Code, the wards plugin also ships a `check-line-length` hook that mechanically warns on limit breaches after edits, tunable per project via an optional `wards.config.json`.

## Comments and Docblocks

- Comment anything that is not self-explanatory within a few adjacent lines, and make each comment earn its place: a few high-value comments beat blanket coverage.
- Explain intent and the non-obvious why; the code already says what it does.
- Pitch comments at the durable altitude: capture the rule or invariant that stays true.
  Transient specifics (measured values, one-off observations, counts, dates) rot into misleading noise, as does over-description and heavy cross-referencing of other files.
- Describe the code as it is now, never narrating deleted or changed code ("this used to…", "the old X is gone").
  Reference removed code only when the present code cannot stand without it (a wire- or API-compatibility constraint, a non-obvious gotcha the removal left behind), and then state the constraint, not the chronology.
- Write in the active voice, end every sentence with a period, and use Oxford commas.
- In docblocks, wrap lines at sentence or logical boundaries to keep each legible on its own:

  Bad:

  ```text
  The cow is white. The
  dog is brown.
  ```

  Good:

  ```text
  The cow is white.
  The dog is brown.
  ```

- Outside Markdown and actual links, reference project files with wikilinks: `[[document.md]]`, never a bare `document.md`.
