---
name: commit
description: Scan the session for compound-worthy learnings, then commit the working tree with a repo-appropriate, value-communicating message.
disable-model-invocation: true
version: 1.1.0
source: EveryInc/compound-engineering-plugin@3.24.0 (ce-commit)
---

Close the loop: harvest the session's learnings first, then create well-crafted git commits from the working tree — learning writes included, so the tree is clean when the loop ends.

## Step 1: Scan for compound candidates

Scan the whole session for candidate learnings: root causes uncovered, gotchas hit, approaches that failed, conventions or preferences decided along the way — plus anything `/review-gate` flagged as compound material.

Judge each against compound's quality bar — _would it change a future agent's behavior in a different session, and is it non-obvious and stable?_
Session-specific trivia dies here.

- Any candidate might clear the bar → invoke `/compound` with the candidates; it routes each to a destination and gates every write on the user.
  Once the approved writes land, present their diff and wait for the user's verdict on the wording — approve, edit, or drop each document — since the destination gate cleared a one-line proposal, not the prose itself.
  Writes that survive ride into the commits below.
- None → say so in one line and move on.

## Step 2: Gather context

Gather context with each command as its **own** shell tool call (program + args only). Do **not** join with `;`, `&&`, `||`, pipes, `$(...)`, or redirects — that syntax fails under Windows PowerShell. A non-zero exit is a normal state to interpret, not a failure to suppress.

- `git status` — working-tree state.
  Clean tree → report there is nothing to commit and stop.
- `git diff HEAD` — the uncommitted changes.
- `git branch --show-current` — empty output means detached HEAD.
- `git log --oneline -10` — recent commit style.
- `git rev-parse --abbrev-ref origin/HEAD` — the default branch (strip the `origin/` prefix).
  If unset, fall back to `main`.

Treat this as a snapshot. Re-read branch and staged set immediately before committing if anything may have changed.

## Step 3: Choose the branch

**Detached HEAD → cut a feature branch before committing, and do not ask** — even where the user asked only for a commit, since a commit reachable from nothing is lost as soon as HEAD moves.
On the default branch, follow the repo's workflow instead: where the documented conventions or recent history show feature branches (or the user asked for one), branch off it before committing.
Where the history shows commits landing directly on it (trunk-based), commit where you are.
On any other branch, commit where you are unless the user asked for a new one.

Whenever this step cuts a branch: derive the name from the change content, `git checkout -b <branch-name>`, then confirm with `git branch --show-current`.

## Step 4: Determine the message convention

In priority order:

1. **Documented repo conventions** already in context (AGENTS.md, CLAUDE.md, or similar).
2. **Recent commit history** — if the last 10 commits show a clear pattern (conventional commits, ticket prefixes, emoji prefixes), match it.
3. **Default: conventional commits** — `type(scope): description`, type one of `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `style`, `build`.
   Where `fix:` and `feat:` both fit, prefer `fix:` — a change that remedies broken or missing behavior is a fix even when implemented by adding code; reserve `feat:` for capabilities the user could not previously accomplish.

Message discipline, whatever the convention:

- **Subject**: concise, imperative mood, focused on _why_ the change has value, not what changed.
- **Body**: for non-trivial changes, a blank line then the problem the change solves and why this approach — a few short paragraphs at most.
  The body records _why_ the code is now this way; the diff already shows _how_, and the process — attempts, dead ends, how the change was verified — dies with the session.
  Write it plain and self-contained: direct declarative sentences a stranger can skim years later, each claim one that stays true about the code; non-obvious trade-offs and costs qualify, the story of the work does not.
  Omit for obvious single-purpose changes.
- **Formatting details** (wrapping, trailers, sign-offs) follow the repo's documented rules and the user's own global instructions; where neither says anything, keep the message plain prose.

## Step 5: Group, stage, and commit

Scan the changed files for naturally distinct concerns; if they clearly group into separate logical changes, commit each group — Step 1's learning writes usually form their own `docs`-type commit.
Keep it lightweight: group at the file level only (no hunk splitting), split only when the separation is obvious, and stay at two or three commits at most.

For each group, stage specific files by name, never `git add -A` or `git add .` — that keeps sensitive files (.env, credentials) and unrelated changes out.
Write the full message — subject line, blank line, optional body — to a file outside the repo with your file-write tool, then stage and commit as two calls per commit group:

```bash
git add file1 file2 file3
```

```bash
git commit -F <message-file> -- file1 file2 file3
```

No shell parses the message with `-F`: a `$`, quotes, backticks, or a multi-line body pass through literally under any shell, with no quoting rules to satisfy. Git's normal whitespace cleanup still applies (trailing spaces trimmed, blank-line runs collapsed), which is fine for a commit message.

The trailing path list on `git commit` is load-bearing: a bare `git commit` takes the whole index, so anything already staged before this run (work the user staged and did not name) would ride into the commit. Naming the paths commits exactly the group and leaves other index entries alone.

During a merge or rebase, git refuses a partial commit: drop the trailing path list, and — the bare commit taking the whole index — check nothing unrelated sits staged before running it.
The path list also commits the named files' working-tree content, not the staged copy, so commit right after the `git add` above, before anything else touches those files.

Verify with `git status` and report the commit hash(es) and subject line(s).

**Learnings captured, committed → the loop is closed.**
The next unit of work deserves a fresh session.
