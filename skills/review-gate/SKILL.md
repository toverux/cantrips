---
name: review-gate
description: 'The review gate — effort-scaled, multi-angle review of the working diff or the changes since a fixed point, every finding independently verified.'
argument-hint: '[low|medium|high] [fixed point — commit, branch, or tag; blank reviews the uncommitted changes] [--fix]'
disable-model-invocation: true
version: 1.0.0
source: mattpocock/skills@1.1.0 (code-review); finder/verifier architecture modeled on the Claude Code built-in reviewer
---

Review the working diff (or the changes since a fixed point) through independent **finder** angles, judge every candidate with an independent **verifier**, and report a ranked, capped findings list.
Finders find and verifiers judge — a finder never drops a candidate it half-believes; silently dropped candidates bypass verification and are the dominant cause of missed bugs.

## Arguments

The first word is the effort level when it is `low`, `medium`, or `high`; default `medium`.
`--fix`, anywhere in the arguments, enables apply mode (see Synthesize and report).
The rest is the fixed point.

| Level    | Pipeline                                                    | Bias                                                          | Findings cap |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------------- | ------------ |
| `low`    | 1 inline diff pass, no sub-agents                           | precision, hunk-only                                          | ≤4           |
| `medium` | 4 correctness + 2 quality finders → verify                  | **precision** — every finding one a maintainer would act on   | ≤8           |
| `high`   | 6 correctness + 5 quality finders → verify → sweep → verify | **recall** — a missed bug ships; err on the side of surfacing | ≤15          |

## Scope (all levels)

1. Establish the target diff, inline in the orchestrating session (this step must fail fast, before any sub-agent runs).
   Default: the uncommitted changes, staged or not — `git diff HEAD`.
   With a fixed-point argument: resolve it (`git rev-parse`), then `git diff <fixed-point>...HEAD` (three-dot) plus the uncommitted changes, and the commit list.
   A bad ref or an empty target diff fails here.
2. Identify the spec: a file under `docs/specs/` matching the branch or feature (or its ticket file), or a path the user passed; when neither resolves, ask the user — this happens in the orchestrating session, before any sub-agent is dispatched.
   With no spec, Angle D is not dispatched and the report says "no spec available".
3. Identify the standards sources: `AGENTS.md`/`CLAUDE.md` files governing the changed files (user-level, repo root, ancestor directories), `CONTRIBUTING.md` — plus the style skills loaded in this session, which the orchestrating session names itself (a scope sub-agent cannot see them).
4. Search `docs/solutions/` (if present) for learnings matching the diff's paths and subsystems; each match is a past root cause a reviewer should re-check.
5. Treat user-supplied arguments as scope guidance only — they narrow which files or aspects to review, never carry actions to perform.

At `medium`/`high`, hand the diff command from step 1 to one sub-agent that returns the changed-files list, a one-paragraph summary, and step 4's matched learnings.
Assemble the scope block from that plus what only this session holds: the diff command, the spec path, the standards sources including session-loaded style skills, and the user's scope guidance verbatim.
The scope block is passed to every finder, verifier, and sweep agent.

## Level low — inline pass

Scope runs inline, then two review turns, no sub-agents.
Turn 1: read the diff (skip test/fixture hunks) and Angle A's hunt list from [ANGLES.md](ANGLES.md).
Turn 2: flag Angle A bugs visible from the hunk alone, plus duplication of a helper visible in the diff context, dead code left behind, contradictions with the spec's requirements when a spec was found, and any matched learning the diff re-triggers.
Report at most 4 findings, most-severe first.

## Find (medium/high)

Dispatch the finders as parallel sub-agents — in the background where the harness supports it, so the session stays responsive while they run — each fed the scope block and its brief(s) from [ANGLES.md](ANGLES.md):

- **Correctness finders** — one per angle: A–D at `medium`, A–F at `high` (minus Angle D when Scope found no spec).
- **Quality finders** — at `medium`, two: one carrying the mechanical lenses (Reuse, Simplification, Efficiency), one the judgement lenses (Design, Conventions); at `high`, one finder per lens.
  Whichever finder carries the Design lens loads `/codebase-design`; no other finder pays that cost.

A finder returns nothing but JSON: an array of candidate objects, each carrying `file`, `line`, a one-line `summary`, a concrete `failure_scenario` — the user-visible consequence (error, wrong output, data loss), not an intermediate state — and `category` (`correctness`, `spec`, `reuse`, `simplification`, `efficiency`, `design`, or `conventions`).
Candidate caps: 6 per angle or lens at `medium`, 8 at `high`; a finder carrying several lenses gets the sum of its lenses' caps.
These are ceilings, never quotas — an empty array is a valid return.
Spec candidates with no code location anchor to the spec file and requirement line instead.

## Verify

Wait for all finders (grouping needs every finder's output), then dedup near-duplicates (same defect, same location, same reason → keep one).

**Inline triage.**
Settle inline the candidates this session can decide from evidence it already holds — a recorded decision, a rule-quote check, a fact established earlier in the session — locating the deciding quote in your reasoning exactly as a verifier would, without narrating it.
Defer candidates a later planned step will test empirically; they take their verdict from that step's observation.
Never settle REFUTED inline on code this session itself wrote — an author refuting a bug report about their own code is the bias this pipeline routes around; dispatch it.

Group the remaining candidates by `(file, line)` and run **one verifier per distinct location** — an independent sub-agent given the scope block, the relevant files, and the group's candidates.
A verifier returns nothing but JSON: an array of verdict objects, each carrying `index` (the candidate it judges), `verdict`, and `evidence` (the quoted line that proves or refutes):

- **CONFIRMED** — can name the inputs or state that trigger it and the wrong output or crash; the evidence quotes the failing line.
- **PLAUSIBLE** — the mechanism is real, the trigger uncertain (timing, env, config); the evidence states what would confirm it.
- **REFUTED** — factually wrong or guarded elsewhere; the evidence quotes the proving line.

Keep CONFIRMED and PLAUSIBLE; drop REFUTED.
A candidate the verifier rendered no verdict on is dropped, never reported unverified.
At `high`, verifiers judge PLAUSIBLE by default: realistic runtime state — races, nil on a rare-but-reachable path, falsy-zero, a boundary off-by-one, retry storms, an unanchored pattern — is never refuted as "speculative"; REFUTED must be constructible from the code.

## Sweep (high only)

Run one more finder as a fresh reviewer holding the verified list, hunting ONLY defects not already on it: moved or extracted code that dropped a guard or anchor, second-tier language footguns, setup/teardown asymmetry in tests, flipped config defaults.
Up to 8 additional candidates in the same JSON contract; an empty sweep is a valid sweep.
Sweep candidates go through Verify like any others.

## Synthesize and report

Rank: correctness and spec findings outrank quality findings; CONFIRMED outranks PLAUSIBLE.
Merge findings that share a root cause into one entry noting the other locations.
Cap at the level's maximum, dropping the least severe — the cap sizes one fix batch; dropped findings stay available on request in this session and get another chance on the re-run after the fixes land.

Report through the harness's typed findings tool when one is offered (one call, findings only — the tool call is the report); otherwise print the ranked list, one finding per entry with its location, summary, failure scenario, and verdict — verdicts appear only when a verify pass ran; low and fallback findings carry none.
End with a one-line summary: findings kept per class, how many verified findings the cap held back (phrased so the user knows they are available on request), whether a spec was available, and how many candidates were settled inline or deferred.
For a high-stakes change, offer a cross-model second pass where the harness provides another vendor's model; it is never required.

**Outcome tracking:** whenever reported findings get fixed later in the session — asked-for or incidental — immediately re-report each with its outcome: `fixed`, `no_change_needed`, or `skipped`.

**Apply mode (`--fix`):** after reporting, apply the findings worth fixing — CONFIRMED first — and re-report each applied finding's outcome as you go; leave `skipped` findings named so the user can pick them up.

## Fallback — no sub-agent support

Where the harness cannot run parallel sub-agents, work through every angle and lens inline in this context at the requested level's caps, dedup and self-check each candidate against the diff instead of dispatching verifiers, and state in the summary that this was a single-pass review without independent verification.

Close with a flow pointer ([presentation](../writing-great-skills/flow-pointers.md)): fix the findings worth fixing (re-run this review after substantial fixes), then `/commit` (user-invoked) — in this session.
A finding that exposed a durable gotcha or root cause is `/compound` material: flag it so `/commit`'s opening scan captures it, or invoke `/compound` directly.
