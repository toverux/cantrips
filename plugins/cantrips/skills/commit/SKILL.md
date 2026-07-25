---
name: commit
description: Scan the session for compound-worthy learnings, then commit the working tree with a repo-appropriate, value-communicating message.
disable-model-invocation: true
version: 1.0.0
source: EveryInc/compound-engineering-plugin@3.19.0 (ce-commit)
---

Close the loop: harvest the session's learnings first, then create well-crafted git commits from the working tree — learning writes included, so the tree is clean when the loop ends.

## Step 1: Scan for compound candidates

Scan the whole session for candidate learnings: root causes uncovered, gotchas hit, approaches that failed, conventions or preferences decided along the way — plus anything `/review-gate` flagged as compound material.

Judge each against compound's quality bar — _would it change a future agent's behavior in a different session, and is it non-obvious and stable?_
Session-specific trivia dies here.

- Any candidate might clear the bar → invoke `/compound` with the candidates; it routes each to a destination and gates every write on the user.
  Approved writes join the working tree and ride into the commits below.
- None → say so in one line and move on.

## Step 2: Gather context

Run each as its own shell call and read the exit status directly — a non-zero exit is a state to interpret, not a failure:

- `git status` — working-tree state.
  Clean tree → report there is nothing to commit and stop.
- `git diff HEAD` — the uncommitted changes.
- `git branch --show-current` — empty output means detached HEAD: ask whether to create a branch or commit detached.
- `git log --oneline -10` — recent commit style.
- `git rev-parse --abbrev-ref origin/HEAD` — the default branch (strip the `origin/` prefix).
  If unset, fall back to `main`.

## Step 3: Choose the branch

Follow the repo's workflow: where the documented conventions or recent history show feature branches (or the user asked for one), branch off the default before committing — derive the name from the change content, `git checkout -b <branch-name>`, confirm with `git branch --show-current`.
Where the history shows commits landing directly on the default branch (trunk-based), commit where you are.

## Step 4: Determine the message convention

In priority order:

1. **Documented repo conventions** already in context (AGENTS.md, CLAUDE.md, or similar).
2. **Recent commit history** — if the last 10 commits show a clear pattern (conventional commits, ticket prefixes, emoji prefixes), match it.
3. **Default: conventional commits** — `type(scope): description`, type one of `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `style`, `build`.
   Where `fix:` and `feat:` both fit, prefer `fix:` — a change that remedies broken or missing behavior is a fix even when implemented by adding code; reserve `feat:` for capabilities the user could not previously accomplish.

Message discipline, whatever the convention:

- **Subject**: concise, imperative mood, focused on _why_ the change has value, not what changed.
- **Body**: for non-trivial changes, a blank line then motivation, trade-offs, anything a future reader needs.
  Omit for obvious single-purpose changes.
- **Formatting details** (wrapping, trailers, sign-offs) follow the repo's documented rules and the user's own global instructions; where neither says anything, keep the message plain prose.

## Step 5: Group, stage, and commit

Scan the changed files for naturally distinct concerns; if they clearly group into separate logical changes, commit each group — Step 1's learning writes usually form their own `docs`-type commit.
Keep it lightweight: group at the file level only (no hunk splitting), split only when the separation is obvious, and stay at two or three commits at most.

For each group, stage specific files by name — a targeted `git add` keeps sensitive files (.env, credentials) and unrelated changes out.
Commit with a heredoc to preserve formatting:

```bash
git add file1 file2 && git commit -m "$(cat <<'EOF'
type(scope): subject line here

Optional body explaining why this change was made.
EOF
)"
```

Verify with `git status` and report the commit hash(es) and subject line(s).

**Learnings captured, committed → the loop is closed.**
The next unit of work deserves a fresh session.
