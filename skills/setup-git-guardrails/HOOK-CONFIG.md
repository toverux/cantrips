# Hook config blocks

The config for step 3 of [SKILL.md](SKILL.md), one section per harness.
Read only the section for the harness step 1 settled, both sections for a both-harness install.
The Claude Code blocks are copied as they stand; the Codex CLI blocks are templates whose notes name what to substitute before writing them.

## Claude Code

Project — `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell",
        "hooks": [
          {
            "type": "command",
            "shell": "bash",
            "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-dangerous-git.sh"
          }
        ]
      }
    ]
  }
}
```

Global — `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell",
        "hooks": [
          {
            "type": "command",
            "shell": "bash",
            "command": "bash ~/.claude/hooks/block-dangerous-git.sh"
          }
        ]
      }
    ]
  }
}
```

`matcher` is a regex over the tool name, and Claude Code has a second shell tool called `PowerShell` — matching `Bash` alone leaves the agent a route around the guardrail on any install where that tool is enabled.
Both tools deliver the command at `.tool_input.command`, so the one script reads either without change.
A hook that cannot launch — `"shell": "bash"` with no Git Bash installed — exits non-2, a non-blocking error, so the command still runs and the guardrail fails open; step 5's live-fire check is what proves the wiring.

## Codex CLI

Project — `.codex/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$(git rev-parse --show-toplevel)/.codex/hooks/block-dangerous-git.sh\"",
            "commandWindows": "& \"C:/Program Files/Git/bin/bash.exe\" -c 'exec bash \"$(git rev-parse --show-toplevel)/.codex/hooks/block-dangerous-git.sh\"'; exit $LASTEXITCODE"
          }
        ]
      }
    ]
  }
}
```

Global — `~/.codex/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.codex/hooks/block-dangerous-git.sh",
            "commandWindows": "& \"C:/Program Files/Git/bin/bash.exe\" -c 'exec bash ~/.codex/hooks/block-dangerous-git.sh'; exit $LASTEXITCODE"
          }
        ]
      }
    ]
  }
}
```

Substitute two things before writing either block:

- **The Git Bash path in `commandWindows`.** It has to be the full path, because bare `bash` on the Windows PATH is the WSL stub and cannot reach the script. `C:/Program Files/Git/bin/bash.exe` is the default install only; `(Get-Command git).Source` points at the `cmd` directory of whichever install is on PATH, with `bash.exe` in its sibling `bin`.
- **The project path in the project block**, where the project is not the repository root — a package inside a monorepo, a submodule, or a project that is no git repository. `git rev-parse --show-toplevel` resolves against the directory Codex was launched from, so put the project's own absolute path in its place.

A wrong path in either fails open rather than loudly: the command cannot launch, the exit is not 2, and Codex reads that as no objection.
The rest of `commandWindows` is load-bearing for the same reason, Codex handing the string to `pwsh -NoProfile -Command`:

- `&` calls the quoted path; without it PowerShell reads the line as an expression and errors on the next token.
- `; exit $LASTEXITCODE` re-raises the script's exit code, because `pwsh -Command` reports every non-zero native exit as 1 — and 1 is a hook error, which lets the command through.

Run the finished `commandWindows` string once by hand from PowerShell before moving on, writing the payload PowerShell's way rather than step 5's:

```powershell
'{"tool_input":{"command":"git push origin main"}}' | & "C:/Program Files/Git/bin/bash.exe" -c 'exec bash "<the script path>"'; $LASTEXITCODE
```

It must report 2, and 0 for a benign command.
Step 5 tests the script, this tests the command wrapped around it, and a wrong Git Bash path shows up nowhere else.

Writing either file does not arm the hook: Codex trust-gates command hooks, and step 3 covers trusting the entry.
