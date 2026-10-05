---
date: 2026-10-05
status: accepted
---

# A ruling names its premises, and a disproved one sends the finding back

## Context

The arbiter of ADR 0005 rules before the verdicts are in, "as though each finding were true", yet its opinions leaned on facts of its own that nobody checked.
A `decline` binds and never reaches the user, so a decline resting on a false fact dropped a real defect silently: in one run the arbiter declined a crash on a default the type did not have, and the verifier judging that finding had measured the opposite.
The skill gave the agent no way to act on the clash, so two sessions improvised a re-send under the finding's original index, hit `report`'s rejection of an index ruled twice, and dropped the first ruling by hand.

Three forms were live.
Dispatching a check for every premise a decline rests on: it catches a false premise no verdict covers, at the cost of a dispatch per decline, when every disproved premise on record had already been measured by the finding's own verifier.
Letting the agent overrule a ruling its evidence contradicts: no message, but the session applying fixes then overrules the guard against its own over-engineering.
Comparing the premises against evidence the run already holds, and sending a contradicted ruling back to the arbiter, the form chosen below.

This builds on ADRs 0005 and 0010, which stand as written.

## Decision

Each ruling lists `rests_on`: the checkable facts it would change without, a fact that makes the finding false or unreachable among them.
Before `report`, the agent holds those facts against the evidence the run already holds — the verdicts, their quoted evidence, what inline triage settled — and dispatches and reads nothing for one; a fact no evidence covers stands.
Evidence contradicting a listed fact is the one ground for sending the arbiter a finding it already ruled, once per finding, under a fresh index with the earlier ruling, the fact and the evidence.
The second ruling stands, and the superseded one stays in `rulings` as returned, joined to no candidate: a candidate's `index` is the one it was last sent under.
A contradiction with no re-send left goes into the agent's prose for the user to overrule.
At `inline` the session rules again once itself and hands `report` only the standing ruling.

What settled it is that the arbiter alone changes a ruling, and the comparison costs no dispatch.

## Consequences

The findings script is untouched: it ignores the extra field, joins rulings per candidate, and still rejects an index ruled twice, which keeps catching a follow-up that restarted its numbering.
The index is keyed on the send rather than on a "standing ruling" because a finding the arbiter never answered has no ruling to stand, and a merged entry would otherwise keep a superseded index.
A false premise that no verdict covers still survives; dispatching a check for it stays deferred in IDEAS.md, to adopt when one does.
A re-send's reply carries a second `trajectory` in the same gate call, as a `high` sweep's follow-up already did, and no rule picks between them.
