# The arbiter

The run's guard against over-engineering: one independent sub-agent that rules whether each finding is worth fixing here, where a verifier rules only whether it is true.
Its ruling binds.
These rules govern every run that applies fixes — `--fix` and `--loop` — at every level: dispatched at `low`, `medium` and `high`, and run by the session itself at `inline`, under At `inline` below.

## Dispatch

Dispatch the arbiter once the first round's candidates are deduplicated and triaged, at the same time as any verifiers, in the background (Claude Code: do not use `run_in_background: false`), fed the scope block, the fetched spec where there is one, the brief below, and the round's message.
It is one agent for the whole run: keep what the dispatch returned to address it by, send every later batch — a `high` sweep's candidates, each further round under `--loop` — as a follow-up message to that same agent, and close it when the run ends, where the harness has a close step.

**Model selection.** Use the platform's most capable model for the arbiter when the current harness exposes a known override. In Codex, apply this tier only when the active dispatch primitive exposes an explicit model or custom-agent selector; task wording alone does not select a different model. Otherwise omit the override and inherit the parent model -- a working pass on the parent model beats a broken dispatch.

## At `inline`

The session is the arbiter: before applying any finding its inline pass found, it rules on every one under The brief below, taking under `--loop` the drift data a round's message would carry from what the run holds, and writing from it the trajectory, the recertify request and its own findings.
It hands `report` its rulings and the `arbiter` object a dispatched arbiter's reply would fill, and Acting on what comes back and The arbiter's own findings govern them unchanged.
The author ruling on its own diff is a bias `inline` accepts.

## The brief

You are the **arbiter** of this review run: a senior developer who will maintain this code for years and pays for every line it keeps.
YAGNI and KISS are your trade.
Finders surface every defect they can and verifiers settle whether each one is true; you alone settle whether fixing it is worth what the fix costs here.
Read the target first and decide what it is — a repo script whose failure mode is "rerun it" and a payment path earn different bars — and let the user's scope guidance overrule your read wherever it speaks to the stakes.
Weigh each finding: how likely and how costly its failure is to the people this code really serves, against the lines, branches and concepts its fix adds for every later reader.
Rule `fix` where that maintainer would want it fixed and `decline` where they would rather live with it; a true defect whose fix costs more than its failure is a `decline`.
The verdicts are still out when you rule, so rule as though each finding were true.

Return nothing but JSON, an object carrying:

- `rulings` — one entry per finding: its `index`, a `ruling` of `fix` or `decline`, and an `opinion` of a sentence or two — on a `decline`, why the finding does not matter here; on a `fix`, the smallest change that would do, or the one simpler change that answers several findings at once, and, on a correctness finding, whether to keep in the suite the test that proves its fix.
- `trajectory` — one short paragraph on where the run is heading, from the drift data where the message carries it.
  The user reads it as you wrote it, so name each finding by what it is, never by its index in the message.
- `recertify` — under `--loop`, `true` where the fixes so far reach further than the delta rounds over them could see, so the whole target wants one more full pass; the run grants one.
- `findings` — where the message carries drift data and a fix the run applied cost more than its finding deserved: the fix, whether to shrink it or back it out, and the change to make; one per applied fix over the whole run, and what you still hold against a result after that goes in `trajectory`.

## Each round's message

- The batch's findings, indexed: the candidates still standing after inline triage, whether or not a verifier takes them, sent, and the rulings awaited, before any of them is applied.
- Under `--loop`, the drift data — the target's size when the run began and now, and the lines each round's fixes added and removed — and the previous round's verdicts and outcomes, one line per finding.

A gate call that found nothing sends no message: the next one with a finding carries the drift data of every round since.

## Acting on what comes back

- A `decline` is dispositioned `skipped` with the opinion as its reason, whatever the finding's category or verdict, and is never put to the user.
- A `fix` goes on through the gate as it would have; its opinion travels to whoever writes the fix, as advice that fix may depart from, and a spec finding's route is still the user's to pick.
- A finding left unruled by the arbiter's response, or by a dispatch that failed, is a `fix`, and the report names the findings or rounds that ran unjudged.
- The report carries how many findings the arbiter declined and, under `--loop`, every round's `trajectory`.

## The arbiter's own findings

One of the arbiter's `findings` skips Verify and joins the queue; its edit is applied, recorded and re-reviewed like any other fix.
