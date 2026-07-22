# Multi-harness plugin integrations for grimoire

Research date: 2026-07-22. All sources checked on that date against official docs, GitHub repos, and
changelogs. Facts are cited; anything marked _unverified_ could not be confirmed in a primary source
and must not be assumed.

Context: grimoire currently serves two harnesses from one tree — Claude Code
(`.claude-plugin/marketplace.json` + `plugins/<name>/.claude-plugin/plugin.json`) and Codex CLI
(`.agents/plugins/marketplace.json` + `plugins/<name>/.codex-plugin/plugin.json`), with one shared
`plugins/<name>/skills/<skill>/SKILL.md` tree. The question: which other harnesses could the same
repo serve, and at what cost.

## Summary table

| Harness                              | Skills support                                                     | Manifest needed                                                                  | Marketplace story                                                                             | Hooks (PostToolUse-like)                                                          | Integration cost                                                  |
| ------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| GitHub Copilot CLI                   | Native SKILL.md (open standard)                                    | `plugin.json` at plugin root; `.claude-plugin/` reportedly read too              | Git-based `marketplace.json`; `.claude-plugin/` location recognized — grimoire may work as-is | Yes: `postToolUse` (+ pre, session, error)                                        | Very low, possibly zero                                           |
| Google Antigravity (IDE + `agy` CLI) | Native SKILL.md inside plugins                                     | `plugin.json` at plugin root (only `name` required)                              | None; `agy plugin install <git-url\|path>` per plugin                                         | Yes: `hooks.json` (events not enumerated in docs)                                 | Low (one additive file per plugin)                                |
| Goose (Block)                        | Native SKILL.md; reads `.agents/skills`, `.claude/skills`          | `plugin.json` at plugin root ("Open Plugins")                                    | None central; `goose plugin install <git-url>`; also consumes Gemini extensions               | Yes: `hooks/hooks.json` with `PostToolUse`, matchers, `${PLUGIN_ROOT}`            | Low (same root manifest as Antigravity)                           |
| Cursor (IDE + CLI)                   | Native SKILL.md incl. `disable-model-invocation`                   | `.cursor-plugin/plugin.json` per plugin + root `.cursor-plugin/marketplace.json` | Central marketplace with human review; team marketplaces on paid plans                        | Yes: `hooks/hooks.json` (agent lifecycle events)                                  | Low files / medium distribution (review gate)                     |
| Gemini CLI                           | Native SKILL.md; `gemini skills install <url> --path`              | `gemini-extension.json` per extension for full bundles                           | Git install + curated gallery (geminicli.com/extensions)                                      | Yes: `AfterTool` (settings.json or extension `hooks/hooks.json`)                  | Medium (extension manifest per plugin; subdir install unverified) |
| OpenCode                             | Native SKILL.md; reads `.claude/skills`, `.agents/skills`          | None for skills; JS/TS module for plugins                                        | `"plugin"` array in opencode.json accepts git+ URLs and npm                                   | Yes, via JS plugin: `tool.execute.after`, `file.edited`                           | Medium (small JS shim to register skills dir)                     |
| Amp (Sourcegraph)                    | Native SKILL.md (`.agents/skills`, `.claude/skills`)               | None — no skill packaging or manifest                                            | None; file-drop only                                                                          | Via TS plugin API: `tool.result` events; plugins are local files, no distribution | Low value-add possible; nothing to ship                           |
| Factory Droid                        | Native SKILL.md incl. `disable-model-invocation`, `user-invocable` | None                                                                             | None documented; file-drop into `.factory/skills`                                             | Yes: `PreToolUse`/`PostToolUse` (user config, not distributable)                  | Nothing additive to ship; docs only                               |
| Charm Crush                          | Native SKILL.md incl. `disable-model-invocation`                   | None                                                                             | None; file-drop or `options.skills_paths`                                                     | None documented                                                                   | Nothing additive to ship; docs only                               |

## The bigger picture: SKILL.md won; `.agents/` is the interop layer

The Agent Skills format (SKILL.md, `name` + `description` frontmatter, progressive disclosure) was
released by Anthropic as an open standard in December 2025 and is now listed as adopted by 40+
products on the official site, including every harness investigated here except none — all nine
support SKILL.md natively. Sources: https://agentskills.io/home (adopter carousel with per-product
doc links), https://github.com/agentskills/agentskills.

Two de-facto conventions matter to grimoire:

- **`.agents/skills/`** is the cross-tool skills directory. Read natively by Gemini CLI, Cursor,
  Copilot, Goose, Amp, Crush, and OpenCode (Factory reads a `.agent/` compatibility folder —
  singular in its docs). Grimoire's skills live in `plugins/<name>/skills/`, so this mostly matters
  for _consumers_ who vendor skills, not for the repo layout.
- **A root `plugin.json` per plugin directory** is converging as a shared plugin manifest:
  Antigravity, Goose "Open Plugins", and Copilot CLI all expect `plugin.json` at the plugin root
  (not inside a dot-directory). One additive file per plugin can serve all three.

Prior art: [EveryInc/compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin)
ships, from one repo: `.claude-plugin/` (plugin + marketplace), `.codex-plugin/`,
`.cursor-plugin/` (plugin + marketplace), `.grok-plugin/`, `.kimi-plugin/`, `.devin-plugin/`, a root
`plugin.json` with `"$schema": "https://antigravity.google/schemas/v1/plugin.json"`, an
`.agents/plugins/marketplace.json` (Codex), an `.agy/` bundle for Antigravity CLI, and an
`.opencode/` JS plugin that registers its skills directory. Verified by listing the repo contents
via the GitHub API on 2026-07-22. Their Antigravity manifest is four fields (`$schema`, `name`,
`version`, `description`) — the same shared fields grimoire already syncs.

## Per-harness details

### GitHub Copilot CLI

- Skills: SKILL.md standard across Copilot products (cloud agent, code review, CLI, VS Code,
  JetBrains). Project discovery: `.github/skills`, `.claude/skills`, `.agents/skills`; personal:
  `~/.copilot/skills`, `~/.agents/skills`. `gh skill` assists discovery/install.
  Source: https://docs.github.com/en/copilot/concepts/agents/about-agent-skills
- Plugins: distributable packages of agents (`agents/NAME.agent.md`), skills
  (`skills/<name>/SKILL.md`), hooks (`hooks.json`), MCP and LSP configs. `plugin.json` required at
  the plugin root (fields: name, description, version, author, license, keywords, plus optional
  component paths). Source: https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-plugins
  and .../how-tos/copilot-cli/customize-copilot/plugins-creating
- Marketplace: any git repo with a `marketplace.json` (name, owner, metadata, `plugins[]` with
  relative `source` paths). The docs state the file may live in `.github/plugin` **and that
  `.claude-plugin/` is recognized as an alternative location** — i.e. grimoire's existing
  `.claude-plugin/marketplace.json` should be registrable via
  `copilot plugin marketplace add toverux/grimoire`.
  Source: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace
- A third-party writeup reports Copilot CLI also reads `.claude-plugin/plugin.json` inside plugin
  dirs and ignores unknown fields (https://cora7.com/blog/copilot-cli-plugin-portability/) —
  _secondary source, unverified_; if false, the fix is the same root `plugin.json` needed for
  Antigravity/Goose.
- Hooks: JSON files in `.github/hooks/` (repo-wide) or plugin `hooks.json`; events `sessionStart`,
  `sessionEnd`, `userPromptSubmitted`, `preToolUse`, `postToolUse`, `errorOccurred`. camelCase, not
  Claude's PascalCase; the wards hook would need a small config translation, the TS script itself
  can likely be reused. Source: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks
- Status: Copilot CLI GA 2026-02-25 (github.blog changelog); enterprise-managed plugins public
  preview 2026-05-06.

### Google Antigravity (IDE and `agy` CLI)

- Plugin layout: `plugin.json` at plugin root (required marker; only `name` is required,
  `description` optional; `$schema: https://antigravity.google/schemas/v1/plugin.json` for editor
  validation), plus optional `skills/<name>/SKILL.md`, `rules/*.md`, `agents/`, `hooks.json`,
  `mcp_config.json`. Sources: https://antigravity.google/docs/plugins,
  https://antigravity.google/docs/cli/plugins
- Discovery/install: IDE scans workspace `.agents/plugins/` or `_agents/plugins/` and global
  `~/.gemini/config/plugins/`; CLI installs local or remote plugins via
  `agy plugin install <path|git-url>`, staged under `~/.gemini/antigravity-cli/plugins/<name>/`.
  No marketplace or marketplace.json exists. Whether `agy plugin install` can target a
  subdirectory of a multi-plugin repo is _unverified_ — EveryInc's repo root _is_ the plugin, so
  their one-command install does not answer it; the documented fallback is clone +
  `agy plugin install ./repo/plugins/<name>`.
- Note: grimoire's `.agents/plugins/marketplace.json` (Codex) sits in the directory Antigravity
  scans for workspace plugins; a lone JSON file without a plugin dir should be ignored, but this
  cohabitation is _untested_.
- Hooks: `hooks.json` supported ("intercept agent actions right before or immediately after
  execution"); event names and schema are not enumerated in public docs — whether a PostToolUse
  equivalent exists is _unverified_.
- Skills there are surfaced as slash commands; honoring of `disable-model-invocation` is
  _unverified_.

### Goose (Block)

- Skills: enabled by default; discovery order `~/.agents/skills/` and `.agents/skills/` first, then
  compatibility paths `.goose/skills/`, `.claude/skills/`, `~/.claude/skills/`; plugin-provided
  skills namespaced `plugin-name:skill-name`.
  Source: https://goose-docs.ai/docs/guides/context-engineering/using-skills/ (the
  block.github.io URL now 404s; goose-docs.ai serves the current docs)
- Plugins ("Open Plugins"): a directory with root `plugin.json` (name, version, description),
  `skills/`, `hooks/hooks.json`, `scripts/`. Discovered at `~/.agents/plugins/<name>/` and
  `<project>/.agents/plugins/<name>/`. Install: `goose plugin install <git-url>` with
  `--auto-update`; also accepts Gemini-style extension repos. Subdirectory install from a
  multi-plugin repo is _unverified_.
  Source: https://goose-docs.ai/docs/guides/context-engineering/plugins
- Hooks: 10 lifecycle events including `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
  `AfterFileEdit`, `AfterShellExecution`; config shape is strikingly Claude-like (`matcher` regex,
  `hooks: [{type: "command", command: "${PLUGIN_ROOT}/…"}]`) and ships inside plugins — the wards
  hook ports with minor config edits, assuming Node is present on the user's machine.
  Source: https://goose-docs.ai/docs/guides/context-engineering/hooks

### Cursor

- Skills: discovery in `.agents/skills/` + `.cursor/skills/` (project), `~/.agents/skills/` +
  `~/.cursor/skills/` (user), plus legacy `.claude/skills/` and `.codex/skills/`. Frontmatter:
  `name`, `description`, optional `paths` globs, **`disable-model-invocation`** (skill becomes
  slash-command only), `metadata`. Works in IDE and CLI.
  Source: https://cursor.com/docs/context/skills
- Plugins (Cursor 2.5, ~Feb 2026): per-plugin `.cursor-plugin/plugin.json` (name required; same
  optional metadata fields as Claude's manifest, plus `logo`, component paths, `variables`);
  multi-plugin repos declare a root `.cursor-plugin/marketplace.json` (`name`, `owner`, `plugins[]`
  with `source` paths — same shape as Claude's, max 500 entries). Auto-discovery of `skills/`,
  `rules/`, `agents/`, `commands/`, `hooks/hooks.json` inside the plugin dir; note grimoire's
  skills are at `plugins/<name>/skills/`, which matches.
  Sources: https://cursor.com/docs/reference/plugins, https://github.com/cursor/plugins
- Distribution: submission to https://cursor.com/marketplace/publish with review by the Cursor
  team; public git hosting required. Teams/Enterprise get private marketplaces. Whether an end user
  can `/add-plugin` from an arbitrary unreviewed git URL is _unverified_ — docs emphasize the
  reviewed marketplace.
- Hooks: `hooks/hooks.json` in plugins, "automation scripts triggered by events (agent, Tab, or
  workspace lifecycle)"; exact event list not in the fetched page (Cursor's separate hooks docs
  cover `afterFileEdit`-style events — _not verified in this pass_).

### Gemini CLI

- Skills: four tiers (built-in, extension, user `~/.gemini/skills/` or `~/.agents/skills/`,
  workspace `.gemini/skills/` or `.agents/skills/`); `.agents/skills` wins within a tier. Commands:
  `gemini skills list/install/uninstall`, `/skills enable|disable|reload`; install takes a git URL
  with `--path` for a subdirectory — so individual grimoire skills are installable **today**:
  `gemini skills install https://github.com/toverux/grimoire --path plugins/cantrips/skills/tdd`
  (exact flag usage _unverified_ beyond the docs' mention of `--path`). Skills activate behind a
  per-skill consent prompt; no `disable-model-invocation` documented.
  Source: https://geminicli.com/docs/cli/skills/
- Extensions: `gemini-extension.json` at extension root (name, version, description required;
  mcpServers, settings, themes, etc. optional); bundle `skills/`, `commands/`, `hooks/hooks.json`,
  `policies/`. Install: `gemini extensions install <github-url|local path> [--ref --auto-update]`.
  Curated gallery at geminicli.com/extensions. One-repo-many-extensions is not documented;
  installing an extension from a repo subdirectory is _unverified_ — grimoire would likely need
  either one extension per plugin in separate installs from a local clone, or to accept
  skills-level (not plugin-level) distribution. Source: https://geminicli.com/docs/extensions/reference
- Hooks: official hooks system in `settings.json` and extension `hooks/hooks.json`; tool events are
  `BeforeTool` / `AfterTool` (regex matchers, JSON over stdin/stdout) — Claude's `PostToolUse` name
  is invalid there. Sources: https://geminicli.com/docs/hooks/,
  https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md

### OpenCode

- Skills: first-party; discovery in `.opencode/skills/`, `~/.config/opencode/skills/`, plus
  Claude-compat (`.claude/skills/`, `~/.claude/skills/`) and agents-compat (`.agents/skills/`,
  `~/.agents/skills/`). Frontmatter: `name`, `description`, optional `license`, `compatibility`,
  `metadata`. No `disable-model-invocation`; invocation policy is instead pattern-based
  `permission.skill` config (`allow`/`deny`/`ask`) per user. No skills registry.
  Source: https://opencode.ai/docs/skills/
- Plugins: JS/TS modules loaded from `.opencode/plugins/`, `~/.config/opencode/plugins/`, or the
  `"plugin"` array in opencode.json — which accepts npm packages **and git URLs**
  (`name@git+https://…#tag`, as EveryInc's install doc demonstrates). A ~30-line plugin can
  register grimoire's `plugins/*/skills/` directories (EveryInc does exactly this).
  Source: https://opencode.ai/docs/plugins/
- Hooks: plugin event API includes `tool.execute.before/after`, `file.edited`, permission events —
  a wards port is possible but as TypeScript against OpenCode's API, not a portable hooks.json.

### Amp (Sourcegraph)

- Skills: precedence `~/.config/agents/skills/` → `~/.agents/skills/` → `~/.config/amp/skills/` →
  project `.agents/skills/` → `.claude/skills/` → `~/.claude/skills/` → built-ins. Frontmatter
  `name`, `description`, optional bundled `mcp.json`. No packaging, manifest, or marketplace;
  toolboxes are deprecated. Source: https://ampcode.com/manual (agent skills + plugins sections)
- Plugins: local TypeScript files (`.amp/plugins/*.ts`, `~/.config/amp/plugins/*.ts`) exporting a
  function over `PluginAPI`; events `session.start`, `agent.start/end`, `tool.call`,
  `tool.result`; can register tools/commands/UI ("Plugins, Everywhere", 2026-05-28,
  https://ampcode.com/news/plugins-everywhere). No install-from-git distribution documented.
- For grimoire: nothing additive to ship; Amp users get grimoire skills by copying/symlinking into
  `.agents/skills/`. `disable-model-invocation` support _unverified_ (not in the manual's field
  list).

### Factory Droid

- Skills: `<repo>/.factory/skills/`, `~/.factory/skills/`, plus `.agent/skills/` compatibility
  (that path is per Factory's docs; note singular — _whether `.agents/skills` also works is
  unverified_). Frontmatter: `name`, `description`, `user-invocable` (default true),
  **`disable-model-invocation`** (default false). No marketplace or distribution mechanism.
  Source: https://docs.factory.ai/cli/configuration/skills
- Hooks: user-configured shell commands at `PreToolUse`, `PostToolUse`, `SessionStart`,
  `SessionEnd` etc. — Claude-like, but configured by the user, not shipped in a package.
  Source: https://docs.factory.ai/cli/configuration/hooks-guide

### Charm Crush

- Skills: Agent Skills standard; global paths `$CRUSH_SKILLS_DIR`, `~/.config/agents/skills/`,
  `~/.config/crush/skills/`, `~/.agents/skills/`, `~/.claude/skills/` (+ Windows LocalAppData
  variants); project paths `.agents/skills`, `.crush/skills`, `.claude/skills`, `.cursor/skills`;
  extra dirs via `options.skills_paths` (relative paths resolve from project root — a consuming
  project could point at a vendored grimoire checkout). `disable-model-invocation` is honored
  (present in README and `internal/skills/skills.go`); `options.disabled_skills` hides skills.
  Source: https://github.com/charmbracelet/crush README (skills section), checked via API.
- No plugin system, no marketplace, no hooks documented. Nothing additive to ship.

## Skill-frontmatter portability notes

- `disable-model-invocation`: honored by Claude Code, Cursor, Factory, Crush. Absent from OpenCode
  (permission config instead), Gemini CLI (consent prompts instead), and undocumented for Copilot,
  Goose, Amp, Antigravity. Per the open spec, unknown keys are tolerated, so grimoire's
  `version`/`source` keys and `disable-model-invocation` are safe everywhere; user-invoked-only
  semantics just degrade to model-invocable on harnesses that ignore the key.
- The wards `check-line-length` hook is TypeScript run via Node type-stripping. Every hooks-capable
  harness above runs arbitrary shell commands, so the script reuses; only the hook _config_ format
  differs (event name casing, matcher semantics, `${PLUGIN_ROOT}`-style variables).

## Recommendation

Ranked by value for cost, for grimoire specifically:

1. **GitHub Copilot CLI — do first.** Potentially zero repo changes: the existing
   `.claude-plugin/marketplace.json` location is recognized, and plugin dirs may already resolve.
   Action: test `copilot plugin marketplace add toverux/grimoire` + `/plugin install cantrips`;
   if plugin manifests fail, the fix is item 2's root `plugin.json`. Hooks port for wards is a
   small `hooks.json` translation (camelCase events). Largest reachable audience per unit effort.
2. **Shared root `plugin.json` per plugin — cheap triple play.** One additive file
   `plugins/<name>/plugin.json` (`$schema` antigravity, `name`, `version`, `description` — fields
   grimoire already syncs) simultaneously satisfies Antigravity, Goose Open Plugins, and Copilot
   CLI's documented manifest location. Extend `check-plugin-sync.ts` and release-please
   `extra-files` to cover it. Caveat: per-plugin install from a multi-plugin repo is unverified for
   `agy` and `goose` (clone + local-path install definitely works); Goose additionally gets the
   wards hook almost for free via `hooks/hooks.json` (`PostToolUse`, `${PLUGIN_ROOT}`).
3. **Cursor plugins — high value, one process gate.** Add `plugins/<name>/.cursor-plugin/plugin.json`
   (same fields as the Claude manifest, so sync-check extension is trivial) and a root
   `.cursor-plugin/marketplace.json` mirroring the existing ones. Cost is mostly the
   cursor.com/marketplace review submission; big audience once listed. Skills-only users can
   already consume grimoire via `.agents/skills` copies today.
4. **Gemini CLI — partial support is already free; full support is medium.** Document
   `gemini skills install <repo> --path plugins/<plugin>/skills/<skill>` now. Full plugin parity
   needs a `gemini-extension.json` per plugin plus an answer to subdirectory installs (open
   question); revisit when Antigravity/Gemini plugin stories converge (both are Google, both scan
   `.agents/`-family paths).
5. **OpenCode — small shim, decent payoff.** A tiny committed JS plugin (EveryInc pattern) that
   registers `plugins/*/skills/`, installed via `"plugin": ["grimoire@git+https://…"]`. Also the
   only route to a wards-equivalent there (`tool.execute.after`).
6. **Amp, Factory, Crush — documentation only.** No packaging/manifest exists to target; add a
   README section telling users to copy or symlink `plugins/<name>/skills/*` into `.agents/skills/`
   (works for all three plus most others). Zero repo restructuring; low ongoing cost.

Nothing investigated requires restructuring the tree: every viable integration is additive files
(root `plugin.json`, `.cursor-plugin/`, `gemini-extension.json`, an OpenCode shim), exactly like
the existing `.codex-plugin` pattern. The main new maintenance burden is manifest N-plication —
worth extending `check-plugin-sync.ts` before adding any of them.

### Open questions

- Does `copilot plugin install` resolve grimoire's `.claude-plugin/plugin.json` manifests, or does
  it require root `plugin.json`? (Primary docs say root; a secondary source says `.claude-plugin/`
  works. Test empirically.)
- Can `agy plugin install` and `goose plugin install` target a subdirectory of a multi-plugin git
  repo, or only a repo root / local path?
- What events does Antigravity's `hooks.json` support — is there a PostToolUse equivalent?
- Can Cursor users install a plugin from an arbitrary git URL without marketplace review (outside
  team marketplaces)?
- Does Gemini CLI's `gemini extensions install` accept a repo subdirectory, and does Gemini plan
  `disable-model-invocation` support?
