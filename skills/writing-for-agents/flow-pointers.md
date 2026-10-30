# Flow-pointer authoring

A pipeline skill closes by pointing at the next step(s) of the loop.
An agent closing a skill holds that skill alone, so every closing carries the format itself; this file is what those copies are stamped from, word for word.

## The closing's shape

A closing reads in this order: its trigger ("Spec published →"), "close with a flow pointer" followed by the format clause, then the steps.

- One step stays a sentence.
- Several steps are declared a **chain** — rendered in order — or a **choice** — rendering the step whose condition holds — then listed one bullet per step.

`/review-gate`'s two closings stay sentences: `LOOP.md` for its sixty-line budget, `SKILL.md` because its first step names no skill.

Each step names its target by this repo's bare name, adds `(user-invoked)` when the target is a user-invoked skill — so the agent hands that invocation to the user instead of a Skill call the harness rejects — and carries what decides it: the condition, the argument rule or the session hint, where there is one.
A closing whose message flagged `/compound` material adds `/compound` as a step beside the one it renders, so the flag ends in a pointer rather than a line the user has to act on by hand.

## The format clause

> (the message's final paragraph, a blockquote in full italics opening `Next:` — or `Next steps:` over one bullet per pointer — each pointer naming its skill the way this skill was itself invoked, same prefix and namespace, and ending in a one-clause rationale after an em dash)

## The compact hint

A closing whose first rendered step naming a skill can be `/review-gate` carries this line after its steps:

> Where the first rendered step that names a skill is `/review-gate`, precede the blockquote with a paragraph of its own recommending that the user compact the conversation first.

## The closing's deputy step

Every closing carries this line after its steps and its compact hint:

> Where this session engaged a deputy through `/deputy` and has not dismissed it, a choice is put to the deputy as [ROUNDS.md](../deputy/ROUNDS.md) says and rendered as the one step it chose, any other closing is rendered as written, and each rendered step that names a skill is then taken: one marked `(user-invoked)` by notifying the user where the harness has a tool for it and waiting for them to type it, any other by invoking it, notifying nobody.

## The routing clause

A gate that puts a decision to the user — a numbered round, a write gate, a verdict, a parked route — carries this sentence right after the line that puts it to the user:

> Where this session engaged a deputy through `/deputy` and has not dismissed it, what is put to the user here goes to the deputy instead, as [ROUNDS.md](../deputy/ROUNDS.md) says, and the deputy's reply is printed verbatim under a one-line header before anything acts on it; otherwise it goes to the user as written.

## What a closing message looks like

One step, from a skill invoked as `/compound`:

> _Next: `/commit` (user-invoked) — lands these writes with the rest of the diff._

A chain with a hint due, from a skill invoked as `/cantrips:diagnosing-bugs`:

Compact the conversation before the gate.

> _Next steps:_
>
> - _`/cantrips:review-gate medium --fix` (user-invoked) — hunts bugs in the fix before the commit._
> - _`/cantrips:commit` (user-invoked) — once the gate stands._
