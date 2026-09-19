# Flow-pointer authoring

A pipeline skill closes by pointing at the next step(s) of the loop.
An agent closing a skill holds that skill alone, so every closing carries the format itself; this file is what those copies are stamped from, word for word.

## The closing's shape

A closing reads in this order: its trigger ("Spec published →"), "close with a flow pointer" followed by the format clause, then the steps.

- One step stays a sentence.
- Several steps are declared a **chain** — rendered in order — or a **choice** — rendering the step whose condition holds — then listed one bullet per step.

`/review-gate`'s two closings stay sentences: `LOOP.md` for its sixty-line budget, `SKILL.md` because its first step names no skill.

Each step names its target by this repo's bare name, adds `(user-invoked)` when the target is a user-invoked skill — so the agent hands that invocation to the user instead of a Skill call the harness rejects — and carries what decides it: the condition, the argument rule or the session hint, where there is one.

## The format clause

> (the message's final paragraph, a blockquote in full italics opening `Next:` — or `Next steps:` over one bullet per pointer — each pointer naming its skill the way this skill was itself invoked, same prefix and namespace, and ending in a one-clause rationale after an em dash)

## The compact hint

A closing that can point into `/simplify` or `/review-gate` carries this line after its steps:

> Where a rendered pointer leads into `/simplify` or `/review-gate`, precede the blockquote with a paragraph of its own recommending that the user compact the conversation first, and give them the keep-list to compact with as a code block: what the steps ahead need from this session — the spec or ticket path, the intent behind the diff, the decisions still open.

## What a closing message looks like

One step, from a skill invoked as `/compound`:

> _Next: `/commit` (user-invoked) — lands these writes with the rest of the diff._

A chain with a hint due, from a skill invoked as `/cantrips:implement`:

Compact the conversation before the review tail, keeping:

```
the spec at .scratch/export/spec.md; the diff adds CSV export behind the existing report seam; open: whether empty reports export a header row
```

> _Next steps:_
>
> - _`/cantrips:simplify` (user-invoked) — an optional quality pass over the diff._
> - _`/cantrips:review-gate medium --fix` (user-invoked) — hunts bugs and spec drift before the commit._
> - _`/cantrips:commit` (user-invoked) — once the gate stands._
