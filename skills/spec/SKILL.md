---
name: spec
description: Synthesize the current conversation into a published spec, test seams included.
disable-model-invocation: true
version: 1.1.0
source: mattpocock/skills@1.1.0 (to-spec)
---

Produce a spec (you may know this document as a PRD) from the current conversation and codebase understanding.
Synthesize what you already know — the interview, if any, already happened (`/grilling`).

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already.
   Use the project's domain vocabulary throughout the spec.

2. Read the repo's decision memory: the `AGENTS.md` conventions already in context, plus the records bearing on this feature from whichever knowledge stores the loop config enables — ADRs for decisions already made, solutions for gotchas and approaches that failed before.
   The loop config translates the storage verbs: it is `docs/agents/cantrips-loop.md`, and when that doc is absent the plugin defaults ([defaults.md](../setup-cantrips-loop/defaults.md)) govern.
   Fold whatever applies into the spec's decisions.
   When this feature's decisions conflict with a standing ADR — one whose status is `accepted` — flag the conflict explicitly in the spec — name the ADR and the revised decision — and note that the revision routes through `/compound` at loop end; `/compound` is the ADR store's sole writer, so the standing record stays as written until then.

3. Propose the **test seams** — the places `/implement` will drive TDD (seam vocabulary: `/codebase-design`).
   Prefer existing seams to new ones; place any new seam at the highest point you can.
   The fewer seams across the codebase, the better - the ideal number is one.

   Check the seams with the user before writing the spec: approving them now, while the decisions are fresh, lets implementation test at them later without relitigating the design.

4. Publish the spec — the publish-spec verb, translated by the loop config from step 2 — using the template below.
   The published body is frozen: a spec is a point-in-time decision record, and execution state lives in git and the backend, so work-status lines (pending, in-progress, done) never enter the body.
   Afterthoughts arrive as dated annotations through the annotate-spec verb.

<spec-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories.
Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made.
This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets.
They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype.
Trim to the decision-rich parts — not a working demo, just the important bits.

## Test Seams

The seams the user approved in step 3 — where TDD will bite during implementation.
For each seam: the interface under test, what behavior the tests will verify through it, and prior art (similar tests in the codebase).

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

</spec-template>

Spec published → close with a flow pointer ([presentation](../writing-great-skills/flow-pointers.md)): `/tickets` (user-invoked) if the work spans multiple sessions or context windows, else `/implement` (user-invoked) — in a fresh context either way.
