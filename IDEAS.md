# IDEAS

Analyzed during the grimoire v1 design (see [docs/specs/grimoire-v1.md](docs/specs/grimoire-v1.md))
and deliberately deferred. Most of these earn their keep at team scale or on big, long-running
projects; v1 targets a solo workflow. Each entry notes when it becomes worth adopting.

## More harnesses beyond Claude Code and Codex CLI

SKILL.md is now an open standard with wide adoption, so grimoire's skills trees are already
portable; only packaging and distribution differ per harness. Full research (sources, per-harness
costs, open questions) in
[docs/research/multi-harness-plugins.md](docs/research/multi-harness-plugins.md). Ranked plan:

1. **GitHub Copilot CLI** — reportedly reads the `.claude-plugin/` layout as-is; test
   `copilot plugin marketplace add toverux/grimoire` (possibly zero-cost).
2. **Antigravity + Goose + Copilot** — one additive root `plugins/<name>/plugin.json` serves all
   three; Goose also runs Claude-style `hooks/hooks.json`, bringing the wards hook along.
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
on an issue tracker, resolved one at a time until the way is clear. The grimoire adaptation
sketched in the design interview keeps the map/decision-ticket model but stores the map and its
tickets as local markdown (same spirit as `docs/specs/<feature>/` tickets), removing the tracker
dependency.

**Adopt when:** a single effort's decision surface outgrows what `/grilling` → `/spec` can chew
through in a session or two, i.e. multi-week efforts with dozens of open decisions.

## Triage

Pocock's `triage` moves issues (and external PRs) through a state machine of triage roles:
categorise, verify, grill if needed, write agent-ready briefs. Depends on an issue tracker and an
inbound flow of issues.

**Adopt when:** the projects using grimoire have a real issue inbox (public repos with external
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

## `paths:` frontmatter experiment for rule-like skills

The old rules files carried `paths:` globs; skills have no equivalent, so the style skills rely on
strong write-trigger descriptions instead. Experiment: reintroduce path-scoping for skills if
harnesses grow support for it, making style skills fire mechanically on matching edits.

**Adopt when:** Claude Code or Codex CLI ships path-scoped skill activation.
