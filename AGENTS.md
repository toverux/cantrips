# AGENTS.md

## Project overview

`cantrips` is a multi-harness (Claude Code + Codex CLI) plugin of curated agent skills: the core engineering loop (/grilling → /spec → /tickets → /implement + /tdd → /simplify → /review-gate → /commit → /compound) plus its supporting skills.
The design contract is [docs/specs/cantrips-v1.md](docs/specs/cantrips-v1.md), amended by later specs in `docs/specs/` (e.g. [review-gate.md](docs/specs/review-gate.md), which supersedes its code-review and grill-me rows); deferred ideas live in [IDEAS.md](IDEAS.md).

The repository **is** the plugin: the manifests, the skills tree, and the catalog files that publish it all sit at the root, and an install copies the whole checkout.
Development-only files (`docs/`, `scripts/`, the tooling configs) therefore ride along into an install; keep them small and keep nothing secret in them.

## Tech stack

- [mise-en-place](https://mise.jdx.dev): dev tools, env vars, and task runner (`mise tasks`).
- Bun + `package.json`: lint/format tooling (oxfmt, oxlint, tsc via [@toverux/blanc-hopital](https://github.com/toverux/blanc-hopital-config) shared configs) and lefthook pre-commit hooks.
- Node 22.6 runs `.agents/hooks/check-line-length.ts` directly through `--experimental-strip-types`, which erases types without rewriting code, so the hook stays **erasable-syntax-only**: no class access modifiers, no parameter properties, no enums, no namespaces.
  `tsc` accepts all four, so the compiler is not the gate here; the production runtime is.

## Repository structure

- `skills/<skill>/SKILL.md`: the one shared skills tree; both harnesses auto-discover it.
- `.claude-plugin/plugin.json` + `.codex-plugin/plugin.json`: the dual manifests; shared fields must stay identical (enforced, see below).
- `.claude-plugin/marketplace.json` + `.agents/plugins/marketplace.json`: the catalog files that publish this repo as an installable plugin (Claude Code takes a string `source`, Codex CLI the object form; both point at `./`).
- `package.json`: private release-please version anchor plus the dev tooling.
- `scripts/check-plugin-sync.ts`: consistency check for the dual manifests, the catalog pair, and the skill sidecars.
- `.agents/rules/` and `.agents/hooks/`: this repo's own agent rules and hook, hand-maintained (with `.claude/rules/` symlinking into the rules, and `.claude/settings.json` wiring the hook).
  The hook is executed on every edit here, so it is linted and type-checked like any other source file.
- `docs/specs/`: this repo's own specs (dogfooding its own convention).

## Commands

Run `mise tasks` for the full list.
Do NOT use npx; prefer mise shortcuts, or bun/bunx if there is no dedicated shortcut.

- `mise check:agents`: read-only verify (tsc, oxlint, oxfmt, plugin-sync) with agent-friendly output.
  `check:*` write nothing; `mise fix` applies the auto-fixes (oxlint then oxfmt).
- `mise check:plugin-sync`: just the manifest/catalog/sidecar consistency check.

Always run the appropriate check commands after performing changes; but do it at the end of the editing session, not in the middle.

## How to add or revise a skill

1. Write against the `/writing-great-skills` standard (`skills/writing-great-skills/SKILL.md`): predictability, leading words, checkable completion criteria, progressive disclosure, positive phrasing, no no-ops, prune sediment.
   Forks get leaner than upstream, never heavier.
2. Frontmatter: `name`, `description` (trigger-rich for model-invoked skills; one human-facing line + `disable-model-invocation: true` for user-invoked ones), `argument-hint` where an argument is meaningful, `version` (per-skill semver; bump on every content change), and for forks `source` recording upstream provenance, e.g. `source: mattpocock/skills@1.1.0 (to-spec)`.
   `version` and `source` are unofficial keys the loaders ignore.
   Every skill carries an `agents/openai.yaml` sidecar (`interface.display_name`, `interface.short_description`, `policy.allow_implicit_invocation`): `false` for user-invoked skills — Codex CLI ignores `disable-model-invocation`, so the sidecar is what stops auto-firing there — and `true` for model-invoked ones, stating the intent explicitly rather than leaning on Codex defaults.
3. Pipeline skills end with a flow pointer naming the next step(s) of the loop and marking a user-invoked target `(user-invoked)`; keep those pointers consistent when renaming or inserting skills.
   The shared presentation format (a final-paragraph italic blockquote, `Next:` for one step versus `Next steps:` bullets for several, each pointer closing on a one-clause rationale) lives in [flow-pointers.md](skills/writing-great-skills/flow-pointers.md); skills point at that file instead of restating it.
4. Distributability rule: the plugin must be installable by anybody — no user-specific paths, names, or personal conventions inside skill bodies.
   Personalization belongs in the user's own global CLAUDE.md.
5. Cross-skill references use this repo's names (`/spec`, `/commit`, `/compound`…), never upstream names.
   In docs and prose, skill names always carry the `/` prefix, whatever the invocation mode.
6. Markdown intended for agents (SKILL.md files and their references, AGENTS.md, specs) is written one sentence per line and is exempt from the 100-character line limit.
   Human-facing docs (README.md, NOTICE.md, IDEAS.md) wrap at ~100 columns instead.

## Dual-manifest and catalog sync

The plugin has two `plugin.json` manifests (Claude Code + Codex CLI; the Codex schema is a superset) and two catalog files.
Shared metadata is duplicated by necessity.
`scripts/check-plugin-sync.ts` (via `mise check:plugin-sync`, wired into `mise check`, `mise check:agents`, CI, and the lefthook pre-commit) enforces:

- shared plugin.json fields identical between the two manifests, and version equal to the `package.json` anchor;
- both catalog files publishing exactly one plugin, named after the manifests, sourced at `./`, and described in the manifests' own words;
- every skill carrying an `agents/openai.yaml` sidecar whose `allow_implicit_invocation` is the inverse of the skill's `disable-model-invocation` frontmatter.

When editing plugin metadata, edit BOTH manifests (and both catalog files for the description).

## Versioning and releases

release-please (`.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`) maintains a rolling release PR from Conventional Commits; merging it bumps the version, updates `CHANGELOG.md`, tags `vX.Y.Z`, and creates a GitHub Release.
There is one release unit: the private `package.json` is the version anchor, synced via `extra-files` into both plugin.json manifests.

- Commit messages follow Conventional Commits.
  `feat`/`fix` trigger releases; `chore`/`refactor`/`docs` do not.
  Anything user-facing (skills, hooks, manifests) must be `feat` or `fix`.
- Pre-1.0: `feat` bumps minor, `fix` bumps patch.
  1.0.0 only via a deliberate `Release-As:` footer.
- Per-skill `version` frontmatter is bumped by hand when a skill changes; the plugin version is release-please's job.
  Never hand-edit the plugin.json versions.

## Boundaries

Never:

- Create a git branch, stage files, or commit work yourself unless the user expressly told you so.
- Commit secrets, tokens, `.env` files, dumps, or credentials.
- Put user-specific paths or personal conventions inside the plugin (see distributability above).

Ask first before:

- Adding a dependency.
- Renaming a skill (it touches the manifests' reach, the flow pointers, and the README).

## Preferred agent behavior

- Start by inspecting existing patterns (a neighboring skill, the template pieces this repo was built from).
- CLAUDE.md files here are committed relative symlinks to AGENTS.md; edit AGENTS.md, never the symlink.
- Propose updates to this file when you notice a pattern or introduce changes that deserve to be documented for future sessions.

## Project rules

These rules live in `.agents/rules/`; Claude Code loads them natively through `.claude/rules/`, and Codex CLI reads them here.

- Before editing any file, read `.agents/rules/general-code-style.md`.
- Before editing TypeScript or JavaScript files, read `.agents/rules/typescript-code-style.md`.
- Before editing C# files, read `.agents/rules/cs-code-style.md`.
