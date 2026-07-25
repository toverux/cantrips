---
ward:
  kind: rule
  description: Language-agnostic code style — line breaks, the 100-character limit, comments, docblocks.
  version: 1.0.0
  applicability:
    - '**/*'
  scope: project
---

# General Code Style

Language-agnostic style rules.
Apply every rule below to all code you write or edit.

## Formatting

- Let the code breathe: separate logical blocks, and a variable's assignment from its usage, with single blank lines (never consecutive ones).
- Break every `{}` block across multiple lines, even a short one.
- Pass at most 4 parameters to a function; beyond that, group them into an object.
  Symmetry with neighboring code wins over this rule.
- Let the carrier decide em dashes (—): prose documents (Markdown, text docs, specs, changelogs) allow them, with parsimony; source code forbids them, comments and docblocks included.
  In code, punctuate with commas, semicolons, colons, or `--` (with parsimony) instead, and when you meet an em dash there, replace it or find a simpler formulation.
- Enforce a strict 100-character line length limit in source files, comments and docblock decoration included.
  Exceptions:
  - One-line lint warning suppression comments.
  - Long strings that would read worse split across lines.
  - AGENTS.md and other Markdown documents intended for agents (ex. skills, rules).
  - Any file where the limit is not applicable or desirable.

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
