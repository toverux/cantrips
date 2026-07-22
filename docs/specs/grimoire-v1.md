# Grimoire v1

Status: approved spec, pending implementation.
Origin: grilling interview of 2026-07-22 (Q1–Q19 + amendments), audited for completeness by a separate agent.

## Vision

Convert this repo (`toverux-skills`, to be renamed **`toverux/grimoire`**) into a multi-plugin, multi-harness (Claude Code + Codex CLI) marketplace of curated agent skills.
The core plugin, **`cantrips`**, implements a coherent engineering loop forked from the best of [mattpocock/skills](https://github.com/mattpocock/skills) (MIT) and [EveryInc/compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin) (MIT): Pocock-style drivers with Compound-Engineering-style learning capture.
Satellite plugins ship enforcement hooks and language style skills.

Community-validated thesis: "Pocock to steer, CE-style pipeline to execute and remember."

## Identity

- Repo: `toverux/grimoire` (rename of `toverux-skills`).
  Marketplace name: **`grimoire`**.
- Plugins (each under `plugins/<name>/`):
  - **`cantrips`** — the core engineering loop (this spec's main subject).
    "Basic spells a caster always has prepared."
  - **`wards`** — style guard: the `general-code-style` skill + the `check-line-length` hook (rewritten in TypeScript).
    "Protective spells that trigger at a boundary."
  - **`typescript`** — TypeScript style skill(s).
  - **`csharp`** — C# style skill(s).
- Future plugins are plainly named (`<topic>@grimoire`).
- Skill names are plain and verb-like (`/spec`, `/implement`, `/compound`); the plugin namespace disambiguates.
  Renames from upstream (`to-spec` → `spec`, `ce-commit` → `commit`) are deliberate: these are forks, not mirrors.

## The pipeline (cantrips)

Tiered; each tier only adds ceremony when the work warrants it:

- **Small fix:** `grill-me` (optional) → implement directly → `code-review` → `commit`.
- **Feature:** `grill-me` → `spec` → `implement` (fresh context, drives `tdd`) → [`simplify` (optional)] → `code-review` → `commit` → `compound`.
- **Big / multi-session:** insert `tickets` between `spec` and `implement`; one ticket per fresh context window.
- **Bug entry point:** `diagnosing-bugs` replaces grill/spec; its tail points to `compound`.
- `handoff` is the context-break utility at any tier (compaction for resuming, never a substitute for a spec).

**Flow-pointer convention (cross-cutting):** every pipeline skill ends by naming the next step(s) ("spec written → next: `/tickets` if multi-session, else `/implement`").
The pipeline is self-navigating; no router skill.

### Specs and tickets

- Committed in-repo markdown: `docs/specs/<feature>.md`; tickets (big tier) as files alongside the spec (exact layout at implementer's discretion, e.g. `docs/specs/<feature>/`).
- No issue-tracker dependency in v1 (solo workflow).
  A per-project tracker override and a Pocock-style setup skill are deferred to `IDEAS.md`.
- `spec` proposes **test seams** as part of spec-writing (user approves them while decisions are fresh).

### Testing discipline

Seam-gated TDD: `implement` drives `tdd` at the seams agreed in the spec; plain implementation with explicit verification criteria where no seam was agreed.
Small-tier bug fixes get a failing repro test first; otherwise judgment (per `general-guidelines`).

### Review stack

1. `simplify` (fork of `ce-simplify-code`) — optional, manual pre-pass; applies behavior-preserving quality fixes.
2. `code-review` (fork of Pocock's) — the gate.
   Two axes in parallel subagents:
   - **Spec axis** reads `docs/specs/<feature>.md`.
   - **Standards axis** reads the project's documented standards wherever they live: `AGENTS.md`, project-local rules if present, and loaded style skills (wards / language plugins).
3. Cross-model review (Codex plugin) mentioned as an _option_ for high-stakes changes, never mandatory.

## The compounding system (cantrips)

### `compound` (model-invoked, also `/compound` ad-hoc)

Fires at loop end (the `commit` / review tail includes a "scan this session for compound candidates" step) or on demand.
For each candidate that clears the quality bar, it proposes a destination + one-line rationale; **every write is user-gated** — approve / redirect / kill.
If nothing clears the bar: one line saying so, stop.

**Quality bar:** would this change a future agent's behavior in a different session, and is it non-obvious and stable?
Any "no" → discard.
(Explicit anti-goal: the eager-auto-memory failure mode — session-specific trivia must die here.)

**Destinations (routing taxonomy):**

1. Project `AGENTS.md` — durable _shared_ preferences/conventions, cheap enough to always load.
   Includes a glossary section for domain terms ("we call this X, not Y"); when the glossary outgrows AGENTS.md, compound proposes graduating it to a `CONCEPTS.md` file.
2. `docs/solutions/` — problem-shaped learnings (root cause, gotcha, "what didn't work"): one small frontmattered markdown file per solved problem.
   Expensive knowledge, loaded on demand.
3. Project-local rules — path-scoped project conventions, when the project uses rules files.
4. Skills — project-specific procedures → the project's `.claude/skills/`; _generic_ workflow improvements → "the user's personal skills collection, if configured" (phrased exactly that abstractly — see distributability below).
5. User-global `CLAUDE.md` — personal-only preferences, and a _staging area_ to trial candidate durable preferences before graduating them to a shared file.

**Authoring gate:** before editing `AGENTS.md`, rules, or skills, `compound` loads `writing-great-skills` (our fork, extended to state its principles apply to AGENTS.md/rules/ CLAUDE.md editing too).

**Read-back arrows (what makes it compounding):** `spec`, `code-review`, and `diagnosing-bugs` each include a step to search `docs/solutions/` (and past specs) for relevant learnings.

### `compound-refresh` (user-invoked)

Garbage collection for the stores: audits `docs/solutions/` against the current code (verdicts: keep / update / consolidate / delete — git history is the archive) and audits `AGENTS.md` for bloat/contradictions/staleness.
All changes user-gated.

## Cantrips roster

| Skill                           | Invocation | Source                                   | Notes                                                                                           |
| ------------------------------- | ---------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `grill-me`                      | user       | existing own fork (of Pocock `grilling`) | Keep as-is; fold in upstream improvements if any.                                               |
| `spec`                          | user       | Pocock `to-spec`                         | Local `docs/specs/` target; proposes test seams; searches `docs/solutions/`.                    |
| `tickets`                       | user       | Pocock `to-tickets`                      | Local files; tracer-bullet slices; expand–contract for wide refactors.                          |
| `implement`                     | user       | Pocock `implement`                       | Drives `tdd` at agreed seams; flow-pointers to review tail.                                     |
| `tdd`                           | model      | Pocock `tdd`                             | Keep anti-patterns; seams confirmed with user; leans on `codebase-design` vocabulary.           |
| `simplify`                      | user       | CE `ce-simplify-code`                    | Optional pre-review quality pass; behavior-preserving.                                          |
| `code-review`                   | user       | Pocock `code-review`                     | Two-axis; Standards axis per "Review stack" above.                                              |
| `commit`                        | user       | CE `ce-commit`                           | Branch per the repo's workflow; opens with the compound scan.                                   |
| `compound`                      | model      | new, inspired by CE `ce-compound`        | See above. Diverges deliberately from CE: no headless auto-write, five-way routing, user-gated. |
| `compound-refresh`              | user       | CE `ce-compound-refresh`                 | Extended to audit AGENTS.md too.                                                                |
| `handoff`                       | user       | Pocock `handoff`                         | Redaction/no-duplication rules kept.                                                            |
| `writing-great-skills`          | user       | Pocock `writing-great-skills`            | Extended scope (AGENTS.md/rules/CLAUDE.md); loaded by `compound` and used to author this repo.  |
| `diagnosing-bugs`               | model      | Pocock `diagnosing-bugs`                 | Tail → `compound`; no-seam case hands off to `improve-codebase-architecture`.                   |
| `prototype`                     | model      | Pocock `prototype`                       | Grill detour for design questions.                                                              |
| `research`                      | model      | Pocock `research`                        | Background primary-source research.                                                             |
| `resolving-merge-conflicts`     | model      | Pocock `resolving-merge-conflicts`       |                                                                                                 |
| `codebase-design`               | model      | Pocock `codebase-design`                 | Shared vocabulary reference.                                                                    |
| `improve-codebase-architecture` | user       | Pocock `improve-codebase-architecture`   |                                                                                                 |
| `general-guidelines`            | model      | existing own                             | Unchanged.                                                                                      |
| `teach`                         | user       | Pocock `teach`                           | Forked close to upstream; orthogonal to the pipeline.                                           |

## Satellite plugins

### `wards`

- `general-code-style` skill: fork of the current rule (line breaks, 100-char limit, comments, docblocks).
  Model-invoked with a strong description mandating load **before writing or editing code** — never on read-only sessions.
- `check-line-length` hook: rewritten in **TypeScript on Node** (current bash+jq+awk is not Windows-portable).
  Same behavior (PostToolUse warning with offending line numbers, suppression exemptions).
  Per-project tuning via an optional project config file read by the hook (plugin hooks get no per-project env); per-project opt-out via plugin enablement.
- Any hook written in JS/TS (this one and future ones) uses the [`@toverux/blanc-hopital`](https://github.com/toverux/blanc-hopital-config) npm package **directly as a dependency** (extends-style shared configs).
  Consumption examples in `../HallOfFameServer` (up-to-date, `@toverux/blanc-hopital` v3: `oxfmt.config.ts`, `oxlint.config.ts`, and `tsconfig.json` extending the package's presets).

### `typescript` and `csharp`

- Current rules become ordinary model-invoked skills with strong descriptions mandating load before writing/editing the target language (same "write-trigger, not read-trigger" principle).
- The two TypeScript variants (with/without `nn()`/`ensure*()` helpers) collapse into **one** skill that detects whether the project has the helpers.
- Content is revised (not just ported) during the move.

## Repo infrastructure

Structural template: `../coherent-gameface-mcp` (analyzed; recipe on file).
Concretely:

- `plugins/<name>/.claude-plugin/plugin.json` + `plugins/<name>/.codex-plugin/plugin.json` with identical shared metadata (Codex manifest is a superset; `./`-relative component pointers).
- Root `.claude-plugin/marketplace.json` (string sources `./plugins/<name>`) + root `.agents/plugins/marketplace.json` (object-form sources) with identical entries.
- Single shared `skills/` tree per plugin — both harnesses auto-discover it.
  No MCP servers, so the dual-mcp.json machinery is not needed.
- One `AGENTS.md` per relevant level with committed relative symlink `CLAUDE.md → AGENTS.md` (Claude Code reads CLAUDE.md, not AGENTS.md; symlink-capable checkout assumed, as in the template repo).
- Sync-check script (modeled on the template's `check-plugin-sync.ts`): deep-equal shared manifest fields, marketplace-pair consistency, version anchors.
  Wired into CI and pre-commit.
- **release-please** integration, per-plugin versioning (template repo demonstrates the manifest setup).
- Versioning: existing per-skill semver `version` frontmatter continues (unofficial field, ignored by loaders, harmless); plugin versions in `plugin.json`.
- Repo-root assets that are _not_ plugin components: `agents-md-template.md` (updated to reference `docs/specs/`, `docs/solutions/`, the AGENTS.md glossary section and CONCEPTS.md graduation).
  The old `rules/` and `hooks/` dirs dissolve into the plugins per this spec.
- The repo is formatted with **oxfmt** (Markdown and JS/TS alike), consuming [`@toverux/blanc-hopital`](https://github.com/toverux/blanc-hopital-config)'s configuration directly (see `../HallOfFameServer`'s `oxfmt.config.ts` for the consumption example); wire it into the pre-commit/CI checks alongside the sync check.

## Licensing and provenance

- Repo stays MIT.
  Add a `NOTICE` section/file crediting mattpocock/skills (MIT, © Matt Pocock) and EveryInc/compound-engineering-plugin (MIT, © Every).
- Every forked skill records provenance in frontmatter: upstream repo, upstream skill name, and upstream version at fork time (exact key shape at implementer's discretion, e.g. `source: mattpocock/skills@1.1.0 (to-spec)`).
- Anthropic's `skill-creator` (Apache-2.0) is used only as an external dev-time test bench — not vendored, so no Apache notice needed.

## Distributability (design principle)

Every plugin must be installable by _anybody_: no user-specific paths, names, or personal conventions inside skill bodies.
Morgan's personalization (e.g. pointing compound's "personal skills collection" at the local grimoire checkout) lives in their user-global `CLAUDE.md`, never in the plugins.

## Docs deliverables

- `README.md` rewritten: grimoire marketplace, **cantrips front and center** (the loop, a diagram of the tiers, install instructions for both harnesses), satellite plugins documented secondarily, migration note (uninstall the upstream Pocock/CE installs cantrips replaces).
  Presentation matters: sexy, skimmable markdown — strong visual hierarchy, clear plain language, tasteful use of GitHub-flavored features (tables, callouts, badges where they earn their place).
  A reader should get the pitch in 30 seconds of scanning and the details on a second pass.
- `IDEAS.md` — analyzed-but-deferred, mostly team/big-project-scale, with a note on when each becomes worth adopting: wayfinder (adapted-to-local-files design sketched in the interview), `triage`, `babysit-pr` + `resolve-pr-feedback`, CE `brainstorm`/`plan`/`work`/`lfg`, per-repo setup skill + issue-tracker override, standalone domain-modeling discipline, skill-creator eval harness as a permanent test bench, `paths:` frontmatter experiment for rule-like skills.
- Root `AGENTS.md` (with committed `CLAUDE.md → AGENTS.md` symlink) authored for **maintaining this repo with agents** going forward: repo layout and where each kind of component lives; how to add or revise a skill (write against `writing-great-skills`, provenance frontmatter, version bump, flow-pointers, distributability rule); how the dual-manifest/marketplace pairs stay in sync (the check script) and how releases work (release-please); pointer to this spec and to `IDEAS.md`.
  Follows `agents-md-template.md` where it fits.
  The point: a fresh session in this repo should be able to maintain it correctly from AGENTS.md alone.
- This spec stays in `docs/specs/` (dogfooding the convention).

## Implementation ground rules

- **If any question or ambiguity arises during implementation — main thread or subagent — STOP and ask Morgan.**
  Subagents surface questions to the main thread; the main thread asks the user.
  Never guess on an unresolved decision.
- Every authored/forked skill is written against the `writing-great-skills` standard (predictability, leading words, completion criteria, progressive disclosure, no negation, no no-ops, prune sediment).
  Forks should generally get _leaner_ than upstream, never heavier.
- Main thread drives and reviews; bulk fork-writing goes to subagents fed this spec, the relevant upstream files, and the writing-great-skills criteria.
- Upstream sources were shallow-cloned during research to `%TEMP%\mattpocock-skills` and `%TEMP%\compound-engineering-plugin` (plus `%TEMP%\skill-creator-analysis`); re-clone if the temp dirs are gone.
- Verify at build time (facts, not decisions): exact Codex plugin schema fields against the template repo; release-please config shape; whether `skills` frontmatter keys used here are all honored by both harnesses.
