---
name: simplify
description: Optional pre-review quality pass — behavior-preserving fixes for reuse, dead weight, altitude, and clarity. Bug hunting is /review-gate's job.
argument-hint: "[blank to simplify the current branch's changes, or describe what to simplify]"
disable-model-invocation: true
version: 1.0.0
source: EveryInc/compound-engineering-plugin@3.19.0 (ce-simplify-code)
---

Simplify recently changed code while preserving exact behavior: same output for every input, same error behavior, same side effects and ordering.
Prioritize readable, explicit code over compact code — fewer lines is not the goal.

## Step 1: Resolve the scope

1. **If the user named a scope** (a file, a directory, "the function I just wrote"), use it as authoritative — do not widen it.
2. **Otherwise**, use the diff between the current branch and its merge-base with the default branch (`git diff <default-branch>...`).
   With no base ref, fall back to staged + unstaged changes (`git diff HEAD`).
3. **Outside a git repository**, use the files edited earlier in this conversation.

If the scope comes up empty, stop and ask the user what to simplify.

**Preflight:** the reviewers hunt in _code_.
If the scope is documentation-only, or only generated, vendored, lockfile, or mechanical churn (formatting, lint autofix, mass rename), stop with a one-line note that there is nothing to simplify.
On a mixed diff, narrow the scope to the code files and continue.
Gate on the _kind_ of change only — a user-named scope always runs.

## Step 2: Launch three reviewers in parallel

Dispatch one subagent per persona, in parallel where the harness supports it, sequentially otherwise.
For each, read its file and pass the **full file content verbatim** as the subagent's prompt, together with the resolved scope (the full diff or file set) — paraphrasing from memory loses the gating rules that keep the pass behavior-preserving:

- [`references/personas/code-reuse-reviewer.md`](references/personas/code-reuse-reviewer.md) — existing utilities, duplicated functionality, reimplemented stdlib primitives.
- [`references/personas/code-quality-reviewer.md`](references/personas/code-quality-reviewer.md) — dead weight, altitude (abstraction level), clarity.
- [`references/personas/efficiency-reviewer.md`](references/personas/efficiency-reviewer.md) — wasted work, missed concurrency, memory.

## Step 3: Apply fixes

Wait for all three reviewers, aggregate their findings, and fix each issue directly.
A false positive or a fix not worth its churn: note it, skip it, move on — settle it yourself rather than raising it to the user.

Before applying each fix, confirm it preserves behavior (the test above).
If it can't clear that test, skip it.

**Never simplify away a safety check.**
Input validation at trust boundaries, error handling that prevents data loss, security checks (authorization, escaping, sanitization), and accessibility affordances stay — even when a finding frames them as redundant.
Code that drops one is not simpler, it is unfinished.

## Step 4: Verify behavior is preserved

- **Typecheck and lint the full project** — they catch the common simplification regressions: broken imports, dropped narrowings, dead code other modules still reference.
- **Run tests scoped to the blast radius** of the changes; broaden when shared or heavily-imported code was touched.
  No scoping mechanism → full suite.

On a failure, fix the underlying break or revert the specific simplification that caused it — weakening assertions, types, or skipping tests defeats the behavior-preservation guarantee.
If no checks are configured, state that in the summary.

## Step 5: Summarize

Report fixes applied per dimension (reuse, quality, efficiency), findings skipped as false positives or not worthwhile, and which checks ran with their results.
The measure is what improved and that behavior held — many clarity and safety fixes preserve or add lines.

Close with a flow pointer ([presentation](../writing-great-skills/flow-pointers.md)): `/review-gate` (user-invoked) — the gate that hunts for bugs and spec drift, in this session; suggest `low` for a trivial or mechanical diff, `high` for a large, cross-cutting, or risky one, `medium` otherwise.
