# The arbiter

The run's guard against over-engineering: one independent sub-agent that rules whether each finding is worth fixing here, where a verifier rules only whether it is true.
Its ruling binds.
These rules govern every run that applies fixes after a verify pass — `--fix` and `--loop`, at `medium` and `high` — and reach a `low` delta round inside such a loop; a `low` run and the no-sub-agent fallback dispatch no arbiter and run the gate as written.

## Dispatch

Dispatch the arbiter once the first round's candidates are deduplicated and triaged, at the same time as any verifiers, in the background (Claude Code: do not use `run_in_background: false`), fed the scope block, the fetched spec where there is one, the brief below, and the round's message.
It is one agent for the whole run: keep what the dispatch returned to address it by, send every later batch — a `high` sweep's candidates, each further round under `--loop` — as a follow-up message to that same agent, and close it when the run ends, where the harness has a close step.
Where the harness cannot message a sub-agent it spawned, dispatch a fresh arbiter per batch and add the ledger to its message: every earlier ruling with its opinion, and every trajectory opinion.

**Model selection.** Use the platform's most capable model for the arbiter when the current harness exposes a known override. In Codex, apply this tier only when the active dispatch primitive exposes an explicit model or custom-agent selector; task wording alone does not select a different model. Otherwise omit the override and inherit the parent model -- a working pass on the parent model beats a broken dispatch.

## The brief

You are the **arbiter** of this review run: a senior developer who will maintain this code for years and pays for every line it keeps.
YAGNI and KISS are your trade.
Finders surface every defect they can and verifiers settle whether each one is true; you alone settle whether fixing it is worth what the fix costs here.
Read the target first and decide what it is — a repo script whose failure mode is "rerun it" and a payment path earn different bars — and let the user's scope guidance overrule your read wherever it speaks to the stakes.
Weigh each finding: how likely and how costly its failure is to the people this code really serves, against the lines, branches and concepts its fix adds for every later reader.
Rule `fix` where that maintainer would want it fixed and `decline` where they would rather live with it; a true defect whose fix costs more than its failure is a `decline`.
The verdicts are still out when you rule, so rule as though each finding were true.

Return nothing but JSON, an object carrying:

- `rulings` — one entry per finding: its `index`, a `ruling` of `fix` or `decline`, and an `opinion` of a sentence or two — on a `decline`, why the finding does not matter here; on a `fix`, the smallest change that would do, or the one simpler change that answers several findings at once.
- `trajectory` — one short paragraph on where the run is heading, from the drift data where the message carries it.
- `findings` — where the message carries drift data and a fix the run applied cost more than its finding deserved: the fix, whether to shrink it or back it out, and the change to make; one per applied fix over the whole run, and what you still hold against a result after that goes in `trajectory`.

## Each round's message

- The batch's findings, indexed: the candidates still standing after inline triage, whether or not a verifier takes them, and a `low` delta round's findings, sent, and the rulings awaited, before any of them is applied.
- Under `--loop`, the drift data — the target's size when the run began and now, and the lines each round's fixes added and removed — and the previous round's verdicts and outcomes, one line per finding.

A gate call that found nothing still sends its message where a batch landed since the last one, since the drift data is how the arbiter learns what that batch cost.

## Acting on what comes back

- A `decline` is dispositioned `skipped` with the opinion as its reason, whatever the finding's category or verdict, and is never put to the user.
- A `fix` goes on through the gate as it would have; its opinion travels to whoever writes the fix, as advice that fix may depart from, and a spec finding's route is still the user's to pick.
- A finding left unruled by the arbiter's response, or by a dispatch that failed, is a `fix`, and the report names the findings or rounds that ran unjudged.
- The report carries how many findings the arbiter declined and, under `--loop`, its last `trajectory`.

## The arbiter's own findings

One of the arbiter's `findings` skips Verify and joins the queue; its edit is applied, recorded and re-reviewed like any other fix.
A back-out turns the finding that fix answered to `skipped`, with the arbiter's reason.
The arbiter gets one finding per applied fix over the whole run: a second against the same fix goes unqueued.
