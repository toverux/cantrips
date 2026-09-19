---
date: 2026-09-19
status: accepted
---

# An authoritative arbiter of proportionality in `/review-gate`'s apply modes

## Context

`/review-gate --loop` over-engineers: a fifty-line repo tooling script comes out at two hundred and fifty, each round fixing an edge case that is real and does not matter for a script whose failure mode is "relaunch it".
Every round is locally reasonable and the drift only shows across rounds, which nothing in the gate reads: finders never drop a candidate, verifiers rule on whether a defect is true, and the fixer applies what survives.
Instructions did not hold — `IDEAS.md` recorded, until this decision took the item over, an extracted predicate reverted across four files as over-engineered despite two standing anti-over-engineering instructions.

Four alternatives were live.
A fourth verifier verdict, real but not worth fixing, with a stakes line in the scope block: no new agent, but verifiers are stateless and per-location, and folding "worth it" into the truth verdict biases them toward refuting real bugs.
An advisory judge whose declines are parked for the user: it rebuilds the interruption the user wants gone.
A fresh judge per round fed a ledger, on every harness: one path instead of two, at the price of rereading the target each round and losing the judge's own reasoning.
A stop condition owned by the judge: it strands findings ruled worth fixing, for nothing declining cannot already express.

ADR 0001 weighed an extra sub-agent on every run and dropped it; this one runs only where the gate applies fixes.
ADR 0004 holds `LOOP.md` to sixty lines, which left the arbiter little room there.

## Decision

`/review-gate` gains an arbiter: one independent sub-agent on the harness's most capable model, holding the view of a long-term maintainer, whose `fix` or `decline` ruling on each finding binds.
A declined finding is `skipped` with the arbiter's reason in the disposition ledger, whatever its category or verdict, and the user is never asked; the opinion beside each ruling — the smallest fix that would do, a reframe answering several findings — is advisory.
It runs under `--loop` and one-shot `--fix`, at `medium` and `high`, in parallel with the verifiers and from the first round; a `low` run and the no-sub-agent fallback go unjudged, while a `low` delta round inside a larger loop is still sent to it.
Under `--loop` it is one agent for the whole run, messaged each round with the findings, the target's measured growth and the last round's verdicts, and it may raise one finding per applied fix to shrink it or back it out.

What settled it is that over-engineering in a loop is cumulative, so only an observer with memory across rounds can see it, and that an opinion the loop may route around changes nothing.
Persistence was chosen over a fresh judge per round once both harnesses proved able to message a spawned sub-agent, verified on 2026-09-19; the fresh judge with a ledger remains the fallback where a harness cannot.
Silence means `fix`: the arbiter exists to subtract work, so its absence leaves the gate as it was.

## Consequences

A verified bug can now go unfixed on one agent's ruling; the ledger lists every decline with its reason, the closing GREEN line carries their count, and the user overrides after the run.
Every applying run at `medium` or `high` pays for one more sub-agent on the most capable model.

ADR 0004 stands untouched: the arbiter's rules live in a sibling `ARBITER.md`, `LOOP.md` takes one call, at two sites in its block, and one bullet and stays inside its sixty lines, and the control-flow change was checked against the executable model.

The once-per-fix bound is what keeps fixer and arbiter from cycling, since none of the three stop conditions catches that pair.
The arbiter's trajectory opinion stands in for the convergence-reading lines an earlier rewrite of `LOOP.md` dropped.

AGENTS.md rule 5 changes: the carried "Model selection" paragraph may vary the tier as well as the noun, and the arbiter's names no model class, since the top class is renamed faster than a skill is revised.
The lifecycle is worded without naming a tool — close the arbiter when the run ends, where the harness has a close step — because the Codex session tested exposed no close tool and a toolset other than the one its feature list implied.
