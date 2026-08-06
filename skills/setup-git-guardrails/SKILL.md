---
name: setup-git-guardrails
description: Set up a hook that blocks dangerous git commands before they execute, in Claude Code or Codex CLI.
disable-model-invocation: true
argument-hint: [project|global] [codex|claude]
version: 1.0.0
source: mattpocock/skills@1.2.0 (git-guardrails-claude-code)
---

# Setup Git Guardrails

Sets up a PreToolUse hook that intercepts and blocks dangerous git commands before the agent executes them.

## What Gets Blocked

- `git push` (all variants including `--force`)
- `git reset --hard`
- `git clean -f` / `git clean -fd`
- `git branch -D`
- `git checkout .` / `git restore .`

When blocked, the agent sees a message telling it that it does not have authority to access these commands.

## Steps

### 1. Ask harness and scope

Ask the user for whatever the arguments did not already supply: which harness — **Claude Code**, **Codex CLI**, or both — and install for **this project only** or **all projects**?
The arguments name one harness at most, so "both" arrives here.

### 2. Copy the hook script

The bundled script is at: [scripts/block-dangerous-git.sh](scripts/block-dangerous-git.sh)

Copy it to the target location based on harness and scope:

- **Claude Code, project**: `.claude/hooks/block-dangerous-git.sh`
- **Claude Code, global**: `~/.claude/hooks/block-dangerous-git.sh`
- **Codex CLI, project**: `.codex/hooks/block-dangerous-git.sh`
- **Codex CLI, global**: `~/.codex/hooks/block-dangerous-git.sh`

Make it executable with `chmod +x`.

The script needs `bash`, `jq` and `grep` on PATH — state that to the user, since `jq` ships with none of the three platforms by default.
Without it the script reads an empty command, matches nothing, and exits 0, which is the allow verdict: the guardrail installs and passes everything.

### 3. Add hook to config

Read [HOOK-CONFIG.md](HOOK-CONFIG.md) and work through the section for each harness being installed.

If the config file already exists, merge the hook into existing `hooks.PreToolUse` array — don't overwrite other settings.

On Codex, finish by having the user trust the entry under `/hooks`; the hook does not run until they do.

### 4. Ask about customization

Ask if user wants to add or remove any patterns from the blocked list.
Edit every copy step 2 wrote, so a both-harness install does not end up guarding two different lists.
The entries are extended regexes matched against the whole command, not literal text.

### 5. Verify

Run a quick test:

```bash
echo '{"tool_input":{"command":"git '"push"' origin main"}}' | bash SCRIPT_PATH
```

Should exit with code 2 and print a BLOCKED message to stderr.
On Windows, run it through Git Bash by its full path — `bash` on the Windows PATH is the WSL stub, which reaches no script and reports no verdict.

The split quoting is what makes this runnable once the hook is live: the command's own text never spells the blocked pattern, so the hook lets it through, while the script still receives `git push origin main` and answers for itself.
Test any pattern the user added in step 4 the same way, splitting its literal too — a hand-added pattern is the likeliest to be a malformed regex, and a plain payload cannot reach it.

That proves the script, not the wiring.
Prove the wiring live: run `git push --dry-run` and confirm the harness denies it — a denial is the hook firing, and the command running, harmless as this one is, means it did not.
If it runs, read the config file back and check the hook sits inside `hooks.PreToolUse`, and on Codex that the entry shows as trusted under `/hooks`.
