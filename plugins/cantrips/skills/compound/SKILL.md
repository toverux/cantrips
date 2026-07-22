---
name: compound
description: Capture this session's durable learnings and route each to the right knowledge store, every write user-gated. Use at loop end when /commit's opening scan finds candidates, when /diagnosing-bugs closes out a fix, or when the user wants to capture, remember, or write down a learning, convention, gotcha, or preference.
argument-hint: '[optional: what to capture; blank scans the whole session]'
version: 1.0.1
---

Harvest what this session learned so future sessions inherit it.
Only knowledge that compounds gets written; every write is approved by the user first.

## 1. Scan the session

Sweep the whole session for candidates: corrections the user made and preferences they stated, conventions that emerged, gotchas and root causes uncovered, approaches that failed and why, domain terms coined or clarified ("we call this X, not Y"), and workflow friction a procedure could remove.

## 2. Apply the quality bar

For each candidate, two questions: would this change a future agent's behavior in a different session, and is it non-obvious and stable?
Any "no" → discard.

This bar is the defence against the eager-auto-memory failure mode: session-specific trivia — in-flight task state, one-off values, things any agent would infer anyway — must die here.

If nothing clears the bar, say so in one line and stop.

## 3. Route each survivor

1. **Project `AGENTS.md`** — durable _shared_ preferences and conventions, cheap enough to always load.
   Domain terms go in its glossary section; when the glossary outgrows `AGENTS.md`, propose graduating it to a `CONCEPTS.md` file.
2. **`docs/solutions/`** — problem-shaped learnings: root cause, gotcha, what didn't work.
   One small file per solved problem, per [`solutions-format.md`](solutions-format.md).
   Expensive knowledge, loaded on demand.
3. **Project-local rules** — path-scoped project conventions, when the project uses rules files.
4. **Skills** — project-specific procedures → the project's skills directory (`.claude/skills/` on Claude Code, or the harness's equivalent); generic workflow improvements → the user's personal skills collection, if configured.
5. **User-global memory file** (`~/.claude/CLAUDE.md` on Claude Code, `~/.codex/AGENTS.md` on Codex CLI, or the harness's equivalent) — personal-only preferences, and the staging area to trial a candidate durable preference before graduating it to a shared file.

## 4. Gate every write

Present the survivors as one list: for each, the proposed destination and a one-line rationale.
The user answers per candidate — approve, redirect (different destination or wording), or kill.
A write happens only on an approval.

## 5. Write the approved ones

- Before editing `AGENTS.md`, a rules file, or a skill: load the `/writing-great-skills` skill ([`../writing-great-skills/SKILL.md`](../writing-great-skills/SKILL.md)) and hold the edit to it.
- Before writing to `docs/solutions/`: read [`solutions-format.md`](solutions-format.md), then search existing docs (frontmatter `area`, `tags`, `symptoms`) for one covering the same problem — fold fresh context into an existing doc rather than writing a near-duplicate.

Done when every approved candidate is written to its store.
The writes join the working tree: `/commit`'s flow picks them up when it invoked this scan; on an ad-hoc run, next: `/commit`.
