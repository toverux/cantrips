---
name: setup-cantrips-loop
description: Configure this repo's cantrips loop — knowledge stores and storage backend — by writing docs/agents/cantrips-loop.md.
disable-model-invocation: true
version: 1.0.0
---

Configure how this repo runs the cantrips loop: which opt-in knowledge stores are enabled, and which backend the six storage verbs translate to.
The result is one prose doc, `docs/agents/cantrips-loop.md`, that storage-touching skills read in place of the plugin defaults ([defaults.md](defaults.md)).

## Process

1. Read `docs/agents/cantrips-loop.md` if it exists.
   An existing doc makes this run an edit: summarize the current configuration, ask what the user wants to change, and carry every unrevisited answer forward unchanged.

2. Explain each opt-in knowledge store's role in plain words, then ask which to enable:

   - `docs/adr/` holds durable decisions with supersession chains — an outdated record names the record that replaced it, so decisions have history instead of silent drift.
     Written only through `/compound`'s user gate; read back by `/spec` as the repo's decision memory.
   - `docs/solutions/` holds problem-shaped learnings — root cause, the gotcha, what didn't work — so the next session that hits the same problem starts from the answer.

3. Ask which backend seed translates the six storage verbs (the verbs and their meaning: [defaults.md](defaults.md)):

   - **Local markdown** — the default made explicit: the verb translations in [defaults.md](defaults.md).
     Ask where the artifacts live: gitignored `.scratch/<feature>/` (the default — disposable working material, deleted by the human when the feature closes) or a committed path such as `docs/specs/` for repos whose specs should travel with branches, worktrees, and pull requests.
     For a gitignored location, add the entry to `.gitignore` in this run, so the doc can state a fact instead of leaving every later write a chore.
   - **GitHub** — the `gh` CLI: publish the spec as a GitHub issue holding the spec body; publish the tickets as one issue each, each linking its parent spec issue, blocking edges via native issue links; fetch the spec or a ticket with `gh issue view`; annotate the spec as an issue comment, which appends and carries its own timestamp; resolve the ticket as an issue close with a completion comment.
   - **Freeform** — the user describes their tracker workflow in a paragraph; record that paragraph as prose and derive each verb's translation from it, asking about any verb the paragraph leaves uncovered.

   Every seed holds the contract invariants in [defaults.md](defaults.md): an annotation appends without overwriting what is there, stays time-ordered, and governs over the body it revises; a published ticket is traceable to its parent spec.
   When a derived translation would break one, say so and ask the user for one that holds.

4. Write `docs/agents/cantrips-loop.md` as this repo's **phrasebook**: a skill arrives holding a verb and leaves holding the path or command it means here.
   Whatever a skill still needs has to be in it.
   Fill the scaffold:

<loop-config-template>

# The cantrips loop in this repo

What the six storage verbs translate to here, and which knowledge stores are enabled.
Storage-touching skills read this doc instead of the plugin defaults.
`/setup-cantrips-loop` wrote it; re-run that skill to change it.

## Storage backend

<the backend, and what closing a feature means — the one act no verb covers>

- **Publish the spec** (`publish-spec`) — <translation>
- **Fetch the spec** (`fetch-spec`) — <translation>
- **Annotate the spec** (`annotate-spec`) — <translation>
- **Publish the tickets** (`publish-tickets`) — <translation>
- **Fetch the ticket** (`fetch-ticket`) — <translation>
- **Resolve the ticket** (`resolve-ticket`) — <translation>

<the invariants, carried from defaults.md>

## Knowledge stores

- `docs/adr/` — **enabled** or **disabled**.
- `docs/solutions/` — **enabled** or **disabled**.

</loop-config-template>

Done when every slot is filled and nothing sits outside one.
