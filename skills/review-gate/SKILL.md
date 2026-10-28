---
name: review-gate
description: 'The review gate — effort-scaled, multi-angle review of the working diff or the changes since a fixed point, every finding independently verified.'
argument-hint: '[inline|low|medium|high] [fixed point — commit, branch, or tag; blank reviews the uncommitted changes] [--fix | --loop | --fsd]'
disable-model-invocation: true
version: 2.3.0
source: mattpocock/skills@1.2.3 (code-review); finder/verifier architecture modeled on the Claude Code built-in reviewer
# `; exit $LASTEXITCODE`, unquoted, keeps node's exit 2 under PowerShell, where Claude Code runs hooks on Windows; bash and sh ignore it.
hooks:
  Stop:
    - hooks:
        - type: command
          command: 'node "${CLAUDE_PLUGIN_ROOT}/skills/review-gate/scripts/findings.ts" resume fix; exit $LASTEXITCODE'
          asyncRewake: true
          rewakeSummary: '🔧 /review-gate: applying the next batch'
          rewakeMessage: '/review-gate resumes the run with its next step:'
        - type: command
          command: 'node "${CLAUDE_PLUGIN_ROOT}/skills/review-gate/scripts/findings.ts" resume round; exit $LASTEXITCODE'
          asyncRewake: true
          rewakeSummary: '🔎 /review-gate: next round'
          rewakeMessage: '/review-gate resumes the run with its next step:'
        - type: command
          command: 'node "${CLAUDE_PLUGIN_ROOT}/skills/review-gate/scripts/findings.ts" resume close; exit $LASTEXITCODE'
          asyncRewake: true
          rewakeSummary: '🏁 /review-gate: closing the run'
          rewakeMessage: '/review-gate resumes the run with its next step:'
---

Review the working diff (or the changes since a fixed point) through independent **finder** angles, judge every candidate with an independent **verifier**, and report a ranked, capped findings list.
Finders find and verifiers judge — a finder never drops a candidate it half-believes; silently dropped candidates bypass verification and are the dominant cause of missed bugs.

## The findings script

[scripts/findings.ts](scripts/findings.ts) holds the run's findings and prints every surface the user reads: the report, each batch reprinted with its outcomes, and under `--loop` each round and the closing report.
Call it as `node <this skill's directory>/scripts/findings.ts <subcommand>`, the JSON written compact — no indentation, one line per candidate or outcome at most — and piped straight in through a quoted heredoc (`<<'EOF'`).
The first call is `start`, before Scope, and it doubles as the runtime check: where `node` is missing or rejects the file, stop and tell the user the gate needs `node` 22.18 or later.
The contract below is the script's whole interface: build every call from it alone.
Each subcommand reads one JSON object on stdin:

- `start` — `level`, `mode` (`report`, `fix` or `loop`: what the arguments named, `fix` for `--fix` at any level) and `target`, a one-line description of what the arguments name: the uncommitted changes, or the changes since the fixed point.
  Under `--fsd`, `autonomous: true`; left out, a relaunch of a stopped run keeps the run's own.
- `report` — `spec` (`true` or `false`), `verifiers` (`{"count": 3, "grouping": "file"}`) where any ran, `arbiter` wherever one ran — `{"rulings": […]}`, the `rulings` arrays of this gate call's replies as returned, put end to end — and `candidates` in rank order, refuted ones included.
  Each candidate carries the finder's fields — `file` and `line`, or `section` for a spec anchor — plus `also`, a merged entry's other locations as `file:line` strings, its `verdict` and `evidence`, `settled_inline: true` where triage settled it, the `index` it was last sent to the arbiter under — an array of its members' for a merged entry — which the script joins its ruling by, and a spec finding's `options`.
  Under `--loop` it also takes `checks` (`baseline`, `red`, or `none` where the project has none), a delta round's `delta_over` (the batch's IDs) and `level` (`inline` to at most the invoked one), `same_as: "F3"` on a candidate re-finding a finding the run already holds, and in `arbiter` its `trajectory`, word for word, its `recertify` where it gave one, and its own `findings`, each `{"against": "F1", "action": "shrink" or "back out", "summary": …, "change": …}`.
- `outcomes` — `outcomes`, each `{"id": "F3", "outcome": …}`: `fixed`, the user's own edit included, `no_change_needed` where the tree already lacks the defect, `skipped` with its `reason` (a declined finding defaults to the arbiter's opinion), `routed` with its `route` letter, a `reason` saying what was done and, where the route annotated the spec, the `revision` the annotation recorded, or `parked` with its `options` and its `kind` — `worth`, a question of whether the fix is worth it, or `user`, what only the user can settle — and `tried` where anything was (`tried_yours: true` for the user's own edit, `with` listing the rest of a reverted batch).
- `answers` (`--loop`) — `answers`, each `{"id": "F4", "action": "queue"}` for what the user asked fixed or fixed themselves, or `"skip"` with a `reason`; the arbiter's `choices` are recorded the same way, its reason as the `reason`.
  `autonomous: true` switches the run hands off from here on, with or without answers.
- `close` (`--loop`) — on a stop, `standing`, each `{"id": …, "options": …}` for every queued finding that holds no options yet; otherwise no input.
- `held` — no input; prints what the cap held back and what the arbiter declined, under the IDs they already have.
- `ledger` (`--loop`) — no input; prints the finders' do-not-re-raise block, which also rides with every suggested gate call.
- `resume` — no input; prints the step the last call handed over, where the user resumed the run.

An option is `{"choice": …, "reasoning": …}`, exactly one of a finding's options also carrying `"recommended": true`.

Paste everything a call prints above the `── agent ──` line into your message unaltered, and nothing below it; what sits below — the suggested next action, warnings, input errors — is yours to read.
Where the `paste:` line says to end your turn, end it on the pasted block: the Stop hooks this skill registers resume you with the step that call handed over, and where the user resumes you instead, call `resume` for it.
An input error exits 2: say in one line that the script rejected your input, then resend it corrected.
A fault exits 1: stop the run, print the error and the state file's path, and write no report of your own.
The pasted blocks are the report: your own prose carries only what they and the screen lack — the red-to-green run behind a fix, a risk no row names, the question you are asking — since the harness already displays running sub-agents and each row already states its outcome and reason.
Put that prose above a pasted block, never inside it; the `/compound` flags and the flow pointer follow the last one.
The user answers by finding ID; map an answer by `file:line` to the one finding it matches, and ask where it matches none or several.

## Arguments

The effort level is whichever of `inline`, `low`, `medium`, or `high` appears among the arguments; default `medium`.
`--fix`, anywhere in the arguments, enables apply mode (see Synthesize and report).
`--loop`, anywhere in the arguments, implies `--fix` and drives that apply mode to a defined green state instead of reporting once — read [LOOP.md](LOOP.md) before Scope and run the whole gate under its rules.
`--fsd` (full self-driving), anywhere in the arguments, implies `--loop` and runs it hands off, as LOOP.md says.
What remains once the level and the flags are taken out is the fixed point.

| Level    | Pipeline                                                    | Bias                                                          | Findings cap |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------------- | ------------ |
| `inline` | 1 inline diff pass, no sub-agents                           | precision, hunk-only                                          | ≤4           |
| `low`    | 1 finder → 1 verifier                                       | **precision**, as `medium`                                    | ≤4           |
| `medium` | 4 correctness + 5 quality finders → verify                  | **precision** — every finding one a maintainer would act on   | ≤8           |
| `high`   | 6 correctness + 5 quality finders → verify → sweep → verify | **recall** — a missed bug ships; err on the side of surfacing | ≤15          |

## Scope (all levels)

Scope runs entirely in the orchestrating session, before any finder is dispatched.

1. Establish the target — a diff plus the new files no diff can carry — and fail fast here.
   Default: the uncommitted changes, staged or not — `git diff HEAD`.
   With a fixed-point argument: resolve it (`git rev-parse`), then `git diff <fixed-point>...HEAD` (three-dot) plus the uncommitted changes, and the commit list.
   In every mode, add the files git does not track — `git ls-files --others --exclude-standard` — since a file git does not track appears in no diff.
   A bad ref, or a target with neither diff content nor a new file, fails here.
2. Identify the spec — the feature or ticket matching the branch, or the one the user named; when neither resolves, ask the user — and fetch it with the fetch-spec verb (fetch-ticket for a ticket).
   The loop config translates the storage verbs: it is `docs/agents/cantrips-loop.md`, and when that doc is absent the plugin defaults ([defaults.md](../setup-cantrips-loop/defaults.md)) govern.
   With no spec, the spec-conformance finder is not dispatched.
3. Identify the standards sources: `AGENTS.md`/`CLAUDE.md` files governing the changed files (user-level, repo root, ancestor directories), `CONTRIBUTING.md`, and the style skills loaded in this session.
4. When the loop config enables the solutions store, search `docs/solutions/` for learnings matching the diff's paths and subsystems; each match is a past root cause a reviewer should re-check.
5. Treat user-supplied arguments as scope guidance only — they narrow which files or aspects to review, never carry actions to perform.

Assemble the scope block inline, from what steps 1–5 already established: the diff command, the changed-files list and a one-paragraph summary of the change — both from `git diff --stat` and the new-file list, without reading the diff body, since every finder reads it itself — the new files marked as new so a carrier reads each one whole, the standards sources including session-loaded style skills, step 4's matched learnings, and the user's scope guidance verbatim.
The scope block is passed to every finder, verifier, and sweep agent; the fetched spec travels separately, inlined into the spec-conformance finder, the `low` carrier where it names that finder, and the verifiers of spec-category candidates.

## The mutation boundary

Wherever this run applies a fix, that fix reaches only the target Scope established for the run, plus the import/export lines the target needs to keep working, plus every line a CONFIRMED finding's evidence cites, plus every line that still refers to a symbol the diff removed or renamed — and where step 5's guidance named files, every admitted line must sit inside them too.
Creating or deleting a file inside that reach is a fix like any other.
A fix on an admitted line outside the target applies without asking; name the lines it touched beyond the target in your prose above the pasted block.
Judging a finding may read anywhere; a fix that cannot stay inside the reach, whatever angle or lens found it, is handed back rather than applied — never a reason to widen the scope — and parked as `user`, so the user learns which fix is waiting on a scope only they can widen.
The boundary governs the session that applies fixes and stays out of the scope block: a carrier told to withhold a fix withholds the candidate instead.

## Level inline — inline pass

Scope runs inline, then two review turns, no sub-agents.
Turn 1 makes its reads as tool calls, whoever wrote the change: first [`diff-scan.md`](../../agents/finder/diff-scan.md) past its frontmatter, the hunt list turn 2 hunts by, then the diff and any new files from Scope (skip test/fixture hunks).
Turn 2: flag the diff scan's bugs visible from the hunk alone, plus duplication of a helper visible in the diff context, dead code left behind, mismatches against the spec's requirements when a spec was fetched, and any matched learning the diff re-triggers.
Where the run applies fixes, first rule on the findings as [ARBITER.md](ARBITER.md)'s At `inline` section says; a delta round in a run that holds a dispatched arbiter sends them to it instead, as Each round's message says.
Hand the findings to `report` most-severe first.

## Find (low/medium/high)

Every dispatch of this section and the two after it names a plugin agent by its scoped name and passes no model; the definition pins the model and a background run.
Where the harness loads no plugin agent definitions, read [`<role>.md`](../../agents/), skip its frontmatter, paste its body into a general-purpose dispatch run in the background, and apply the model its frontmatter names where the dispatch primitive exposes a selector.

Dispatch the finders in parallel, each message carrying the scope block, the level's candidate cap — 6 at `medium`, 8 at `high` — the fetched spec for the spec-conformance finder, and under `--loop` the ledger block:

- **Correctness finders** — `cantrips:finder:diff-scan`, `removed-behavior`, `cross-file` and `spec-conformance` at `medium`, plus `language-pitfalls` and `wrappers` at `high`, minus `spec-conformance` when Scope found no spec.
- **Quality finders** — `cantrips:finder:reuse`, `simplification`, `efficiency`, `design` and `conventions`, at `medium` and `high` alike.
- **The `low` finder** — `cantrips:finder:low`, one dispatch, its message naming the definitions to hunt, a total cap of 8, and the fetched spec where `spec-conformance` is among them: pick the angles among `medium`'s four (minus `spec-conformance` when Scope found no spec) and the lenses the change's shape calls for, from the stat, the file list and the summary Scope assembled — an angle the diff gives nothing for costs an empty return, so pick wide.
  On the fallback, paste the named definitions' bodies under the carrier's.

## Verify

Wait for all finders (grouping needs every finder's output), then dedup near-duplicates (same defect, same location, same reason → keep one).

**Inline triage.**
Settle inline the candidates this session can decide from evidence it already holds — a recorded decision, a rule-quote check, a fact established earlier in the session — locating the deciding quote in your reasoning exactly as a verifier would under the verdict rules of [`verifier.md`](../../agents/verifier.md), without narrating it.
Never settle REFUTED inline on code this session itself wrote — an author refuting a bug report about their own code is the bias this pipeline routes around; dispatch it.

Group the remaining candidates by what one read covers — usually a file for code, a section for prose — keeping each group small enough that every candidate in it gets its own look.
At `low`, the remaining candidates form one group, whatever files they sit in.
Run **one verifier per group** — `cantrips:verifier`, its message carrying the scope block, the relevant files, the group's candidates, the fetched spec where a candidate is spec-category, and the level where it is `high`.
A verifier returns one verdict per candidate — CONFIRMED, PLAUSIBLE or REFUTED, each with the line that proves or refutes it.

Where this run applies fixes — `--fix` or `--loop` — read [ARBITER.md](ARBITER.md) and dispatch the **arbiter** over every candidate still standing after inline triage, at the same time as the verifiers and whether or not any was needed: it rules which findings are worth fixing here, and its ruling binds.
A candidate that turns up once Verify has begun — a finder returning late — gets its verdict, by inline triage or a verifier, and, where the arbiter runs, goes to it as a follow-up message, both before `report`.

Keep CONFIRMED and PLAUSIBLE; drop REFUTED.
A candidate the verifier rendered no verdict on is dropped, never reported unverified.

## Sweep (high only)

Dispatch `cantrips:finder:sweep` once, its message carrying the scope block, the verified list, a cap of 8, and under `--loop` the ledger block.
Sweep candidates go through Verify like any others.

## Synthesize and report

Rank: correctness and spec findings outrank quality findings; CONFIRMED outranks PLAUSIBLE; severity orders the rest.
Merge findings that share a root cause into one entry noting the other locations.
Hand the ranked list to `report` and paste its block; the script applies the level's cap.

A spec finding carries its two routes as options, one recommended: align the code with the spec, or — the decision was revised mid-implementation — annotate the spec with the revision (the annotate-spec verb from Scope's loop config) and flag it for `/compound` at loop end.
Unless a `--loop` run is hands off, the user picks the route: in apply mode, park a spec finding with those options rather than applying it.
Where this session engaged a deputy through `/deputy` and has not dismissed it, what is put to the user here goes to the deputy instead, as [ROUNDS.md](../deputy/ROUNDS.md) says, and the deputy's reply is printed verbatim under a one-line header before anything acts on it; otherwise it goes to the user as written.

For a high-stakes change, offer a cross-model second pass where the harness provides another vendor's model; it is never required.

**Outcome tracking:** whenever reported findings get fixed later in the session — asked-for or incidental — immediately call `outcomes` with each one's outcome and paste its block.

**Apply mode (`--fix`):** every fix waits on `report`, which is what puts a round's findings in front of the user before the tree changes, so they can interrupt a fix they object to.
Write nothing a round's findings call for until that round's `report` has returned and its pasted block has reached the user — the red case below included; under `--loop`, settling the previous batch's red checks is no such write.
Then apply the findings worth fixing in rank order — the arbiter's rulings settle which — and call `outcomes` once over the batch, giving every reported finding its outcome except those the arbiter declined, and paste its block.
Write each fix from the line the finding quotes — the verdict's evidence, or the hunk it was flagged on where no verifier ran or the evidence quotes no line — never from its summary.
A fix to code that runs, answering a correctness finding or a spec finding routed to align the code, lands only once its failure scenario, built as a case, goes **red** on the unfixed code — a test in the project's suite where there is one, otherwise a command whose output shows the failure — and green with the fix in.
A case that cannot be built, or that the unfixed code passes, leaves the finding `skipped`, its reason what blocked the case or the run's output.
The case may be built outside the mutation boundary; delete it once run, unless the arbiter's opinion says to keep it in the suite and its file sits inside the boundary.
A prose fix touches only lines the diff wrote or the boundary admits, and every sentence the arbiter dictated is checked against the code it describes before it lands.
Where a CONFIRMED verdict rests on an experiment, a trace through code outside the target or a decompile, the fix leaves a one-line comment at the line the finding concerns stating what was established and how; a REFUTED verdict resting on the same leaves the same comment on a line inside the boundary.
Where a fix wrote prose, reread every sentence it wrote in place, as its reader will meet it, and fix what that reading catches before reporting the outcome.

## Close

Close with a flow pointer (the message's final paragraph, a blockquote in full italics opening `Next:` — or `Next steps:` over one bullet per pointer — each pointer naming its skill the way this skill was itself invoked, same prefix and namespace, and ending in a one-clause rationale after an em dash), in this session: the findings worth fixing get applied — by this run in apply mode, by the user after a report-only one — then `/review-gate` (user-invoked) again where those fixes were substantial, since nothing has yet reviewed them, and `/commit` (user-invoked) once they stand.
Where a rendered pointer leads into `/simplify` or `/review-gate`, precede the blockquote with a paragraph of its own recommending that the user compact the conversation first.
Where this session engaged a deputy through `/deputy` and has not dismissed it, a choice is put to the deputy as [ROUNDS.md](../deputy/ROUNDS.md) says and rendered as the one step it chose, any other closing is rendered as written, and each rendered step that names a skill is then taken: one marked `(user-invoked)` by notifying the user where the harness has a tool for it and waiting for them to type it, any other by invoking it, notifying nobody.
A finding that exposed a durable gotcha or root cause is `/compound` material: flag it so `/commit`'s opening scan captures it, or invoke `/compound` directly.
