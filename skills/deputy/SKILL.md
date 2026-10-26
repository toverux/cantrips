---
name: deputy
description: Engage a stand-in that answers every later round, gate and closing in your place for the rest of the session, handing back only the decisions you kept, or that recommends on each while you decide.
argument-hint: '[what you want of your deputy, in your own words: orders, advise or decide, off]'
disable-model-invocation: true
version: 1.2.0
---

Engage a **deputy** for the rest of this session: the plugin agent `cantrips:deputy`, whose definition is its brief, answering in the user's place every round, gate and closing a later skill would put to them, under the per-gate procedure in [ROUNDS.md](ROUNDS.md).
The argument is the user speaking to you about their deputy, in their own words: read what they want of it as you read any request.
It may engage one, dismiss it, set its mode — deciding by default, advisor where they want it to recommend while they give every final answer — or give it standing orders, and one argument can do several: `advise on X` asks for advisor mode with orders X, `on` or a blank argument for a deputy in the default mode with no orders.

- To dismiss: close it where the harness has a close step, say so, and from here every gate goes to the user as each skill says; with none engaged, say that none was.
- With a deputy engaged — a mode switch or new orders go to it as one follow-up message, or join what its first dispatch carries where none is dispatched yet, and say in one line what changed; where the argument changes nothing, say that one is engaged, and in which mode.
  A round, gate or closing still awaiting the user's answer is then settled as ROUNDS.md's At a gate says for the mode now set, a switch to deciding taking the deputy's last advice on it as its answer.
- With none engaged — read ROUNDS.md, switch deputy mode on in the mode asked, hold the standing orders, and say in one line that it is engaged, and in which mode: the first round, gate or closing that needs the user dispatches the deputy as Dispatch says, and so does the next gate of a session holding no handle, a context summary having lost it.
  Where a round, gate or closing still awaits its answer, put it to the deputy next, as ROUNDS.md's At a gate says.
