# Flow-pointer presentation

A pipeline skill closes by pointing at the next step(s) of the loop.
Render those pointers as the closing message's final paragraph, a blockquote in full italics:

- One next step: open with `Next:`, then the pointer.
- Several: open with `Next steps:` and give one pointer per bullet.

Each pointer names the skill, adds `(user-invoked)` when the target is a user-invoked skill — so you hand that invocation to the user instead of a Skill call the harness rejects — and ends with a one-clause rationale after an em dash.

One step:

> _Next: `/commit` (user-invoked) — captures the diff and closes the loop._

Several:

> _Next steps:_
>
> - _`/simplify` (user-invoked) — an optional quality pass over the diff._
> - _`/review-gate` (user-invoked) — hunts bugs and spec drift before the commit._
