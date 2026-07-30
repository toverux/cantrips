# Spec/plan artifact lifecycle after implementation

Research date: 2026-07-30. All repo claims were checked against source at these pinned commits:
mattpocock/skills @ `2ab9580`, EveryInc/compound-engineering-plugin @ `b562b14`, github/spec-kit @
`f36634b`. Web sources were fetched the same day. Facts are cited; anything marked _unverified_
could not be confirmed in a primary source and must not be assumed.

Context: cantrips' `/spec` writes specs to `docs/specs/<feature>.md`, `/tickets` writes ticket files
beside them, `/implement` reads them — and nothing ever closes a spec out. `/spec` step 2 even mines
_existing_ `docs/specs/` for "decisions already made", so old specs retain implicit authority
forever. The questions: what terminal states (if any) should a spec have, amendment versus
supersession, how stale-spec drift is handled elsewhere, and how hard the pipeline should bind to
local files versus a pluggable backend (the flexibility of Matt Pocock's tracker-backed approach).

## Summary table

| System               | Storage                                                        | States on the artifact                                                                             | Post-implementation fate                                                            | Drift resolution                                                             |
| -------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| mattpocock/skills    | Issue on a pluggable tracker (GitHub/GitLab/local md/freeform) | Tracker open/closed + five triage roles; wayfinder tickets add claimed/resolved + blocked-by       | Skills never close the spec issue; the tracker's own machinery (a human) does       | None on specs; durable knowledge migrates to `CONTEXT.md` + ADRs             |
| compound-engineering | `<root>/plans/*.md` files, committed                           | `artifact_readiness: requirements-only \| implementation-ready`; progress values explicitly banned | Plan body frozen ("decision artifact"); never archived, marked done, or deleted     | None; "whether it shipped is derived from git, not recorded in the doc"      |
| GitHub spec-kit      | `specs/NNN-slug/` per feature branch                           | `Status: Draft` (vestigial — never transitioned); task checkboxes in `tasks.md`                    | Deliberately unowned: three named "persistence models," teams choose                | `/speckit.converge` gap-scans code vs spec and appends catch-up tasks        |
| AWS Kiro             | `.kiro/specs/<name>/` (requirements/design/tasks)              | Per-task in-progress/completed; no spec-level status documented                                    | Kept in-repo as living documents, "continuous refinement"                           | On-demand bidirectional sync: ask Kiro to update specs from code, or refresh tasks from specs |
| ADR practice         | `docs/adr/NNNN-*.md`, append-only                              | proposed / accepted / deprecated / superseded (MADR adds rejected, "superseded by ADR-0123")       | Record freezes; reversal = new ADR + status flip on the old one, never deletion     | Supersession chain is the drift record; old decision stays readable          |
| OpenSpec (community) | `openspec/specs/` (living) + `openspec/changes/<slug>/` (delta) | Change: proposed → applied → archived                                                              | `/opsx:archive` moves the change to `changes/archive/<date>-<slug>/`, updates specs | Living spec is regenerated truth; archived deltas are the history            |

## mattpocock/skills — spec as a tracker issue, lifecycle delegated to the tracker

Sources: `skills/engineering/to-spec/SKILL.md`, `to-tickets/SKILL.md`, `implement/SKILL.md`,
`triage/SKILL.md`, `wayfinder/SKILL.md`, `setup-matt-pocock-skills/SKILL.md` and its seed templates,
`.out-of-scope/mainstream-issue-trackers-only.md`, all read at commit `2ab9580`.

**Where the artifact lives.** `/to-spec` synthesizes the conversation into a spec and "publish[es]
it to the project issue tracker. Apply the `ready-for-agent` triage label" — the spec is an issue,
not a file (unless the tracker _is_ files; see below). `/to-tickets` breaks a spec into
tracer-bullet tickets published the same way, blockers wired with the tracker's native dependency
links where they exist.

**The pluggability contract.** `/setup-matt-pocock-skills` is a one-time setup skill that writes a
per-repo prose document, `docs/agents/issue-tracker.md`, from one of four seeds: GitHub (`gh` CLI),
GitLab (`glab`), local markdown, or "Other (Jira, Linear, etc.) — ask the user to describe the
workflow in one paragraph; the skill will record it as freeform prose." The contract that document
satisfies is a small verb vocabulary the other skills speak:

- "When a skill says 'publish to the issue tracker'" → tracker-specific instruction
- "When a skill says 'fetch the relevant ticket'" → tracker-specific instruction
- "Wayfinding operations" → how _this_ tracker expresses map, child ticket, blocking edge,
  frontier query, claim, and resolve

Skills never name `gh` or a file path; they name the verb, and the tracker doc translates. A second
doc, `docs/agents/triage-labels.md`, maps five _canonical role names_ to whatever label strings the
repo actually uses ("Edit the right-hand column to match whatever vocabulary you actually use").
The local-markdown seed shows a file backend satisfying the same contract: spec at
`.scratch/<feature-slug>/spec.md`, one ticket per file at `issues/<NN>-<slug>.md`, "Triage state is
recorded as a `Status:` line near the top of each issue file", comments appended under a
`## Comments` heading. Note the directory name — `.scratch/` — which frames the whole local store
as disposable working material.

The cost of this flexibility is acknowledged in `.out-of-scope/mainstream-issue-trackers-only.md`:
"Every issue-tracker backend hard-codes a CLI shape into the skills… Each new backend is permanent
maintenance surface", so first-class backends are limited to mainstream tools and everything else
goes through the local-markdown or freeform escape hatches.

**States.** The `triage` skill defines the state machine: five state roles (`needs-triage`,
`needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) plus two category roles, riding on
the tracker's own open/closed. Wayfinder decision tickets additionally carry `claimed`/`resolved`
and blocked-by edges. These states describe the _pre-implementation_ funnel; there is no
"implemented" state.

**Post-implementation.** `/implement` is eight lines: implement, `/tdd`, typecheck, `/code-review`,
"Commit your work to the current branch." It closes nothing. `/to-tickets` is explicit: "Do NOT
close or modify any parent issue." The only skill-driven closures are `triage`'s `wontfix` (close
with comment; rejected enhancements also get a durable `.out-of-scope/*.md` entry) and `wayfinder`'s
per-ticket resolve (comment answer, close, index it on the map). So the spec issue simply stays
open until a human closes it through the tracker's normal machinery — the lifecycle is _delegated_
to the tracker rather than owned by the skills, and on a real tracker that costs nothing because
close/reopen/label/audit-trail come built in.

**Is the spec re-read later?** Only by explicit reference: `/to-tickets` and `/implement` fetch the
ticket/spec they're handed. No skill mines old specs for decisions. Durable knowledge is instead
expected to migrate _out_ of specs into `CONTEXT.md` (domain glossary) and `docs/adr/` — the
`domain.md` seed tells every skill to read those before exploring and to "Flag ADR conflicts …
surface it explicitly rather than silently overriding", and `triage` grilling updates
"`CONTEXT.md`/ADRs inline as decisions land." Specs and tickets are working artifacts; ADRs are the
record. (The repo dogfoods this: it carries its own `.agents/adr/` with numbered decision records.)

## EveryInc/compound-engineering-plugin — plan as immutable decision artifact, state lives in git

Sources: `skills/ce-plan/SKILL.md`, `skills/ce-work/SKILL.md`, `skills/lfg/SKILL.md`,
`docs/plans/`, `docs/brainstorms/`, read at commit `b562b14`.

**Storage.** Plans are markdown files under `<root>/plans/` (default `docs/plans/`; the root is
configurable via `.compound-engineering/config.yaml`), datestamped
`YYYY-MM-DD-NNN-type-slug-plan.md`. Requirements-stage brainstorms live in `docs/brainstorms/`.
Plans carry machine-readable frontmatter: `artifact_contract: ce-unified-plan/v1`,
`artifact_readiness`, `execution: code | knowledge-work`.

**States — readiness, never progress.** The only status axis is readiness:
`requirements-only` (an enrichment input for `ce-plan`) versus `implementation-ready` (executable
by `ce-work`). Progress is banned from the vocabulary outright: "Progress-like values (`active`,
`in_progress`, `completed`, `done`) are invalid readiness values. Stop and ask for plan repair
rather than guessing" (`ce-work/SKILL.md`).

**Post-implementation fate.** `ce-work` is the sharpest statement in this whole survey: "**Do not
edit the plan body during execution.** The plan is a decision artifact; progress lives in git
commits and the task tracker, not the plan. `ce-work` does not mutate the plan — whether it shipped
is derived from git, not recorded in the doc. Legacy plans may contain `- [ ]` / `- [x]` marks on
unit headings or a `status:` field — ignore them as state." Nothing archives, closes, or deletes a
plan; the repo's own `docs/plans/` holds ~60 dated plans from Feb–Jun 2026, all still sitting
there, and legacy requirements docs "remain readable historical inputs; do not migrate or rewrite
them" (`ce-plan`). The plan is a point-in-time record by construction; the repo history is the
progress ledger.

**Supersession and freshness, where they do exist.** Two narrow mechanisms: (1) a same-basename
`.md`/`.html` sibling where one is `implementation-ready` supersedes the stale `requirements-only`
copy ("a format conversion superseded it — the implementation-ready sibling is canonical"); (2)
auto-discovery of requirements docs only trusts files "created within the last 30 days (use
judgment to override if the document is clearly still relevant or clearly stale)". Decisions
settled mid-session are pinned into the plan as `session-settled:`-labeled Key Technical Decisions
— "the plan is the challenge ledger; later pipeline stages do not re-challenge" — making the plan
the durable carrier of decision provenance even though it never carries execution state. Review
leftovers get their own committed record, `<root>/residual-review-findings/<branch>.md` (`lfg`
step 6), rather than being written back into the plan.

**Drift.** No reconciliation mechanism exists or is wanted: since the plan never claims to describe
the current system — only the decisions made at planning time — spec-vs-code drift is definitionally
not an error. Code + git are truth; the plan is history.

## GitHub spec-kit — lifecycle explicitly left to the team, and the community feels it

Sources: `templates/spec-template.md`, `templates/commands/{implement,converge,clarify}.md`,
`docs/concepts/spec-persistence.md`, `docs/guides/evolving-specs.md`, read at commit `f36634b`.

**Storage and states.** Each feature gets `specs/NNN-slug/` (tied to a same-named feature branch)
holding `spec.md` → `plan.md` → `tasks.md`. The spec template opens with `**Status**: Draft` — and
a grep across every command template shows _nothing ever transitions it_; it is written once and
never read. Execution state lives in `tasks.md` checkboxes: `/speckit.implement` "For completed
tasks, make sure to mark the task off as [X] in the tasks file."

**Post-implementation.** `/speckit.converge` is the one code-vs-spec reconciliation primitive: run
after implement, it "Assess[es] the current codebase against the feature's spec, plan, and tasks,
then append[s] any remaining unbuilt work as new tasks" — findings classified `missing` / `partial`
/ `contradicts` / `unrequested`, looped with implement until nothing remains. But what happens to
the _directory_ afterwards is deliberately unowned. `docs/concepts/spec-persistence.md`: "Spec Kit
intentionally leaves teams in control of what happens to `spec.md`, `plan.md`, and `tasks.md` after
requirements change… None is the default, and none is required by Spec Kit." It names three models:

- **Flow-back** — edit any artifact, reconcile the set by hand; risk is "silent divergence."
- **Flow-forward** — "completed artifacts are treated as immutable. When requirements change, the
  team creates a new feature directory instead of mutating the existing" one; "Use clear feature
  names or cross-links when a new directory supersedes or extends earlier work."
- **Living spec** — `spec.md` is the contract; plan/tasks are "disposable derivations" regenerated
  from it.

The doc grounds this in Fowler's SDD taxonomy (below): "The model is a team convention, not a CLI
setting." `docs/guides/evolving-specs.md` gives the per-model operating procedure; it exists
because the community demanded it (issue #916, closed by that doc).

## AWS Kiro — specs as living in-repo documents with on-demand two-way sync

Sources: https://kiro.dev/docs/cli/v3/specs/, https://kiro.dev/docs/specs/,
https://kiro.dev/docs/specs/best-practices/, https://kiro.dev/blog/introducing-kiro/.

**Storage and states.** "Each phase produces a file in `.kiro/specs/<name>/`": `requirements.md`
(EARS-notation user stories/acceptance criteria), `design.md`, `tasks.md`. The store is shared
across surfaces ("Start a spec in the CLI, continue it in the IDE. The file format is identical").
Tasks get "real-time status updates" (in-progress/completed) and dependency-wave execution; no
spec-level status field is documented.

**Post-implementation.** The docs are silent on any terminal state — no archive, close, or done
marker. The stance is living-document instead: "Specs are designed to be version-controlled…
Store specs directly in your project repository alongside the code they describe" and Feature Specs
"are designed for continuous refinement, allowing you to update and enhance them as your project
evolves" (best-practices).

**Drift.** The launch post confronts it directly: the common failure is that "developers stop
updating original artifacts during implementation, causing documentation mismatches", and Kiro's
answer is on-demand bidirectional sync — "Kiro's specs stay synced with your evolving codebase.
Developers can author code and ask Kiro to update specs or manually update specs to refresh tasks."
The IDE exposes this as edit-then-**Refine** on `design.md` and **Sync Files** on `tasks.md`
(per docs navigation; exact affordance wording verified only via search excerpts of
kiro.dev/docs pages — _the button names are unverified beyond that_). Note this sync is invoked,
not automatic: drift is repaired when a human asks, not detected.

## ADR practice — the mature prior art for "point-in-time record amended by a later record"

Sources: Michael Nygard, "Documenting Architecture Decisions" (2011),
https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions; https://adr.github.io/;
MADR template, https://github.com/adr/madr (`template/adr-template.md`, develop branch).

Nygard's status vocabulary: "proposed" until stakeholders agree, "accepted" once agreed, and later
"deprecated" or "superseded" when a newer decision changes it. The load-bearing convention is
immutability-with-supersession: "If a decision is reversed, we will keep the old one around, but
mark it as superseded. (It's still relevant to know that it _was_ the decision, but is _no longer_
the decision.)" The motivation is exactly the stale-authority problem: "One of the hardest things
to track during the life of a project is the motivation behind certain decisions", and without the
record a newcomer must either blindly accept or blindly reverse old decisions. MADR formalizes the
field as frontmatter: `status: "{proposed | rejected | accepted | deprecated | … | superseded by
ADR-0123}"` — note that supersession _names its successor_, so the chain is walkable in both
directions (old → "superseded by NNNN", and the new record cites what it replaces).

Why ADRs are never edited in place: the record's value _is_ its point-in-time honesty. Editing an
accepted ADR would silently rewrite the rationale future readers rely on; a reversal instead costs
one new numbered file plus a one-line status flip on the old one. The numbered append-only sequence
doubles as the project's decision history. (mattpocock/skills builds this in as the durable layer
next to its tracker-based specs — `docs/adr/` in every repo, skills told to read and flag conflicts
with ADRs, never to override them silently.)

## Community signal — stale specs are the #1 lifecycle complaint; OpenSpec is the fullest answer

**spec-kit issue #620** ("How to keep specs consistent and up-to-date with spec-kit?", open,
https://github.com/github/spec-kit/issues/620) is the canonical thread: feature 001's spec "becomes
partially outdated" when feature 009 changes login; the author floats "a `/close` command (or
equivalent) to mark a feature as deprecated". The comments map the whole design space: edit the old
spec in the same commit that adds the new one (jperfetto); a post-implementation
`/speckit.compact` that synthesizes completed specs into a milestone summary and "detect[s] drift
between intent and implementation" (michelegirini); "the generated output after the spec is
implemented quickly becomes out of date due to the fine-tuning changes applied to get the feature
ready" (tjohnson4); even _not merging_ `specs/` to main so specs stay branch-local archival
material (gwallan); and repeated demand for one consolidated current-state spec — "That is exactly
the killer feature of Openspec" (amerzad).

**spec-kit discussion #152** ("Evolving specs",
https://github.com/github/spec-kit/discussions/152) states the authority problem crisply: "spec
driven development would seem to indicate that the spec is the source of truth… but spec kit leads
me to create a new spec with the variation… now to know what the system does I need to read both
specs." The community's split answer mirrors spec-kit's later persistence-models doc: an
append-only trail of delta specs whose newest entries override ("spec3 — Replace file storage
with… cloud storage") versus a master snapshot spec "updated when a feature is complete."
**Issue #916** (closed) added the brownfield angle — "Specs diverge from codebase as the project
evolves" — and was resolved by writing the `evolving-specs` guide rather than any tooling.

**OpenSpec** (https://github.com/Fission-AI/OpenSpec, README) is the community-cited system that
actually owns the full lifecycle, via a two-tier store: `openspec/specs/` is the living
source-of-truth requirements set, and each piece of work is a **change** at
`openspec/changes/<slug>/` containing `proposal.md`, delta specs (`## ADDED Requirements` with
scenarios), `design.md`, `tasks.md`. After `/opsx:apply` implements the tasks, `/opsx:archive`
closes the loop: "Archived to `openspec/changes/archive/2025-01-23-add-dark-mode/`. Specs updated.
Ready for the next feature." — i.e. the delta is folded into the living spec and the change folder
is date-stamped into an archive that _is_ the project history. This is the ADR pattern
(append-only deltas, dated, never deleted) fused with the living-spec pattern (one current
contract), file-based throughout.

**Fowler's taxonomy** (Birgitta Böckeler, "Comparing spec-driven development tools",
https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html — the article spec-kit's own
docs cite) names the underlying temporal question: **spec-first** ("used in the AI-assisted
development workflow for the task at hand", then discardable), **spec-anchored** ("kept even after
the task is complete, to continue using it for evolution and maintenance of the respective
feature"), and **spec-as-source** (only the spec is human-edited). She classifies Kiro and
spec-kit as effectively spec-first in current practice. The disposable-prompt-vs-durable-record
debate is exactly the spec-first/spec-anchored boundary, and every system above sits somewhere on
it: Pocock local tracker (`.scratch/`) and CE plans are spec-first with a durable side-channel
(ADRs / session-settled KTDs), Kiro and living-spec/OpenSpec are spec-anchored, spec-kit refuses
to choose.

## Comparative: pluggable backends, file bindings, and an ADR-shaped lifecycle for pipeline specs

**What makes Pocock's backend pluggable** is not the trackers — it's the indirection: skills speak
a tiny verb contract ("publish to the issue tracker", "fetch the relevant ticket", plus the
wayfinding verbs), and one per-repo prose doc translates verbs into `gh` calls, `glab` calls, file
writes, or a user-described workflow. Three consequences matter for cantrips: (1) the local-file
backend is _already one implementation of the contract_, not a lesser mode — a file-first pipeline
can adopt the same indirection later without rewriting skill bodies; (2) a real tracker gives the
lifecycle (open/close, labels, assignment, audit trail) for free, which is exactly why Pocock's
skills can afford to never close anything — the tracker UI makes the human's close a one-click act;
(3) the flexibility has a named cost — "permanent maintenance surface" per backend — which is why
upstream caps first-class backends and routes the rest through freeform prose.

**Who binds to files, and how they cope with lifecycle:** CE binds hard to files but sidesteps the
terminal-state question by _redefining the artifact_ — a plan is a frozen decision record, state is
derived from git, so there is nothing to close and drift is not an error. spec-kit binds to files
and declines to own the lifecycle, which produced its most persistent community pain (#620, #152,
#916). Kiro binds to files and picks living-document, with human-invoked resync as the drift
answer. OpenSpec binds to files and solves it structurally: living spec + archived dated deltas +
an explicit archive verb that performs the fold. The lesson across all four: a file backend is
fine, but the lifecycle must then be designed rather than inherited — file systems have no native
"closed."

One convergence worth copying regardless of backend: **both mature agent pipelines keep execution
state out of the spec body** (Pocock: state = tracker labels; CE: state = git, progress values
banned from plan metadata), while the systems that put checkboxes in files (spec-kit, Kiro) still
leave the spec's own status vestigial (`Status: Draft` forever). Status-of-the-work and
status-of-the-record are different axes; conflating them is what makes stale specs lie.

**The ADR supersession model applied to pipeline specs** would look like: a spec gains one
`Status:` header with a record-lifecycle vocabulary (not a work-progress one) — e.g. `draft` →
`approved` → `implemented` (a terminal freeze, stamped by `/commit` or `/compound` at loop end,
after which the file is history and is only ever amended by supersession) → `superseded by
<feature>.md` when a later spec changes the same behavior. A new spec that alters shipped behavior
names what it supersedes; the old spec gets the back-pointer flipped in the same edit (the one
in-place edit the model permits, per Nygard: keep it around, mark it superseded). This gives
cantrips' `/spec` step 2 a correctness rule it currently lacks: mine `implemented` specs freely as
history, but only non-superseded ones carry authority about current behavior — which resolves the
"old specs retain authority" ambiguity, the #152 "read both specs" problem, and flow-forward's
missing-cross-links weakness, at the cost of one header line and one convention. It is exactly
spec-kit's flow-forward model with the discipline made explicit, OpenSpec's archive without the
folder move, and ADR practice applied one level up — and it stays entirely file-local, while
remaining compatible with a later Pocock-style tracker indirection should the pipeline ever want
one (the statuses map 1:1 onto tracker open/closed/labels).

### Open questions

- Kiro's exact IDE affordance names ("Refine", "Sync Files") are corroborated only by search
  excerpts of kiro.dev pages, not a fetched doc body — verify in-product before citing them in a
  skill.
- Whether spec-kit will ship anything from #620 (`/close`, `/speckit.compact`) — the issue is open
  with no maintainer commitment as of 2026-07-30.
- OpenSpec's exact archive semantics beyond the README (how delta specs merge into `specs/` on
  conflict) were not traced into its source.
