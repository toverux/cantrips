---
name: compound
description: Capture this session's durable learnings and route each to the right knowledge store, every write user-gated. Use at loop end when /commit's opening scan finds candidates, when /diagnosing-bugs closes out a fix, or when the user wants to capture, remember, or write down a learning, convention, gotcha, decision, or preference.
argument-hint: '[optional: what to capture; blank scans the whole session]'
version: 1.3.0
---

Harvest what this session learned so future sessions inherit it.
Only knowledge that compounds gets written; every write is approved by the user first.

## 1. Scan the session

Sweep the whole session for candidates: corrections the user made and preferences they stated, conventions that emerged, durable decisions settled or reversed, gotchas and root causes uncovered, approaches that failed and why, domain terms coined or clarified ("we call this X, not Y"), and workflow friction a procedure could remove.

## 2. Apply the quality bar

For each candidate, two questions: would this change a future agent's behavior in a different session, and is it non-obvious and stable?
Any "no" → discard.

This bar is the defence against the eager-auto-memory failure mode: session-specific trivia — in-flight task state, one-off values, things any agent would infer anyway — must die here.

If nothing clears the bar, say so in one line and stop.

## 3. Route each survivor

1. **Project `AGENTS.md`** — durable _shared_ preferences and conventions, cheap enough to always load.
   Domain terms go in its glossary section; when the glossary outgrows `AGENTS.md`, propose graduating it to a `CONCEPTS.md` file.
2. **`docs/adr/`** (opt-in store) — durable _decisions_: a project-shaping choice settled among live alternatives — where `AGENTS.md` holds preferences and `docs/solutions/` holds problem-shaped learnings.
   One record per decision, per [`adr-format.md`](adr-format.md).
   Reversing a standing decision routes as a pair — a new ADR plus the status flip on the superseded record.
3. **`docs/solutions/`** (opt-in store) — problem-shaped learnings: root cause, gotcha, what didn't work.
   One small file per solved problem, per [`solutions-format.md`](solutions-format.md).
   Expensive knowledge, loaded on demand.
4. **Project-local rules** — path-scoped project conventions, when the project uses rules files.
5. **Skills** — project-specific procedures → the project's skills directory (`.claude/skills/` on Claude Code, or the harness's equivalent); generic workflow improvements → the user's personal skills collection, if configured.
6. **User-global memory file** (`~/.claude/CLAUDE.md` on Claude Code, `~/.codex/AGENTS.md` on Codex CLI, or the harness's equivalent) — personal-only preferences, and the staging area to trial a candidate durable preference before graduating it to a shared file.

The two opt-in stores take writes only where the repo enables them: `docs/agents/cantrips-loop.md` lists the enabled stores; when that doc is absent, both are off.
A survivor aimed at a disabled store is presented with that store's own remedy — enable it through `/setup-cantrips-loop` — or dropped; a durable decision belongs in `docs/adr/`, so rerouting one into `AGENTS.md`, which holds preferences, is no substitute.

## 4. Gate every write

Present the survivors as one list: for each, the proposed destination and a one-line rationale.
The user answers per candidate — approve, redirect (different destination or wording), or kill.
A write happens only on an approval.

## 5. Write the approved ones

Load the `/writing-for-agents` skill ([`../writing-for-agents/SKILL.md`](../writing-for-agents/SKILL.md)) and hold every write to it: each store is a file an agent will load.
Every write lands among text that already exists — in the file, or in its sibling records — so read the neighbourhood first and write to fit it: match the density of what surrounds it, extend the line or section that already covers the subject rather than adding one beside it.
**Keep the edit as short as it possibly can be.**
The rationale was for the gate; the file carries the rule.

- Before writing to `docs/adr/`: read [`adr-format.md`](adr-format.md) and hold to it, and search the store for the record a reversal supersedes — the pair only lands when its other half is found.
- Before writing to `docs/solutions/`: read [`solutions-format.md`](solutions-format.md), then search existing docs (frontmatter `area`, `tags`, `symptoms`) for one covering the same problem — fold fresh context into an existing doc rather than writing a near-duplicate.

Done when every approved candidate is written to its store.
The writes join the working tree: `/commit`'s flow picks them up when it invoked this scan; on an ad-hoc run, close with a flow pointer (read [flow-pointers.md](../writing-for-agents/flow-pointers.md) for the format): `/commit` (user-invoked) — it lands these writes with the rest of the diff.
