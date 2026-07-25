/* oxlint-disable node/no-sync -- sequential check script, synchronous IO is intentional. */

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Consistency check for the plugin's dual manifests (Claude Code + Codex CLI), the two catalog
// files that publish it, and each skill's invocation-policy pair (SKILL.md frontmatter +
// openai.yaml sidecar). Shared metadata is duplicated across those files by necessity, so this
// script keeps the copies honest. Exits nonzero (via a failed assertion) on any drift.

const repoRoot = path.resolve(import.meta.dirname, '..');

// The plugin lives at the repo root, so a catalog entry points at "./" and the manifests sit
// beside the catalog files that describe them.
const pluginSource = './';

const claudeManifest = readJsonObject('.claude-plugin/plugin.json');
const codexManifest = readJsonObject('.codex-plugin/plugin.json');

const pluginName = requireString(
  claudeManifest.name,
  '.claude-plugin/plugin.json must declare a "name".'
);

checkSharedManifestFields();
checkVersionAnchor();
checkCatalogPair();
checkSkillSidecars();

function checkSharedManifestFields(): void {
  const sharedFields = [
    'name',
    'version',
    'description',
    'author',
    'homepage',
    'repository',
    'license',
    'keywords'
  ];

  for (const field of sharedFields) {
    assert.deepEqual(
      codexManifest[field],
      claudeManifest[field],
      `Manifest field "${field}" differs between .claude-plugin/plugin.json and ` +
        `.codex-plugin/plugin.json; keep the shared fields identical.`
    );
  }
}

function checkVersionAnchor(): void {
  // The root package.json is the release-please version anchor; the manifests are synced from it
  // via extra-files, so any drift means a hand edit bypassed the release process. Codex manifest
  // coverage is transitive through checkSharedManifestFields.
  const anchor = readJsonObject('package.json');

  assert.equal(
    claudeManifest.version,
    anchor.version,
    'The plugin manifests must carry the same version as package.json (the release-please anchor).'
  );
}

// The Claude catalog (.claude-plugin/marketplace.json, string sources) and the Codex catalog
// (.agents/plugins/marketplace.json, object-form sources) must publish the same single plugin with
// the same description, and that description is the storefront copy of the manifest's.
function checkCatalogPair(): void {
  const claudeCatalog = readJsonObject('.claude-plugin/marketplace.json');
  const codexCatalog = readJsonObject('.agents/plugins/marketplace.json');

  assert.equal(claudeCatalog.name, codexCatalog.name, 'The two catalog files must share a name.');
  assert.deepEqual(
    codexCatalog.owner,
    claudeCatalog.owner,
    'The two catalog files must share an owner.'
  );

  const claudeEntry = soleEntry('.claude-plugin/marketplace.json', claudeCatalog);
  const codexEntry = soleEntry('.agents/plugins/marketplace.json', codexCatalog);

  for (const [relativePath, entry] of [
    ['.claude-plugin/marketplace.json', claudeEntry],
    ['.agents/plugins/marketplace.json', codexEntry]
  ] as const) {
    assert.equal(entry.name, pluginName, `${relativePath} must publish "${pluginName}".`);
    assert.equal(
      entry.description,
      claudeManifest.description,
      `${relativePath}'s description must match the one in .claude-plugin/plugin.json.`
    );
  }

  // String source (Claude) versus object-form source (Codex), both naming the repo root.
  assert.equal(
    claudeEntry.source,
    pluginSource,
    `The Claude catalog source must be "${pluginSource}" (the plugin is the repository itself).`
  );

  assert.deepEqual(
    codexEntry.source,
    { source: 'local', path: pluginSource },
    `The Codex catalog source must be the object form ` +
      `{"source": "local", "path": "${pluginSource}"}.`
  );
}

// A skill's invocation policy lives twice: `disable-model-invocation` in the SKILL.md frontmatter
// (honored by Claude Code) and `allow_implicit_invocation` in the openai.yaml sidecar (honored by
// Codex CLI, which ignores the frontmatter key). Every skill must carry the sidecar, and the two
// keys must stay logically inverse.
function checkSkillSidecars(): void {
  const skillDirs = readdirSync(path.join(repoRoot, 'skills'), { withFileTypes: true }).filter(
    entry => entry.isDirectory()
  );

  assert.ok(skillDirs.length > 0, 'No skill directories found under skills/.');

  for (const skillDir of skillDirs) {
    const skillRoot = `skills/${skillDir.name}`;
    const sidecarPath = `${skillRoot}/agents/openai.yaml`;

    assert.ok(
      existsSync(path.join(repoRoot, sidecarPath)),
      `${skillRoot} has no agents/openai.yaml sidecar; every skill carries one.`
    );

    const frontmatter = frontmatterOf(readTextFile(`${skillRoot}/SKILL.md`));
    const userInvoked = /^disable-model-invocation:\s*true\s*$/mu.test(frontmatter);
    const declared = /^\s*allow_implicit_invocation:\s*(?<value>true|false)\s*$/mu.exec(
      readTextFile(sidecarPath)
    )?.groups?.value;

    assert.ok(
      declared != null,
      `${sidecarPath} must declare policy.allow_implicit_invocation explicitly.`
    );

    assert.equal(
      declared,
      userInvoked ? 'false' : 'true',
      `${skillRoot}: allow_implicit_invocation must be the inverse of the SKILL.md ` +
        `disable-model-invocation frontmatter (Codex CLI only honors the sidecar).`
    );
  }
}

function frontmatterOf(skillMd: string): string {
  const body = /^---\r?\n(?<body>[\s\S]*?)\r?\n---/u.exec(skillMd)?.groups?.body;

  assert.ok(body != null, 'Every SKILL.md opens with a frontmatter block.');

  return body;
}

function soleEntry(
  relativePath: string,
  catalog: Record<string, unknown>
): { name: string; description: string; source: unknown } {
  const { plugins: entries } = catalog;

  assert.ok(Array.isArray(entries), `${relativePath} must declare a "plugins" array.`);
  assert.equal(entries.length, 1, `${relativePath} must publish exactly one plugin.`);

  const entry: unknown = entries[0];

  assert.ok(typeof entry == 'object' && entry != null, `${relativePath} has a non-object entry.`);

  const { name, description, source } = entry as Record<string, unknown>;

  assert.ok(typeof name == 'string', `${relativePath}'s entry has no "name".`);
  assert.ok(typeof description == 'string', `${relativePath}'s entry has no "description".`);

  return { name, description, source };
}

function readJsonObject(relativePath: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readTextFile(relativePath));

  assert.ok(
    typeof parsed == 'object' && parsed != null && !Array.isArray(parsed),
    `${relativePath} must contain a JSON object.`
  );

  return parsed as Record<string, unknown>;
}

function readTextFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function requireString(value: unknown, message: string): string {
  assert.ok(typeof value == 'string' && value.length > 0, message);

  return value;
}
