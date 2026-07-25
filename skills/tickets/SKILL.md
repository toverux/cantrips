---
name: tickets
description: Break a spec, plan, or the current conversation into tracer-bullet ticket files alongside the spec, each declaring its blocking edges.
disable-model-invocation: true
version: 1.0.0
source: mattpocock/skills@1.1.0 (to-tickets)
---

# Tickets

Break a plan, spec, or conversation into **tickets** — tracer-bullet vertical slices, each declaring the tickets that **block** it, written as markdown files alongside the spec.

## Process

### 1. Gather context

Work from whatever is already in the conversation context.
If the user passes a spec path (usually `docs/specs/<feature>.md`), read it in full.

### 2. Explore the codebase

If you have not already explored the codebase, do so to understand the current state of the code.
Ticket titles and descriptions should use the project's domain vocabulary.

Look for opportunities to prefactor the code to make the implementation easier.
"Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests) — vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window — one ticket, one `/implement` run
- Any prefactoring should be done first

</vertical-slice-rules>

Give each ticket its **blocking edges** — the other tickets that must complete before it can start.
A ticket with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.**
A **wide refactor** is one mechanical change — rename a column, retype a shared symbol — whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green.
Don't force it into a tracer bullet; sequence it as **expand–contract**.
First expand: add the new form beside the old so nothing breaks.
Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own ticket blocked by the expand, keeping CI green batch to batch because the old form still exists.
Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch.
When even the batches can't stay green alone, keep the sequence but let them share an integration branch that all block a final integrate-and-verify ticket — green is promised only there.

### 4. Quiz the user

Present the proposed breakdown as a numbered list.
For each ticket, show:

- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first
- **What it delivers**: the end-to-end behaviour this ticket makes work

Ask the user:

- Does the granularity feel right?
  (too coarse / too fine)
- Are the blocking edges correct — does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split further?

Iterate until the user approves the breakdown.

### 5. Write the ticket files

Write one file per ticket to `docs/specs/<feature>/NN-<slug>.md` — a directory named after the spec file it sits beside — numbered from `01` in dependency order (blockers first).
Each file's "Blocked by" lists the numbers/titles it depends on.
Use the template below — one ticket per file, never a single combined file.

<ticket-template>

# <NN> — <Ticket title>

**What to build:** the end-to-end behaviour this ticket makes work, from the user's perspective — not a layer-by-layer implementation list.

**Blocked by:** the numbers/titles of the tickets that gate this one, or "None — can start immediately".

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2

</ticket-template>

Avoid specific file paths or code snippets in tickets — they go stale fast.
Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note briefly that it came from a prototype.
Trim to the decision-rich parts — not a working demo, just the important bits.

Tickets written → close with a flow pointer ([presentation](../writing-great-skills/flow-pointers.md)): `/implement` (user-invoked), one ticket per fresh context window, working the **frontier** — any ticket whose blockers are all done (for a purely linear chain, top to bottom).
