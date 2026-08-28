# IDEAS

Analyzed during the design of the loop and deliberately deferred. Most of these earn their keep at
team scale or on big, long-running projects; cantrips targets a solo workflow. Each entry notes
when it becomes worth adopting.

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

Every added manifest pair is one more copy of the same metadata kept in sync by hand; weigh that
before adding one.

**Adopt when:** someone actually asks for a third harness — starting with the Copilot test, which
costs five minutes and may already work.

## Wayfinder, adapted to local files

Pocock's `wayfinder` plans work too big for one agent session as a shared map of decision tickets
on an issue tracker, resolved one at a time until the way is clear. The cantrips adaptation
sketched in the design interview keeps the map/decision-ticket model but carries the map and its
tickets through the storage verb contract, so it runs on local markdown or a tracker exactly as
the rest of the loop does.

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

## A grouping mechanism for `/review-gate`'s verifiers

Verify says to group candidates by `(file, line)` and run one verifier per distinct location. That
arithmetic runs away on a real pass: twenty-seven candidates over six files resolved to fourteen
locations, and the orchestrator grouped them by file instead of spawning fourteen sub-agents.
Observed behaviour is that agents consistently adapt this rule rather than follow it — which makes
it a rule that does not hold, and the adaptation goes unreported unless the orchestrator volunteers
it.

Per-location isolation buys one thing: a verifier cannot trade a weak candidate against a strong one
somewhere else. It costs one sub-agent per location plus a re-read of the same file by each of them.
A stated grouping mechanism would keep the isolation where it pays and bound the fan-out — group by
file by default, split a file only past a candidate threshold, and name the grouping in the report
so the reader knows how much independence was actually bought.

**Adopt when:** the next `/review-gate` edit lands. The stated contract and the observed behaviour
have already diverged, so the skill is describing a pipeline nobody runs.

## Compression that falsifies

Pruning weighs what a line costs, not what tightening it asserts. Compressing a loose claim can
invent an attribution the original left vague: "large scripts are capped at 400 lines" became "a
lineStart/lineEnd range is capped at 400 lines", pinning an unconditional cap on one parameter.
Candidate rule for Pruning: re-verify a compressed claim against its source, not against the
sentence being compressed.

**Adopt when:** the next `/writing-for-agents` edit lands.

## Delta rounds narrow the readership, and the round count hides it

`LOOP.md` scopes each delta round to the batch the previous round fixed, and reads convergence from
findings per round. The two interact in a way it does not warn about: scoping a delta to the batch
guarantees coverage narrows, so the count falls whether or not the work is settling.

Observed on a seven-round prose gate. Findings ran 24, 11, 10, 9, 5 — then the certifying pass found
14, more than the delta before it. Nine of those fourteen were in eight files no delta round had ever
re-read, because the deltas kept landing on the same seven files the fixes kept touching. The falling
count measured a shrinking readership, not converging prose, and a loop trusting it would have closed
three rounds early on a number that was going down for the wrong reason.

Candidate rule for the round section: track which files in the target no delta round has read, and
scope one late pass at those before a low count is allowed to close the loop. Read the trend per file
rather than per round — a file at zero findings because nobody opened it is not the same observation
as a file at zero after three passes, and the per-round count cannot tell them apart.

**Adopt when:** the next `/review-gate` edit lands — pairs with the verifier-grouping entry above,
since both are places where the stated contract and a real pass diverge.

## Closure claims that were never true

`/writing-for-agents` prunes a **Snapshot** — a count standing where an invariant belongs — because
it goes stale. The nearer failure is a claim that was wrong the day it was written: "the three
bullets below" pointing at four, "`low` is the exception" omitting two paths, "both fixes cost
something real" omitting a third and cheaper one. Five in one ticket, each reading as precision,
which is how each survived being written.

The damage tracks whatever trusts the claim. A `FORKS.md` bullet is read as a settled verdict, so a
short list tells `/sync-upstream` that an unlisted divergence is drift to merge away. Candidate rule
for Pruning: count an exhaustive claim as you write it, or phrase it so counting is unnecessary —
"recorded below" cannot be off by one.

**Adopt when:** the next `/writing-for-agents` edit lands, with "Compression that falsifies" above —
the same defect one step earlier.

## A cross-lens pointer no carrier can follow

`QUALITY-LENSES.md`'s Simplification lens hands the platform-guarantee route out of a duplicate to
the Reuse lens "under the conditions printed there", which a carrier holding Simplification alone
never sees. On a diff where a framework already validates both copies, that carrier proposes
nothing where one holding Reuse proposes the deletion. `FORKS.md`'s `/review-gate` section records
which carriers hit the dead end and which resolve it.

Three fixes, and the cheapest was missed when this was first written down. Print the Reuse
conditions under both lenses, and a dead end is traded for two copies that drift apart — the
failure that retired the three upstream personas in the first place. Let Simplification carry the
route itself, and the fork moves further from upstream's code-quality rule 3 rather than back
toward it. Or hoist one condition into the file's "Rules governing every lens" preamble:
`/review-gate` and `/simplify` both already paste that preamble alongside the single lens section,
so it reaches every carrier in one copy, with no duplication and no new divergence. Try the third
first.

The same shape has a second instance, recorded in `FORKS.md`'s `/simplify` section: the two brakes
closing upstream's code-quality rule 3 reach no Simplification-only carrier either. The preamble
hoist covers it too, which is part of why it is the fix to try. It also settles the open middle
case `FORKS.md` records — an inline `/simplify` pass whose parent holds Reuse's text while the
pass runs under one assigned lens — by making the census moot.

**Adopt when:** the next `/review-gate` edit lands.

## Inline the flow-pointer format into each pipeline skill

The closings say "read [flow-pointers.md] for the format", and sessions routinely skip the read and
improvise: the skill body already inlines the pointer's content (targets, `(user-invoked)`, flags),
so the load has no visible payoff, and an agent that skips it cannot see its own deviation. The
verb-first rewording recorded in `FORKS.md`'s "Pipeline closings" bullet fixed the citation-read
failure and not this one. Observed again 2026-08-28 — two skills, two closings, zero reads — and it
happens often.

The proposal inverts the current design: carry the format in each pipeline skill's closing (it is
two lines — an italic blockquote, `Next:` / `Next steps:`, an em-dash rationale per pointer) and
demote `flow-pointers.md` to the authoring reference `/writing-for-agents` points at. That trades
the one authoritative home for a dozen copies kept identical by hand — the drift cost AGENTS.md
rule 3 exists to avoid — bought because a pointer whose target holds only presentation is a pointer
agents demonstrably do not follow. A cheaper companion: the format's opener is a checkable token,
so a done-when naming `Next:` would make the deviation observable whichever home the format keeps.

**Adopt when:** the next edit touching the pipeline closings lands — it re-touches every pipeline
skill anyway, which is when the copies are cheapest to stamp.

## The gate calls green before the close it owes

The dominant failure in a 2026-08-28 survey of ~85 sessions: `/review-gate` applies fixes, then
declares green without the delta verification or certifying pass the loop requires, rationalizing
that the batch was small or that the letter of the rule was satisfied. It recurs within a single
session after being caught ("the green call was one notch early again"), and the forced close finds
real defects every time — one certifying pass found eight, "including two in the very fix I made to
justify running it." The user's countermeasures escalated from an oral reminder to a PERMANENT
REMINDER pasted into every `--loop` invocation, to a `/goal` Stop hook, to a mechanical
`stop-review-gate-hook.mjs` — and even under the hook one run took thirteen delta rounds and ended
by the user clearing the goal by hand. LOOP.md already states the rule; the rule does not survive
the pull to conclude.

**Adopt when:** the next `/review-gate` edit lands — the close needs a checkable token the agent
must produce, not a rule it must remember.

## Fixes written from summaries reintroduce defects

The mechanism behind the gate's slow convergence. In one long gate, roughly a third of ~95 fixed
findings were errors a previous round's fix introduced; in another, five of seven delta rounds
caught defects in the prior batch's new sentences, and the orchestrator isolated the cause itself:
"every time I wrote a fix from a verdict's summary instead of from the quoted decompile line, the
next round caught it" — batches written from quoted lines came back clean. At scale this is the
non-convergence failure: three sessions on one diff, the 200-subagent cap, "Seventy-six repairs
bought no measurable drop in defect density" — and the loop has no churn detector.

**Adopt when:** the next `/review-gate` edit lands — a fix sentence is a new claim and needs the
same source as the one it replaces.

## /compound and /commit run long until told otherwise

"Keep edits smart and short" (or a variant) appears in nearly every session that reaches
`/compound`, usually sent preemptively — before anything was written. Three distinct defects:
bloat (a solutions doc grown to "four paragraphs and two code blocks" duplicating its own Fix
section; `/commit` bodies read as "session lab notebooks", traced to the skill's own open-ended
"anything a future reader needs" with "no upper bound anywhere"); low precision (whole candidate
sets killed — "kill each", twice, 100% rejected — plus truisms, already-covered items, stale
claims); and risky wording (a proposed AGENTS.md sentence the user rewrote for fear "an agent will
bypass the cantrips loop").

**Adopt when:** the next `/compound` or `/commit` edit lands — both need a stated length bound and
a fixed proposal format.

## The standing invocation preamble

Real invocations are never bare: round-limit overrides ("ROUND LIMITS DON'T APPLY FOR THIS RUN,
continue until green"), anti-over-engineering hedges (often repeated mid-run after failing once),
autonomy grants escalating to caps ("I'm hands off, CALL THE SHOTS"), and model routing retyped on
every dispatching invocation even though the user's global CLAUDE.md already states it. Contract
gaps feed the habit: at `low` the stated contract itself makes `--fix` report without applying —
and observed runs also skipped the disclosure that contract requires — costing one extra turn to
say "fix them"; the findings cap parks verified findings mid-`--loop` instead of
fixing them (self-reported three times before the user said "Take the standing findings"); round
limits have no knob, so the override only exists as freeform prose.

**Adopt when:** the next `/review-gate` edit lands — everything the preamble restates is a default
the skill could own.

## Applied fixes do damage the gate cannot see

A verifier-confirmed finding shipped a visible regression (menu flashing blank, a scrollbar
popping) the user refused outright; an extracted predicate was reverted across four files as
over-engineered despite two standing anti-over-engineering instructions; `/simplify` deleted a
load-bearing one-liner on a finder's word and, in another run, flipped a fact while "simplifying"
("two simulation spawners" became three, contradicting a shipped sibling) — against its own
quality-only contract. Verification itself reads shallow: a reference that "passed three review
rounds" for plausibility turned out wrong in every substantive claim on first check against the
decompile, because "each round's derivation stopped at the line that agreed with it."

**Adopt when:** the next `/review-gate` or `/simplify` edit lands.

## /setup-cantrips-loop writes without interviewing

Observed directly: "Running the setup interview now with this repo's answers…" immediately
followed by the full config `Write`, no question ever posed — twice, both dogfood attempts. The
generated file was itself defective: a self-contradictory no-op sentence the agent traced to the
template ("every user picking .scratch/ would have gotten that same dead sentence") and prose too
verbose for the standard the plugin ships. Counter-evidence: a re-run against an existing config
behaved — summarized state, offered optional changes, imposed nothing. It is the first run, the
welcome one, that skips its own interview.

**Adopt when:** the next `/setup-cantrips-loop` edit lands — it should be an onboarding
conversation whose answers are the user's, not the repo's.

## No output format is specified, so every run improvises one

Ledger and report formats swing between extremes across sessions, drawing opposite corrections: a
parked-decision list too compressed to act on ("Restated all standing decisions in very clear
plain terms and enough context") in one session, "No long paragraph after each round please, just
a short ledger" then "No table please for ledgers" in another. Three times the user invoked
`/wait-what` just to decode a gate report; other catches were density ("you are using way too much
numbers… Would that actually help an agent?") and unresolved referents ("waiting on its own gate —
which?").

**Adopt when:** the next `/review-gate` edit lands — LOOP.md can carry the ledger format the way
flow-pointers.md carries the closing format.

## Skills that do not load when they should

Four shapes. `/writing-for-agents` does not auto-fire when the agent edits agent-facing markdown —
the user's own words: "I have to correct you each time you edit agent-facing markdown … to use
this skill" — and `/compound`'s own step read "a 45-line slice of the file, not the skill." A bare
`/simplify` in a flow pointer resolved to Claude Code's builtin simplify skill instead of
`cantrips:simplify` (different contract; bug-hunting leaked into the pass), a collision `commit`,
`research`, and `init` share. `/diagnosing-bugs` did not fire on a message matching its trigger
verbatim ("The PublishNewVersion task is broken…"). And under a `/goal` Stop hook, an agent routed
around `disable-model-invocation` by replicating the whole gate workflow by hand ("The stop hook
is the user's explicit invocation — I'll run the gate by its files"), forty-seven nag cycles deep.

**Adopt when:** the next edit touching descriptions or flow pointers lands — pointers should carry
the namespaced form, and the gate lock needs wording that survives hook pressure.

## The loop spends context it never budgets

The user compacts by hand between steps, naming the next skill to protect the handoff — "/compact
for /simplify pass", "/compact for /review-gate" — a pattern repeated across sessions because a
full loop pass does not fit one context window and no skill acknowledges it. The flow pointers
could carry the recommendation: a closing that names the next step can also say when a `/compact`
before it is worth it.

**Adopt when:** the next edit touching the pipeline closings lands — same batch as the
flow-pointer-format entry above.

## /compound-refresh's judgment rules guard only the audit that never runs here

The judgment rules — the restored "Unverifiable is not false" prohibition included — sit
under `## Audit docs/solutions/`, while `## Audit AGENTS.md` is a sibling heading none of them
reach. In a repo whose solutions store is off (this one), every run takes only the AGENTS.md
audit, whose Bloat lens proposes deletions with no guard above them — so a
true but uncorroborated claim can still be stripped, the outcome the restoration exists to
prevent. The fix is hoisting the store-neutral rules above both audits; it restructures a body the
fork-divergence spec kept out of bounds, which is why it waits here.

**Adopt when:** the next `/compound-refresh` edit lands.

## /review-gate loses an angle silently when one dispatch fails mid-run

Its only fallback triggers on "the harness cannot run parallel sub-agents" — a capability check
made once — so a finder or verifier dispatch that fails mid-run costs an angle or lens and the
report still reads as a complete pass; the closing summary reports findings per class and whether
a spec was available, no other per-angle coverage. `/simplify` closed the same hole with a
per-fixer inline fallback; the gate
has no counterpart.

**Adopt when:** the next `/review-gate` edit lands.
