---
name: implement
description: Implement a spec or a single ticket, driving TDD at the seams agreed in the spec.
argument-hint: '[spec or ticket; blank asks]'
disable-model-invocation: true
version: 1.1.1
source: mattpocock/skills@1.1.0 (implement)
---

Implement the work in the spec or the ticket the user names.
Fetch it in full first — the fetch-spec or fetch-ticket verb — and for a ticket, fetch its parent spec too.
The loop config translates the storage verbs: it is `docs/agents/cantrips-loop.md`, and when that doc is absent the plugin defaults ([defaults.md](../setup-cantrips-loop/defaults.md)) govern.

Where the spec agreed a **test seam**, drive `/tdd` at that seam — the seams are already approved, so test at them without re-asking.
Where no seam was agreed, implement directly: state explicit verification criteria up front (what observable result proves it works), then verify against them before calling the work done.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

When working from a ticket, tick its acceptance criteria as each one is verified.
When every criterion is verified, resolve the ticket — the resolve-ticket verb from the same loop config, the ticked criteria standing as evidence.
Resolve on the criteria without second-guessing: a wrong resolve is one human reopen away.
The spec itself stays as published — no skill ever closes a spec; closing the feature is the human's act through the backend's native machinery.

Done when every criterion is verified, the ticket (if any) is resolved, and the full suite passes → close with a flow pointer (read [flow-pointers.md](../writing-great-skills/flow-pointers.md) for the format) naming the review tail, all in this session with the working diff as context: `/simplify` (user-invoked) for an optional quality pass, then `/review-gate` (user-invoked) — suggest `low` for a trivial or mechanical diff, `high` for a large, cross-cutting, or risky one, `medium` otherwise — then `/commit` (user-invoked).
If context runs low anywhere in that chain, recommend `/handoff` (user-invoked) and resume in a fresh session instead of pushing on degraded.
