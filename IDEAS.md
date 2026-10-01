# IDEAS

Analyzed during the design of the loop and deliberately deferred. Most of these earn their keep at
team scale or on big, long-running projects; cantrips targets a solo workflow. An entry may note
when it becomes worth adopting; an edit that fires such a trigger adopts the entry or re-defers it
under a new one in the same change.

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

## Compression that falsifies

Pruning weighs what a line costs, not what tightening it asserts. Compressing a loose claim can
invent an attribution the original left vague: "large scripts are capped at 400 lines" became "a
lineStart/lineEnd range is capped at 400 lines", pinning an unconditional cap on one parameter.
Candidate rule for Pruning: re-verify a compressed claim against its source, not against the
sentence being compressed.

**Adopt when:** the next edit to `/writing-for-agents`' Pruning section lands.

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

**Adopt when:** the next edit to `/writing-for-agents`' Pruning section lands, with "Compression
that falsifies" above — the same defect one step earlier.

## Applied fixes do damage the gate cannot see

A verifier-confirmed finding shipped a visible regression (menu flashing blank, a scrollbar
popping) the user refused outright. Verification itself reads shallow: a reference that "passed
three review rounds" for plausibility turned out wrong in every substantive claim on first check
against the decompile, because "each round's derivation stopped at the line that agreed with it."
Prose fixes do it too (transcript `2296fef0-9d0e-4541-bac7-ea15e7dd6158`): a conventions finding
ruled `fix` reworded 22 passive lines the diff never wrote, and two rewrites named the wrong actor;
a round later, three of five errors of fact came from wording the arbiter dictated. A prose fix
could stay on lines the diff wrote, and dictated wording be checked against the code before it
lands. A `--loop` run (transcript `bb9dec00-76ec-4cd6-b666-f7c2f43996e5`) stopped on
`fourth_novel_round` from this churn alone: each delta round's findings were the last batch's
rephrasings — a rephrase the arbiter asked for contradicting its own entry, another asserting a
false fact — and the arbiter's own advice was to delete rather than rephrase.

**Adopt when:** a third run shows a prose fix, or wording the arbiter dictated, adding an error of
fact.

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

## Skills that do not load when they should

Three shapes. `/writing-for-agents` does not auto-fire when the agent edits agent-facing markdown —
the user's own words: "I have to correct you each time you edit agent-facing markdown … to use
this skill" — and `/compound`'s own step read "a 45-line slice of the file, not the skill."
`/diagnosing-bugs` did not fire on a message matching its trigger verbatim ("The PublishNewVersion
task is broken…"). And under a `/goal` Stop hook, an agent routed around
`disable-model-invocation` by replicating the whole gate workflow by hand ("The stop hook is the
user's explicit invocation — I'll run the gate by its files"), forty-seven nag cycles deep.

**Adopt when:** the next edit touching descriptions lands, or the next `/review-gate` edit for the
gate lock, which needs wording that survives hook pressure.

## /compound-refresh's judgment rules guard only the audit that never runs here

The judgment rules — the restored "Unverifiable is not false" prohibition included — sit
under `## Audit docs/solutions/`, while `## Audit AGENTS.md` is a sibling heading none of them
reach. In a repo whose solutions store is off (this one), every run takes only the AGENTS.md
audit, whose Bloat lens proposes deletions with no guard above them — so a
true but uncorroborated claim can still be stripped, the outcome the restoration exists to
prevent. The fix is hoisting the store-neutral rules above both audits; it restructures a body the
fork-divergence spec kept out of bounds, which is why it waits here.

**Adopt when:** the next `/compound-refresh` edit lands.

## The redaction discipline lives in one skill

Upstream's `## Redact` section landed in `/diagnosing-bugs` at v1.2.3: every secret redacted before
a command, output, or captured artifact is shown, loops built against env vars. The concern is not
diagnosis-specific — `/commit` prints `git status` and diff output, `/review-gate` hands whole
diffs and untracked files to dispatched finders, and `/handoff` carries only its own one-line
variant ("Redact any sensitive information") — so the plugin now holds two divergent redaction
rules in two skills and none elsewhere. The section is carried upstream bytes and stays
byte-identical where it is; the honest home for a plugin-wide rule is a shared reference the other
skills point at, reconciling the two wordings on the way.

**Adopt when:** the next edit touching `/commit` or `/handoff` lands, or a secret reaches a gate
dispatch.

## /setup-cantrips-loop sets up model-tier preferences

Skills that tier a dispatch name the tier abstractly — mid-tier for `/simplify`'s fixers and the
gate's mechanical-lens finder, most capable for the arbiter — and fall back to the parent model
wherever the harness exposes no selector. Which model a tier means is left to each run. The setup
interview could ask once and record the answer in the loop config: the model each tier maps to on
the user's harness, or that a tier is off, for tiering skills to read beside the storage verbs.

## Dispatched roles as agent definitions

`/review-gate`'s finders, verifiers and arbiter, and `/simplify`'s fixers, are general-purpose
dispatches handed a brief the orchestrator pastes from a sibling file (ANGLES.md,
QUALITY-LENSES.md, ARBITER.md). The plugin could ship them as agent definitions instead, one per
role. Each role would then show up by name in the harness, carry its own brief behind a context
pointer rather than the orchestrator's prompt, and pin its model tier and read-only toolset in
frontmatter rather than in prose. Weigh the costs first:
- **Claude Code only.** A Claude Code plugin ships `agents/*.md`; a Codex plugin cannot ship roles,
  which load only from the user's or project's own config
  ([research](docs/research/harness-subagent-capabilities.md#4-model-and-named-agent-selection-per-dispatch)).
  Codex would keep the pasted briefs, so every role lives twice.
- **Paths that still inline the brief.** `inline` runs the brief inline, and AGENTS.md rule 4
  makes every path carry what it needs.

## The arbiter can decline a spec finding without the user hearing of it

A `decline` binds whatever the finding's category
([ADR 0005](docs/adr/0005-an-authoritative-arbiter-of-proportionality-in-the-review-gate.md)), so
a spec mismatch the arbiter judges not worth its fix is `skipped` with a reason: the user is never
offered the two spec routes, the spec is never annotated with the revision, and `/compound` is
never flagged. The arbiter's brief weighs a fix's cost against its failure's and gives it no
criterion for which of code and spec is wrong. A carve-out would send spec findings past the
arbiter to the user, as before it existed.

**Adopt when:** a run's ledger shows a declined spec finding the user would have wanted to route.

## `/review-gate`'s default target is empty once the work is committed

The default target is the uncommitted diff, and Scope fails fast on an empty one. A session that
commits as it goes — a feature amended into one PR commit — reaches the gate with a clean tree, so
the run fails or the agent picks a fixed point itself: twice in one session it substituted
`main...HEAD` and said so. Scope could propose the default branch as the fixed point when the tree
is clean and the branch is ahead of it.

**Adopt when:** a run on a clean tree fails, or picks its own fixed point, again.

## A widened mutation boundary leaves earlier fixes shaped by the narrow one

A fix is written to fit the boundary it was applied under, and nothing sends the loop back to it
when the user's answer widens that boundary. A charset bug was fixed by replacing `▲`/`▼` with a
signed number because the symbol table was out of reach; one round later the boundary widened to
add other symbol keys, and the arrows stayed gone until the user asked why. `answers` could
re-queue the applied fixes whose record names the boundary as their constraint.

**Adopt when:** a fix shaped by the narrow boundary survives a widening again.

## The mutation boundary is too conservative a default

The user often ends up widening the mutation boundary, and finds agents too conservative about it.
Every fix that needs a file just outside the target is handed back, and it waits on a question
whose answer is usually yes. The user could choose the boundary up front, for example with a flag
that lets fixes reach beyond the target. The gate could even default to extending the boundary and
still hand back anything it could not reach. Weigh this against why the boundary exists: a fix
outside the reviewed scope is one no finder or verifier looked at. Raised in session
`33c53966-f425-4648-a8cf-2d5cf0de084b`.

Seen again in session `723b78a4-40ad-4691-b3db-a62baa50c2eb`, in the sharpest form the idea has:
a `--loop` round deleted an `internal static` member, and a repo skill doc still cited it as its
worked example, so the only fix for a now-false instruction was one file outside the target. The
user's answer was "Extend the mutation boundary when needed." That sub-case needs neither a flag
nor a judgement call, because the target's own deletion is what falsified the doc — a reference the
diff broke is not unreviewed scope, it is the diff's own fallout, and the run already knows which
symbols the diff removed or renamed. It is also the case most likely to be missed, since the stale
reference lives where no finder is looking unless a lens happens to sweep the docs.

**Adopt when:** adopt the deleted-reference case now, since it is mechanical and the boundary's own
rationale does not cover it; keep deferring the general widening until a third session asks for it.

## The loop parks for the user what the arbiter could rule

`--loop` parks for the user every item it cannot resolve, including those asking only whether a fix
is worth it — the arbiter's own question. Twice in one run the user answered "ask the arbiter", then
delegated to it everything parked from then on. The loop no longer waits on a parked item, but
each one still holds the run at `WAITING:` short of green until answered. A flag, or a first
answer, could hand the arbiter the parked set, keeping for the user what it cannot rule: spec
routes and actions only they can perform.

**Adopt when:** the user answers a parked item with "ask the arbiter" again.

## A spec finding is parked even when a sibling fix already settled its route

A spec finding and a conventions finding sat on one line; the arbiter ruled the conventions fix in,
and that fix aligned the line with the spec. The script still asked to park the spec finding for
its route, so it was recorded `no_change_needed` by hand (transcript
`a7963c1a-809b-41c7-b381-eb3563cc3309`). The script could drop a spec finding's park once another
fix in the batch leaves no mismatch to route.

**Adopt when:** a second run parks, or hand-settles, a spec finding another fix made moot.

## The arbiter's earlier rulings should bind it

Over one `--loop` run (transcript `6155e3fb-b5ba-457a-8d49-c88c8e3d2a3a`) the arbiter ruled the same finding three ways in three rounds (a lock takeover
refused, then endorsed, then refused; an accept status locked, then unlocked), each time on the round's
message alone. Each ruling was applied, each reversal cost a batch and a delta round. Its own prior
rulings travel in the message as drift data, but nothing says they stand unless the round brings new
evidence; the brief should, so a reversal has to name what changed.

**Adopt when:** the arbiter reverses a ruling with no new evidence again.

## A tripped `/review-gate` stop prints below everything else

Under `--loop` the line that announces a stop closes the agent section, after the warnings and
above a ledger that ran to 58 KB. An agent that trimmed the section to its first lines applied two
batches past a tripped `fourth_novel_round` without seeing it (transcript
`5678f667-f07c-4826-b158-8e10551a2d4f`). The script could print a stop first.

**Adopt when:** a run works past a stop it did not see again.

## No `/review-gate` subcommand lists the findings a `same_as` tag matches against

`--loop`'s `fix_not_taking` guard trips only on a candidate tagged `same_as` a finding the run
holds, and the fixed and queued ones appear nowhere but in the round blocks already pasted:
`ledger` lists what was skipped, routed or refuted. After a compaction — which the skill itself
recommends before a continued run — a re-found fixed finding goes untagged and is fixed again under
a new ID (transcript `5678f667-f07c-4826-b158-8e10551a2d4f`, F259). `ledger` could list fixed and
queued findings on request; riding them on every gate call would grow each round by the whole run.

**Adopt when:** a compacted run re-fixes a finding under a new ID, or misses a `fix_not_taking`.

## `/simplify` reports in its own format

`/review-gate` reports through a script that prints fixed rows: run-wide `F<n>` IDs, two lines per
finding, class emojis with a legend, fixed rows struck through. `/simplify` still writes its own
summary, although its findings come through the same quality lenses and would read the same as
rows (transcript `5678f667-f07c-4826-b158-8e10551a2d4f`). Adopting the rows means shipping the
script, or a shared one, with `/simplify`, and its runtime requirement with it.

**Adopt when:** `/simplify`'s report draws the complaints the gate's did — a numbering invented per
run, a format that swings between runs, or a summary the user asks to have reworked.

## `/review-gate`'s Stop hooks miss a sandboxed run's hand-off

With Claude Code's sandbox filesystem isolation on, sandboxed commands get their own `$TMPDIR` and
hooks run outside the sandbox, so the hook looks for the script's hand-off in another temp
directory and never wakes the agent: each round waits on a user nudge and the agent's `resume`
(transcript `5678f667-f07c-4826-b158-8e10551a2d4f`). No documented marker tells the script it runs
sandboxed, so it cannot fall back to printing the step with its block; a state location both sides
share would.

**Adopt when:** a sandboxed `--loop` run stalls on a hand-off, or Claude Code documents a sandbox
marker.

## A Stop hook for `/review-gate` on Codex CLI

On Codex CLI the gate's order rests on the agent sending a round's findings as a message before its
first edit, in one turn: Codex reads no hooks from a skill's frontmatter, so nothing ends the turn
on the block as Claude Code's Stop hooks do. A Codex plugin can bundle hooks in `hooks/hooks.json`,
and a `Stop` hook answering `decision: "block"` makes Codex continue with a new prompt, which would
give Codex the same split; bundled hooks stay skipped until the user reviews and trusts them
([research](docs/research/codex-mid-turn-messages.md#what-this-means-for-review-gate)).

**Adopt when:** a Codex run lands a round's findings and outcomes together, or shortens the
findings block it was meant to send mid-turn.

## `/review-gate`'s snapshots fault under Codex CLI's default sandbox

A run that applies fixes snapshots the working tree into the repository's own object store. Codex's
`workspace-write` sandbox mounts `.git` read-only, so the write fails (`error: unable to create
temporary file: Read-only file system`, reproduced with `codex sandbox` on 0.159.3) and every
`--fix` or `--loop` run faults at `start` unless the user approves each script call to run outside
the sandbox (transcript `eabd43f5-ae03-42c3-95f2-96aea400f144`). The temp directory stays writable
there, so the fix is a fallback: where the repository's store refuses the write, put the objects in
a side directory beside the script's state, reached through `GIT_OBJECT_DIRECTORY` with the
repository's store as its alternate, and prefix the handed diff with
`GIT_ALTERNATE_OBJECT_DIRECTORIES=<side>`. That costs the plain `git diff` on Codex only, and
reverses the ruling that kept a side object directory out of the snapshot's design.

**Adopt when:** a Codex user runs `/review-gate --fix` or `--loop` under the default sandbox.

## A `--1`/`--one` argument for `/grilling`

`/grilling` asks the whole frontier in each round. A `--1`/`--one` argument would ask one question
per message instead, the one whose answer reshapes the most of the tree, so each answer lands before
the next question is framed. The user asked for it at the start of a grilling session (transcript
`270fcb57-9d96-4487-b800-f522f8cbf6f7`). With one question per message, the frontier and the lock
still apply, but the "numbers still open" line has nothing to name.

## `/implement` cannot keep a spec's commit boundaries when the agent may not commit

A spec prescribing four ordered commits was implemented in a repo whose rules forbid the agent to
commit, so the stages piled into one working tree (transcript
`f5731cf6-33e6-412c-b15e-1d7846bcbc64`). The workaround was a tree snapshot per stage through a
throwaway index (`GIT_INDEX_FILE=<tmp> git read-tree HEAD`, `git add -A`, `git write-tree`), which
touches neither the real index nor any ref. `/implement` could record one such tree per prescribed
commit and `/commit` replay them in order.

**Adopt when:** a second spec prescribes more than one commit.

## `/spec` decides in prose while rewriting a published body

Asked after publication to make tag matching case-insensitive, a probed `/spec` rewrote the body in
place and chose on its own that case is ignored only when filtering, saying so in a paragraph rather
than as a numbered question (transcript `0bd2fa27-5f4f-4178-bba7-71f8cbe2d620`). The rewrite runs
with no reread, so nothing turns such a choice into a question. The rewrite could put any decision
the correction did not state to the user in the numbered format.

**Adopt when:** a post-publication rewrite carries a decision the user later reverses.
