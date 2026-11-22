# The cantrips loop in this repo

What the storage verbs translate to here, which knowledge stores are enabled, and where the roadmap lives.
Storage-touching skills read this doc instead of the plugin defaults.
`/setup-cantrips-loop` wrote it; re-run that skill to change it.

## Storage backend

Local markdown under a gitignored `.scratch/`, each feature copied one way to GitHub issues by `/storage`'s script, the local files ruling.
After publish-spec, and outside Claude Code after any write verb, sync the feature through `/storage` without asking, since its script publishes only in a clone the user marked; a spec opens with a one-line title, a level-one heading on its first line.
A spec or a ticket delivering roadmap items names them on a `Roadmap items:` line, and publishing a spec marks its items in flight through `/roadmap`.
To close a feature, close it through `/storage`, with `--done` or `--not-planned` where its tickets are not all resolved, and through `/roadmap`, then delete its folder.

- Mirror: `toverux/cantrips`
- Features: `.scratch/`

- **Publish the spec** (`publish-spec`) — write it to `.scratch/<feature>/spec.md`, `<feature>` a kebab-case slug.
- **Fetch the spec** (`fetch-spec`) — read `.scratch/<feature>/spec.md`.
- **Annotate the spec** (`annotate-spec`) — append under a `## Comments` heading at the end of the file, each entry prefixed with its date; the annotation leaves the body above as written.
- **Publish the tickets** (`publish-tickets`) — one file per ticket at `.scratch/<feature>/NN-<slug>.md`, numbered from `01` in dependency order, blocking edges as each ticket's "Blocked by" prose; the shared folder ties a ticket to its parent spec.
- **Fetch the ticket** (`fetch-ticket`) — read the ticket file.
- **Annotate the ticket** (`annotate-ticket`) — append the note, undated, under a `## Comments` heading at the end of the ticket file.
- **Resolve the ticket** (`resolve-ticket`) — add or flip a `Status: resolved` line under the ticket's title; the ticked criteria stay as evidence.

Invariants, here as on any backend: an annotation appends without disturbing what is already there, stays time-ordered, and governs over the body it revises; a ticket is traceable to its parent spec.

## Knowledge stores

- `docs/adr/` — **enabled**.
- `docs/solutions/` — **disabled**.

## Roadmap

Read and write this repo's roadmap through `/roadmap`.

- Backend: `GitHub issues`
- Tracker: `toverux/cantrips`

## Deputy/Arbiter instructions

Always brief the deputy for this:
- Minimize diffs with upstreams, judge diffs on what value they're actually likely to bring.
- Take roadmap entries critically, they are often raw reports from other agents. So you can reject and retire roadmap entries, just ask the user first.
- Prose written for agents is not code: agents are good at reading intention, so short sentences can beat longer ones unless a specific problem is encountered.
- In the same vein, always keep skills as small as possible. Every line is a context cost and an actual cost for the user.
