# Loop mode

Drive the gate to **green** instead of reporting once.
These rules govern the whole run at every level and on every harness: they leave Scope, Find, Verify and Sweep as they are where those run, and stand in for the reporting and closing the level would otherwise have done — Synthesize and report's at `medium` and `high`, the inline pass's at `low`, the Fallback's unverified-review note where the harness has no sub-agents, and the Close section's on every path.
How a finding is judged, shaped and channelled still comes from the section the level would have run; every path writes its fixes under Synthesize and report's apply mode, inside the run's mutation boundary, which a delta round's narrower scope never narrows.

**Green** is a certifying pass over the whole target that surfaces nothing new, with the project's checks back at their baseline.
Every finding the loop acted on carries one disposition, reported as it lands, through the findings tool where the harness offers one: `fixed` for a fix or a hardening, `no_change_needed` where the tree no longer exhibits it, `skipped` for anything you acknowledged, declined or routed.

## The loop

```python
def loop(target, level):
  baseline = checks()
  queue, parked = [], []
  while True:                                        # one round
    if not queue:
      found = gate(target, level)                    # certifying pass
      if refound := refound_fixed(found): return f"STOP: fix_not_taking — {refound}"
      queue = new(found)
      if not queue and not new_failures(baseline): return "GREEN: certifying pass surfaced nothing new, checks at baseline"
    record = apply_batch(take(queue), parked)        # next batch in rank order; parks what needs you
    if new_failures(baseline): record = keep_baseline(record, parked)
    if record:
      queue += new(gate(diff(record), delta_level(record, level)))   # delta round
    if stop := asked_twice(parked) or fourth_novel_round(): return f"STOP: {stop}"
    if parked: queue += answers(present(parked)); parked = []
```

- `checks()` — the project's own checks (the commands its `AGENTS.md`/`CLAUDE.md` names, or the obvious suite runner); the opening run is the **baseline**, `new_failures` is what a rerun adds to it, and a project with no checks sits at baseline by definition.
- `gate` — the full gate at that level: a **certifying pass** over the run's target as the tree now stands, a **delta round** over one batch's diff, handed to Scope as the target; the level's cap sizes `take`'s batch, and the gate hands over everything it found, whatever cap its level's report would apply.
- `new(found)` — what is neither queued, parked, nor `skipped` by you; a finding the loop already dispositioned that comes back is queued for one retry, then parked for you — except the `fixed` one a certifying pass brings back, which stopped the run above.
- `apply_batch` — each finding's fix under apply mode, or the edit you made yourself where that was your answer, its disposition `fixed`; the **record** is the batch's edits, files and hunks, since no fixed point separates them from the feature work around them, and `diff(record)` adds any file the batch created.
- `keep_baseline` — back out the edit likeliest behind the red, yours included; where that clears the checks, repair it once, parking it backed out where the checks still fail; where it does not, revert the batch and park it for you as one item, a red that survives the revert, or that no edit explains, parked with it; a backed-out or reverted edit leaves the record and loses its disposition, a repaired one is `fixed`.
- `delta_level` — the highest level the batch earns, capped at the invoked one: a few lines inside one file earn `low`, several files or anything other code depends on earn `medium`, one nobody would want reviewed hunk-only earns the invoked level.

## What needs you

Unless your answer re-queued it, `apply_batch` parks a spec finding's route (the gate's ask-before-applying rule lands here), a finding no fix can resolve, one whose only fix reaches outside the mutation boundary, one the loop judges real but not worth the churn, an action only you can perform, and anything else the loop cannot resolve — a question beats an improvisation, and a finding is never silenced by weakening what surfaces it.
`present` is one numbered list: each item with its finding, its verdict where it has one, its evidence, what the loop tried, the question asked, and explicit options — a reverted batch as one item, an edit of yours named as yours.
`answers` stops the run until you reply, then re-queues what you asked fixed or fixed yourself, your answer widening the mutation boundary where the fix needs it; what you declined is `skipped`, a declined red joining the baseline.

## Stopping

Three conditions, each ending the run on a `STOP:` line naming it and what tripped it:

- `fix_not_taking` — a certifying pass surfaced a finding dispositioned `fixed`.
- `asked_twice` — a finding is about to reach you a second time, a reverted fix counting as the finding it answered.
- `fourth_novel_round` — four gate calls past the first surfaced a finding none before had, counted over the whole run since a count that resets is one an alternating cycle evades; draining what the cap held back surfaces nothing new and is not churn, and a run stopped here relaunches with a fresh count.

## Reporting

One progress line per gate call: round number, scope, level, found, novel and fixed counts, checks status.
The closing report opens on the line the procedure returned, verbatim, then what qualifies it — checks status, or that the project has none, and whether any pass ran unverified — then **the round ledger** (passes and rounds run, findings fixed per class, inline-settled count, spec available or not) and **the disposition ledger** (every skipped or spec-routed finding with its one-line reason).
A stop adds its standing findings, the parked set included, each with concrete options.
Flag `/compound` material either way, and close with a flow pointer (read [flow-pointers.md](../writing-for-agents/flow-pointers.md) for the format): on green `/commit` (user-invoked) — the certifying pass already served as the re-review; on a stop `/review-gate --loop` (user-invoked) once the standing findings are settled — nothing has reviewed the fixes since.
