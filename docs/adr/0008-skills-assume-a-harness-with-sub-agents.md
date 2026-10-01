---
date: 2026-10-01
status: accepted
---

# Skills assume a harness with sub-agents

## Context

The plugin ships to Claude Code and Codex CLI, and its skills hedged on what a harness might lack: an inline pass standing in for `/review-gate`'s pipeline and `/spec`'s reread on a harness without sub-agents, "sequentially otherwise" beside `/simplify`'s and design-it-twice's parallel dispatches, "in the background where the harness supports it", and a fresh dispatch "where the harness cannot message a sub-agent it spawned".
WHY.md cast the inline pass as Codex's path, which was false: both harnesses spawn sub-agents, run them in parallel and in the background, and message one they spawned, all by default ([research](../research/harness-subagent-capabilities.md)).
Each fallback was a second path through its skill that no supported harness takes, and `/review-gate`'s cost the most: AGENTS.md rule 4 made every sibling file cover it, and the findings script and its tests held a branch for it.

Two forms were live.
Keep the fallbacks against a harness yet to come: every skill edit keeps paying for a path nothing exercises.
Remove them, the form chosen below.

This revises ADR 0005, whose Decision left the no-sub-agent fallback unjudged and kept a fresh arbiter per round where a harness could not message one; both clauses were removed there in place.

## Decision

Skills assume a harness that spawns sub-agents, runs them in parallel and in the background, and messages one it spawned, and carry no fallback for a harness that cannot.
A hedge stays only where the two harnesses differ by default: the arbiter's close step, which one of Codex's two tool surfaces has, and the model selector the carried "Model selection" paragraph guards.
`/simplify`'s inline fallback stays too: it answers a dispatch that failed, and its no-dispatch branch stands in for upstream's own.

What settled it is that a setup without sub-agents has become too rare among those the plugin runs in to earn a second path.
The user made this call.

## Consequences

`low` is `/review-gate`'s only inline path: the only pass the findings script records unverified, and under `--loop` the only run that applies fixes with no arbiter.
On a harness without sub-agents, `/review-gate` above `low` and `/spec`'s reread have nothing to run.
A hedge returns only where a rescan shows a supported harness lost the capability by default; the research note is of its date.
A dispatch that fails mid-run still costs `/review-gate` an angle in silence, and Codex's cap on running children — three on one of its tool surfaces, six on the other — makes that predictable at `medium`; `IDEAS.md` carries it.
