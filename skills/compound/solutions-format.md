# The docs/solutions/ format

One small markdown file per solved problem, under `docs/solutions/` at the project root.
This file is the single source of truth for the format; `/compound` writes against it and `/compound-refresh` audits against it.

## Naming

`docs/solutions/<problem-slug>.md` — kebab-case, named for the _problem_, not the fix (`stale-jwt-after-team-switch.md`, not `add-token-refresh.md`).
One flat directory: retrieval is by frontmatter search, not browsing.
The `date` field carries the date; keep it out of the filename.

## Frontmatter

```yaml
---
date: 2026-07-22 # date documented, YYYY-MM-DD
area: auth/session # module, path, or domain area the problem lives in
symptoms: # how the problem announced itself — error messages verbatim
  - '401 after switching teams, session still valid'
tags: [jwt, caching] # lowercase kebab-case search keywords
updated: 2026-08-03 # only on docs revised after creation
---
```

`date`, `area`, and `tags` are always present.
`symptoms` is present whenever the problem was observable — verbatim error text is what a future grep finds.
Quote any value containing `: ` or starting with a YAML indicator character.

## Body

Sections in this order; drop a section only when it has nothing to say:

```markdown
# <Problem title>

## Problem

One or two sentences: what broke or misled, and its visible impact.

## What didn't work

The dead ends and why each failed — often the most valuable section; it is the one that
saves a future agent from re-walking them.

## Root cause

The actual mechanism, grounded in the code — cite `file:line` for behavior claims rather
than asserting from memory.

## Fix

What worked, with the key code.

## Prevention

The guardrail, test, or practice that stops recurrence.
```

Keep the whole doc readable in under a minute — it is expensive knowledge loaded on demand, and a sprawling doc defeats the loading.
