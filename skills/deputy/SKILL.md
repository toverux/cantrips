---
name: deputy
description: Engage a stand-in that answers every later round, gate and closing in your place for the rest of the session, handing back only the decisions you kept.
argument-hint: '[standing orders in free text, blank for none; off to dismiss]'
disable-model-invocation: true
version: 1.0.0
---

Engage a **deputy** for the rest of this session: the plugin agent `cantrips:deputy`, whose definition is its brief, answering in the user's place every round, gate and closing a later skill would put to them, under the per-gate procedure in [ROUNDS.md](ROUNDS.md).

- With a deputy engaged — `off` dismisses it: close it where the harness has a close step, say so, and from here every gate goes to the user as each skill says.
  Standing orders go to it as a follow-up message; bare, say that one is engaged.
- With none engaged — `off` says so and does nothing else.
  Otherwise read ROUNDS.md and dispatch a deputy as its Dispatch says, the argument its standing orders, and say in one line that it is engaged and which rounds it was onboarded with.
  Where a round, gate or closing still awaits its answer, put it to the deputy next, as ROUNDS.md's At a gate says.
