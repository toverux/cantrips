# Wards v2: Scrolls

Status: implemented 2026-07-24.
Origin: grilling interview of 2026-07-24 (Q1–Q15 + amendments).
Amends [grimoire-v1.md](grimoire-v1.md): supersedes its `wards`, `typescript`, and `csharp` plugin rows and the `general-guidelines` skill row.

## Problem Statement

The style guidance (`general-code-style`, `typescript-code-style`, `cs-code-style`, `general-guidelines`) and the `check-line-length` hook are distributed as marketplace plugins, and that distribution model is wrong three ways:

- They are opinionated personal conventions, yet they ship as public plugins of this repo, implying general applicability they don't have.
- A project's code style belongs to the project — committed with it, applying to every contributor — not to whichever contributors happened to install an optional plugin.
- Skill-based delivery triggers unreliably: a style skill the model forgets to load is a style that silently doesn't apply.
  Claude Code rules (`.claude/rules/`, with `paths:` glob scoping) load deterministically, but rules cannot be shipped in plugins.

## Solution

`wards` becomes a generic, agent-driven installer: it transcribes **scrolls** — rules, hooks, and templates — from any git repository into a project (or the user's global config), where they are committed and versioned like any other file.
Each installed scroll carries provenance frontmatter (source, version, recorded local deltas), so the updater can pull upstream improvements without erasing local customization: the agent supplies the judgment, a small zero-dependency CLI supplies the mechanics.
The opinionated content leaves the plugin system entirely and moves to a top-level `example-scrolls/` directory — this repo becomes the reference _source_, while the `wards` plugin stays a fully generic _vehicle_ anyone can point at any source.
The `typescript` and `csharp` plugins are deleted; `cantrips` sheds `general-guidelines`.

## User Stories

1. As a project maintainer, I want code style rules committed inside my repository, so that every contributor's agent applies them without installing anything.
2. As a project maintainer, I want to install curated rules from a git repository with one command, so that I don't hand-copy and hand-maintain style files.
3. As a wards user, I want language rules scoped to file globs, so that they load deterministically when matching files are touched instead of depending on a model's judgment to load a skill.
4. As a wards user, I want to customize a scroll at install time (e.g. relax the line limit), so that the installed rule matches my project's reality from day one.
5. As a wards user, I want my customizations recorded as deltas in the file's provenance frontmatter, so that future updates understand and preserve my intent.
6. As a wards user, I want `/wards update` to merge upstream changes into my locally-modified scrolls, so that I get improvements without losing my preferences.
7. As a wards user, I want `/wards status` to show installed scrolls, their sources, and available updates across both project and user scope, so that I can see drift at a glance.
8. As a wards user, I want to install personal-preference scrolls at user-global scope, so that behavioral guidance follows me across projects without polluting shared repos.
9. As a wards user, I want the installer to recommend a scope per scroll (project vs user) while letting me override it, so that sensible defaults don't become constraints.
10. As a multi-harness user, I want one canonical copy of each scroll with per-harness integrations derived from it, so that Claude Code and Codex CLI stay consistent without duplicate maintenance.
11. As a multi-harness user, I want wards to detect which harnesses my project uses and propose the matching install methods, so that I only confirm choices instead of researching mechanisms.
12. As a Codex CLI user, I want installed rules referenced from a managed AGENTS.md block with their applicability conditions, so that Codex consumes the same content despite lacking scoped rules.
13. As a Claude Code user, I want rules integrated into `.claude/rules/` with translated `paths:` frontmatter, so that the harness's native conditional loading does the triggering.
14. As a Claude Code user, I want the line-length hook installed as a committed project file wired into project settings, so that the check runs for every contributor, not just plugin installers.
15. As a wards user, I want to install a file from a repository that has never heard of wards, so that any skill or document on GitHub is one command away from being a managed, updatable part of my project.
16. As a wards user, I want unversioned upstream files tracked by commit hash, so that updates work even when a source doesn't maintain version numbers.
17. As a scroll author, I want my source repository to need no manifest — just files carrying ward metadata — so that there is nothing to keep in sync and nothing to drift.
18. As a scroll author, I want to declare kind, description, version, applicability globs, and recommended scope in the scroll itself, so that the file is self-describing wherever it travels.
19. As a hook author, I want ward metadata in a line-comment header of the executable file, so that hooks in any language remain single self-contained files.
20. As a project maintainer, I want an AGENTS.md starter template installable and updatable as a scroll, so that structural improvements to the template can be proposed against my heavily-customized file instead of overwriting it.
21. As a wards user, I want a single file to be able to aggregate several sources (e.g. AGENTS.md holding both a template ancestry and a managed pointer block), so that provenance stays accurate for composite files.
22. As a wards user, I want update and repeat installs to infer the source from what's already installed, so that I only name a source the first time.
23. As a wards user, I want wards to have no baked-in default source, so that the tool carries no one's personal opinions; my own default lives in my global CLAUDE.md.
24. As an agent running /wards, I want a CLI that answers "what does this source offer" and "what is installed and outdated" as JSON, so that I spend my context on judgment (merges, customization dialogs) instead of mechanical scanning.
25. As the grimoire maintainer, I want the repo's own scroll set validated by the check suite, so that a malformed ward header fails CI instead of failing a user's install.
26. As the grimoire maintainer, I want grimoire itself to consume its own scrolls through a real `/wards install`, so that the end-to-end flow is dogfooded continuously.
27. As a grimoire user reading the README, I want a clear presentation of wards' dynamic, multi-kind model versus static copiers like `npx skills`, so that I understand what the extra machinery buys me.
28. As a plugin consumer, I want `/wards` to be strictly user-invoked in both harnesses, so that no agent starts installing files into my project on its own initiative.

## Implementation Decisions

### The scroll format

- A **scroll** is a single file carrying ward metadata; kinds: `rule` (Markdown), `hook` (executable script), `template` (Markdown scaffold).
- Markdown scrolls carry metadata as YAML frontmatter; executable scrolls carry the same YAML in a leading **line-comment header** (`// ward:` style).
  The parser auto-detects the comment token from the file's first line (`//`, `#`, `--`, `;`), strips token + one space per line, and parses the YAML inside.
  Block comments are unsupported by design; line comments cover every target language with one trivial parser.
- Source-side metadata (authored by the scroll author): kind, description, per-scroll semver, neutral applicability globs (e.g. `**/*.{ts,tsx}`), recommended scope (`project` or `user`), and for hooks a neutral wiring declaration (fires-after-file-edit event).
- Installed-side metadata (written by the installer): a **list** of provenance entries, each holding source repository, path within source, upstream version last applied, and a prose description of local deltas.
  A list, not a single entry, because composite files (AGENTS.md) can aggregate several upstreams.
- Version fallback: when an upstream file carries no version, the provenance records the source commit hash instead.

### Sources and discovery

- A source is a git URL, with `owner/repo` GitHub shorthand and an optional ref.
  Fetching is a clone into a temp dir; the user's existing git auth covers private sources.
- **No manifest file.**
  Discovery scans the clone for files bearing ward metadata; the CLI assembles the offering in memory.
  Zero drift; sources are exactly as self-describing as their files.
- Foreign files (no ward metadata) are installable by explicit path; the agent synthesizes the provenance on install (version, or commit hash) so they become updatable like native scrolls.
- No baked-in default source.
  First install in a scope requires a source argument; afterwards, sources are inferred from installed provenance.
  Personal defaults belong in the user's own global CLAUDE.md, per the repo's personalization philosophy.

### Install targets and harness integrations

- Canonical neutral homes: `.agents/rules/` and `.agents/hooks/` in a project; the mirror layout under `~/.agents/` at user scope.
  Scope is a root-path parameter; one mental model, one code path.
- A template never lands in `.agents/`: it describes a file the project already owns, so its provenance rides in that file's own ward block.
  **Narrowed 2026-07-25:** that file is `AGENTS.md` or `.codex/AGENTS.md`, relative to the scope root, and nowhere else.
  `status` scans those two fixed paths alongside the canonical trees, in both scopes, which is what makes template drift checkable at all — recorded anywhere else, a template is invisible to every command.
  A file at either path carrying no ward header is passed over rather than reported `foreign`: unlike a file sitting in a canonical tree, a project's own AGENTS.md having nothing to do with wards is the ordinary case.
- The main `/wards` SKILL.md is harness-neutral; each harness's mechanics live in a reference file (progressive disclosure), so supporting a new harness means adding a reference file.
  Wards detects the harnesses present (`.claude/`, `.codex/`, AGENTS.md…), proposes the matching integration methods, and the user chooses.
- Claude Code integration: symlink from `.claude/rules/` to the canonical file where symlinks work, wards-managed copy otherwise; neutral globs translate to `paths:` frontmatter; a path-less scroll stays unconditional.
  Hooks wire into the project's committed `.claude/settings.json` (user scope: `~/.claude/`).
- Codex CLI integration: a wards-managed, clearly-marked block in AGENTS.md (`~/.codex/AGENTS.md` at user scope) holding conditional pointer lines ("before editing TypeScript files, read `<canonical path>`").
  Codex has no scoped-instruction or hook mechanism (verified 2026-07-24); hooks are skipped for Codex.
- Derived artifacts (copies, managed blocks) are wards-owned: users edit only the canonical file; the updater regenerates derivations.

### Update flow

- The updater compares installed provenance against the source clone, then performs a three-way merge in a temp dir: the old upstream baseline (recovered from the source's git history at the recorded version), the new upstream, and the local file, via `git merge-file`.
  Conflicts are resolved by the agent with `/resolving-merge-conflicts` when available (soft dependency, graceful fallback), using the recorded delta notes as semantic context for why the local side diverges.
- Template scrolls get a different merge posture: a project's AGENTS.md diverges ~100% by design, so update means diffing old-template→new-template and proposing the structural improvements against the project's file, never re-transcribing.
  Their drift is reported by `status` like any other scroll's, since the template's provenance sits at one of the two scanned carrier paths.
- Update never fires ambiently: no model-invoked "updates available" companion; the user runs `/wards`.

### The wards plugin surface

- One user-invoked skill, `/wards` (`disable-model-invocation: true`, sidecar `allow_implicit_invocation: false`), with an argument hint covering `install | update | status`, routing the three flows and deferring harness mechanics to reference files.
- A zero-dependency TypeScript CLI inside the plugin, run via `node --experimental-strip-types` from the plugin root (same pattern as the former hook), shelling out to git, emitting machine-readable JSON.
  Subcommands, roughly: `list <source>` (clone + scan + offering), `status` (scan both scopes, compare versions), `fetch` (materialize the new upstream, plus the old baseline when one is recorded, for an install or a merge), `validate` (check ward metadata of a tree).
  The CLI is the mechanical substrate; all judgment (selection dialogs, customization, merges, managed-block prose) stays with the agent.

### The example scrolls

Top-level `example-scrolls/` directory — the name marks it as the reference source for the generic system, not a blessed registry:

- `general-code-style`: rule, `paths: **/*` (loads on any file touch), recommended scope project.
- `typescript-code-style`: rule, TypeScript/JavaScript globs, recommended scope project.
- `cs-code-style`: rule, `**/*.cs`, recommended scope project.
- `general-guidelines`: rule, path-less (always loaded), recommended scope user — a personal driving preference, not a project convention.
- `check-line-length`: hook with `//`-comment ward header, fires after file edits, recommended scope project.
- The AGENTS.md starter template: template kind, moved from the repo root (root copy deleted, README pointer updated); its "do NOT use npx" directive is demoted to an example line like the section's other content.

### Teardown and repo mechanics

- `plugins/typescript/` and `plugins/csharp/` deleted; both marketplace files and release-please lose their entries; their openai.yaml sidecars die with them.
- `plugins/wards/` sheds its skill and hook (now scrolls) and its `hooks.json`; it keeps its release-please entry and ships only the installer (normal `feat` bump, staying 0.x).
- `cantrips` loses the `general-guidelines` skill; `/tdd`'s pointer to it is reworded for the rule's new life.
- Per-scroll semver stays hand-bumped in the scroll metadata (existing per-skill convention); scrolls have no release units or tags — the updater reads versions from metadata and git history.
- The check suite gains mechanical validation of `example-scrolls/` ward metadata, implemented as the CLI's `validate` subcommand wired into the existing check tasks and CI — per [unenforced-agents-md-invariant-drift](../solutions/unenforced-agents-md-invariant-drift.md), a prose invariant without a failing check will drift.
- Grimoire dogfoods its own scrolls: a real `/wards install` populates this repo's `.agents/`, serving as the continuous end-to-end verification.
- IDEAS.md gains an entry tracking openai/codex#24881 (path-scoped skills) and openai/codex#23788 (instructions directory), so the Codex integration can graduate from AGENTS.md pointers to native scoped rules when either lands.
- Flow pointers across skills that target a user-invoked skill (e.g. `/spec`, `/wards`) gain a "(user-invoked)" precision, so agents hand the invocation to the user instead of attempting a Skill call that `disable-model-invocation` will reject.
- All skills adopt one presentation convention for flow pointers in the agent's closing message: the final paragraph, wrapped in a blockquote, fully italicized, opening with "Next:" for a single step or "Next steps:" plus bullets for several; each pointer names the skill, carries "(user-invoked)" where applicable, and gives a one-clause rationale after an em dash.
- The README is rewritten around the new shape, with a high-quality presentation of wards as the centerpiece: its agent-driven dynamic nature (install-time customization dialogs, delta-preserving updates, judgment merges) and multi-kind support (rules, hooks, templates, foreign files) positioned explicitly against static copiers such as `npx skills`.

## Test Seams

One seam, approved 2026-07-24: **the CLI subprocess boundary**.

- Interface under test: `wards-cli.ts` invoked exactly as production runs it — a child process under `node --experimental-strip-types` — with fixture temp directories (small local git repositories as sources; fake project trees with `.agents/` content), asserting on JSON stdout and exit codes.
- Behavior verified through it: ward-metadata parsing (YAML frontmatter and line-comment headers across `//`, `#`, `--`, `;` tokens), manifest-less source scanning, version comparison (semver and commit-hash fallback, multi-entry provenance), scope handling as a root-path parameter, fetch materialization of new upstream plus old baseline from git history, and `validate` as used by the check suite.
- Runner: `bun test` (already in the toolchain, no new dependency), exposed as a mise task and wired into CI.
  Prior art: none — these are the repo's first tests.
- Deliberately unseamed: skill prose and agent-performed integrations (settings.json edits, managed AGENTS.md blocks, delta merges) are judgment work, verified end-to-end by the dogfooding install.

## Out of Scope

- Native Codex scoped rules (blocked upstream; tracked in IDEAS.md).
- Hook support for Codex CLI (no hook mechanism exists there).
- Marketplace features beyond "source as a parameter": indexes, discovery, curation, signatures, popularity — explicitly resisted.
- Harnesses beyond Claude Code and Codex CLI (the reference-file structure leaves the door open).
- Ambient update notifications or any model-invoked wards companion.
- A published npm package for the CLI; it ships inside the plugin only.

## Further Notes

- The review-gate's standards axis reads project rules, so installed `.agents/rules/` (via their Claude Code integration) feed the existing review pipeline with no extra wiring — the two features compound.
- User-level `paths:` scoping is confirmed to work: verified empirically on Claude Code 2.1.218 (ticket 04) via the `InstructionsLoaded` hook, using a throwaway `~/.claude/rules/` rule carrying a `paths:` glob.
  With a matching file read, the rule loaded with `load_reason: path_glob_match`; with no matching file present, it did not load at all (only the unconditional `~/.claude/CLAUDE.md` loaded, via `session_start`).
  So user-scope language rules can rely on `paths:` scoping exactly as project-scope rules do.
- The comment-token table and the ward-header grammar should live in one place consumed by both the CLI and the scroll-authoring docs, so a new token or field is added once.
