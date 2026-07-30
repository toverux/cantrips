# Plugin defaults — the bare-install storage contract

The storage contract for a repo where `/setup-cantrips-loop` has never run: skills fall back to this file whenever `docs/agents/cantrips-loop.md` is absent, so a bare install works with no configuration step.

## The six storage verbs

Storage-touching skills speak these verbs and let the repo's config — or this fallback — supply the paths and commands.
Under the default local-markdown backend they translate as:

- **Publish the spec** (`publish-spec`) — write the spec to `.scratch/<feature>/spec.md` (kebab-case feature slug).
- **Fetch the spec** (`fetch-spec`) — read `.scratch/<feature>/spec.md`.
- **Annotate the spec** (`annotate-spec`) — append the note under a `## Comments` heading at the end of the spec file, each entry prefixed with its date; the body above that heading stays frozen.
- **Publish the tickets** (`publish-tickets`) — write one file per ticket to `.scratch/<feature>/NN-<slug>.md`, numbered from `01` in dependency order, blocking edges as the ticket body's "Blocked by" prose; the shared folder is what ties a ticket to its parent spec.
- **Fetch the ticket** (`fetch-ticket`) — read the ticket file.
- **Resolve the ticket** (`resolve-ticket`) — add or flip a `Status: resolved` line directly under the ticket's title; the verified acceptance-criterion checkboxes remain as evidence.

Any write under `.scratch/` first makes sure `.scratch/` is listed in `.gitignore`.

Three invariants hold whatever the backend: an annotation appends without touching what is already there and stays time-ordered; an annotation recording a revised decision governs over the body it revises, so later readers judge the spec as amended; and a published ticket is traceable to its parent spec.

`.scratch/` is disposable working material, not a record: a spec and its tickets live there only while the feature is in flight, and the durable outcome lives in code, git history, and the enabled knowledge stores.
Closing a finished feature is the human's act, here as everywhere: delete `.scratch/<feature>/` once it no longer serves.
A repo that wants its specs committed — traveling with branches, worktrees, and pull requests — overrides the location through `/setup-cantrips-loop`.

## Knowledge stores

Both opt-in stores default off:

- `docs/adr/` (durable decisions with supersession chains) — off.
- `docs/solutions/` (problem-shaped learnings) — off.

A store is on only when `docs/agents/cantrips-loop.md` lists it as enabled; skills skip reads and writes against a store that is off.
