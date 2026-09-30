---
name: spec
description: Synthesize the current conversation into a published spec, test seams included.
disable-model-invocation: true
version: 1.2.0
source: mattpocock/skills@1.2.3 (to-spec)
---

Produce a spec from the current conversation and codebase understanding.
Synthesize what you already know — the interview, if any, already happened (`/grilling`).
Where the conversation holds nothing the user decided or approved about the design, recommend `/grilling` and stop there, drafting nothing.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain vocabulary throughout the spec.

2. Read the repo's decision memory: the `AGENTS.md` conventions already in context, plus the records bearing on this feature from whichever knowledge stores the loop config enables — ADRs for decisions already made, solutions for gotchas and approaches that failed before.
   The loop config translates the storage verbs: it is `docs/agents/cantrips-loop.md`, and when that doc is absent the plugin defaults ([defaults.md](../setup-cantrips-loop/defaults.md)) govern.
   Fold whatever applies into the spec's decisions.
   Every standing ADR — one whose status is `accepted` — whose subject this feature touches becomes a question in step 3's round, the ones you judge the design compatible with included: state what keeping the ADR concretely preserves in this feature's artifacts, and offer keep, revise or retire.
   On a revise or retire answer, name the ADR and the revised decision in the spec, and note that the revision routes through `/compound` at loop end; `/compound` is the ADR store's sole writer, so the standing record stays as written until then.

3. Propose the **test seams** — the places `/implement` will drive TDD (seam vocabulary: `/codebase-design`). Prefer existing seams to new ones; place any new seam at the highest point you can. The fewer seams across the codebase, the better - the ideal number is one.

Put the seams and step 2's ADR questions to the user as one numbered round, and wait for the answers before drafting.
Each question should be formatted like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Number on from the conversation's last question where an interview preceded, so an answer naming a number points at one question.

4. Draft the spec into a file, using the template below.
   Where the loop config translates the publish-spec verb to a file path, write the draft straight to that path; on any other backend, write it to the OS temp directory.

5. Have a sub-agent **reread** the draft: a fresh dispatch, in the background where the harness supports it (Claude Code: do not use `run_in_background: false`).
   Give it the draft's path, the brief below, and, pasted verbatim, everything a decision can trace to: each question put to the user as it was asked — options and recommendation included — with the user's answer, step 3's round among them, and every exploration or research report the conversation folded in.
   The user's own statements that decided or approved something outside a numbered question travel with them.

   <reread-brief>
   Reread the draft spec at the path you were given, against the material pasted with it and against the repo.
   Edit nothing yourself: report each finding with its evidence and a proposed wording.
   Run three checks over the whole draft:

   - **Traced** — every decision traces to something the user answered or approved.
     Report one that does not as a question for the user.
   - **Evidenced** — every claim about the code, and everything a decision relies on the code to provide, is no firmer than its evidence.
     Read the repo to settle what a check can settle, and propose softer wording where none can.
   - **Covered** — everything the problem statement and the user stories raise is covered by a decision or listed out of scope.

   Mark each finding as changing a decision, a claim or a gap, or as wording only.
   Where a check finds nothing, say so explicitly.
   </reread-brief>

   **Model selection.** Use the platform's balanced mid-tier model for the rereader when the current harness exposes a known override. In Claude Code this is the Sonnet class. In Codex, apply this tier only when the active dispatch primitive exposes an explicit model or custom-agent selector; task wording alone does not select a different model. Otherwise omit the override and inherit the parent model -- a working pass on the parent model beats a broken dispatch.

   You are the draft's only writer: apply to the file each finding that needs no user call, and hold the rest for step 6.
   Then message the same sub-agent to reread the file — a fresh dispatch carrying the same brief and material where the harness cannot message a sub-agent it spawned.
   Repeat until a pass reports nothing that changes a decision, a claim or a gap beyond the findings already held, three passes at most; wording-only findings are fixed without calling for another pass.
   Where the harness has no sub-agents, run the three checks yourself, rereading the draft from disk each pass, under the same stop rule and cap.

6. Put the residue to the user: one line saying what the reread fixed or softened on its own, then the questions only the user can settle, as one numbered round ending the message, in step 3's format.
   A third pass that still changed a decision, a claim or a gap is residue too: say the cap was hit.
   Leave the draft out of the message.
   With no residue, publish without stopping.
   Apply the user's answers to the draft.
   Where an answer departs from its question's recommendation, run one more pass over the applied answers, by the means of step 5's later passes, and apply what it finds; a finding that needs the user opens one more numbered round.

7. Publish the spec, once — the publish-spec verb, translated by the loop config from step 2.
   A draft written at the verb's own path is published as it stands; any other goes through the verb byte for byte, and its temp file is then removed without mention.
   A spec is a point-in-time decision record, and execution state lives in git and the backend, so work-status lines (pending, in-progress, done) never enter the body.
   Where this conversation holds the spec's publication and no implementation after it, a correction the user asks for rewrites the body in place, by the backend's own means and with no reread; where tickets were published from the spec in between, carry the rewrite into every ticket it touches in the same turn, and name the tickets changed.
   Anywhere else the body is frozen, and a correction arrives as a dated annotation through the annotate-spec verb.

<spec-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Test Seams

The seams the user approved in step 3 — where TDD will bite during implementation.
For each seam: the interface under test, what behavior the tests will verify through it, and prior art (similar tests in the codebase).

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

</spec-template>

Spec published → close with a flow pointer (the message's final paragraph, a blockquote in full italics opening `Next:` — or `Next steps:` over one bullet per pointer — each pointer naming its skill the way this skill was itself invoked, same prefix and namespace, and ending in a one-clause rationale after an em dash) — a **choice**, rendering the step whose condition holds:

- `/tickets` (user-invoked) where the work spans multiple sessions or context windows — in a fresh context.
- `/implement` (user-invoked) otherwise — in a fresh context.
