---
name: wards
description: Install, update, and check status of scrolls — versioned rules, hooks, and templates transcribed from a git source into a project or the user's config.
argument-hint: 'install <source> | update | status'
disable-model-invocation: true
version: 1.0.0
---

# Wards

Wards transcribes **scrolls** — versioned rules, hooks, and templates — from any git source into a project (or the user's global config), where they are committed and updatable like any other file.
Each installed scroll carries **provenance** frontmatter, so updates pull upstream improvements without erasing local customization.
You supply the judgment (selection, customization, merges); the CLI supplies the mechanics (cloning, scanning, version comparison, merge materialization).

Route by the argument: `install`, `update`, or `status`.
When the argument is blank, ask which of the three the user wants.

## The CLI

Every step runs the wards CLI:

```
node --disable-warning=ExperimentalWarning --experimental-strip-types <cli> <args>
```

`<cli>` is `cli/wards-cli.ts` under the wards plugin root (Claude Code exposes it as `${CLAUDE_PLUGIN_ROOT}/cli/wards-cli.ts`; other harnesses via their own plugin-root variable).
It emits JSON on stdout and its outcome on the exit code; read the JSON, then act on it.

A **source** is a git URL, an `owner/repo` GitHub shorthand, or a local path, each with an optional `#ref` suffix.

`wards fetch` writes into a directory you name with `--out` and never cleans it up: pick a fresh temp directory, and delete it once you are done with its contents.

## Scopes and canonical homes

A scroll installs into one of two scopes, a root path the CLI treats uniformly:

- **project**: `.agents/rules/` and `.agents/hooks/` at the repo root.
- **user**: the same layout under `~/.agents/`.

The file in these homes is **canonical**: each harness gets a derived integration pointing back at it, and the user edits only the canonical file — the updater regenerates every derivation.

A **template** is the exception: it describes a file the project already owns, so it records itself in that file instead, at `AGENTS.md` or `.codex/AGENTS.md` relative to the scope root.
Those two paths are what `wards status` scans for templates, so a template recorded anywhere else drops out of tracking.

## Provenance

The installer writes a `ward.provenance` list into each canonical file — a list because a composite file (an AGENTS.md template plus a managed block) can aggregate several upstreams.
Each entry records:

- `source`: the source string a future update will clone from (a public identity, so contributors can update too).
- `path`: the file's path within that source.
- `ref` when the install was pinned to a branch, tag, or commit; without it every update tracks the source's default branch.
- `version` when the upstream carries one, else `commit` (the source commit hash).
- `notes`: a prose description of local deltas — why this file diverges from upstream — omitted when it matches upstream verbatim.
  Write it as a single-line scalar, quoted when it contains a colon: the ward YAML subset reads single-line scalars only, and a block scalar (`notes: >`) makes `wards status` report the file `invalid` instead of tracking it.

## Harnesses

Detect which harnesses the target uses, propose the matching integrations, and let the user choose which to wire:

- **Claude Code** — `.claude/` present.
  Mechanics: [references/claude-code.md](references/claude-code.md).
- **Codex CLI** — `.codex/` or an `AGENTS.md` present.
  Mechanics: [references/codex-cli.md](references/codex-cli.md).

Supporting a further harness is a new reference file, nothing more.

## Install

1. **Source.**
   Required on the first install into a scope — wards has no baked-in default.
   When none is given, infer it from installed provenance; when nothing is installed, ask the user for one.

2. **Offering.**
   Run `wards list <source>` and present the scrolls it returns (path, kind, description, applicability, recommended scope).
   Relay its `diagnostics` (scrolls whose header failed to parse, so they never reached the offering) and its `excluded` list (paths filtered out as installed copies) alongside, so the user can tell an empty offering apart from a filtered one.
   A **foreign file** — a path in the source with no ward metadata, so it is absent from the offering — installs by explicit path instead.

3. **Selection and scope.**
   For each scroll the user picks, default the scope to the scroll's recommendation and let the user override it.

4. **Customization dialog.**
   Offer to adapt each scroll to the project before it lands (for example, relaxing a line limit to match the codebase).
   Every change the user accepts becomes a `notes` delta in that file's provenance entry.

5. **Write the canonical file** into `.agents/rules/` (rules) or `.agents/hooks/` (hooks), appending its provenance entry.
   `wards list` reports metadata only, so get the content with `wards fetch --source <source> --path <path> --out <dir> [--ref <ref>]`: it materializes the scroll as `<dir>/upstream/<filename>` and reports the `version` it carries, otherwise the `commit` that last changed it.
   Delete `<dir>` once the file has landed.
   Record `ref` too whenever the source was pinned (`list` and `fetch` report the ref they used).

   A **template** never lands in `.agents/`: propose its structure against the file the project already owns (an AGENTS.md template against the project's AGENTS.md), then append the provenance entry to that file's own ward block, so the update flow can diff future template versions against it.
   Follow [references/codex-cli.md](references/codex-cli.md) for how that block is written.

   A **foreign file** fetches the same way, by explicit path.
   Install it as a `rule` or a `hook` — those are the only two shapes wards writes, and a file that is neither is out of scope for wards.
   A foreign file has no ward header, so synthesize the whole block, not just the provenance: `kind`, a one-line `description`, and a `version` (the upstream's when it has one, else `1.0.0`), plus the provenance entry.
   Without those three required fields the header does not validate, and `wards status` reports the file as invalid instead of tracking it.

6. **Integrations.**
   For each harness the user chose, follow its reference file to derive the integration from the canonical file.

Done when every selected scroll has a canonical file carrying its provenance and each chosen harness integration is in place, and `wards status --scope <scope>` classifies each of those scrolls up-to-date (a file the project wrote itself classifies `foreign`, which is its steady state).
A file reported `unverified` does not count: it means nothing could be compared, so fix the source string or the path before calling the install done.

## Update

1. **Find the drift.**
   Run `wards status` (both scopes by default); sources come from the installed provenance, so the user names nothing.

2. For each **outdated** non-template scroll, per provenance entry:
   - `wards fetch --source <source> --path <path> --out <dir> --local <local-canonical> (--version <v> | --commit <hash>) [--ref <ref>]` writes the recorded baseline to `<dir>/base/<filename>` and the new upstream to `<dir>/upstream/<filename>`, and reports the new version and commit.
     Pass `--local` with the local canonical file so both sides match its line endings, otherwise every line conflicts.
     Pass `--ref` whenever the status entry reports one: without it the merge pulls the source's default branch into a file that was pinned elsewhere.
   - Merge three ways: `git merge-file <local-canonical> <base> <upstream>`.
   - When conflicts remain, resolve them with `/resolving-merge-conflicts` if it is available, otherwise resolve them by hand; read the provenance `notes` as the semantic context for why the local side diverges, and preserve that intent.
   - Update the provenance entry to the new version (or commit), then regenerate every harness integration from the merged canonical file.
   - Delete `<dir>` once the merge is resolved.

3. **Templates** take a different posture: a project's file diverges from the template ~100% by design, so never re-transcribe.
   `status` reports their drift alongside every other scroll's, since a template records itself in `AGENTS.md` or `.codex/AGENTS.md`.
   Run `fetch` for the entry as above, then diff the old template against the new (the `base` and `upstream` it materialized) and propose the structural improvements against the project's file.

4. **Copied integrations.**
   Where a harness integration is a copy rather than a link, regenerate it for every tracked scroll, outdated or not: `status` reads canonical files only, so a locally edited canonical file leaves its copies stale with nothing to report it.

Done when every updated scroll's provenance names its new version or commit and its integrations are regenerated.
A scroll reported `unverified` does not count: it means nothing could be compared, so fix the source string or the path its `comparison.reason` names, then update it like any other — and when the fix needs the user, say which scrolls stayed frozen.

## Status

Run `wards status [--scope project|user|both]` and relay its report, with the recorded-versus-source provenance detail behind each classification:

- **up-to-date**: every provenance entry was compared against its source and matches.
- **outdated**: an entry has drifted; `/wards update` merges it.
- **unverified**: an entry could not be compared, so this is never a clean bill of health.
  Its `comparison.reason` names what to fix: `source-unavailable` (the source, or the entry's `ref`, could not be cloned), `path-missing` (the path is not in the source there), `source-version-missing` (version provenance against an upstream that no longer carries a version), `source-header-invalid` (version provenance against an upstream whose own ward header does not parse, so the fix belongs upstream), or `source-history-missing` (commit provenance against a path with no upstream history).
- **foreign**: present but carrying no provenance, so wards does not manage it.
- **invalid**: the ward header does not parse; the `diagnostics` list carries the parser's messages, and the file stays out of the update flow until they are fixed.

> _Next: `/wards update` (user-invoked) — merges every scroll this report classified outdated._
