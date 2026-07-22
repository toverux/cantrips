# AGENTS.md

## Project overview

`grimoire` is a multi-plugin, multi-harness (Claude Code + Codex CLI) marketplace of curated agent skills.
The design contract is [docs/specs/grimoire-v1.md](docs/specs/grimoire-v1.md), amended by later specs in `docs/specs/` (e.g. [review-gate.md](docs/specs/review-gate.md), which supersedes its code-review and grill-me rows); deferred ideas live in [IDEAS.md](IDEAS.md).
Plugins:

- `plugins/cantrips/`: the core engineering loop (/grilling → /spec → /tickets → /implement + /tdd → /simplify → /review-gate → /commit → /compound) plus its supporting skills.
  The flagship plugin.
- `plugins/wards/`: style guard — the `/general-code-style` skill + the `check-line-length` PostToolUse hook (executable TypeScript, run by Node via type stripping).
- `plugins/typescript/`, `plugins/csharp/`: language style skills.

Everything a plugin ships MUST live inside its `plugins/<name>/` directory (marketplace installs copy only that subtree).
New plugins get sibling directories, entries in both marketplace files, and a release-please package entry.

## Tech stack

- [mise-en-place](https://mise.jdx.dev): dev tools, env vars, and task runner (`mise tasks`).
- Bun + the root `package.json`: lint/format tooling (oxfmt, oxlint, tsc via [@toverux/blanc-hopital](https://github.com/toverux/blanc-hopital-config) shared configs) and lefthook pre-commit hooks.

## Repository structure

- `.claude-plugin/marketplace.json`: Claude Code marketplace file (string `source` entries).
- `.agents/plugins/marketplace.json`: Codex CLI marketplace file (object-form `source` entries).
- `plugins/<name>/.claude-plugin/plugin.json` + `plugins/<name>/.codex-plugin/plugin.json`: the dual manifests; shared fields must stay identical (enforced, see below).
- `plugins/<name>/package.json`: private release-please version anchor, not a workspace package.
- `plugins/<name>/skills/<skill>/SKILL.md`: one shared skills tree per plugin; both harnesses auto-discover it.
- `plugins/wards/hooks/`: `hooks.json` (auto-discovered by Claude Code) + the hook sources.
- `scripts/check-plugin-sync.ts`: consistency check for the dual manifests and marketplace pair.
- `docs/specs/`: this repo's own specs (dogfooding the cantrips convention).
- `agents-md-template.md`: the AGENTS.md starter template distributed to Morgan's projects; not a plugin component.

## Commands

Run `mise tasks` for the full list.
Do NOT use npx; prefer mise shortcuts, or bun/bunx if there is no dedicated shortcut.

- `mise check:agents`: read-only verify (tsc, oxlint, oxfmt, plugin-sync) with agent-friendly output.
  `check:*` write nothing; `mise fix` applies the auto-fixes (oxlint then oxfmt).
- `mise check:plugin-sync`: just the manifest/marketplace consistency check.

Always run the appropriate check commands after performing changes; but do it at the end of the editing session, not in the middle.

## How to add or revise a skill

1. Write against the `/writing-great-skills` standard (`plugins/cantrips/skills/writing-great-skills/SKILL.md`): predictability, leading words, checkable completion criteria, progressive disclosure, positive phrasing, no no-ops, prune sediment.
   Forks get leaner than upstream, never heavier.
2. Frontmatter: `name`, `description` (trigger-rich for model-invoked skills; one human-facing line + `disable-model-invocation: true` for user-invoked ones), `argument-hint` where an argument is meaningful, `version` (per-skill semver; bump on every content change), and for forks `source` recording upstream provenance, e.g. `source: mattpocock/skills@1.1.0 (to-spec)`.
   `version` and `source` are unofficial keys the loaders ignore.
   Every skill carries an `agents/openai.yaml` sidecar (`interface.display_name`, `interface.short_description`, `policy.allow_implicit_invocation`): `false` for user-invoked skills — Codex CLI ignores `disable-model-invocation`, so the sidecar is what stops auto-firing there — and `true` for model-invoked ones, stating the intent explicitly rather than leaning on Codex defaults.
3. Pipeline skills end with a flow pointer naming the next step(s) of the loop; keep those pointers consistent when renaming or inserting skills.
4. Distributability rule: every plugin must be installable by anybody — no user-specific paths, names, or personal conventions inside skill bodies.
   Personalization belongs in the user's own global CLAUDE.md.
5. Cross-skill references use the grimoire names (`/spec`, `/commit`, `/compound`…), never upstream names.
   In docs and prose, skill names always carry the `/` prefix, whatever the invocation mode.
6. Markdown intended for agents (SKILL.md files and their references, AGENTS.md, specs) is written one sentence per line and is exempt from the 100-character line limit.
   Human-facing docs (README.md, NOTICE.md, IDEAS.md) wrap at ~100 columns instead.

## Dual-manifest and marketplace sync

Each plugin has two `plugin.json` manifests (Claude Code + Codex CLI; the Codex schema is a superset with `./`-relative component pointers) and the repo has two marketplace files.
Shared metadata is duplicated by necessity.
`scripts/check-plugin-sync.ts` (via `mise check:plugin-sync`, wired into `mise check`, `mise check:agents`, CI, and the lefthook pre-commit) enforces:

- shared plugin.json fields identical between the two manifests, and version equal to the plugin's `package.json` anchor;
- both marketplace files listing the same plugins, sources pointing at existing `./plugins/<name>` directories, and descriptions matching the plugin.json;
- every `plugins/<name>` directory present in both marketplace files;
- every skill carrying an `agents/openai.yaml` sidecar whose `allow_implicit_invocation` is the inverse of the skill's `disable-model-invocation` frontmatter.

When editing plugin metadata, edit BOTH manifests (and both marketplace files for descriptions).

## Versioning and releases

release-please (`.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`) maintains a rolling release PR from Conventional Commits; merging it bumps versions, updates changelogs, tags (`<plugin>-vX.Y.Z`), and creates GitHub Releases.
Per plugin: the private `package.json` is the version anchor, synced via `extra-files` into both plugin.json manifests; `cantrips` (the flagship) also syncs the root `package.json`.
There is no root release unit: root-only changes never release.

- Commit messages follow Conventional Commits; scope by plugin when it helps, e.g. `feat(cantrips): …`.
  `feat`/`fix` trigger releases; `chore`/`refactor`/`docs` do not.
  Anything user-facing (skills, hooks, manifests) must be `feat` or `fix`.
- Pre-1.0: `feat` bumps minor, `fix` bumps patch.
  1.0.0 only via a deliberate `Release-As:` footer.
- Per-skill `version` frontmatter is bumped by hand when a skill changes; plugin versions are release-please's job.
  Never hand-edit plugin.json versions.

## Boundaries

Never:

- Create a git branch, stage files, or commit work yourself unless the user expressly told you so.
- Commit secrets, tokens, `.env` files, dumps, or credentials.
- Put user-specific paths or personal conventions inside a plugin (see distributability above).

Ask first before:

- Adding a dependency.
- Adding a new plugin or renaming a skill (both touch manifests, marketplaces, release config, and README).

## Preferred agent behavior

- Start by inspecting existing patterns (a neighboring skill, the template pieces this repo was built from).
- CLAUDE.md files here are committed relative symlinks to AGENTS.md; edit AGENTS.md, never the symlink.
- Propose updates to this file when you notice a pattern or introduce changes that deserve to be documented for future sessions.
