---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to be grilled about a plan, wants a decision stress-tested, or when requirements are fuzzy before a spec is written.
version: 1.0.0
source: mattpocock/skills@1.1.0 (grilling)
---

Interview me relentlessly about every aspect of this until we reach a shared understanding.
Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one.

If a _fact_ can be found by exploring the environment (filesystem, tools, etc.), look it up rather than asking me.
The _decisions_, though, are mine — put each one to me and wait for my answer.

## How to ask

Number every question sequentially across the interview (Q1, Q2, …) so answers and later references stay unambiguous.

When you can offer multiple concrete candidate answers, present them as a lettered list: reasoning and tradeoffs first, then the question itself, then the options, with your recommended one first and marked "(Recommended)".
When a question is too open-ended to enumerate candidate answers, ask it openly instead — still one question at a time, still with your recommended answer.

When my answer contains a question or remark of my own, answer it before (or instead of) asking the next question; never let a new question bury the reply.

When a decision needs empirical evidence rather than debate, propose `/prototype` for it; when it hinges on facts living in external docs or sources, propose `/research`.

## Closing

The interview is done when every branch of the decision tree is resolved.
Close with a single sentence stating that shared understanding is reached — no summary — then recommend the next step and wait for my go-ahead:

- `/spec` when the outcome is a feature worth a written contract — in this session, since it synthesizes the interview; implementation then starts fresh.
- `/implement` directly when it's a small fix that needs no spec — in this session, which already carries the context.
- `/prototype` when an unresolved question survived the interview and needs empirical evidence — in this session, feeding the verdict back here.
- `/research` when an unresolved question needs facts from primary sources — it runs in the background while this session continues.
