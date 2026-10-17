# The arbiter

The run's guard against over-engineering: one independent sub-agent that rules whether each finding is worth fixing here, where a verifier rules only whether it is true.
Its ruling binds.
These rules govern every run that applies fixes — `--fix` and `--loop` — at every level: dispatched at `low`, `medium` and `high`, and run by the session itself at `inline`, under At `inline` below.

## Dispatch

Dispatch `cantrips:arbiter` once the first round's candidates are deduplicated and triaged, at the same time as any verifiers, its message carrying the scope block, the fetched spec where there is one, and the round's message.
Where the harness loads no plugin agent definitions, read [`arbiter.md`](../../agents/arbiter.md), skip its frontmatter, paste its body into a general-purpose dispatch run in the background, and apply the model its frontmatter names where the dispatch primitive exposes a selector.
It is one agent for the whole run: keep what the dispatch returned to address it by, send every later batch — a `high` sweep's candidates, each further round under `--loop` — as a follow-up message to that same agent, and close it when the run ends, where the harness has a close step.

## At `inline`

The session is the arbiter: before applying any finding its inline pass found, it rules on every one under the arbiter's brief — the body of [`arbiter.md`](../../agents/arbiter.md), past its frontmatter, its write-nothing clause excepted, since the session also applies the fixes — taking under `--loop` the drift data a round's message would carry from what the run holds, and writing from it the trajectory, the recertify request and its own findings.
It hands `report` the `arbiter` object a dispatched arbiter's reply would fill, its `rulings` under indices of the session's own numbering, and Acting on what comes back and The arbiter's own findings govern them, with one change: it holds each ruling's `rests_on` against what it has read, and where a fact fails it rules on that finding again itself, once, sending no message and handing `report` only the ruling that stands.
Once the run is hands off, it rules the `worth` items too, recording each through `answers`.
The author ruling on its own diff is a bias `inline` accepts.

## Each round's message

- The batch's findings, indexed: the candidates still standing after inline triage, whether or not a verifier takes them, sent, and the rulings awaited, before any of them is applied.
  Within one gate call, a follow-up message numbers its findings on from the last index already sent, so no two share an index.
- Under `--loop`, the drift data — the target's size when the run began and now, and the lines each round's fixes added and removed — and the previous round's verdicts and outcomes, one line per finding.
- Once the run is hands off, the parked `worth` items `answers` has not yet recorded, each with its options and the recommended one marked, for a `choices` entry each; where the script's `next:` line asks, they go in a message of their own.

A gate call that found nothing sends no message: the next one with a finding carries the drift data of every round since.

## Acting on what comes back

- Before `report`, with the verdicts in, hold every fact a kept finding's ruling `rests_on` against the evidence the run already holds — the verdicts, their quoted evidence, what inline triage settled.
  Dispatch and read nothing for a fact: one no evidence covers stands.
- Evidence contradicting a listed fact is the one ground for sending the arbiter a finding it already ruled, once per finding: a follow-up message carrying the finding under a fresh index, the earlier ruling, the fact and the evidence against it.
  The second ruling stands; the candidate takes the fresh index, and the earlier ruling stays in `rulings` as returned.
- A contradiction with no re-send left — against a fact the second ruling lists, or met after the finding's `report` — leaves the ruling standing: name the finding, the fact and the evidence in your prose above the pasted block, for the user to overrule.
- A `decline` is dispositioned `skipped` with the opinion as its reason, whatever the finding's category or verdict, and is never put to the user.
- A `fix` goes on through the gate as it would have; its opinion travels to whoever writes the fix, as advice that fix may depart from.
- Each `choices` entry is recorded through `answers` as the user's answer would be: `queue` for an option that fixes, `skip` with the arbiter's reason otherwise.
- A `worth` item the response, or a failed dispatch, left without a choice takes its recommended option as its choice.
- A finding left unruled by the arbiter's response, or by a dispatch that failed, is a `fix`, and the report names the findings or rounds that ran unjudged.
- The report carries how many findings the arbiter declined and, under `--loop`, every round's `trajectory`.

## The arbiter's own findings

One of the arbiter's `findings` skips Verify and joins the queue; its edit is applied, recorded and re-reviewed like any other fix.
