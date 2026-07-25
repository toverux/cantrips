/* oxlint-disable node/no-sync -- sequential check script, synchronous IO is intentional. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { toPosixRelative, walkFiles } from '../plugins/wards/cli/files.ts';
import { scopeSubdirectories, templateCarriers } from '../plugins/wards/cli/ward-grammar.ts';
import { type WardMetadata, parseWardFile } from '../plugins/wards/cli/ward-metadata.ts';
import { type YamlValue, parseYaml } from '../plugins/wards/cli/yaml.ts';

// This repo dogfoods its own installer: the scrolls under `.agents/` were installed from
// `example-scrolls/`, and the root AGENTS.md descends from the template scroll there. What must
// hold between an installed copy and its source is that they name the same version -- the
// installed header, its provenance entry, and the source header all agree -- because a version
// that lies is what makes `/wards status` miss a real update. Their bodies are deliberately NOT
// compared: an installed scroll may carry local deltas recorded in its provenance `notes`, which is
// the whole point of the installer, so byte-identity would forbid the feature this repo exists to
// exercise. What must also hold is that each installed rule is actually wired into both harnesses,
// since a rule no harness loads costs nothing to keep and everything to trust. Exits nonzero (via a
// failed assertion) on any drift.

const repoRoot = path.resolve(import.meta.dirname, '..');
const installedRoots = scopeSubdirectories.map(subdirectory => path.join('.agents', subdirectory));
const thisRepo = 'toverux/grimoire';

// A derived copy is re-transcribed from its source, so the two share one version. A template
// carrier is the project's own file: it descends from a template but diverges from it by design,
// so it keeps a version of its own and only its provenance entry has to name a version the source
// actually carries.
type CopyKind = 'derived-copy' | 'template-carrier';

let checked = 0;

for (const root of installedRoots) {
  for (const absolute of walkFiles(path.join(repoRoot, root), { followSymlinks: true })) {
    checkInstalledScroll(absolute, 'derived-copy');
  }
}

for (const carrier of templateCarriers) {
  const absolute = path.join(repoRoot, carrier);

  // A project carries the AGENTS.md its harnesses read, which is rarely both of them.
  if (existsSync(absolute)) {
    checkInstalledScroll(absolute, 'template-carrier');
  }
}

assert.ok(
  checked > 0,
  `No installed scroll carried provenance pointing at this repository; the dogfood check is ` +
    `looking at the wrong place.`
);

function checkInstalledScroll(absolute: string, kind: CopyKind): void {
  const relative = toPosixRelative(repoRoot, absolute);
  const parsed = parseWardFile(readFileSync(absolute, 'utf8'));

  if (parsed.status == 'absent') {
    // A template carrier is the project's own file, which may legitimately descend from nothing.
    // In an installed tree, where every file got there by being transcribed, a missing header is a
    // scroll destroyed by a bad merge: `/wards status` stops tracking it, silently and for good.
    assert.ok(
      kind == 'template-carrier',
      `${relative} carries no ward header; an installed scroll keeps the header that makes it ` +
        `trackable, so restore it from its source.`
    );

    return;
  }

  if (parsed.status != 'valid') {
    assert.fail(`${relative} does not parse as a scroll: ${parsed.errors.join('; ')}`);
  }

  if (parsed.ward.kind == 'rule') {
    checkClaudeRuleWiring(absolute, relative, parsed.ward);
  }

  for (const entry of parsed.ward.provenance ?? []) {
    if (entry.source != thisRepo) {
      continue;
    }

    // A path that no longer resolves is drift in its own right: the installed file now points at
    // nothing, so skipping it would retire the check for exactly the scroll that moved.
    const sourcePath = path.join(repoRoot, entry.path);

    assert.ok(
      existsSync(sourcePath),
      `${relative} records provenance path ${entry.path}, which does not exist in this ` +
        `repository; update the provenance when a source scroll moves.`
    );

    const source = parseWardFile(readFileSync(sourcePath, 'utf8'));

    assert.ok(source.status == 'valid', `${entry.path} must parse as a scroll.`);

    const remedy =
      kind == 'derived-copy'
        ? `re-derive the installed copy and bump both.`
        : `merge the new template's structural changes, then record its version here.`;

    assert.equal(
      entry.version,
      source.ward.version,
      `${relative}'s provenance records version ${entry.version} of ${entry.path}, which is at ` +
        `${source.ward.version}; ${remedy}`
    );

    if (kind == 'derived-copy') {
      assert.equal(
        parsed.ward.version,
        source.ward.version,
        `${relative} is at version ${parsed.ward.version} but its source ${entry.path} is at ` +
          `${source.ward.version}; the installed copy and its source share one version.`
      );
    }

    checked++;
  }
}

// Claude Code reads project rules from `.claude/rules/` and honors only their own top-level
// `paths:` key; the ward header means nothing to it. So an installed rule is loaded there only when
// both hold, and a `paths:` narrower than the applicability the scroll declares is the
// silent-non-loading failure wards exists to prevent.
function checkClaudeRuleWiring(absolute: string, relative: string, ward: WardMetadata): void {
  const name = path.basename(absolute);
  const link = path.join(repoRoot, '.claude', 'rules', name);

  assert.ok(
    existsSync(link),
    `${relative} has no resolvable .claude/rules/${name}; the rule loads in Codex CLI only.`
  );

  assert.deepEqual(
    frontmatterPaths(absolute),
    ward.applicability,
    `${relative}'s top-level paths: must state exactly its ward applicability ` +
      `(${ward.applicability?.join(', ') ?? 'none'}); Claude Code matches on paths: alone.`
  );
}

// The `paths:` key as written, unvalidated: this is the frontmatter Claude Code itself reads, so
// the check compares the raw value rather than one normalized into what it ought to be.
function frontmatterPaths(absolute: string): YamlValue | undefined {
  const lines = readFileSync(absolute, 'utf8').split(/\r?\n/u);
  const closing = lines.findIndex((line, index) => index > 0 && /^---\s*$/u.test(line));

  if ((lines[0] ?? '').trim() != '---' || closing == -1) {
    return undefined;
  }

  const document = parseYaml(lines.slice(1, closing).join('\n'));

  return Array.isArray(document) || typeof document != 'object' ? undefined : document.paths;
}
