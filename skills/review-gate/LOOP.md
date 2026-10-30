# Loop mode

Drive the gate to **green** instead of reporting once: certify the whole target, then apply the findings in batches and re-review each batch, until nothing is left to fix or re-review with the project's checks at their baseline and nothing parked for the user.
These rules govern the whole run at every level: they leave Scope, Find, Verify and Sweep as they are where those run, save what a gate call below adds to a finder's brief, and stand in for the reporting and closing the level would otherwise have done — Synthesize and report's at `low`, `medium` and `high`, the inline pass's at `inline`, and the Close section's on every path.
How a finding is judged, shaped and channelled still comes from the section the level would have run; every path writes its fixes under Synthesize and report's apply mode, inside the run's mutation boundary, which a delta round's narrower scope never narrows.

## The run

The script paces the run: after each call, do what its `next:` and `then:` lines say, printed or handed over at the turn end — the batch to apply, the delta round or certifying pass to run, the close — and take every judgement they leave from here.

- **Checks** — the project's own checks (the commands its `AGENTS.md`/`CLAUDE.md` names, or the obvious suite runner), run once before the first gate call as the **baseline**; each `report` says whether a rerun adds to it, a red parked for the user excepted, or that the project has none.
- **Gate calls** — a **certifying pass** is the full gate over the run's target as the tree now stands; a **delta round** is the gate over the `git diff` the script hands it, taken as Scope's whole target — a file the batch created is inside it, so Scope lists no untracked file beside it — at the highest level that diff earns by what it changes, the invoked level its ceiling and `inline` reachable under every ceiling: a batch of comments, docstrings or one expression earns `inline`, a few lines of logic in one file earn `low`, logic across files or anything other code depends on earns `medium`, a diff nobody would trust to one finder earns the invoked level.
  Either hands `report` everything it found, whatever cap its level's report would apply, and each finder's brief — the inline pass itself, where the level dispatches no finder — carries the ledger block the script prints before it.
- **Re-finds** — tag each candidate that matches a finding the run already holds `same_as` that finding: the script retries it, parks it, or stops the run on it by those tags alone.
- **A batch** — each finding's fix under apply mode, or the edit the user made where that was their answer.
- **A red batch** — where the checks come back with new failures, back out the edit likeliest behind the red, the user's included; where that clears the checks, repair it once, parking it backed out where the checks still fail; where it does not, revert the batch and park it as one item under the finding it answered, `with` the rest, a red that survives the revert, or that no edit explains, parked with it; a backed-out or reverted edit loses its outcome, a repaired one is `fixed`.

## What needs the user

Unless the user's answer re-queued it, park a spec finding's route, a finding no fix can resolve, one whose only fix reaches outside the mutation boundary, an action only the user can perform, and anything else the loop cannot resolve — a question beats an improvisation, and a finding is never silenced by weakening what surfaces it.
Park each through `outcomes` as it lands, with its options, what the loop tried and its `kind`: `worth` where the question is whether a fix is worth it, `user` for the rest — a spec route, a fix beyond the boundary, a finding no fix resolves, a red the user must judge, and anything the loop cannot classify.
Keep working: the loop never waits on the user.
Of the parked items, only a spec finding's route goes to a deputy, and every `user` item once the run is hands off, its reply reaching `answers` as the user's would, a hand-back staying parked for the user, notified where the harness has a tool for it, while the loop works on.
Where this session engaged a deputy through `/deputy` and has not dismissed it, what is put to the user here goes to the deputy instead, as [ROUNDS.md](../deputy/ROUNDS.md) says, and the deputy's reply is printed verbatim under a one-line header before anything acts on it; otherwise it goes to the user as written.
At the next round boundary, hand `answers` whatever the user replied since: it re-queues what they asked fixed or fixed themselves, their answer widening the mutation boundary where the fix needs it, and skips what they declined, a declined red joining the baseline.
A decline the user overrules is fixed directly and recorded through `outcomes`, since `answers` refuses a declined finding.

## Hands off

`--fsd` at invocation, or `autonomous: true` handed to `answers` once a reply of the user's delegates the parked set, makes the run hands off.
A `worth` item goes to the arbiter, as [ARBITER.md](ARBITER.md) says, instead of waiting on the user.
A spec finding takes the route the gate recommends without parking: align the code as a fix recorded `fixed`, which parks as `user` where no case goes red, or annotate the spec and record the finding `routed` with its `revision`, the spec's edit inside the boundary whatever files the scope guidance names; a `spec`-labelled finding whose options are not those two routes parks as `user`.
A spec route parked before the run went hands off is taken once it is: an align route queued through `answers`, in the switch's own call where one carries it, an annotate route recorded `routed` through `outcomes`.
A fix beyond the boundary still parks as `user`.

## Ending

Once the run has ended, ask again in your next message about any item a reply left unanswered, and push back on closing or `/commit` while any is open.
Flag `/compound` material after the closing block, and close with a flow pointer (the message's final paragraph, a blockquote in full italics opening `Next:` — or `Next steps:` over one bullet per pointer — each pointer naming its skill the way this skill was itself invoked, same prefix and namespace, and ending in a one-clause rationale after an em dash), a **choice** on how the run ended: on green `/commit` (user-invoked) — every fix was re-reviewed; on a stop `/review-gate --loop` (user-invoked), `--fsd` in its place where the run is hands off, once the standing findings are settled — nothing has reviewed the fixes since; on waiting none, the message ending on the answers it waits for; where the message flagged `/compound` material, `/compound` beside whatever step renders.
Where the first rendered step that names a skill is `/review-gate`, precede the blockquote with a paragraph of its own recommending that the user compact the conversation first.
Where this session engaged a deputy through `/deputy` and has not dismissed it, a choice is put to the deputy as [ROUNDS.md](../deputy/ROUNDS.md) says and rendered as the one step it chose, any other closing is rendered as written, and each rendered step that names a skill is then taken: one marked `(user-invoked)` by notifying the user where the harness has a tool for it and waiting for them to type it, any other by invoking it, notifying nobody.
