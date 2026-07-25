---
date: 2026-07-25
area: tooling/checks
symptoms:
  - 'check-line-length exits 0 on a file with a 143-character line'
tags: [error-handling, exit-codes, silent-failure, temporal-dead-zone, hooks, guards]
---

# A check reported clean because it had stopped checking

## Problem

A guard in this repo turned a failure into a success rather than a report: the line-length hook exited 0 on a file it should have flagged.
It looked exactly like a passing check, so nothing downstream had any signal to act on.

## What didn't work

Reading the code did not surface it.
The defect is invisible on the happy path, and it was found only by running the tool against a deliberately broken input and noticing the exit code was wrong.

Trusting a smoke test that used a POSIX path on Windows was worse than useless: Node cannot read `/tmp/x.ts` in Git Bash, the hook bows out silently on an unreadable file, and every case therefore "passed".
Use `pwd -W` for a real Windows path when driving these tools by hand.

## Root cause

A handler whose success path and failure path produce the same observable outcome.

`.agents/hooks/check-line-length.ts` wrapped its entry call in `try { run(); } catch { process.exit(0); }`.
The trigger was a temporal dead zone: a lazily-built `Intl.Segmenter` was declared as a module-level `let` placed with the helpers at the bottom of the file, below the top-level `run()` call.
Function declarations hoist and `let` does not, so every over-long line threw `ReferenceError`, the catch swallowed it, and the hook reported every file clean.

## Fix

Narrow the guard to the condition it was actually written for, and let everything else be loud.

The hook now handles the two tolerable conditions where they arise (an absent or unparseable stdin payload, an unreadable file) and wraps nothing else, so a bug exits 1 with its stack on stderr.
Only exit 2 blocks the tool, so a loud crash still lets the user's edit through.

## Prevention

Write the negative case first and watch it fail: a new check earns trust only after you inject the drift it targets and observe a non-zero exit.

Treat a catch-all around an entry point as a defect unless the code inside it cannot fail for any reason other than the one being tolerated.
When a guard must swallow, name the condition it swallows in the catch, so a future reader can see what it does not cover.
