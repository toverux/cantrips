# IDEAS

Analyzed during the design of the loop and deliberately deferred. Most of these earn their keep at
team scale or on big, long-running projects; cantrips targets a solo workflow. An entry may note
when it becomes worth adopting, naming the step or line its concern sits in so a diff settles
whether an edit fired it; an edit that fires such a trigger adopts the entry or re-defers it under
a new one in the same change.

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

**Adopt when:** the next edit to a skill's trigger phrases lands, or the next `/review-gate` edit
for the gate lock, which needs wording that survives hook pressure.

## /compound-refresh's judgment rules guard only the audit that never runs here

The judgment rules — the restored "Unverifiable is not false" prohibition included — sit
under `## Audit docs/solutions/`, while `## Audit AGENTS.md` is a sibling heading none of them
reach. In a repo whose solutions store is off (this one), every run takes only the AGENTS.md
audit, whose Bloat lens proposes deletions with no guard above them — so a
true but uncorroborated claim can still be stripped, the outcome the restoration exists to
prevent. The fix is hoisting the store-neutral rules above both audits; it restructures a body the
fork-divergence spec kept out of bounds, which is why it waits here.

**Adopt when:** the next edit to `/compound-refresh`'s audit sections lands, or a run strips a true
AGENTS.md line.

## The redaction discipline lives in one skill

Upstream's `## Redact` section landed in `/diagnosing-bugs` at v1.2.3: every secret redacted before
a command, output, or captured artifact is shown, loops built against env vars. The concern is not
diagnosis-specific — `/commit` prints `git status` and diff output, `/review-gate` hands whole
diffs and untracked files to dispatched finders, and `/handoff` carries only its own one-line
variant ("Redact any sensitive information") — so the plugin now holds two divergent redaction
rules in two skills and none elsewhere. The section is carried upstream bytes and stays
byte-identical where it is; the honest home for a plugin-wide rule is a shared reference the other
skills point at, reconciling the two wordings on the way.

**Adopt when:** the next edit touching `/commit`'s context-gathering step or `/handoff` lands, or a
secret reaches a gate dispatch.

## /setup-cantrips-loop sets up model-tier preferences

Each dispatched role pins its model as an alias in its definition's frontmatter: mid-tier on the
three mechanical lens finders, most capable on the arbiter and the deputy. The general-purpose
dispatches that stay tiered, such as `/spec`'s rereader, name the tier abstractly and fall back to
the parent model wherever the harness exposes no selector, so which model that tier means is left to
each run. The setup interview could ask once and record the answer in the loop config: the model
each tier maps to on the user's harness, or that a tier is off, for tiering skills to read beside
the storage verbs.

## The arbiter's read-only pin is prose, and prose leaks

Every dispatched role keeps the full tool set, so "edit nothing" is a sentence of the arbiter's,
the finders' and the deputy's definitions rather than a tool restriction, and a tool denylist would
not stop a write through Bash anyway. The pin leaks (session
`c8610db9-8641-4448-a2b8-7393fb1a56cc`): an arbiter briefed "Read-only: do not edit any file"
edited a tracked source file to settle a `tsc` question, then restored it. A verifier whose brief
named a scratch copy ran the same measurement in `/tmp`.

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

## The deputy's closing weighs no active `/goal`

A `--loop` run with standing orders "Unlimited rounds. Drive to green" under a `/goal` stopped on
`fourth_novel_round`, and the deputy closed it on the arbiter's "certifying pass spent"; the
`/goal` hook then forced a `start`, whose certifying pass found a correctness bug in code round 1
had covered, and the next delta round its follow-up race (transcript
`bef994d4-be89-4e6f-9887-7638ca1ab771`). `--fsd` now lifts the novelty stop; the deputy's
closing could still weigh an active `/goal`, which is neither a plugin skill nor a user skill here.

**Adopt when:** a run closes under an active `/goal` again.

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

It happens inside one round too (transcript `b9f2fca5-1192-476b-8041-f43826d39919`, round 9).
Verifier verdicts sent as follow-ups while the arbiter was still ruling each resumed it, and each
reply re-ruled every finding of the round. The second of three replies reversed four of the
first's rulings, though the only evidence between them bore on a fifth finding. One reversal
declined a narrower retry catch on a doubt about the game's exception mapping, a doubt the first
reply had settled with a cited line. ARBITER.md says neither which reply stands nor that a
follow-up re-rules only the findings it carries; the session kept the last ruling per index, which
`report`'s one-ruling-per-index check forces anyway. Holding the verdicts for one message once
every verifier returns, or briefing that a follow-up re-rules only the indices it names, would
close it.

**Adopt when:** the arbiter reverses a ruling with no new evidence again; round 9's run above has
fired it.

## Checking a decline's premise no evidence covers

The arbiter lists the facts each ruling rests on, and the run holds them against the evidence it
already has; a fact no verdict covers stands unchecked, since every disproved premise recorded so
far had been measured by the finding's own verifier (transcripts
`c37f6e53-4a06-42b1-8d91-f44288a3c916`, `d5213dad-05ef-46ff-80eb-a116a8e4c535`). The gate could
dispatch a verifier for a decline's uncovered premise, at the cost of a dispatch per such decline. A fix
ruling's premise goes unchecked the same way: one replaced a comment with an `<inheritdoc>` of a
member whose note is a `//` comment, which `<inheritdoc>` does not carry, and only the applying
session caught it (transcript `b6281e1d-cfef-4c62-848f-3c9d1cc36902`). Under `--loop` it compounds
when no reading can settle the premise: three delta rounds refused, built, then refused again a
value on what a debuggee would accept in which slot, until a verifier measured it by experiment
(transcript `180476e2-6357-4a30-b6c1-7ecd92f3fed9`); the first ruling resting on such a premise
could get that experiment. A premise the ruling never lists escapes even the re-send rule: three
rulings in one run rested on one a live probe then contradicted, and the regression one of them
declined stood until the user overruled it (transcript `be48e9ab-2360-4cea-b7e5-011c63ad5edd`).

**Adopt when:** a false premise under a decline survives because no verdict covered it.

## A finder's `spec` label parks findings no spec route fits

The category is the finder's, so a missing test assertion and slips in the wording of the run's own
spec annotation, labelled `spec`, were parked for the user with align-or-annotate routes that did
not apply; the agent wrote stand-in options instead (transcript
`c37f6e53-4a06-42b1-8d91-f44288a3c916`, five findings). Verification could reclassify a candidate
whose evidence quotes no spec requirement, or the script could park only `spec` findings anchored
to one.

**Adopt when:** a run parks a `spec` finding whose options are not the two routes again.

## A merge across categories is verified under one

Finders raised one defect as `spec` (Angle D) and as `correctness` (Angles A and C). Merged, it
went to the spec verifier, which refuted it because the code matched the spec's wording; a fresh
verifier judging it as correctness confirmed it (transcript
`72284c61-7ff3-4a44-8ec2-d1aefc771e0e`). Verify could judge a cross-category merge under each of
its categories and keep the strongest verdict.

**Adopt when:** another merged candidate's categories would split its verdict.

## A tripped `/review-gate` stop prints below everything else

Under `--loop` the line that announces a stop closes the agent section, after the warnings and
above a ledger that ran to 58 KB. An agent that trimmed the section to its first lines applied two
batches past a tripped `fourth_novel_round` without seeing it (transcript
`5678f667-f07c-4826-b158-8e10551a2d4f`). The script could print a stop first.

**Adopt when:** a run works past a stop it did not see again.

## The arbiter's round message numbers findings two ways

ARBITER.md asks each round's message for the previous round's verdicts and outcomes, one line per
finding, and names no numbering: the arbiter rules under its own indices, the script reports under
its ranked `F` IDs, and the two diverge as soon as `report` reranks. A session that wrote the
previous-round line under `F` IDs had the arbiter read them as its indices and spend its
trajectory warning that a correct ledger was inverted (transcript
`a5d3ab6a-1141-4fa6-899e-201b2e389791`). The clause could name the arbiter's indices as the
numbering of every line the message carries.

**Adopt when:** another arbiter reply disputes an outcome ledger that is correct.

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

## `/review-gate --loop` sees one repository of a cross-repo target

The script keys its state and its snapshots on the worktree it is called from. On a target spanning
two repositories, the delta round's diff held the first one only, a batch that touched only the
second was answered with "the batch changed nothing the tree shows" and went unreviewed, and
`outcomes` called from the second faulted with "no run in this session and worktree" (transcript
`f89d8dff-1caa-41a7-86c8-5a3f0671ea05`). `start` could take the target's repositories and snapshot
each, or refuse a target that names more than one.

A target in a repository other than the session's directory loses the Stop hooks too: the hook
moves into the hook input's `cwd` (`findings.ts` `resumeHook`) and keys the hand-off on that
worktree, so it never finds the target repo's run, and the user typed "continue" after every block,
while `resume` called from the session's directory answered "nothing handed over: no step is
pending" rather than "no run" (transcript `acf285ac-7061-46c2-9815-e118a4157d14`). The hook could
look up every run of the session, whatever worktree it is keyed on.

**Adopt when:** a second cross-repo run leaves a batch unreviewed.

## A `--1`/`--one` argument for `/grilling`

`/grilling` asks the whole frontier in each round. A `--1`/`--one` argument would ask one question
per message instead, the one whose answer reshapes the most of the tree, so each answer lands before
the next question is framed. The user asked for it at the start of a grilling session (transcript
`270fcb57-9d96-4487-b800-f522f8cbf6f7`). With one question per message, the frontier and the lock
still apply, but the "numbers still open" line has nothing to name.

## `/grilling`'s recommended answer carries the agent's bias, not the user's

`/grilling` gives every question a recommended answer and says nothing about how to pick it. In
use, the recommendation often merges the options ("A, and a little bit of B") instead of choosing
one, and where it does choose, it weighs cost and scope the agent's way: the cheaper, narrower
option gets recommended even when the user's standing instruction is to recommend the option with
the best outcome and state its cost and scope as facts beside it (reported from use in transcript
`0f7ff5f9-1e01-4ce0-ad75-4066be791109`). The skill could ask for one option per recommendation,
the others' cost and scope stated as facts next to it, and let the user name the bias to recommend
on, so an answer that reads "A" is A and not the agent's compromise.

**Adopt when:** another grilling round recommends a merge of its options, or the user overrides a
recommendation on cost grounds.

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

## Apply mode skips a correctness fix no red case can reach

A correctness fix lands only once its case goes red, so a fix to engine-bound code with no
off-engine test is `skipped` even when the arbiter rules it worth fixing: a two-line read-once guard
waited for the user to re-queue it (transcript `d5213dad-05ef-46ff-80eb-a116a8e4c535`). The skip
could park the finding with the arbiter's ruling and the missing case as options instead.

It recurred on a broken user rule: `process.exit()` after a stdout write truncates nothing below
64 KiB, so no case went red and the run closed green with the rule still broken. Re-raising it as a
`conventions` candidate `same_as` the skipped finding, ruled `fix`, left it skipped, and `answers`
refused it (`F2 is not waiting on an answer`) (transcript `9f48eefc-4716-4be5-b628-b49447244957`).
A finding quoting a broken rule could apply as conventions, with no red case.

**Adopt when:** a third fix is skipped this way.

## `/review-gate` narrates its own mechanics

SKILL.md keeps the agent's prose to what the pasted blocks and the screen lack, yet every
background-agent notification resumes the agent, and it answers each with a status line: which
finders returned, what a verifier found, who is still running. The user asked for only the most
important information to surface (transcript `b436114f-763c-45bc-9bd8-f4982f710aa1`). The skill
could say what a notification turn writes when it carries no question and no pasted block: nothing.

A second run drew it (transcript `42ae81c1-1c3e-4f05-a365-efd76db5e406`): the agent answered each
finder's return with a count and each verifier's with a verdict table, and the user asked for no
table at each round, only the verifying, with the output during a round settled once for all
sessions rather than improvised by each. The rule belongs in SKILL.md (or as a fixed line the
script prints), covering every turn between two pasted blocks: finders returning, verdicts
arriving, the arbiter's reply, a re-send.

**Adopt when:** fired by the second run above; adopt at the next edit to SKILL.md's report section.

## A spec's decisions reach `/compound` only where something flags them

A `--loop` run routed a spec finding to the annotate route, and SKILL.md says to "flag it for
`/compound` at loop end", but neither `outcomes` nor the closing block carries the flag, so it
lived only in the agent's memory and was lost; `/commit`'s first scan then offered two gotchas and
missed the medal-ladder decision the spec's dated comment recorded, which the user had to ask
after (transcript `67e62cb7-f0a5-44a1-ba5f-153678e67d1c`). The closing block now lists each spec
finding routed to annotate as `/compound` material, with its `revision`; `/commit`'s scan could
still name the spec's dated comments as a source of ADR candidates.

The same blind spot hides a feature's own decision. The agents-first-roles spec listed in its
Records only the standing ADRs it revised, so `/commit`'s scan took that list as the whole and wrote
no record of the choice the spec itself settled, dispatched roles as plugin agents over four live
alternatives, until the user asked (transcript `4277a26b-0589-43df-820a-7e158f7b9716`). `/spec`'s
step 2 asks about every standing ADR a feature touches but never whether the feature makes a
decision worth a record of its own; its Records could name the new ADR the feature earns, and the
scan could read the spec's Implementation Decisions for one.

**Adopt when:** the next edit to what `/commit`'s scan reads or `/spec`'s step 2, or another spec
decision goes unrecorded; the closing-block half is adopted, so an edit there fires nothing here.

## A parked row still reads as a question after a deputy answered it

Under `/deputy`, a `/review-gate --loop` run sends a parked spec finding's route to the deputy, and
its reply reaches `answers` only at the next round boundary. Until then, every block the findings
script prints shows the finding as parked under "❓ Options", so the user, back at the screen,
reads a question the deputy already answered and asks why it went unanswered (transcript
`0b9eb4f8-9742-4008-8df3-6a1b68fdf0bf`). The parked row could show that a reply is queued, or
LOOP.md could hand `answers` a deputy's reply as soon as it lands.

**Adopt when:** another deputy run draws the same question; the `--fsd` change re-rendered
the parked row for a `kind` of its own and left this one standing.

## A delta round over a small diff dispatches every agent afresh

LOOP.md's delta round runs the gate at the level its diff earns, and Find and Verify dispatch new
finders and verifiers each time, so each one rereads the standards sources and the files around
the diff before it reaches the few lines that changed. In transcript
`418d6400-586d-4a4f-8ca9-9035f2843e98`, a 53-line fix batch over four files earned `medium` and
paid for nine fresh finders and a verifier, which raised three one-line findings. For a simple
diff, the gate could resume the round's finders and verifiers with a follow-up message carrying
the new diff and the ledger, as the arbiter is already resumed each round. That brief would have to
say that a callback deserves the same skepticism as the first message: the agent must not trust
its earlier reading of a file the batch changed, nor defend a verdict it gave before. A level, or
a size the diff stays under, would mark where reuse stops paying.

**Adopt when:** a delta round at `medium` or above pays for fresh finders over a batch of comments
or one expression.

## `/review-gate` needs a git repository, and its snapshots follow the global gitignore

`findings.ts start` runs `git rev-parse --git-path index` and faults outside a repository, so a
target that lives in no repo (a skill folder under `~/.claude/skills/`) cannot be reviewed in place
(transcript `1395deb9-2a1f-4d28-9964-a90a55d6892f`, where the run went through a copy in a
throwaway repo). Inside one, the script's tree snapshots list untracked files through the standard
excludes, so a target file the user's global gitignore matches (`templates/CLAUDE.local.md`, with
`CLAUDE.local.md` in `~/.gitignore-global`) never enters a snapshot, and a delta round's diff
silently drops that file; only `core.excludesFile /dev/null` on the repo brought it back. The
same run never saw the Stop hook that resumes the gate after a pasted block fire, and the user
typed "next" after every block, as the hook keys on the session's directory rather than the
throwaway repo (see the cross-repo entry). The script could snapshot with the repo's own excludes
only, or warn when a target file the standard excludes hide is passed to it, and `start` could
fall back to a snapshot of the target's files where there is no repository.

**Adopt when:** the next edit to `findings.ts`'s snapshot.

## The built-in `/simplify` shadows the plugin's

Claude Code ships its own `/simplify`, so a bare `/simplify` runs the built-in rather than
`/cantrips:simplify`: four cleanup agents of the session's choosing, without the plugin's
preservation contract, one of them on an altitude angle no plugin finder advertises (transcript
`dec309ed-2ad1-4719-9030-3a309b8fe520`, where the user typed the bare name meaning the plugin's,
and the session improvised a general-purpose agent for altitude). The README, `/implement`'s
closing and the docs name the skill `/simplify`; only `flow-pointers.md` writes
`/cantrips:simplify`. Every user-facing mention could take the scoped name, or the skill a name the
harness doesn't own.

**Adopt when:** the next edit to `/simplify`'s frontmatter or to a closing that names it.

## A delta round's diff carries a rebase made during the run

A run that applies fixes diffs each batch against the tree `start` snapshotted. Where the branch
moves under the run, as in a rebase the user asks for while the finders work, the first delta
round's `git diff` carries the commits the rebase brought in as well as the batch (transcript
`42ae81c1-1c3e-4f05-a365-efd76db5e406`: 37 files of the base's commits around a 3-line batch).
`report` already warns that the tree moved; it could re-snapshot there, so the next delta starts
from the tree the round reviewed.

**Adopt when:** the next edit to `findings.ts`'s snapshot, or a second delta round carrying a base
move.

## A crash wipes a run's state under `/tmp`

`findings.ts` keeps a run's state under `/tmp/cantrips-<uid>/review-gate/`, which a reboot clears.
Twice in one run a machine crash lost it (transcript `1673c114-ee77-4ed0-9e59-84fd97b01a86`): each
time the session restarted the run and refiled round 1's report from its own context, and the
restarted `start` snapshotted a tree that already held the applied batch, so the delta round saw no
diff and the batch was re-reviewed inline, unverified. State kept somewhere a reboot leaves, such as
the user's cache directory, would let `resume` pick the run up.

**Adopt when:** the next edit to where `findings.ts` writes its state, or a second run lost to a
reboot.

## Agent descriptions repeat their summoning guard

Every agent file's `description` sits in the agent-type listing of every session and subagent, and
13 of them carry the same "Only the user summons it, through /review-gate or by naming it…"
sentence: the 17 entries cost about 1,000 tokens each time, a cost /review-gate's fan-out pays once
per spawned finder (Token Optimizer audit, transcript `39d0e12c-5c7a-4b9d-a982-8f65fcf87b39`).
`finder:low` and `finder:sweep` already carry the guard in one clause ("Not for direct use; it
expects the message the gate composes"); that form on the rest could save about half. The sentence
exists to keep the model from spawning these agents on its own, so a shortened guard needs a check
that it still holds.

**Adopt when:** the next edit to an agent file's frontmatter under `agents/`.

## Unused skills stay model-invocable

`prototype` and `resolving-merge-conflicts` had no invocation in 60 days of transcripts (Token
Optimizer audit, transcript `39d0e12c-5c7a-4b9d-a982-8f65fcf87b39`), yet their descriptions sit in
every session's skill listing. `disable-model-invocation: true` would drop them from the listing
and leave `/prototype` and `/resolving-merge-conflicts` in place; the cost is that a merge conflict
mid-rebase no longer pulls the skill in on its own.

**Adopt when:** the next edit to either skill's frontmatter, or a session where one of them fires
on its own.

## Finders and verifiers experiment in the live working tree

In an apply-mode `/review-gate` run, a finder built its repro inside the target repo: it wrote
scratch stylesheets and edited a tracked source file, then reverted them, while another finder read
the tree mid-edit (transcript `bf2f47ce-2f5b-43ab-bec3-d33ad898d46b`). A reviewer that does this can
report on code that is not the diff, and in apply mode a stray edit can ride into a fix batch.
Briefs saying "experiment in a scratch copy only" kept later rounds clean, so the finder and
verifier definitions under `agents/` could carry the rule themselves: any experiment runs in a
scratch copy (`git checkout-index -a --prefix=<tmp>/`), never in the target tree.

**Adopt when:** the next edit to a finder or verifier definition under `agents/`, or a second run
where a reviewer's experiment lands in the target tree.

## An advisor-mode round shows two answers where one is wanted

In a `/grilling` run with the deputy in advisor mode, every round printed the session's own
recommendation under the question and the deputy's line under that, and the two departed in three
rounds of ten, so each answer had to be disambiguated by hand (transcript
`4be318a5-1877-4a89-9434-a539c612f6dd`). The user's direction: the session still sends its
recommendation to the deputy, since the round reaches the deputy as the skill would have put it to
the user, but renders only the deputy's reply as the round's answer, and never its own. One answer
on screen also makes a bare "agree" unambiguous. The change sits in ROUNDS.md's advisor-mode
paragraph, which today prints the deputy's line verbatim under the question's recommendation.

**Adopt when:** the next edit to ROUNDS.md's advisor-mode paragraph, or the next advisor-mode run
where the two answers differ.
