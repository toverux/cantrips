---
name: setup-cantrips-loop
description: Configure this repo's cantrips loop — knowledge stores, storage backend and roadmap — by writing docs/agents/cantrips-loop.md.
disable-model-invocation: true
version: 1.1.0
---

Configure how this repo runs the cantrips loop: which opt-in knowledge stores are enabled, which backend the six storage verbs translate to, and where the roadmap lives.
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

4. Ask where the repo's roadmap lives: the git-ignored local file `.scratch/ROADMAP.md` (the default), or the repo's GitHub issues, one issue per item.
   Take GitHub issues only from an answer the user gives in this run; a choice the existing doc holds carries forward.
   Either way, make sure `.scratch/` is in `.gitignore`; on GitHub issues, ask for the tracker as `owner/repo` and any labels of the repo's own to ride beside the standard ones, and check that `gh` is installed and logged in (`gh auth status`).
   Where the user chose GitHub issues in this run, or the doc holds it and `git config --get cantrips.roadmapWrites` is unset in this clone and the user confirms the choice when asked, run `git config --local cantrips.roadmapWrites true`, the mark that lets agents write to the roadmap without asking.
   Where `.git` is read-only, print that command for the user to run instead.

5. Write `docs/agents/cantrips-loop.md` as this repo's **phrasebook**: a skill arrives holding a verb and leaves holding the path or command it means here.
   Whatever a skill still needs has to be in it.
   Fill the scaffold:

<loop-config-template>

# The cantrips loop in this repo

What the six storage verbs translate to here, which knowledge stores are enabled, and where the roadmap lives.
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

## Roadmap

Read and write this repo's roadmap through `/roadmap`.

- Backend: <`local file` or `GitHub issues`>
- Tracker: <`owner/repo`; GitHub issues only>
- Labels: <the repo's own labels, each in backticks, comma-separated; GitHub issues only>
- Note: <optional: what the issues are>

</loop-config-template>

Keep the roadmap lines in this form, since `/roadmap`'s script reads them, and drop a line that has no value.
On GitHub issues, then create the labels with `/roadmap`'s script (`labels`).

Done when every slot kept is filled, nothing sits outside one, and on GitHub issues the labels exist.
