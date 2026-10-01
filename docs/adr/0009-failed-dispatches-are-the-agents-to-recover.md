---
date: 2026-10-01
status: accepted
---

# Failed dispatches are the agent's to recover

## Context

`/review-gate` carries no fallback for a dispatch that fails mid-run, which `IDEAS.md` recorded as an angle lost in silence and ADR 0008's Consequences predicted on Codex's cap of three running children.
Two forms were live: a sentence in every dispatching skill — resume or relaunch a failed agent at once, then retry every five minutes until it goes through — or nothing.
A Codex run asked for six and then four parallel dispatches; told its slot count, the session dispatched them in waves within the cap, no spawn failed, and its closing account named the cap ([research](../research/harness-subagent-capabilities.md#2-parallel-fan-out)).

## Decision

Skills carry no guidance for recovering a failed dispatch or run, nor for fitting a dispatch to a harness's concurrency cap.
Agents notice a failure and adapt on their own, and that behaviour is the models' post-training to provide, not the plugin's: such edge cases are out of scope for cantrips.
The user made this call.

## Consequences

ADR 0008's last consequence — a failure the gate loses in silence, made predictable by Codex's cap — no longer holds, and the `IDEAS.md` entry carrying it is retired.
A skill edit adding retry, backoff, or concurrency-cap handling around a dispatch reopens this decision.
`/simplify`'s inline fallback is upstream's text and stays, under ADR 0008.
Waves cost time instead, so README's Codex install section tells users how to raise `[agents] max_threads`.
