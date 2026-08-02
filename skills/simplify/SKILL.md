---
name: simplify
description: Optional pre-review quality pass — preserving fixes through the reuse, simplification, and efficiency lenses. Bug hunting is /review-gate's job.
argument-hint: "[blank to simplify the current branch's changes, or describe what to simplify]"
disable-model-invocation: true
version: 1.4.0
source: EveryInc/compound-engineering-plugin@3.20.0 (ce-simplify-code)
---

Simplify recently changed material while preserving what it does.
Prioritize readable, explicit results over compact ones — fewer lines is not the goal.

The contract below governs every step of this pass, and travels verbatim to each fixer dispatched in Step 2.

<preservation-contract>
Preserve what the material does.
Which test that is depends on the material, and a file is judged by its own kind — a diff holding both kinds is held to both:

- **Code** — same output for every input, same error behavior, same side effects and ordering.
- **Agent-facing prose** (a skill, an `AGENTS.md` or `CLAUDE.md`, a rules file — anything an agent loads and acts on) — the instruction set is what is preserved.
  Cut text that repeats, rambles, or restates what another file already says.
  Never cut or weaken a sentence that directs an agent to act, forbids an action, gates a step behind a condition, or states how completion is judged — rewording one into a suggestion is weakening it.
  Where a sentence's kind is uncertain, it stays.
</preservation-contract>

## Step 1: Resolve the scope

1. **If the user named a scope** (a file, a directory, "the function I just wrote"), use it as authoritative — do not widen it.
2. **Otherwise**, use the diff between the current branch and its merge-base with the default branch (`git diff <default-branch>...`) plus the uncommitted changes (`git diff HEAD`), which a merge-base diff leaves out.
   With no base ref, the uncommitted changes alone.
   Either way, add the files git does not track (`git ls-files --others --exclude-standard`): a file git does not track appears in no diff, so it joins the scope whole.
   Snapshot each of those untracked files before Step 3 edits anything — git holds no pre-pass state for them, and Step 4 verifies against pre-pass text.
3. **Outside a git repository**, use the files edited earlier in this conversation.

If the scope comes up empty, stop and ask the user what to simplify.

## Step 2: Launch three fixers in parallel

Dispatch one subagent per lens — **Reuse**, **Simplification**, **Efficiency** — in parallel where the harness supports it, sequentially otherwise.
Give each one:

- the preservation contract above and the fixer brief below, both **verbatim**;
- its single lens section from [`../review-gate/QUALITY-LENSES.md`](../review-gate/QUALITY-LENSES.md) — the lens text, the restraints printed under it, and the governing rules from that file's preamble;
- the resolved scope (the full diff or file set).

Paraphrasing any of it from memory loses the restraints that keep the pass preserving.

<fixer-brief>
Propose fixes; the skill that dispatched you applies them. Edit nothing yourself.
Hunt only through the lens you were given, and for each thing you find, name the concrete fix — one that satisfies the preservation contract you were given, since a fix that cannot is one this pass will drop.
Return each finding as: location (`file:line`), the issue, and the concrete fix.
If there is nothing to flag, say so explicitly.
</fixer-brief>

**Model selection.** Use the platform's balanced mid-tier model for these reviewers when the current harness exposes a known override. In Claude Code this is the Sonnet class. In Codex, apply this tier only when the active dispatch primitive exposes an explicit model or custom-agent selector; task wording alone does not select a different model. Otherwise omit the override and inherit the parent model -- a working pass on the parent model beats a broken dispatch.

## Step 3: Apply fixes

Wait for all three fixers, aggregate their findings, and fix each issue directly.
A false positive or a fix not worth its churn: note it, skip it, move on — settle it yourself rather than raising it to the user.

Before applying each fix, confirm it satisfies the preservation contract for that material.
If it can't clear that test, skip it.

**Never simplify away a safety check.**
Input validation at trust boundaries, error handling that prevents data loss, security checks (authorization, escaping, sanitization), and accessibility affordances stay — even when a finding frames them as redundant.
In agent-facing prose the equivalent is a gate or a prohibition: a sentence that stops an agent doing something, or makes it stop and check first.
Material that drops one is not simpler, it is unfinished.

## Step 4: Verify what was preserved

Each verification below observes one kind of material.
Run the one whose material this pass touched, and both where it touched both — code checks cannot observe prose, and the prose re-read cannot observe code.

**Where the pass touched code:**

- **Typecheck and lint the full project** — they catch the common simplification regressions: broken imports, dropped narrowings, dead code other modules still reference.
- **Run tests scoped to the blast radius** of the changes; broaden when shared or heavily-imported code was touched.
  No scoping mechanism → full suite.

On a failure, fix the underlying break or revert the specific simplification that caused it — weakening assertions, types, or skipping tests defeats the preservation guarantee.
If no checks are configured, state that in the summary.

**Where the pass touched agent-facing prose**, diff each changed file against its state before this pass and read every line the pass removed or reworded.
For a file git tracks that state is `HEAD`; for an untracked one it is the Step 1 snapshot, since git holds none.
That pre-pass text is the only place a cut instruction still exists, so re-reading the file as it now stands cannot find one.
For each removed or reworded line, confirm it carried no directive, prohibition, gate, or completion criterion — and restore it where it did.

## Step 5: Summarize

Report fixes applied per lens (reuse, simplification, efficiency), findings skipped as false positives or not worthwhile, and which verifications ran — the code checks with their results, the prose diff-read, or both.
The measure is what improved and that the contract held — many clarity and safety fixes preserve or add lines.

Close with a flow pointer (read [flow-pointers.md](../writing-great-skills/flow-pointers.md) for the format): `/review-gate` (user-invoked) — the gate that hunts for bugs and spec drift, in this session; suggest `low` for a trivial or mechanical diff, `high` for a large, cross-cutting, or risky one, `medium` otherwise.
