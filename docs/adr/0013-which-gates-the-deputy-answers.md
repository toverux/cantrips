---
date: 2026-10-14
status: accepted
---

# Which gates the deputy answers

## Context

`/deputy` engages a sub-agent that answers in the user's place, and a routing clause stamped at each gate sends that gate to it.
[flow-pointers.md](../../skills/writing-for-agents/flow-pointers.md) stamps the clause on "a gate that puts a decision to the user", yet some gates that put a decision stay unstamped on purpose, and nothing in a skill says why.

Two forms were live.
Stamp every gate that waits on the user, the deputy answering what it can and handing back the rest: every fact or access ask then costs a deputy round trip that can only end in a hand-back.
Stamp only gates the deputy can answer, the form chosen below.

## Decision

A gate carries the routing clause where it puts the user a decision the deputy can make; it stays the user's where it asks for a fact, an artifact, access or setup only they hold, or where the decision is the user's by nature.
The asks that stay the user's are `/diagnosing-bugs`' requests for output, an environment or a captured artifact, `/simplify`'s "what to simplify", `/review-gate`'s spec lookup, `/setup-git-guardrails`' questions; the decisions are `/setup-cantrips-loop`'s questions, since they configure the loop the deputy runs inside, and `/teach`'s mission confirmation, since the mission is the learner's.
Writing these exceptions into the authoring rule would grow it a clause per case, so they live here.

## Consequences

Under a deputy, those gates still wait on the user, and a session left alone stalls there.
Before stamping the routing clause on a gate this record lists, an author revises or retires this record.
