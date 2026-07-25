# Claude Code integration

Claude Code reads rules from `.claude/rules/` and runs hooks from its settings; wards derives both from the canonical file in `.agents/`.
Only `rule` and `hook` scrolls get an integration here: a `template` describes a file the project already owns, so it is proposed against that file and never linked as a rule.

## Rules

The canonical file lives in `.agents/rules/<name>.md` and carries its `ward:` frontmatter (including `provenance`).
Claude Code loads a rule conditionally from a `paths:` frontmatter key, so translate the scroll's neutral `ward.applicability` globs into a top-level `paths:` list in the same frontmatter:

```yaml
---
ward:
  kind: rule
  description: How to write TypeScript in this project.
  version: 3.0.0
  applicability:
    - '**/*.{ts,tsx}'
  provenance:
    - source: owner/repo
      path: rules/typescript.md
      version: 3.0.0
paths:
  - '**/*.{ts,tsx}'
---
```

Claude Code reads `paths:` and ignores `ward:`; the wards CLI reads `ward:` and ignores `paths:`; both live in one file.
A scroll with no `applicability` gets no `paths:` key — it stays an unconditional rule that always loads.

Then link it into the rules directory of the scroll's scope: `.claude/rules/` for a project-scope scroll, `~/.claude/rules/` for a user-scope one, whose canonical file lives under `~/.agents/rules/`.
User-scope rules honor `paths:` exactly as project-scope rules do, so a language rule installed globally still loads only for its own file types.

- **Symlink** `<rules-dir>/<name>.md` to the canonical file where symlinks work (test once with a throwaway link; on Windows this needs developer mode or an elevated shell, and `git config core.symlinks true`).
- **Copy** otherwise: write a wards-managed duplicate into `<rules-dir>/<name>.md`, frontmatter first and the generated-file banner right after the closing `---`:

  ```markdown
  ---
  ward: …
  paths:
    - '**/*.{ts,tsx}'
  ---

  <!-- wards-managed: generated from .agents/rules/<name>.md; edit the canonical file, not this copy -->
  ```

  Claude Code reads frontmatter only when the file opens with `---`, so a banner placed above it makes the rule silently never load at all.
  The copy keeps the canonical `ward:` block, which is what marks it wards-owned, and users edit only the canonical file.
  `wards status` reads canonical files and never scans `.claude/`, so a stale copy has nothing to report it: the update flow regenerates every copy whatever the scroll's classification.

## Hooks

A hook's canonical file lives in `.agents/hooks/<name>.<ext>` (its `ward:` header carries `provenance`).
Wire it into settings rather than symlinking:

- **project** scope: the committed `.claude/settings.json`.
- **user** scope: `~/.claude/settings.json`.

Translate the scroll's `ward.event` to the harness event.
`fires-after-file-edit` maps to `PostToolUse` with an `Edit|Write|MultiEdit` matcher, running the canonical file under the Node type-stripping runtime:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node --disable-warning=ExperimentalWarning --experimental-strip-types \"$CLAUDE_PROJECT_DIR/.agents/hooks/<name>.ts\""
          }
        ]
      }
    ]
  }
}
```

A hook may take flags; append them to the command string, quoting any value the shell would otherwise split so it survives on every platform (`check-line-length`, for instance, requires `--extensions ts,tsx,js` and a single-quoted `--suppressions '<regex>'`, and errors out if either is missing).
At user scope, point the command at the absolute `~/.agents/hooks/<name>.ts` path instead.
Merge into any existing hooks array rather than replacing it.
