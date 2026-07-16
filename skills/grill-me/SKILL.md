---
name: grill-me
description: Grill the user relentlessly about a plan, decision, or idea.
disable-model-invocation: true
version: 1.0.0
---

Interview me relentlessly about every aspect of this until we reach a shared understanding. Walk
down each branch of the decision tree, resolving dependencies between decisions one-by-one.

Ask the questions one at a time, waiting for my answer before continuing. Asking multiple questions
at once is bewildering.

If a _fact_ can be found by exploring the environment (filesystem, tools, etc.), look it up rather
than asking me. The _decisions_, though, are mine — put each one to me and wait for my answer.

## How to ask (Claude Code harness, adapt as needed)

When you can offer 2–4 concrete candidate answers, ask via the AskUserQuestion tool — one question
per call. Put your recommended answer first, with "(Recommended)" at the end of its label. Leave
free-text answers to the tool's built-in "Other" option; never add your own.

When a question is too open-ended to enumerate candidate answers, ask it in plain text instead —
still one question at a time, still with your recommended answer.

## Closing

The interview is done when every branch of the decision tree is resolved. Close with a single
sentence stating that shared understanding is reached, then ask what the next step is — and wait
for my answer before acting.
