# AGENTS.md

## Project overview

`cantrips` is a multi-harness (Claude Code + Codex) plugin of curated agent skills: the core engineering loop (/grilling → /spec → /tickets → /implement + /tdd → /simplify → /review-gate → /commit → /compound) plus its supporting skills.
Specs for individual skills live in `docs/specs/` (e.g. [review-gate.md](docs/specs/review-gate.md)); deferred ideas live in [IDEAS.md](IDEAS.md).

The repository **is** the plugin: the manifests, the skills tree, and the catalog files that publish it all sit at the root, and an install copies the whole checkout.
Everything else here (`docs/`, this file) therefore rides along into an install; keep it small and keep nothing secret in it.

## There is no build

This repository is content, not code: no dependencies, no package manager, no build, no test suite, no lint step.
Nothing needs installing to work on it, and there is no command to run before or after an edit.
The one mechanical convention is [.editorconfig](.editorconfig) (LF, UTF-8, two-space indent, trailing newline, 100-column guide).

Consequently the invariants below are honored by hand.
Nothing fails when one drifts, so check them yourself whenever you touch the files they cover.

## Repository structure

- `skills/<skill>/SKILL.md`: the one shared skills tree; both harnesses auto-discover it.
- `.claude-plugin/plugin.json` + `.codex-plugin/plugin.json`: the dual manifests; shared fields must stay identical.
- `.claude-plugin/marketplace.json` + `.agents/plugins/marketplace.json`: the catalog files that publish this repo as an installable plugin (Claude Code takes a string `source`, Codex CLI the object form; both point at `./`).
- `docs/specs/`: specs for the work done here (dogfooding the `/spec` convention).
- `docs/research/`: primary-source research notes, written by `/research`.

## How to add or revise a skill

1. Write against the `/writing-great-skills` standard (`skills/writing-great-skills/SKILL.md`): predictability, leading words, checkable completion criteria, progressive disclosure, positive phrasing, no no-ops, prune sediment.
   Forks get leaner than upstream, never heavier.
2. Frontmatter: `name`, `description` (trigger-rich for model-invoked skills; one human-facing line + `disable-model-invocation: true` for user-invoked ones), `argument-hint` where an argument is meaningful, `version` (per-skill semver; bump on every content change), and for forks `source` recording upstream provenance, e.g. `source: mattpocock/skills@1.1.0 (to-spec)`.
   `version` and `source` are unofficial keys the loaders ignore.
   Every skill carries an `agents/openai.yaml` sidecar (`interface.display_name`, `interface.short_description`, `policy.allow_implicit_invocation`): `false` for user-invoked skills — Codex CLI ignores `disable-model-invocation`, so the sidecar is what stops auto-firing there — and `true` for model-invoked ones, stating the intent explicitly rather than leaning on Codex defaults.
   The sidecar's `allow_implicit_invocation` is always the logical inverse of the SKILL.md `disable-model-invocation`; a skill shipped without a sidecar auto-fires in Codex whatever its frontmatter says.
3. Pipeline skills end with a flow pointer naming the next step(s) of the loop and marking a user-invoked target `(user-invoked)`; keep those pointers consistent when renaming or inserting skills.
   The shared presentation format (a final-paragraph italic blockquote, `Next:` for one step versus `Next steps:` bullets for several, each pointer closing on a one-clause rationale) lives in [flow-pointers.md](skills/writing-great-skills/flow-pointers.md); skills point at that file instead of restating it.
4. Distributability rule: the plugin must be installable by anybody — no user-specific paths, names, or personal conventions inside skill bodies.
   Personalization belongs in the user's own global CLAUDE.md.
5. Cross-skill references use this repo's names (`/spec`, `/commit`, `/compound`…), never upstream names.
   In docs and prose, skill names always carry the `/` prefix, whatever the invocation mode.
6. Markdown intended for agents (SKILL.md files and their references, AGENTS.md, specs) is written one sentence per line and is exempt from the 100-column guide.
   Human-facing docs (README.md, NOTICE.md, IDEAS.md) wrap at ~100 columns instead.

## Dual-manifest and catalog sync

The plugin has two `plugin.json` manifests (Claude Code + Codex CLI; the Codex schema is a superset) and two catalog files, because neither harness reads the other's.
Shared metadata is duplicated by necessity, and keeping the copies honest is a manual duty:

- the shared plugin.json fields (`name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`) stay identical between the two manifests;
- both catalog files publish exactly one plugin, named after the manifests, sourced at `./`, and described in the manifests' own words;
- every skill directory carries its `agents/openai.yaml` sidecar.

When editing plugin metadata, edit BOTH manifests, and both catalog files for the description.

## Versioning and releases

release-please (`.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`) maintains a rolling release PR from Conventional Commits; merging it bumps the version, updates `CHANGELOG.md`, tags `vX.Y.Z`, and creates a GitHub Release.
There is one release unit, and no version file to maintain: `.release-please-manifest.json` is the version of record, mirrored via `extra-files` into both plugin.json manifests.
The `simple` release type would also write a `version.txt`, but it only updates that file when it already exists, so leaving it absent costs one skipped-file warning in the workflow log and nothing else.

- Commit messages follow Conventional Commits.
  `feat`/`fix` trigger releases; `chore`/`refactor`/`docs` do not.
  Anything user-facing (skills, manifests) must be `feat` or `fix`.
- Plain semver: a breaking change bumps major, `feat` bumps minor, `fix` bumps patch.
- Per-skill `version` frontmatter is bumped by hand when a skill changes; the plugin version is release-please's job.
  Never hand-edit the plugin.json versions or the release manifest.

## Boundaries

Never:

- Create a git branch, stage files, or commit work yourself unless the user expressly told you so.
- Commit secrets, tokens, `.env` files, dumps, or credentials.
- Put user-specific paths or personal conventions inside the plugin (see distributability above).
- Reintroduce a build step, a dependency, or a check script without asking; their absence is deliberate.

Ask first before:

- Renaming a skill (it touches the flow pointers, the README roster, and any spec naming it).

## Preferred agent behavior

- Start by inspecting existing patterns: read a neighboring skill before writing a new one.
- CLAUDE.md here is a committed relative symlink to AGENTS.md; edit AGENTS.md, never the symlink.
- Propose updates to this file when you notice a pattern or introduce changes that deserve to be documented for future sessions.
