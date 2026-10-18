---
name: deputy
description: Engage a stand-in that answers every later round, gate and closing in your place for the rest of the session, handing back only the decisions you kept, or that recommends on each while you decide.
argument-hint: '[standing orders in free text, blank for none; advise to recommend while you decide; off to dismiss]'
disable-model-invocation: true
version: 1.1.0
---

Engage a **deputy** for the rest of this session: the plugin agent `cantrips:deputy`, whose definition is its brief, answering in the user's place every round, gate and closing a later skill would put to them, under the per-gate procedure in [ROUNDS.md](ROUNDS.md).
Two words count only as the whole argument: `advise` engages it in advisor mode, where it recommends and the user gives every final answer; `off` dismisses it.
Anything else is standing orders, free text.

- With a deputy engaged — `off` dismisses it: close it where the harness has a close step, say so, and from here every gate goes to the user as each skill says.
  Standing orders go to it as a follow-up message, or join the held orders where none is dispatched yet; bare, say that one is engaged; `advise`, say that the mode is set at engagement, so `off` comes first.
- With none engaged — `off` says so and does nothing else.
  Otherwise read ROUNDS.md, switch deputy mode on, deciding or advisor, hold the standing orders, and say in one line that it is engaged: the first round, gate or closing that needs the user dispatches the deputy as Dispatch says, and so does the next gate of a session holding no handle, a context summary having lost it.
  Where a round, gate or closing still awaits its answer, put it to the deputy next, as ROUNDS.md's At a gate says.
