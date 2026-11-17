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
     For a gitignored location, add the entry to `.gitignore` in this run, so the doc states it as a fact and carries no rule for later writes.
   - **GitHub** — the `gh` CLI: publish the spec as a GitHub issue holding the spec body; publish the tickets as one issue each, each linking its parent spec issue, blocking edges via native issue links; fetch the spec or a ticket with `gh issue view`; annotate the spec as an issue comment, which appends and carries its own timestamp; resolve the ticket as an issue close with a completion comment.
   - **Mirror** — local markdown as above, each feature copied one way to a GitHub repo's issues by `/storage`'s script, the local files ruling.
     Take it only from an answer the user gives in this run; a choice the existing doc holds carries forward.
     Ask for the tracker as `owner/repo`, and check that `gh issue create --help` lists `--parent` and `gh issue edit --help` lists `--add-blocked-by`, telling the user the mirror needs a newer `gh` where either is missing.
   - **Freeform** — the user describes their tracker workflow in a paragraph; record that paragraph as prose and derive each verb's translation from it, asking about any verb the paragraph leaves uncovered.

   Every seed holds the contract invariants in [defaults.md](defaults.md): an annotation appends without overwriting what is there, stays time-ordered, and governs over the body it revises; a published ticket is traceable to its parent spec.
   When a derived translation would break one, say so and ask the user for one that holds.

4. Ask whether the repo keeps a roadmap: none (the default, writing no Roadmap section, so agents file nothing on their own), the git-ignored local file `.scratch/ROADMAP.md`, or the repo's GitHub issues, one issue per item.
   Take the local file or GitHub issues only from an answer the user gives in this run; a choice the existing doc holds carries forward.
   For either, make sure `.scratch/` is in `.gitignore`; on GitHub issues, ask for the tracker as `owner/repo` and any labels of the repo's own to ride beside the standard ones, and check that `gh` is installed and logged in (`gh auth status`).
   Where the user chose GitHub issues or the mirror in this run, or the doc holds either and `git config --get cantrips.trackerWrites` is unset in this clone and the user confirms the choice when asked, run `git config --local cantrips.trackerWrites true`, the mark that lets agents write to the roadmap without asking; in mirror mode, run it only once the adoption look below has the user's strikes.
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

Keep the roadmap lines in this form, since `/roadmap`'s script reads them, drop a line that has no value, and drop the section where the repo keeps no roadmap.
On GitHub issues, then create the labels: `node <this skill's directory>/../roadmap/scripts/roadmap.ts labels`.
In mirror mode, the storage backend section carries the lines `- Mirror: \`<owner/repo>\`` and `- Features: \`<the folder holding the feature folders>\``, which `/storage`'s Stop hook reads, and says once, in its opening prose and in no verb's translation: after publish-spec, and outside Claude Code after any write verb, sync the feature through `/storage` without asking, since its script publishes only in a clone the user marked; a spec opens with a one-line title, a level-one heading on its first line.
Then create the `spec` and `ticket` labels: `node <this skill's directory>/../storage/scripts/mirror.ts labels --tracker <owner/repo>`, the script the adoption look runs too.
Where this run is about to set the mark in mirror mode and the clone holds feature folders with neither a `mirror.json` nor a `no-mirror` file, run the adoption look: show the user each folder's `sync <folder> --dry-run`, saying a spec with no tickets may be a draft, theirs to keep or strike; create an empty `no-mirror` file in each folder they strike, set the mark, then `sync <folder> --tracker <owner/repo>` the rest, and `close <folder>` each whose tickets are all resolved.
On GitHub issues where specs live in feature folders, the storage backend section says once that a spec or a ticket delivering roadmap items names them on a `Roadmap items:` line and that publishing a spec marks its items in flight through `/roadmap`.
The line on closing a feature reads "close it through `/storage`, with `--done` or `--not-planned` where its tickets are not all resolved, and through `/roadmap`, then delete its folder", dropping the part for a mode the repo lacks.

Done when every slot kept is filled, nothing sits outside one, on GitHub issues or the mirror the labels exist, and where this run set the mark in mirror mode every feature folder is synced or struck.
