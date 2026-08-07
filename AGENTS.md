# AGENTS.md

## Project overview

`cantrips` is a multi-harness (Claude Code + Codex) plugin of curated agent skills: the core engineering loop (/grilling → /spec → /tickets → /implement + /tdd → /simplify → /review-gate → /commit → /compound) plus its supporting skills.
A feature's spec and tickets are disposable working material under a gitignored `.scratch/`, deleted once the feature closes ([docs/agents/cantrips-loop.md](docs/agents/cantrips-loop.md)); what survives is the skills, git history, the decision records in `docs/adr/`, and the deferred ideas in [IDEAS.md](IDEAS.md).

The repository **is** the plugin: the manifests, the skills tree, and the catalog files that publish it all sit at the root, and an install copies the whole checkout.
Everything else here (`docs/`, this file) therefore rides along into an install; keep it small and keep nothing secret in it.

## There is no build

This repository is content, not code: no dependencies, no package manager, no build, no test suite, no lint step.
Nothing needs installing to work on it, and there is no command to run before or after an edit.
The one mechanical convention is [.editorconfig](.editorconfig) (LF, UTF-8, two-space indent, trailing newline, 100-column guide).
[mise.toml](mise.toml) holds dogfooding conveniences only — `mise run dev:sync-install` mirrors the working tree over the local installs (Claude Code and Codex CLI) so unreleased edits are usable from other projects — and no edit has to pass through it.

Consequently the invariants below are honored by hand.
Nothing fails when one drifts, so check them yourself whenever you touch the files they cover.

## Repository structure

- `skills/<skill>/SKILL.md`: the one shared skills tree; both harnesses auto-discover it.
- `.claude-plugin/plugin.json` + `.codex-plugin/plugin.json`: the dual manifests; shared fields must stay identical.
- `.claude-plugin/marketplace.json` + `.agents/plugins/marketplace.json`: the catalog files that publish this repo as an installable plugin (Claude Code takes a string `source`, Codex CLI the object form; both point at `./`).
- `FORKS.md`: the fork divergence ledger — every upstream skill listed, forks with how they deliberately differ and why, the rest marked not ported; `/sync-upstream` and human readers both consult it.
- `docs/agents/cantrips-loop.md`: the per-repo loop config — what the six storage verbs translate to here, and which knowledge stores are enabled (`docs/adr/` on, `docs/solutions/` off).
  Storage-touching skills read it instead of `skills/setup-cantrips-loop/defaults.md`; `/setup-cantrips-loop` rewrites it.
- `.scratch/<feature>/`: the spec and tickets of a feature in flight, gitignored and disposable — deleted when the feature closes, which is the human's act.
- `docs/adr/`: durable decision records with supersession chains, written only through `/compound`'s user gate and read back by `/spec`.
- `docs/research/`: primary-source research notes, written by `/research`.

## How to add or revise a skill

1. Write against the `/writing-for-agents` standard (`skills/writing-for-agents/SKILL.md`): predictability, leading words, checkable completion criteria, progressive disclosure, positive phrasing, no no-ops, prune sediment.
   Forks get leaner than upstream, never heavier.
2. Frontmatter: `name`, `description` (trigger-rich for model-invoked skills; one human-facing line + `disable-model-invocation: true` for user-invoked ones), `argument-hint` where an argument is meaningful, `version` (per-skill semver; bumped per the versioning section below), and for forks `source` recording upstream provenance, e.g. `source: mattpocock/skills@1.2.0 (to-spec)`.
   `version` and `source` are unofficial keys the loaders ignore.
   Changing a fork's body beyond its upstream text is a divergence: record it in [FORKS.md](FORKS.md) in the same edit, so `/sync-upstream` preserves it instead of merging upstream's wording back.
   A passage carried byte-identical stays that way even where a quality pass finds a real improvement in it: skip the finding and name the reason, since the edit trades a permanent sync divergence for a redundancy upstream chose.
   Where a fork needs a name for something upstream already names, take upstream's name.
   Every skill carries an `agents/openai.yaml` sidecar (`interface.display_name`, `interface.short_description`, `policy.allow_implicit_invocation`): `false` for user-invoked skills — Codex CLI ignores `disable-model-invocation`, so the sidecar is what stops auto-firing there — and `true` for model-invoked ones, stating the intent explicitly rather than leaning on Codex defaults.
   The sidecar's `allow_implicit_invocation` is always the logical inverse of the SKILL.md `disable-model-invocation`; a skill shipped without a sidecar auto-fires in Codex whatever its frontmatter says.
3. Pipeline skills end with a flow pointer naming the next step(s) of the loop and marking a user-invoked target `(user-invoked)`; keep those pointers consistent when renaming or inserting skills.
   The shared presentation format lives in [flow-pointers.md](skills/writing-for-agents/flow-pointers.md); skills point at that file instead of restating it, wording the pointer verb-first as an instruction to read it.
4. A sibling reference file that declares what it extends or replaces must cover every path the parent skill can take — the `low` inline pass and the no-sub-agent fallback included, since neither reaches the sections a main-path declaration names.
   A declaration that names only the main path leaves the other paths running the parent's own rules, which is how a mode degrades silently on one harness while reading correct on the other.
5. Every step that dispatches a sub-agent asks for a background dispatch where the harness supports one, and carries the parenthetical "(Claude Code: do not use `run_in_background: false`)".
   A blocking dispatch freezes the session for as long as the agent runs, which degrades the user experience and is invisible from inside the skill.
   This is the sole harness parameter a skill body may name; keep the wording identical across skills so a reader meets one clause, not five.
6. Distributability rule: the plugin must be installable by anybody — no user-specific paths, names, or personal conventions inside skill bodies.
   Personalization belongs in the user's own global CLAUDE.md.
7. Cross-skill references use this repo's names (`/spec`, `/commit`, `/compound`…), never upstream names.
   In docs and prose, skill names always carry the `/` prefix, whatever the invocation mode.
8. Markdown intended for agents (SKILL.md files and their references, AGENTS.md, specs) goes one sentence per line, and is exempt from the 100-column guide.
   Text carried from an upstream is the exception rule 2 already covers: its line breaks stay upstream's, however long its lines run, since reflowing re-creates the whole paragraph as a diff at every sync.
   Human-facing docs (README.md, WHY.md, NOTICE.md, IDEAS.md) wrap at ~100 columns instead.

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
  One bump per skill per release, sized to the largest change in it — successive edits to one unreleased change are one change, not three.
  Never hand-edit the plugin.json versions or the release manifest.

## Boundaries

These govern your own conduct here, not what a skill may instruct its own users to do.

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
