# IDEAS

Analyzed during the cantrips v1 design (see [docs/specs/cantrips-v1.md](docs/specs/cantrips-v1.md))
and deliberately deferred. Most of these earn their keep at team scale or on big, long-running
projects; v1 targets a solo workflow. Each entry notes when it becomes worth adopting.

## More harnesses beyond Claude Code and Codex CLI

SKILL.md is now an open standard with wide adoption, so the skills tree is already portable; only
packaging and distribution differ per harness. Full research (sources, per-harness
costs, open questions) in
[docs/research/multi-harness-plugins.md](docs/research/multi-harness-plugins.md). Ranked plan:

1. **GitHub Copilot CLI** — reportedly reads the `.claude-plugin/` layout as-is; test
   `copilot plugin marketplace add toverux/cantrips` (possibly zero-cost).
2. **Antigravity + Goose + Copilot** — one additive `plugin.json` at the repo root serves all
   three; Goose also runs Claude-style `hooks/hooks.json`, should the plugin ever ship a hook.
3. **Cursor** — `.cursor-plugin/` manifests (Claude-shaped), but distribution passes a
   human-reviewed central marketplace.
4. **Gemini CLI** — document per-skill `gemini skills install --path` now; defer the
   `gemini-extension.json` bundles.
5. **OpenCode** — small JS shim plugin (the CE repo demonstrates the pattern).
6. **Amp / Factory Droid / Crush** — nothing to ship; README "copy into `.agents/skills`"
   instructions.

Extend `scripts/check-plugin-sync.ts` before adding any new manifest pair.

**Adopt when:** someone actually asks for a third harness — starting with the Copilot test, which
costs five minutes and may already work.

## Wayfinder, adapted to local files

Pocock's `wayfinder` plans work too big for one agent session as a shared map of decision tickets
on an issue tracker, resolved one at a time until the way is clear. The cantrips adaptation
sketched in the design interview keeps the map/decision-ticket model but stores the map and its
tickets as local markdown (same spirit as `docs/specs/<feature>/` tickets), removing the tracker
dependency.

**Adopt when:** a single effort's decision surface outgrows what `/grilling` → `/spec` can chew
through in a session or two, i.e. multi-week efforts with dozens of open decisions.

## Triage

Pocock's `triage` moves issues (and external PRs) through a state machine of triage roles:
categorise, verify, grill if needed, write agent-ready briefs. Depends on an issue tracker and an
inbound flow of issues.

**Adopt when:** the projects using cantrips have a real issue inbox (public repos with external
reporters, or a team funneling work through a tracker).

## babysit-pr + resolve-pr-feedback

CE's PR-lifecycle pair: continuously shepherd an open PR to merge-ready (react to review comments,
CI failures, base movement), and one-shot resolution of review feedback. GitHub-specific.

**Adopt when:** work routinely ships through reviewed PRs with CI, rather than direct pushes to
the default branch.

## CE brainstorm / plan / work / lfg

CE's own outer loop: exploratory product framing (`ce-brainstorm`), plan authoring (`ce-plan`),
autonomous plan execution (`ce-work`), and the fully hands-off ship-to-PR pipeline (`lfg`).
Overlaps with the cantrips loop (`/grilling`, `/spec`, `/implement`) but trades user-in-the-loop
control for autonomy.

**Adopt when:** wanting a hands-off autonomous tier above the cantrips loop — most plausibly an
`lfg`-style wrapper that chains the existing cantrips skills without check-ins.

## Orchestrator skill for ticket-per-subagent implementation

An `/implement` variant (working names: `/conduct`, `/orchestrate`, `/implement-fleet`, `/foreman`)
that takes a spec plus its ticket suite, builds a dependency-aware task list, and delegates each
ticket to a fresh subagent — the orchestrator keeps only judgment work: sequencing, briefing each
subagent with conventions and cross-ticket handoff notes, independently verifying results (checks,
tests, acceptance criteria) instead of trusting completion reports, and fencing parallel agents off
each other's files. Validated by hand-driving the pattern on a large multi-ticket implementation
(2026-07-24). To grill: how it works, its scope, and whether/how to copy `/lfg` from
EveryInc/compound-engineering-plugin as the autonomous outer wrapper.

**Adopt when:** the grilling happens; the manual run already proved the shape carries.

## Per-repo setup skill + issue-tracker override

A Pocock-style `setup` skill that configures a consuming repo for the pipeline (where specs live,
which tracker to use, label vocabulary), letting projects override the local-markdown default with
a real tracker.

**Adopt when:** a second storage/tracker configuration actually exists; today local markdown is
the only backend, so there is nothing to configure.

## Standalone domain-modeling discipline

Pocock's `domain-modeling` (ubiquitous language, architectural decisions, domain model upkeep) as
its own cantrips skill. v1 covers the need with the AGENTS.md glossary section and its CONCEPTS.md
graduation path, driven by `/compound`.

**Adopt when:** a project's glossary graduates to CONCEPTS.md and keeps growing, i.e. the domain
vocabulary needs active modeling rather than passive capture.

## skill-creator eval harness as a permanent test bench

Anthropic's `skill-creator` (Apache-2.0) offers an eval loop for skill quality. v1 uses it only as
an external dev-time test bench, not vendored.

**Adopt when:** skill regressions actually bite (a fork edit degrades behavior unnoticed); then
wire evals into CI rather than vendoring the tool.

## `/review-gate` on a plugin-defined workflow engine

Claude Code's built-in reviewer runs its finder → verify → sweep pipeline on an internal workflow
engine (phase barriers, schema-validated sub-agent outputs, background execution with a live
progress UI). That engine is compiled into the binary with no plugin API, so `/review-gate`
approximates it in prose: background sub-agent dispatch plus explicit barrier instructions. The
skill's phase structure (Scope → Find → Verify → Sweep → Synthesize) maps onto a workflow script
almost mechanically if the surface ever opens.

**Adopt when:** Claude Code (or another harness) exposes plugin-defined workflows.

## One quality taxonomy for `/simplify` and `/review-gate`

The same three quality dimensions live in two separately-authored texts: `/simplify`'s persona
files (fixer briefs with behavior-preservation gating, forked from CE) and `/review-gate`'s
mechanical lenses in ANGLES.md (finder briefs, reimplemented from the built-in reviewer). They
already drift — the personas carry 7–9 hunt items per dimension, the lenses 4–5 — so refining what
"reuse" or "efficiency" means requires editing both or the two review paths disagree about the
same defect class (a CONFIRMED reuse finding from the 2026-07 dogfooding run). Candidate shapes: a
shared taxonomy file both reference, or the personas deferring to the lenses and keeping only
their fixer-gating rules.

**Adopt when:** the next substantive edit to either taxonomy lands — reconcile then instead of
patching one side.

## A documented spec lifecycle after implementation

`/spec` is the only skill that creates `docs/specs/<feature>.md`, and every downstream skill reads
it without writing back: `/tickets` breaks it into files beside it, `/implement` executes it,
`/review-gate`'s Angle D checks the diff against it, `/resolving-merge-conflicts` mines it for
intent, `/handoff` defers to it for anything durable, and a later `/spec` run reads past specs for
"decisions already made". The single exception is `/prototype`, which appends a branch pointer and
verdict. So a spec is de facto a forever document: written once, amended only by a later spec that
supersedes it. That convention is real — this repo practices it, and its AGENTS.md describes
`cantrips-v1.md` as amended by later specs — but it lives in one project's prose and no skill
states it. Four consequences follow:

- **No terminal state.** `/implement` ticks a ticket's acceptance criteria; nothing marks a spec
  implemented, dated, or superseded. `docs/specs/cantrips-v1.md` still reads "Status: approved
  spec, pending implementation" long after it shipped.
- **Drift resolves in one direction.** Angle D frames every mismatch as the code being wrong
  (missing requirements, scope creep). When the code is right and the spec is stale — a decision
  revised mid-implementation — there is no sanctioned move, so the gate re-reports it forever.
- **`/compound` cannot route to a spec.** Its destinations are AGENTS.md, `docs/solutions/`, rules,
  skills, and the user-global memory file. A revised decision has no path back into the contract
  that recorded the original.
- **Post-merge authority is unstated.** `/spec`'s read-back step mines past specs for prior
  decisions; if specs are never corrected, it propagates decisions that implementation abandoned.

The fix is likely three sentences rather than a new skill: a lifecycle statement in `/spec` (a spec
is a point-in-time record, amended by a later spec rather than rewritten, carrying a status line
something updates on completion), a stale-spec resolution path in ANGLES.md reported as a
spec-side finding, and possibly a sixth `/compound` destination for decisions revised during
implementation.

**Adopt when:** the next spec-touching edit to `/spec`, `/review-gate`, or `/compound` lands — or
sooner, if a stale spec misleads a session for real rather than just reading wrong.

## `/compound` inside `/commit` should pause before the commit

`/commit` opens by invoking `/compound`, which gates every write on the user — but the gate is on the
_destination_, not the text. The user approves "this learning goes to `docs/solutions/`", the agent then
writes the prose and stages it into the same commit, so the first time anyone reads the actual document
is after it has landed. Fixing a clumsy sentence then costs an amend. The two skills each behave
correctly alone; the gap is at the seam, where `/compound`'s approval step and `/commit`'s staging step
run without a checkpoint between them. The fix is a stop in `/commit`'s step 1: once `/compound` has
written the approved files, present the diff of those writes and wait, so the user can bless the wording,
edit it, or drop a document that reads worse than it sounded as a one-line proposal.

**Adopt when:** the next `/commit` run whose compound scan produces a write — or sooner, since the cost
is one prompt and the current behaviour has already shipped learning prose unread.
