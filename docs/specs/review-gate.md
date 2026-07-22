# /review-gate — the merged review skill (and the /grilling rename)

Decision record of the 2026-07 grill-me interview that replaced `/code-review` with `/review-gate` and renamed `/grill-me` to `/grilling`.
Supersedes the `code-review` rows of [grimoire-v1.md](grimoire-v1.md).

## Problem Statement

Grimoire's `/code-review` skill collided with Claude Code's built-in `/code-review`, so the harness surfaced both (`/code-review` and `/cantrips:code-review`) and the user had to disambiguate every time.
The user strongly preferred the built-in's behavior — a multi-angle finder/verifier pipeline — but the built-in is Claude-Code-only (grimoire also targets Codex CLI), is proprietary (no verbatim reuse), and has no notion of a spec, so it cannot catch "built the wrong thing correctly".
Keeping both as separate steps would put two review gates in one loop.

## Solution

One skill, `/review-gate`, that reimplements the built-in reviewer's _architecture_ (finder angles → independent verify → sweep → capped ranked report) in grimoire's own words, merged with the old two-axis skill's distinctive assets: the spec-conformance axis, the Fowler smell baseline, `docs/solutions/` read-back, and the explicit fixed-point argument.
It runs identically on any harness (inline fallback where sub-agents are unavailable) and no longer collides with any built-in name.
`/grill-me` becomes `/grilling` — model-invokable, with a closing that recommends the next skill and whether to stay in the session.

## User Stories

1. As a grimoire user, I want a single review step in the loop, so that I never choose between two same-named review skills.
2. As a grimoire user, I want the review to check the diff against the spec in `docs/specs/`, so that correct-but-wrong implementations are caught.
3. As a grimoire user, I want finder angles with independent verification, so that findings are high-precision without sacrificing recall.
4. As a grimoire user, I want an effort ladder (`low`/`medium`/`high`), so that a quick sanity pass and a pre-ship deep review use the same skill.
5. As a Codex CLI user, I want the review to degrade to a single-pass inline review, so that the loop works without sub-agent support.
6. As a grimoire user, I want a `--fix` mode, so that surviving findings can be applied immediately after the report.
7. As a grimoire user, I want finding outcomes re-reported when fixes land later in the session, so that the report never goes stale.
8. As a Claude Code user, I want findings reported through the harness's typed findings tool when present, so that the host UI renders them natively.
9. As a grimoire user, I want design-smell findings expressed in `/codebase-design` vocabulary, so that reviews and design conversations share one language.
10. As a grimoire user, I want `/grilling` to fire on its own when I ask to have a plan stress-tested, so that I don't have to remember the skill name.
11. As a grimoire user, I want each pipeline skill to name the next step and whether to start a fresh session, so that the loop navigates itself.

## Implementation Decisions

Interview decisions, in dependency order:

- **Merge, don't complement**: one review step in the loop; the built-in's architecture is adopted, not invoked (skills cannot chain into the built-in — `disable-model-invocation` blocks it).
- **Reimplement, don't dump**: Claude Code's license is proprietary (Commercial ToS), so the built-in's text cannot be redistributed; the architecture (angles × candidates → 1-vote verify → sweep → capped findings) is a method and is reimplemented in original words, with provenance credited in the skill's `source` key.
- **Name**: `/review-gate` — no collision with built-in `/code-review`, `/review`, or `/security-review`; matches the skill's long-standing "review gate" identity.
- **Effort ladder**: `low`/`medium`/`high` mapping to the built-in's low/medium/**xhigh** (built-in "high" is skipped — same shape as xhigh, narrower; a user escalating past the default wants the full treatment; "ultra"/cloud has no portable equivalent).
- **Bias flip**: `medium` (default) reviews for precision, `high` for recall — stated in each level's brief, mirrored in the verify ladder ("PLAUSIBLE by default" at `high`).
- **Spec check is a correctness angle**: Angle D, inside the roster prefix so each level is a clean cut — A line-by-line, B removed-behavior, C cross-file tracer, D spec conformance, then the escalation-only E language pitfalls and F wrapper/proxy.
  `medium` runs A–D, `high` runs A–F; D is not dispatched when Scope resolves no spec.
- **Finder set**: one finder per correctness angle (the built-in's own "lens-partitioning matters for catch" rationale); quality lenses get two finders at `medium` — mechanical (Reuse + Simplification + Efficiency) and judgement (Design + Conventions) — and one finder per lens at `high`.
  The built-in merged all cleanup lenses into one finder purely to shorten the barrier before verify; attention was deliberately chosen over wall clock, with `medium` merging only within a shared mindset.
- **Candidate caps are lens-scaled**: 6 per angle or lens at `medium`, 8 at `high`; a multi-lens finder's cap is the sum of its lenses' caps — matching the built-in's cleanup budget (lens count × per-angle cap) at every rung.
  Caps are ceilings, never quotas.
- **JSON sub-agent contracts**: finders and the sweep return only a JSON array of candidates (`file`, `line`, `summary`, `failure_scenario`, `category`); verifiers return only a JSON array of verdicts (`index`, `verdict`, `evidence`).
  Mirrors the built-in's structured-output schemas; `category` is the one extension, so `medium`'s multi-lens finders label candidates the sender alone cannot disambiguate.
- **Verify policy**: location-grouped — one verifier per distinct `(file, line)`, verdict per candidate by index; unverified candidates are dropped, never reported; finders never self-censor (finding and judging are separated).
- **Inline verify triage** (first-dogfooding amendment): candidates whose deciding evidence the orchestrating session already holds — a recorded decision, a rule-quote check, a session-established fact — are settled inline, the quote located in reasoning rather than narrated; candidates a later planned step will test empirically are deferred to that step's observation; everything else is dispatched, and a REFUTED-leaning verdict on code the session itself wrote is always dispatched (false REFUTED is the recall-killing error, and the author is the wrong judge of it).
  The report's summary line counts inline and deferred settlements.
  Basis: 4–5 of 15 verifier dispatches in the first `high` dogfooding run were settleable from context the orchestrator already held.
- **Fowler smells merge into a Design lens**: Altitude plus the 10 smells the built-in lacks form one judgement lens (Duplicated Code and Speculative Generality are dropped as covered by Reuse/Simplification) — same reviewer mindset, blurry partition boundary between them anyway; each smell stays a labelled judgement call; documented project standards override the baseline.
- **`/codebase-design` link**: whichever finder carries the Design lens loads it and judges in its vocabulary; no other finder pays that cost.
- **Pure ranking at the report cap**: correctness (spec included) before quality, CONFIRMED before PLAUSIBLE, no per-class floor — the cap sizes one fix batch, and squeezed quality findings resurface on the post-fix re-run; a floor could displace verified bugs at `high`, where "a missed bug ships".
  The report caps (4/8/15) are attention economics, not tool limits — the typed findings tool accepts 32.
- **Sweep stays a correctness instrument**: gap-hunting only, unchanged from the built-in — a missed bug ships, a missed quality finding waits.
- **Effort-level heuristic in flow pointers**: the skills pointing at `/review-gate` (`/implement`, `/simplify`, `/diagnosing-bugs`) carry one identical criterion — `low` for a trivial or mechanical diff, `high` for a large, cross-cutting, or risky one, `medium` otherwise — so the model that just did the work recommends a level and the user decides; a hardcoded level in a pointer would drift everyone to the expensive rung.
- **`/compound` moves inside `/commit`'s entry**: `/commit` opens with a quick learnings gate against named candidate classes and invokes `/compound` on a hit, before crafting commits — learning writes ride into the same ceremony instead of dirtying the tree after it; `/review-gate`'s tail flags compound-worthy findings toward that scan.
- **Scope phase**: target-diff establishment inline in the orchestrating session (default: the uncommitted changes, staged or not; with a fixed-point argument, the three-dot range plus uncommitted changes), spec-source hunt, standards sources, `docs/solutions/` read-back, and user arguments treated as scope data only (prompt-injection stance inherited from the built-in).
- **Output**: harness-adaptive — typed findings tool when offered, ranked text otherwise; outcome re-reporting (`fixed`/`no_change_needed`/`skipped`); `--fix` apply mode; optional cross-model second pass, never required.
- **Progressive disclosure**: finder briefs live in `ANGLES.md` beside the SKILL.md.
- **`/grilling`**: rename restores the upstream name; model-invoked (description with triggers; Codex sidecar `allow_implicit_invocation: true`); proposes `/prototype` (empirical evidence) or `/research` (primary-source facts) mid-interview; closes by recommending `/spec`, `/implement`, `/prototype`, or `/research` with session guidance.
- **Session-flow pointers**: implement → simplify → review-gate → commit stay in-session ("the working diff is the context"); spec → implement and commit → next unit of work break to a fresh session.
- **README documents every skill**: each cantrips skill gets an anchored section (role, when to use, intent, how it works) linked from the roster tables; loop skills get the full treatment and utilities compact sections; mermaid diagrams only where a skill has real multi-stage structure (`/review-gate`, `/compound`, `/tdd`, `/diagnosing-bugs`); satellite plugins keep plugin-level sections.
- **Versioning**: renamed skills restart their per-skill semver at 1.0.0 (`review-gate`, `grilling`, unchanged by pre-release rework); touched skills get patch bumps, except `/commit` whose reordering is a minor bump.

## Test Seams

Not applicable in the usual sense — the deliverables are prose skills with no executable surface.
Verification is: `mise check:agents` (tsc, oxlint, oxfmt, plugin-sync) green, plus dogfooding — running `/review-gate` on this repo's own diffs is the acceptance test, and this spec is what its spec finder reviews future changes against.

## Out of Scope

- Verbatim reuse of the built-in reviewer's text (license) or of its harness plumbing (typed tool schemas, effort flags, workflow engine).
- A portable equivalent of `/code-review ultra` (cloud multi-agent review).
- Reproducing the built-in's `low`-level variants (fixed-cap vs `min(files, 4)` targets) — one `low` shape suffices.
- Renaming any other skill; updating [grimoire-v1.md](grimoire-v1.md) (kept as historical record).

## Further Notes

- The built-in's pipeline texts were extracted from `claude.exe` for analysis only (temp files, not in the repo); the analysis is summarized in this spec so the extraction need not be repeated.
- Observed agent counts from real sessions of the built-in at xhigh: 10–31 (finders + per-location verifiers + sweep) — the cost warning behind `medium` being the default.
- Upstream migration note: cantrips' `/grilling` now shares its name with Pocock's upstream skill it forks; the README migration warning covers the conflict.
