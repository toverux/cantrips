# Loop mode

Drive the gate to **green** instead of reporting once: certify the whole target, then apply the findings in batches and re-review each batch, until nothing is left to fix or re-review with the project's checks at their baseline and nothing parked for the user.
These rules govern the whole run at every level: they leave Scope, Find, Verify and Sweep as they are where those run, save what a gate call below adds to a finder's brief, and stand in for the reporting and closing the level would otherwise have done — Synthesize and report's at `medium` and `high`, the inline pass's at `low`, and the Close section's on every path.
How a finding is judged, shaped and channelled still comes from the section the level would have run; every path writes its fixes under Synthesize and report's apply mode, inside the run's mutation boundary, which a delta round's narrower scope never narrows.

## The run

The script paces the run: after each call, do what its `next:` and `then:` lines say, printed or handed over at the turn end — the batch to apply, the delta round or certifying pass to run, the close — and take every judgement they leave from here.

- **Checks** — the project's own checks (the commands its `AGENTS.md`/`CLAUDE.md` names, or the obvious suite runner), run once before the first gate call as the **baseline**; each `report` says whether a rerun adds to it, a red parked for the user excepted, or that the project has none.
- **Gate calls** — a **certifying pass** is the full gate over the run's target as the tree now stands; a **delta round** is the gate over one batch's diff, handed to Scope as the target, at the highest level the batch earns, capped at the invoked one: a few lines inside one file earn `low`, several files or anything other code depends on earn `medium`, one nobody would want reviewed hunk-only earns the invoked level.
  Either hands `report` everything it found, whatever cap its level's report would apply, and each finder's brief — the inline pass itself, where the level dispatches no finder — carries the ledger block the script prints before it.
- **Re-finds** — tag each candidate that matches a finding the run already holds `same_as` that finding: the script retries it, parks it, or stops the run on it by those tags alone.
- **A batch** — each finding's fix under apply mode, or the edit the user made where that was their answer; the batch's **record** is its edits, files and hunks, since no fixed point separates them from the feature work around them, plus any file it created, and a delta round's diff is the record's.
- **A red batch** — where the checks come back with new failures, back out the edit likeliest behind the red, the user's included; where that clears the checks, repair it once, parking it backed out where the checks still fail; where it does not, revert the batch and park it as one item under the finding it answered, `with` the rest, a red that survives the revert, or that no edit explains, parked with it; a backed-out or reverted edit loses its outcome, a repaired one is `fixed`.

## What needs the user

Unless the user's answer re-queued it, park a spec finding's route, a finding no fix can resolve, one whose only fix reaches outside the mutation boundary, one the loop judges real but not worth the churn where no arbiter ruled on it, an action only the user can perform, and anything else the loop cannot resolve — a question beats an improvisation, and a finding is never silenced by weakening what surfaces it.
Park each through `outcomes` as it lands, with its options and what the loop tried, and keep working: the loop never waits on the user.
At the next round boundary, hand `answers` whatever the user replied since: it re-queues what they asked fixed or fixed themselves, their answer widening the mutation boundary where the fix needs it, and skips what they declined, a declined red joining the baseline.

## Ending

Once the run has ended, ask again in your next message about any item a reply left unanswered, and push back on closing or `/commit` while any is open.
Flag `/compound` material after the closing block, and close with a flow pointer (the message's final paragraph, a blockquote in full italics opening `Next:` — or `Next steps:` over one bullet per pointer — each pointer naming its skill the way this skill was itself invoked, same prefix and namespace, and ending in a one-clause rationale after an em dash), a **choice** on how the run ended: on green `/commit` (user-invoked) — every fix was re-reviewed; on a stop `/review-gate --loop` (user-invoked) once the standing findings are settled — nothing has reviewed the fixes since; on waiting none, the message ending on the answers it waits for.
Where a rendered pointer leads into `/simplify` or `/review-gate`, precede the blockquote with a paragraph of its own recommending that the user compact the conversation first, and give them the keep-list to compact with as a code block: what the steps ahead need from this session — the spec or ticket path, the intent behind the diff, the decisions still open.
