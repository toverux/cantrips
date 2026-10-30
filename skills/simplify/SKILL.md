---
name: simplify
description: Optional pre-review quality pass — preserving fixes through the reuse, simplification, efficiency, and test-value lenses, pruning tests and comments that carry no value. Bug hunting is /review-gate's job.
argument-hint: "[blank to simplify current branch changes, or describe what to simplify] [proof-test:<path> ...]"
disable-model-invocation: true
version: 1.11.0
source: EveryInc/compound-engineering-plugin@3.33.2 (ce-simplify-code)
---

Simplify recently changed material while preserving what it does.
Prioritize readable, explicit results over compact ones — fewer lines is not the goal.

The contract below governs every step of this pass, and travels verbatim to each lens finder dispatched in Step 2.

<preservation-contract>
Preserve what the material does.
Which test that is depends on the material, and a file is judged by its own kind — a diff holding both kinds is held to both:

- **Code** — same output for every input, same error behavior, same side effects and ordering.
  A test preserves the contract it guards, by a named remaining test where the test itself goes.
  An interface or data shape that existed only in an earlier iteration of the current unshipped scope is not protected behavior once verified to have no deployed, persisted, public, external, dependent-branch, or in-repo caller outside the scope.
- **Agent-facing prose** (a skill, an `AGENTS.md` or `CLAUDE.md`, a rules file — anything an agent loads and acts on) — the instruction set is what is preserved.
  Cut text that repeats, rambles, or restates what another file already says.
  Never cut or weaken a sentence that directs an agent to act, forbids an action, gates a step behind a condition, or states how completion is judged — rewording one into a suggestion is weakening it.
  Where a sentence's kind is uncertain, it stays.
</preservation-contract>

## Step 1: Resolve the scope

Strip every `proof-test:<path>` token from the input before reading the rest as the scope.
The proof-test path is context for Steps 2 and 3, never scope; a caller may pass several.

1. **If the user named a scope** (a file, a directory, "the function I just wrote"), use it as authoritative — do not widen it.
2. **Otherwise**, use the diff between the current branch and its merge-base with the default branch (`git diff <default-branch>...`) plus the uncommitted changes (`git diff HEAD`), which a merge-base diff leaves out.
   With no base ref, the uncommitted changes alone.
   Either way, add the files git does not track (`git ls-files --others --exclude-standard`): a file git does not track appears in no diff, so it joins the scope whole.
   Snapshot each of those untracked files before Step 3 edits anything — git holds no pre-pass state for them, and Step 4 verifies against pre-pass text.
3. **Outside a git repository**, use the files edited earlier in this conversation.

If the scope comes up empty, stop and ask the user what to simplify.

## Step 2: Dispatch the lens finders in parallel

Dispatch `cantrips:finder:reuse`, `cantrips:finder:simplification` and `cantrips:finder:efficiency` in parallel, with `cantrips:finder:test-value` beside them where the resolved scope holds a test file, each message carrying the preservation contract above **verbatim** and the resolved scope (the full diff or file set) — no cap and no brief, the test-value message alone also carrying the proof tests (the `proof-test:` paths, else the tests the session's evidence names), since each definition holds its lens with the restraints printed under it, the rules governing every lens, and the contract it answers in: a JSON array of candidates, each carrying its `fix`.
On a scope the user did not name, the test-value message limits that lens to the tests the work added or changed and the Simplification message limits its **Comments** item to the comments the work added or changed; on a user-named scope they read the material whole.
Every dispatch names the definition by its scoped name and passes no model; the definition pins the model and a background run.
Where the harness loads no plugin agent definitions, read [`<role>.md`](../../agents/finder/), skip its frontmatter, paste its body into a general-purpose dispatch run in the background, and apply the model its frontmatter names where the dispatch primitive exposes a selector.
Where a dispatch fails for a reason that survives correcting the invocation, or the harness offers no way to make a dispatch at all, run that pass inline under the same preservation contract and scope, hunting through the lens and the rules governing every lens, read from that finder's definition past its role framing, and disclose the substitution.

## Step 3: Apply fixes

Proceed once all lens passes are complete, whether a dispatched finder returned its candidates or this context ran it, aggregate the candidates, and apply each one's `fix` directly.
A false positive or a fix not worth its churn: note it, skip it, move on — settle it yourself rather than raising it to the user.

Inspect beyond the resolved scope when needed to evaluate a finding, but edit only that scope and the import/export lines it needs. For a user-named file or directory scope, those import/export lines must also be inside it; skip any fix that would edit outside the mutation boundary.

Before applying each fix, confirm it satisfies the preservation contract for that material.
If it can't clear that test, skip it.
Write each fix from the line at the candidate's location, read in place — never from the candidate's description of it.

**Never simplify away a safety check.**
Input validation at trust boundaries, error handling that prevents data loss, security checks (authorization, escaping, sanitization), and accessibility affordances stay — even when a finding frames them as redundant.
In agent-facing prose the equivalent is a gate or a prohibition: a sentence that stops an agent doing something, or makes it stop and check first.

**Protect the proof tests.** Each test the current work relied on to show its change works stays exactly as it is: every `proof-test:` path, else the tests the session's evidence names. Skip any finding from any reviewer that would delete, weaken, rename, move, merge, or rewrite one, or remove or rename the test-only code it calls. Behavior-preserving changes to the production code it exercises still apply. When you cannot tell which tests those are, delete or rewrite none of the tests the current work added or changed.

## Step 4: Verify what was preserved

Each verification below observes one kind of material.
Run the one whose material this pass touched, and both where it touched both — code checks cannot observe prose, and the prose re-read cannot observe code.

**Where the pass touched code:**

- **Typecheck and lint the full project** — they catch the common simplification regressions: broken imports, dropped narrowings, dead code other modules still reference.
- **Run tests scoped to the blast radius** of the changes; broaden when shared or heavily-imported code was touched.
  No scoping mechanism → full suite.

On a failure, fix the underlying break or revert the specific simplification that caused it — a repair that would land outside the mutation boundary leaves revert the only route, and weakening assertions, types, or skipping tests defeats the preservation guarantee either way.
A test is removed only as a test-value finding, and any remaining tests that finding named must still pass afterwards.
If no checks are configured, state that in the summary.

**Where the pass touched agent-facing prose**, diff each changed file against its state before this pass and read every line the pass removed or reworded.
For a file git tracks that state is `HEAD`; for an untracked one it is the Step 1 snapshot, since git holds none.
That pre-pass text is the only place a cut instruction still exists, so re-reading the file as it now stands cannot find one.
For each removed or reworded line, confirm it carried no directive, prohibition, gate, or completion criterion — and restore it where it did.
Then reread every sentence the pass wrote in place, as its reader will meet it, and fix what that reading catches.

## Step 5: Summarize

Report fixes applied per lens (reuse, simplification, efficiency, test value), findings skipped (as false positives, as not worth the churn, or as fixes the mutation boundary put out of reach), open work or possible defects a candidate named, and which verifications ran — the code checks with their results, the prose diff-read and reread, or both.
The measure is what improved and that the contract held — many clarity and safety fixes preserve or add lines.

Close with a flow pointer (the message's final paragraph, a blockquote in full italics opening `Next:` — or `Next steps:` over one bullet per pointer — each pointer naming its skill the way this skill was itself invoked, same prefix and namespace, and ending in a one-clause rationale after an em dash): `/review-gate [--fix | --loop]` (user-invoked) — the gate that hunts for bugs and spec drift, in this session; suggest `low` for a trivial or mechanical diff, `high` for a large, cross-cutting, or risky one, `medium` otherwise; pair any level with `--fix` to apply the findings once, or with `--loop` to converge the gate to green.
Where the first rendered step that names a skill is `/review-gate`, precede the blockquote with a paragraph of its own recommending that the user compact the conversation first.
Where this session engaged a deputy through `/deputy` and has not dismissed it, a choice is put to the deputy as [ROUNDS.md](../deputy/ROUNDS.md) says and rendered as the one step it chose, any other closing is rendered as written, and each rendered step that names a skill is then taken: one marked `(user-invoked)` by notifying the user where the harness has a tool for it and waiting for them to type it, any other by invoking it, notifying nobody.
