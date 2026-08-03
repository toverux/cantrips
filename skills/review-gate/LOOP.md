# Loop mode

Drive the gate to **green** instead of reporting once.
These rules govern the whole run at every level and on every harness: they extend Scope, Find, Verify and Sweep where those run, and they stand in for whatever reporting and closing the level would otherwise have done — Synthesize and report's at `medium` and `high`, the inline pass's at `low`, the Fallback's where the harness has no sub-agents.
Apply mode is on throughout, `--loop` implying `--fix`, including on those two paths where the gate grants it nowhere else.

**Green** is every finding the loop surfaced carrying an explicit disposition — fixed, hardened, no longer present, or user-acknowledged — with the project's checks back where they started.
Dispositions live in this session, so a finding a later pass re-finds already carries one and is not new — except where a batch tried to fix it and it came back anyway, which is the loop's signal that the fix is not taking.
Each disposition reports through the findings tool as one of its outcomes: a fix or a hardening as `fixed`, a finding the tree no longer exhibits as `no_change_needed`, anything you acknowledged, skipped or routed as `skipped`.

## The round

Open with a **certifying pass**: the full gate at the invoked level over the target, its checks run before anything changes so their result stands as the baseline.
An opening pass that finds nothing closes the run there, green on that pass alone.

Then each round: apply the findings worth fixing, most severe first, parking what needs the user; run the project's checks; then review just what the batch changed — a **delta round**, scoped to the batch's own diff plus any file it created.
Pick that round's level by the batch itself, capped at the invoked level: a few lines inside one file earn `low`, a batch spanning several files or touching anything other code depends on earns `medium`, and one you would not want reviewed hunk-only earns the invoked level.
Record the batch's files and hunks as it lands: the working tree holds no fixed point separating them from the feature work around them.
A batch that changed nothing — everything parked, or the batch reverted — has no diff to review, so it skips its delta round and goes straight to the parked set.
Repeat while the rounds keep returning findings or the queue still holds any.

The queue holds every finding surfaced and not yet dispositioned or parked; parking moves a finding out of it, and an answer dispositions it.
A queued finding the tree no longer exhibits leaves it too, dispositioned `no_change_needed` — a neighbouring fix resolving one is why the queue can empty without every finding being applied.
Re-read its location before dropping it: judging from memory of what you just edited is the author-clearing-their-own-work bias the gate runs independent verifiers to route around.
The findings cap sizes one batch and truncates nothing — cap-held findings stay queued and drain into later batches, since they are already found and in session.
Findings arrive verified where the level ran a verify stage and unverified at `low` or on a harness without sub-agents; severity orders a batch either way.

When a delta round comes back clean, the queue is empty and the checks stand at baseline, close: run a second certifying pass first **if any fix reached past what the delta rounds read** — an export's signature or its behaviour, a shared rule, a cross-file pointer — since that interaction is the only thing a second pass buys.
A certifying pass that returns findings has closed nothing: they enter the queue and the rounds resume.
Where every fix both stayed inside the file its finding was reported in and touched nothing another file depends on, the opening pass plus the delta rounds have already read every line that ships, and the report says so rather than claiming a pass that never ran.
Behaviour counts as much as shape: returning `null` where callers expect an empty list breaks them without touching a signature, and that fix reached past what any delta round read.

## What needs you

Park it and finish the round — one open question does not abandon the batch already in flight.
Park a spec finding's route (this is where the gate's ask-before-applying rule lands), a finding whose evidence no fix can resolve, one you judge real but not worth the churn, an action only you can perform, and a fix the checks reverted.
A finding no fix can resolve is escalated once and then rides on its disposition, so the loop never waters down code to silence it.

Present the parked set at the end of the round that filled it, as one numbered list: each item with its finding, its verdict where it has one, its evidence, what the loop already tried, a concrete actionable message, and explicit options.
Then stop and wait — the next round runs on your answers, and a question raised while the work rolls past it is a question missed.
An answer that changes the tree is a batch like any other: it gets the checks and its own delta round before anything closes.
Nothing ends the run before the parked set has been put to you either: a loop that stops holding a question you never saw has failed at the thing this mode is for.

## Checks

Discover the project's checks from its own conventions — the commands its `AGENTS.md`/`CLAUDE.md` states, or the obvious suite runner — and run them over each batch: the cheapest oracle available catches a fix that breaks the tree.
What the opening pass's run reports is the **baseline**; a project with no checks sits at baseline by definition, and a red the loop did not cause blocks nothing.
On a new failure, attribute it before reverting anything: re-run with the likeliest fix backed out, and where that clears it, give that fix one repair attempt and park it reverted if the repair fails.
Where backing it out does not clear the failure, revert the batch and park it as one item — an unattributable failure belongs to the batch, not to a guessed fix.

## Stopping

Three conditions, each checkable, any one of them ending the run:

- a certifying pass surfaces a finding an earlier one surfaced and a batch has since tried to fix — the fix is not taking;
- an item reaches you a second time, a reverted fix counting as the item it answered;
- a fourth round still surfaces findings the loop had not already found, counted whether or not the rounds between came back clean — a streak that resets is one an alternating cycle evades forever, while draining a backlog the cap held back surfaces nothing new and is not churn.

Anything else the loop cannot resolve becomes a question rather than an improvisation: ask, and let the answer decide.

## Reporting

One progress line per round: round number, scope, level, found and fixed counts, checks status.
Naming the level is what keeps a scaled-down round reported rather than silent.
Re-report each finding's outcome as its round lands rather than at the end, so the findings tool stays truthful mid-run.

Close on green with, in order: **green and what carries it** — a certifying pass at its level, or the opening pass plus its delta rounds where no fix reached past them — the checks status or that none ran, and, where any pass in that claim ran no verifier, that its findings went independently unverified; **the round ledger** — rounds and certifying passes run, findings fixed per class, how many the cap held back, whether a spec was available, how many candidates the session settled inline; and **the disposition ledger** — every acknowledged, skipped, or spec-routed finding with its one-line reason, so the trust exceptions stay auditable.

A stop reports the same three, opening on the standing findings and the condition that fired, and closes on concrete options.

Flag `/compound` material either way, and close with a flow pointer (read [flow-pointers.md](../writing-great-skills/flow-pointers.md) for the format): on green `/commit` (user-invoked), since what carries the claim above already served as the re-review; on a stop the standing findings first, then `/review-gate --loop` (user-invoked) over the result.
