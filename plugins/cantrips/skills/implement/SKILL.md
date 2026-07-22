---
name: implement
description: Implement a spec or a single ticket, driving TDD at the seams agreed in the spec.
argument-hint: '[spec or ticket path; blank asks]'
disable-model-invocation: true
version: 1.0.2
source: mattpocock/skills@1.1.0 (implement)
---

Implement the work in the spec (`docs/specs/<feature>.md`) or the ticket the user names.
Read it in full first; for a ticket, read its parent spec too.

Where the spec agreed a **test seam**, drive `/tdd` at that seam — the seams are already approved, so test at them without re-asking.
Where no seam was agreed, implement directly: state explicit verification criteria up front (what observable result proves it works), then verify against them before calling the work done.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

When working from a ticket, tick its acceptance criteria as each one is verified.

Done when every criterion is verified and the full suite passes → next: `/simplify` (optional quality pass), then `/review-gate` (suggest `low` for a trivial or mechanical diff, `high` for a large, cross-cutting, or risky one, `medium` otherwise), then `/commit` — all in this session; the working diff is the context.
If context runs low anywhere in that chain, recommend `/handoff` to the user and resume in a fresh session instead of pushing on degraded.
