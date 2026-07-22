/* oxlint-disable node/no-sync -- sequential check script, synchronous IO is intentional. */

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Consistency check for each plugin's dual manifests (Claude Code + Codex CLI), the two
// marketplace files, and each skill's invocation-policy pair (SKILL.md frontmatter + openai.yaml
// sidecar). Shared metadata is duplicated across those files by necessity, so this script keeps
// the copies honest. Exits nonzero (via a failed assertion) on any drift.

interface Plugin {
  name: string;
  root: string;
}

const repoRoot = path.resolve(import.meta.dirname, '..');

// Plugins are discovered from the directory tree, so a newly added plugin cannot silently escape
// the check.
const plugins: Plugin[] = readdirSync(path.join(repoRoot, 'plugins'), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => ({ name: entry.name, root: `plugins/${entry.name}` }));

assert.ok(plugins.length > 0, `No plugin directories found under plugins/.`);

// Each plugin's Claude manifest, parsed once here and reused by the marketplace check.
const claudeManifests = new Map<string, Record<string, unknown>>();

for (const plugin of plugins) {
  checkPlugin(plugin);
  checkSkillSidecars(plugin);
}

checkMarketplacePair();
checkRootVersionAnchor();

function checkPlugin(plugin: Plugin): void {
  const claudeManifest = readJsonObject(`${plugin.root}/.claude-plugin/plugin.json`);
  const codexManifest = readJsonObject(`${plugin.root}/.codex-plugin/plugin.json`);

  claudeManifests.set(plugin.name, claudeManifest);

  checkSharedManifestFields(plugin, claudeManifest, codexManifest);
  checkVersionAnchor(plugin, claudeManifest);
}

function checkSharedManifestFields(
  plugin: Plugin,
  claudeManifest: Record<string, unknown>,
  codexManifest: Record<string, unknown>
): void {
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
      `Manifest field "${field}" differs between ${plugin.root}'s .claude-plugin/plugin.json ` +
        `and .codex-plugin/plugin.json; keep the shared fields identical.`
    );
  }

  assert.equal(
    claudeManifest.name,
    plugin.name,
    `${plugin.root}'s manifests must be named after their directory.`
  );
}

function checkVersionAnchor(plugin: Plugin, claudeManifest: Record<string, unknown>): void {
  // The plugin's package.json is the release-please version anchor; the manifests are synced from
  // it via extra-files, so any drift means a hand edit bypassed the release process. Codex
  // manifest coverage is transitive through checkSharedManifestFields.
  const anchor = readJsonObject(`${plugin.root}/package.json`);

  assert.equal(
    claudeManifest.version,
    anchor.version,
    `The plugin manifests must carry the same version as ${plugin.root}/package.json ` +
      `(the release-please anchor).`
  );
}

// A skill's invocation policy lives twice: `disable-model-invocation` in the SKILL.md frontmatter
// (honored by Claude Code) and `allow_implicit_invocation` in the openai.yaml sidecar (honored by
// Codex CLI, which ignores the frontmatter key). Every skill must carry the sidecar, and the two
// keys must stay logically inverse.
function checkSkillSidecars(plugin: Plugin): void {
  const skillsDir = path.join(repoRoot, plugin.root, 'skills');

  if (!existsSync(skillsDir)) {
    return;
  }

  const skillDirs = readdirSync(skillsDir, { withFileTypes: true }).filter(entry =>
    entry.isDirectory()
  );

  for (const skillDir of skillDirs) {
    const skillRoot = `${plugin.root}/skills/${skillDir.name}`;
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

// The Claude marketplace (.claude-plugin/marketplace.json, string sources) and the Codex
// marketplace (.agents/plugins/marketplace.json, object-form sources) must list the same plugins
// with the same descriptions, and every plugins/<name> directory must appear in both.
function checkMarketplacePair(): void {
  const claudeMarket = readJsonObject('.claude-plugin/marketplace.json');
  const codexMarket = readJsonObject('.agents/plugins/marketplace.json');

  assert.equal(claudeMarket.name, codexMarket.name, 'The two marketplace files must share a name.');
  assert.deepEqual(
    codexMarket.owner,
    claudeMarket.owner,
    'The two marketplace files must share an owner.'
  );

  const claudeEntries = marketplaceEntries('.claude-plugin/marketplace.json', claudeMarket);
  const codexEntries = marketplaceEntries('.agents/plugins/marketplace.json', codexMarket);

  assert.deepEqual(
    codexEntries.map(entry => entry.name),
    claudeEntries.map(entry => entry.name),
    'The two marketplace files must list the same plugins in the same order.'
  );

  for (const [index, claudeEntry] of claudeEntries.entries()) {
    checkMarketplaceEntry(claudeEntry, codexEntries[index]);
  }

  // Set equality both ways: a marketplace entry without a plugin directory already failed the
  // manifest lookup above, and this catches the reverse (a plugins/<name> directory listed in
  // neither marketplace).
  assert.deepEqual(
    claudeEntries.map(entry => entry.name).toSorted((a, b) => a.localeCompare(b)),
    plugins.map(plugin => plugin.name).toSorted((a, b) => a.localeCompare(b)),
    'Every plugins/<name> directory must have an entry in both marketplace files.'
  );
}

function checkMarketplaceEntry(
  claudeEntry: { name: string; description: string; source: unknown },
  codexEntry: { name: string; description: string; source: unknown } | undefined
): void {
  assert.ok(codexEntry != null, `Codex marketplace entry missing for "${claudeEntry.name}".`);

  assert.equal(
    codexEntry.description,
    claudeEntry.description,
    `Marketplace descriptions for "${claudeEntry.name}" differ between the two files.`
  );

  // String source (Claude) vs object-form source (Codex) must point at the same directory.
  assert.equal(
    claudeEntry.source,
    `./plugins/${claudeEntry.name}`,
    `The Claude marketplace source for "${claudeEntry.name}" must be "./plugins/<name>".`
  );

  assert.deepEqual(
    codexEntry.source,
    { source: 'local', path: `./plugins/${codexEntry.name}` },
    `The Codex marketplace source for "${codexEntry.name}" must be the object form ` +
      `{"source": "local", "path": "./plugins/<name>"}.`
  );

  // The marketplace description is the storefront copy of the manifest description; the manifest
  // was parsed by checkPlugin, so a missing entry here means the plugin directory is missing.
  const manifest = claudeManifests.get(claudeEntry.name);

  assert.ok(
    manifest != null,
    `The marketplace lists "${claudeEntry.name}" but plugins/${claudeEntry.name} is missing.`
  );

  assert.equal(
    claudeEntry.description,
    manifest.description,
    `The marketplace description for "${claudeEntry.name}" differs from its plugin.json.`
  );
}

function marketplaceEntries(
  relativePath: string,
  marketplace: Record<string, unknown>
): Array<{ name: string; description: string; source: unknown }> {
  const { plugins: entries } = marketplace;

  assert.ok(Array.isArray(entries), `${relativePath} must declare a "plugins" array.`);

  return entries.map((entry: unknown) => {
    assert.ok(typeof entry == 'object' && entry != null, `${relativePath} has a non-object entry.`);

    const { name, description, source } = entry as Record<string, unknown>;

    assert.ok(typeof name == 'string', `${relativePath} has an entry without a "name".`);
    assert.ok(
      typeof description == 'string',
      `${relativePath}'s "${name}" entry has no "description".`
    );

    return { name, description, source };
  });
}

function checkRootVersionAnchor(): void {
  // The root package.json version is synced (via extra-files) from the cantrips anchor, the
  // repo's flagship plugin; the other plugins version independently.
  const anchor = readJsonObject('plugins/cantrips/package.json');
  const rootPackage = readJsonObject('package.json');

  assert.equal(
    rootPackage.version,
    anchor.version,
    `The root package.json must carry the same version as plugins/cantrips/package.json ` +
      `(the release-please anchor).`
  );
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
