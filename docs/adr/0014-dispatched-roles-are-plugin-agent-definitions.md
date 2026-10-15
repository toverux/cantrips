---
date: 2026-10-15
status: accepted
---

# Dispatched roles are plugin agent definitions

## Context

Every role a skill dispatched — `/review-gate`'s finders, verifiers and arbiter, `/simplify`'s fixers, the deputy — was a general-purpose sub-agent handed a brief the session pasted from a sibling file.
The session read each brief into its own context and typed it out again at every dispatch, and what a brief could only ask for leaked: two roles tiered alike ran on different models because the prose names no class, and an arbiter briefed read-only edited a tracked file.

Four alternatives were live beside the form chosen below.
Keep pasting the briefs: no harness dependency, and the leaks stay.
Pin the read-only roles with a `tools` allowlist: an explicit list drops the session's MCP tools, and Bash still writes.
Let each dispatch pass its own `model`: a per-dispatch model outranks the frontmatter pin, which hands the tier back to whatever the session ranks.
Ship a Codex role set: a Codex plugin carries no agents.

## Decision

Each role is a plugin agent definition under `agents/`, loaded on Claude Code as `cantrips:<role>` — the finders under `agents/finder/`, the verifier, the arbiter and the deputy at its top — whose body is the role's whole brief and whose frontmatter pins the model and `background: true`.
A skill dispatches a role by its scoped name, passes no model, and sends only what varies per dispatch; where the harness loads no plugin agents, one fixed fallback clause has it paste the definition's body into a general-purpose dispatch.
A role's "edit nothing" stays a sentence of its body, and every role keeps every tool.
Dispatches whose prompt is written at dispatch time — `/spec`'s rereader, `/research`'s reader, the deputy's second opinion and the like — stay general-purpose.

What settled it is that a definition carries what a pasted brief could only ask for, and lets each brief live in one file.

## Consequences

The brief files retired — `ANGLES.md`, `QUALITY-LENSES.md`, the deputy's `BRIEF.md` — and `/simplify`'s fixers became the gate's three mechanical lens finders.
The roles sit in the agent roster and the `@agent-` typeahead, never among the slash commands; each description names its dispatcher, and the finders, the verifier and the deputy can be summoned directly.
A user or project agent of the same full name does not shadow a plugin role, as tested on Claude Code 2.1.300, so changing a pin or a brief means editing the plugin.
A pinned alias depends on that model being available.
An inline path that reads a body names what it takes from it, since the body's dispatch framing would otherwise bind the session ([AGENTS.md](../../AGENTS.md) rule 4).
The Codex fallback clause has not been run.
