# Review-fix looping in upstream skill collections

Research date: 2026-08-03. All sources are primary: the skill files were read as raw file contents
from GitHub (EveryInc/compound-engineering-plugin pinned at
[`4a47a2e`](https://github.com/EveryInc/compound-engineering-plugin/tree/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da),
mattpocock/skills pinned at
[`2ab9580`](https://github.com/mattpocock/skills/tree/2ab958093e83e0ec752e6c1c5932da465bf23e0c));
Claude Code behavior from code.claude.com docs and the anthropics/claude-code CHANGELOG. Anything
not confirmed in those sources is not asserted.

Question: how do upstream skill collections handle review-fix looping — running a code review,
applying fixes, and re-reviewing until clean? For each mechanism: full re-review vs delta scope,
iteration caps, termination conditions, and how the loop escalates to the user.

## Summary

| Source | Pre-PR review→fix | Re-review after fixes? | True loop anywhere? | Caps |
| --- | --- | --- | --- | --- |
| compound-engineering | One round: review once (report-only), apply eligible fixes, defer the rest | Explicitly forbidden unless the diff "changed materially" | Yes — post-PR only, in `ce-babysit-pr` (CI + review comments) | Pipeline: 3 CI fix rounds + ~30-45 min; interactive: 8 h active / 3-day wall clock |
| mattpocock/skills | `/code-review` is report-only; `/implement` runs it once at the end | Never instructed | No | — |
| Claude Code built-in | `/code-review --fix` applies findings once after the review | Not documented | No documented loop | — |

The headline finding: **nobody upstream loops review→fix→re-review until clean before the PR.**
Compound-engineering deliberately architected the opposite — one report-only review round, one
mechanical apply pass, and every unapplied finding routed to a durable sink (tracker ticket, PR
"Known Residuals", or a committed record file) instead of another round. The only genuine
until-clean loop in any source is `ce-babysit-pr`, and it loops on *external* signals (CI results,
incoming reviewer comments) after the PR exists, with explicit budgets and a trajectory-based
non-convergence detector.

## EveryInc/compound-engineering-plugin

### The pre-PR review→fix is one round by design, not a loop

Both orchestrators (`lfg` and `ce-work`) run the same two-step contract: `ce-code-review
mode:agent` is **report-only**, the caller applies fixes. `lfg` step 4 states it plainly:

> `mode:agent` is report-only **by design** — it surfaces findings but never edits the tree; LFG
> applies the eligible ones in step 5. […] A report-only review followed by an LFG-applied fix is
> the intended contract, not a gap.
> ([skills/lfg/SKILL.md#L87](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/lfg/SKILL.md#L87))

Step 5 then loads `references/review-followup.md` and applies findings under a mechanical
eligibility bar — `suggested_fix` present, confidence 100 (or 75 with cross-persona agreement), fix
mechanical, evidence still matching the code — commits `fix(review): apply review findings`, and
moves on
([skills/lfg/references/review-followup.md#L17-L40](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/lfg/references/review-followup.md#L17-L40)).
There is no step that re-invokes the review on the fixed tree; the pipeline goes straight to the
residual handoff (step 6), browser tests, and PR creation.

`ce-work`'s shipping tail is identical in shape ("Review is not fix — two steps",
[skills/ce-work/SKILL.md#L343-L349](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/ce-work/SKILL.md#L343-L349)),
and its apply reference bans the re-review in both directions:

> This reference loads **after** review has run. […] this apply step **consumes that output** — do
> not start a second review, which would waste reviewer dispatches and risk overwriting the
> artifact the Residual Work Gate reconciles.
> ([skills/ce-work/references/review-findings-followup.md#L9](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/ce-work/references/review-findings-followup.md#L9))

> Any actionable finding not applied in this pass is **residual work** — proceed to the Residual
> Work Gate with an updated count. Do not re-invoke `ce-code-review` solely to re-apply the same
> findings unless the diff changed materially after fixes.
> ([review-findings-followup.md#L104](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/ce-work/references/review-findings-followup.md#L104))

The one sanctioned re-review is therefore **delta-gated, not scheduled**: it exists only as an
option inside the interactive Residual Work Gate — "`Apply/fix now` — […] optionally re-run
`ce-code-review` only after the diff changed materially"
([skills/ce-work/references/shipping-workflow.md#L54](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/ce-work/references/shipping-workflow.md#L54)).
When a re-run does happen it is a full review of the current diff — `ce-code-review` has no
"review only these fixes" input; its scope selectors are base refs, PR targets, and the working
tree, never a findings delta.

The *apply* pass does iterate, but over fix batches, not reviews: findings are grouped by file,
dispatched to fix subagents in parallel waves, and "Repeat until all batches complete"
([review-findings-followup.md#L69-L87](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/ce-work/references/review-findings-followup.md#L69-L87)).
Termination is exhaustion of the finding list, not a clean re-review.

### What replaces the loop: durable residual sinks

Instead of re-reviewing until clean, every unapplied actionable finding must land somewhere
durable before the run may declare DONE:

- `lfg` step 6 ("Autonomous residual handoff") files tracker tickets and/or commits
  `<root>/residual-review-findings/<branch-or-head-sha>.md`: "Do not output DONE until the
  residuals are durable"
  ([skills/lfg/SKILL.md#L95-L109](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/lfg/SKILL.md#L95-L109)).
  It "embraces the autopilot contract: residuals must become durable before DONE, but the agent
  never stops to ask" (L97).
- `ce-work`'s Residual Work Gate is the interactive twin: in autonomous sessions it auto-takes
  "Accept and proceed" and records residuals; in interactive sessions it asks the user via the
  blocking-question tool with four options (`Apply/fix now`, `File tickets`, `Accept and proceed`,
  `Stop — do not ship`)
  ([shipping-workflow.md#L41-L59](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/ce-work/references/shipping-workflow.md#L41-L59)).
  This gate is the loop's user-escalation point: the human decides whether unfixed findings mean
  another apply round, a ticket, an accepted risk, or an abort.

One class of finding escalates harder: a review finding that invalidates a `session-settled:`
user decision "stops the pipeline as blocked, with the finding reported"
([skills/lfg/SKILL.md#L85](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/lfg/SKILL.md#L85)).

### Inside ce-code-review: a single pass with bounded internal iteration

The review skill itself never loops on the diff. Its internal repetitions are all single-shot and
capped:

- **Validator pass (Stage 5b):** all selected findings go into "**one** deterministic validator
  batch […] Eight findings is the normal cap. When more than eight P0/P1 survive, expand that same
  batch past the normal cap […] never split the work into another batch"
  ([references/finish-review.md#L45-L53](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/ce-code-review/references/finish-review.md#L45-L53)).
- **Local apply (Stage 5c)** exists only under explicit `apply:local` authority (a bare invocation
  is report-only; the old `mode:autofix` is deprecated and ignored,
  [SKILL.md#L126](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/ce-code-review/SKILL.md#L126)).
  After applying: "run the affected tests and lint […] If they fail, revert that fix and report it
  as a finding instead — an unverified fix is not finished"
  ([finish-review.md#L73](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/ce-code-review/references/finish-review.md#L73)).
  So a failed fix terminates by reverting, never by retrying.
- The only re-review of fixes is **one delta-scoped self-review**: "diff only the changes
  introduced during Stage 5c against the pre-apply checkpoint. Run one self-review pass over that
  diff" — and if that pass edits files, rerun the affected tests once
  ([finish-review.md#L75-L79](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/ce-code-review/references/finish-review.md#L75-L79)).
  This is the closest thing in the whole plugin to "re-review the fixes", and it is explicitly one
  pass over the fix delta, not a re-run of the reviewer roster.

### The one true loop: ce-babysit-pr (post-PR, external signals)

`lfg` step 9 hands the open PR to `ce-babysit-pr mode:pipeline`:

> It runs the bounded pipeline loop: watches CI, repairs real (convergent) failures via `ce-debug
> mode:pipeline` — never weakening, skipping, or mocking an assertion — resolves any review
> comments that arrived via `ce-resolve-pr-feedback mode:pipeline`, and stops when CI is decided or
> its budget (default 3 fix rounds) is hit.
> ([skills/lfg/SKILL.md#L125](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/lfg/SKILL.md#L125))

Loop mechanics (from
[skills/ce-babysit-pr/SKILL.md](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/ce-babysit-pr/SKILL.md)
and
[references/watch-loop.md](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/ce-babysit-pr/references/watch-loop.md)):

- **Per-round scope is delta, tracked on disk.** A deterministic Python helper (`pr-snapshot`)
  diffs PR state per tick and emits an "attention set" — only unresolved threads, unclassified
  comments, and failing checks *not yet acted on*. Handled items are silenced via an explicit
  `mark` (claim→act→confirm protocol); "the snapshot never marks an item handled just from
  observing it" (watch-loop.md#L147). A new head SHA clears the CI dispatch state, so checks are
  re-evaluated in full against each new commit while review-thread state carries over
  (watch-loop.md#L151).
- **Ordering per tick:** terminal check → feedback before CI ("Never wait for a full CI run before
  addressing review comments", SKILL.md#L46) → stale-SHA cancellation (CI failures against a dead
  SHA are skipped, SKILL.md#L144) → CI on the current head → branch currency → re-snapshot.
- **Iteration caps.** Pipeline mode: "a **budget** is hit: default **3 CI fix rounds** per
  head-lineage (mirrors `lfg`'s historical cap) and an overall time cap (~30-45 min). On
  budget-exhaust, the still-red checks and any `needs-human` items become residuals"
  (watch-loop.md#L46). Interactive mode: an 8-hour active-watch-time budget plus a 3-calendar-day
  wall-clock backstop (SKILL.md#L101, #L202).
- **Termination.** Pipeline success requires exact gates: every check terminal and none failing,
  empty actionable backlog, GitHub-reported `CLEAN` merge state, and null blockers — "a
  terminal-but-red check […] is a residual, not a pass" (SKILL.md#L85-L86). Interactive true stops
  are terminal (merged/closed), "looks merge-ready" after a settle window (300 s default, extended
  to 900/1800 s only on evidence of an in-flight review), budget, or user stop (SKILL.md#L192-L202).
- **Convergence over counters.** The round budget is called "a **blunt cost floor**, not a
  convergence detector" (watch-loop.md#L50). The real stop is trajectory-driven: the helper ships
  deterministic facts (`check_recur_max`, `unresolved_trend`, `stream_alternations`,
  `heads_since_progress`) and past thresholds the loop must pass them to the leaf skill, which
  either "demonstrate[s] progress (name the invariant the next bounded fix resolves) or return[s]
  a `needs-human` that **parks the whole stream**" (watch-loop.md#L57). The anti-cry-wolf line:
  "*progressive failure migration* — A fixed → B appears once → B fixed → done — is ordinary
  repair; **do not park.** *Oscillation* […] is non-convergence; park. 'We've tried a lot' is never
  enough" (watch-loop.md#L59).
- **User escalation mid-loop is park-and-continue, never block.** "An item that needs a human
  decision […] is **parked and surfaced as a standing residual**: it blocks *declaring*
  merge-ready, but it does **not** end the watch. […] Ending the whole loop the moment one item
  needs a human is the primary failure mode of this skill" (SKILL.md#L20). In pipeline mode the
  delegates "never ask the user anything" (SKILL.md#L84); `needs-human` items come back as
  structured residuals, posted as `decision_context` on the open review thread (the thread is the
  ledger) or one run-report PR comment for items with no thread home (SKILL.md#L86). A parked
  thread auto-reopens when a human answers it (watch-loop.md#L149).

`ce-resolve-pr-feedback`, the loop's review-fix leaf, carries the same contract: "**Escalations
never block.** `needs-human` is the escalation channel: the thread is left open with a natural
reply […] the skill never pauses mid-run to ask. This is what lets an autonomous caller […] invoke
this skill in a loop"
([skills/ce-resolve-pr-feedback/SKILL.md#L12](https://github.com/EveryInc/compound-engineering-plugin/blob/4a47a2e0ae06aec412b8b242f3fc4d7ace9bf7da/skills/ce-resolve-pr-feedback/SKILL.md#L12)).
Its non-convergence duty (L14): on a passed trajectory, detect a wrong-approach nit cluster and
"raise **one** approach-level `needs-human` about the root decision […] and stop fixing the
individual instances, rather than dutifully fixing nit after nit."

## mattpocock/skills: no looping mechanism exists

Absence is the finding here. The full active roster (engineering, productivity, in-progress, misc,
personal) was listed; nothing wraps `code-review` in a loop.

- `code-review` is a pure report: it pins a fixed point, spawns two parallel sub-agents (Standards
  vs Spec axes), and aggregates their two reports side by side. No fix step, no re-run, no
  iteration, no cap — the process ends at "Aggregate"
  ([skills/engineering/code-review/SKILL.md#L15-L80](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/code-review/SKILL.md#L15-L80)).
  Its only escalations are up-front inputs: ask for the fixed point if unspecified, ask where the
  spec is if none is found.
- `implement` — the only skill that chains into review — is 15 lines and runs it exactly once,
  after the work: "Once done, use /code-review to review the work. Commit your work to the current
  branch." No instruction to apply the findings, let alone re-review
  ([skills/engineering/implement/SKILL.md#L13-L15](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/implement/SKILL.md#L13-L15)).
- `tdd` points refactoring *at* the review stage rather than looping it: "Refactoring is not part
  of the loop. It belongs to the review stage (see the `code-review` skill)"
  ([skills/engineering/tdd/SKILL.md#L36](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/tdd/SKILL.md#L36)).
- The in-progress `loop-me` skill is unrelated despite the name (it grills the user about
  recurring life/workflow specs, not code review).

## Claude Code built-in /code-review: apply-once, no documented loop

Documented behavior
([code.claude.com/docs/en/commands](https://code.claude.com/docs/en/commands),
[code.claude.com/docs/en/ultrareview](https://code.claude.com/docs/en/ultrareview),
[anthropics/claude-code CHANGELOG.md](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)):

- `/code-review [low|medium|high|xhigh|max|ultra] [--fix] [--comment] [target]` — "Pass `--fix` to
  apply findings." Since v2.1.152, "`/code-review --fix` now applies review findings to your
  working tree after the review" (CHANGELOG). That is a single review → single apply; no
  documentation describes re-running the review on the fixed tree, an iteration count, or a
  loop-until-clean mode.
- `/review <pr>` is "a fast single-pass review" (CHANGELOG v2.1.202) — single-pass is the
  documented design.
- `/code-review ultra` (ultrareview) runs a remote multi-agent fleet whose findings are
  independently *verified* before reporting, but fixing is handed back to the session: "Each
  finding includes the file location and an explanation of the issue so you can ask Claude to fix
  it directly" (ultrareview docs). No re-review of the fixes is documented; the docs' comparison
  table frames local `/code-review` as "quick feedback while iterating" — the human drives any
  iteration.
- Since v2.1.215, "Claude no longer runs the `/verify` and `/code-review` skills on its own"
  (CHANGELOG) — the harness moved *away* from autonomous review invocation, the opposite direction
  from an autonomous review-fix loop.

## Cross-cutting patterns

1. **One round + durable residuals beats loop-until-clean.** The most mature source
   (compound-engineering) had every ingredient for an until-clean loop and chose not to build one
   pre-PR: review once, apply the mechanically safe subset, and make everything else durable
   (tickets, PR Known Residuals, a committed record file). Re-review is allowed only "after the
   diff changed materially" — a delta condition on the tree, not a round counter.
2. **Where a real loop exists, it loops on external events, not on the reviewer's own output.**
   `ce-babysit-pr` re-enters because CI re-ran or a human/bot posted — fresh signal each round —
   and its per-round scope is the tracked delta (attention set), with CI re-evaluated in full per
   new head.
3. **Caps are cost floors; convergence judgment is the real terminator.** Numeric caps exist
   (3 fix rounds, ~30-45 min pipeline, 8 h/3 d interactive) but are explicitly labeled blunt
   backstops; the preferred stop is a reasoning step that distinguishes progressive failure
   migration from oscillation/treadmill and parks the stream with a `needs-human`.
4. **Escalation is asynchronous and non-blocking in loops, blocking at gates.** Inside autonomous
   loops, questions become parked residuals with decision context left where the human will see it
   (the review thread, one PR comment); the loop keeps working other streams. In interactive
   pre-PR flows, escalation is a single blocking gate (Residual Work Gate) with enumerated options.
5. **Review authority and apply authority are always separated.** Report-only review + caller-owned
   apply (compound-engineering's `mode:agent`, deprecated `mode:autofix`; Claude Code's opt-in
   `--fix`; mattpocock's fix-free review). No source lets the reviewer loop on its own edits.

## Open questions

- `ce-babysit-pr`'s interactive watch has the 8-hour/3-day budgets but no documented cap on
  *review-fix rounds* (the 3-round cap is pipeline-mode CI only); whether an interactive watch
  facing an endlessly nit-picking human reviewer terminates on anything but the time budget or the
  trajectory park is not stated in the files read.
- The "diff changed materially" threshold for the one sanctioned pre-PR re-review is undefined —
  it is left entirely to agent judgment; no reference file quantifies it.
- Claude Code's `--fix` internals (whether the apply pass verifies with tests, and whether any
  bounded self-check follows) are not publicly documented; only the changelog one-liners and the
  commands reference describe it. The built-in skills' prompt text is not published in the
  anthropics/claude-code repo.
