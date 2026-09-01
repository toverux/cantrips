---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to be grilled about a plan, wants a decision stress-tested, or when requirements are fuzzy before a spec is written.
version: 2.2.1
source: mattpocock/skills@1.2.3 (grilling)
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **decision tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled — the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Number sequentially across the whole interview rather than restarting each round, so an answer naming Q2 points at one question. Then wait for the user's answers before the next round.

Each question should be formatted like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

A presented question is **locked**: title, body, options and recommendation stay word-for-word as first shown, and only the user's own feedback can reshape or retire it.
Presenting is therefore a commitment — put a question to the user only once you are sure nothing still running can change what you'd ask.

Every message of the interview ends with its questions: newly ready ones in full in the format above, under fresh numbers, then one line naming the numbers still open from earlier messages.
The lock is what makes that line safe — a number keeps pointing at the exact text first shown, so scrolling to it beats reprinting it.
Anything above the questions — findings, replies to the user's remarks — is commentary.

Each round the user answers reshapes the tree — settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

When the user's answers carry a question or remark of their own, answer it before opening the next round; never let a new round bury the reply.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it — in the background where the harness supports it (Claude Code: do not use `run_in_background: false`) — rather than asking the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite — ask the rest of the frontier now, and hold every question the report could reword. A question is downstream of an exploration when its body, options, or recommendation would read differently depending on what comes back — a body that mentions the pending result has declared itself downstream; when in doubt, hold it, since a held question costs one round and a locked question overtaken by facts costs the user's trust in every question still on the table. When an exploration reports, give its findings one short paragraph and fold them into the questions it unblocks; a finding that bears on a locked question goes in that paragraph as commentary for the user to weigh, and the question stands as asked. When the fact lives in external docs or specs rather than the environment, propose `/research` instead. The _decisions_ are the user's — put each to them and wait.

## Closing

The session is done when the frontier is empty: every branch of the decision tree visited, nothing left silently assumed.
Where another skill invoked this interview, hand back to it there — the close belongs to whichever skill owns the flow.
Otherwise close with a single sentence stating that shared understanding is reached — no summary — then recommend the next step as a flow pointer (read [flow-pointers.md](../writing-for-agents/flow-pointers.md) for the format) and wait for the user's go-ahead:

- `/spec` (user-invoked) when the outcome is a feature worth a written contract — in this session, since it synthesizes the interview; implementation then starts fresh.
- `/implement` (user-invoked) directly when it's a small fix that needs no spec — in this session, which already carries the context.
- `/prototype` when an unresolved question survived the interview and needs empirical evidence — in this session, feeding the verdict back here.
- `/research` when an unresolved question needs facts from primary sources — it runs in the background while this session continues.
- `/questionnaire` (user-invoked) when an unresolved question needs facts only another person holds — in this session, drafting the document; the answers come back on the recipient's clock.
