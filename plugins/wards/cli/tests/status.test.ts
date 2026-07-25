import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, symlinkSync } from 'node:fs';
import path from 'node:path';
// The payload type comes from the module under test, so a change to the reported shape shows up
// here as a type error rather than as a green assertion against a payload that no longer exists.
import type { StatusReport } from '../status.ts';
import {
  cleanupFixtures,
  commitAll,
  createGitRepo,
  createTempTree,
  gitIn,
  ruleScroll,
  runCli,
  writeTree
} from './fixtures.ts';

afterAll(cleanupFixtures);

function versionedRule(version: string): string {
  return ruleScroll({ version });
}

function installedRule(version: string, source: string, sourcePath: string): string {
  return ruleScroll({ version, provenance: [{ source, path: sourcePath, version }] });
}

function statusOf(project: string): StatusReport {
  return runCli(['status', '--scope', 'project', '--project', project]).json() as StatusReport;
}

describe('status', () => {
  test('classifies a scroll as up-to-date when its recorded version matches the source', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('2.0.0') });
    const project = createTempTree({
      '.agents/rules/style.md': installedRule('2.0.0', source.dir, 'rules/style.md')
    });

    const report = statusOf(project);

    expect(report.user).toBe(null);
    expect(report.project?.files).toHaveLength(1);

    const file = report.project?.files[0];

    expect(file?.classification).toBe('up-to-date');
    expect(file?.path).toBe('.agents/rules/style.md');
    expect(file?.provenance[0]?.sourceVersion).toBe('2.0.0');
    expect(file?.provenance[0]?.comparison).toEqual({ status: 'current' });
  });

  test('classifies a scroll as outdated when the source has a newer version', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('2.0.0') });

    writeTree(source.dir, { 'rules/style.md': versionedRule('2.1.0') });
    commitAll(source, 'bump style to 2.1.0');

    const project = createTempTree({
      '.agents/rules/style.md': installedRule('2.0.0', source.dir, 'rules/style.md')
    });

    const file = statusOf(project).project?.files[0];

    expect(file?.classification).toBe('outdated');
    expect(file?.provenance[0]?.recordedVersion).toBe('2.0.0');
    expect(file?.provenance[0]?.sourceVersion).toBe('2.1.0');
    expect(file?.provenance[0]?.comparison).toEqual({ status: 'drifted' });
  });

  test('classifies a scroll with no provenance as foreign', () => {
    const project = createTempTree({ '.agents/rules/local.md': versionedRule('1.0.0') });
    const file = statusOf(project).project?.files[0];

    expect(file?.classification).toBe('foreign');
    expect(file?.provenance).toEqual([]);
  });

  test('tracks an unversioned upstream by commit hash', () => {
    const source = createGitRepo({ 'docs/foreign.md': '# Foreign\n\nUpstream body.\n' });
    const project = createTempTree({
      '.agents/rules/foreign.md': ruleScroll({
        version: '1.0.0',
        description: 'Installed from a foreign file.',
        provenance: [{ source: source.dir, path: 'docs/foreign.md', commit: source.head }],
        body: '# Foreign\n'
      })
    });

    const before = statusOf(project);

    expect(before.project?.files[0]?.classification).toBe('up-to-date');
    expect(before.project?.files[0]?.provenance[0]?.recordedCommit).toBe(source.head);

    writeTree(source.dir, { 'docs/foreign.md': '# Foreign\n\nUpstream body, revised.\n' });
    commitAll(source, 'revise the foreign file');

    const file = statusOf(project).project?.files[0];

    expect(file?.classification).toBe('outdated');
    expect(file?.provenance[0]?.comparison).toEqual({ status: 'drifted' });
    expect(file?.provenance[0]?.sourceVersion).toBe(null);
  });

  test('scans a multi-entry provenance list, drift on any entry marking the file outdated', () => {
    const versioned = createGitRepo({ 'rules/a.md': versionedRule('2.0.0') });
    const foreign = createGitRepo({ 'b.md': 'body\n' });
    const project = createTempTree({
      '.agents/rules/composite.md': ruleScroll({
        version: '2.0.0',
        description: 'A composite file.',
        provenance: [
          { source: versioned.dir, path: 'rules/a.md', version: '2.0.0' },
          { source: foreign.dir, path: 'b.md', commit: foreign.head }
        ],
        body: '# Composite\n'
      })
    });

    writeTree(versioned.dir, { 'rules/a.md': versionedRule('3.0.0') });
    commitAll(versioned, 'bump a to 3.0.0');

    const file = statusOf(project).project?.files[0];

    expect(file?.classification).toBe('outdated');
    expect(file?.provenance).toHaveLength(2);
    expect(file?.provenance[0]?.comparison).toEqual({ status: 'drifted' });
    expect(file?.provenance[1]?.comparison).toEqual({ status: 'current' });
  });

  // Two entries can name one repository at different refs, so each ref needs its own checkout: a
  // clone cache keyed by URL alone would classify the second entry against the first entry's ref.
  test('classifies two refs of one source independently', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });

    gitIn(source.dir, 'tag', 'v1');
    writeTree(source.dir, { 'rules/style.md': versionedRule('2.0.0') });
    commitAll(source, 'bump style to 2.0.0');

    const project = createTempTree({
      '.agents/rules/pinned.md': installedRule('1.0.0', `${source.dir}#v1`, 'rules/style.md'),
      '.agents/rules/tracking.md': installedRule('1.0.0', source.dir, 'rules/style.md')
    });

    const [pinned, tracking] = statusOf(project).project?.files ?? [];

    expect(pinned?.path).toBe('.agents/rules/pinned.md');
    expect(pinned?.classification).toBe('up-to-date');
    expect(pinned?.provenance[0]?.sourceVersion).toBe('1.0.0');
    expect(tracking?.classification).toBe('outdated');
    expect(tracking?.provenance[0]?.sourceVersion).toBe('2.0.0');
  });

  test('scans the user scope and defaults the project root to the working directory', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });
    const home = createTempTree({
      '.agents/rules/style.md': installedRule('1.0.0', source.dir, 'rules/style.md')
    });
    const project = createTempTree({
      '.agents/hooks/local.md': versionedRule('1.0.0')
    });

    const report = runCli(['status', '--user', home], project).json() as StatusReport;

    expect(report.user?.files[0]?.classification).toBe('up-to-date');
    expect(report.project?.root).toBe(project);
    expect(report.project?.files[0]?.classification).toBe('foreign');
  });

  test('exits 2 on an unknown scope', () => {
    const result = runCli(['status', '--scope', 'everywhere']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('scope');
  });
});

describe('status classifications beyond drift', () => {
  test('reports a scroll whose ward header does not parse as invalid, with diagnostics', () => {
    const broken = [
      '---',
      'ward:',
      '  kind: rule',
      '  description: A managed rule.',
      '  version: 1.0.0',
      '  provenance:',
      '    - source: owner/repo',
      '      path: rules/style.md',
      '      version: 1.0',
      '---',
      '# Rule\n'
    ].join('\n');

    const project = createTempTree({ '.agents/rules/broken.md': broken });
    const file = statusOf(project).project?.files[0];

    expect(file?.classification).toBe('invalid');
    expect(file?.diagnostics.some(message => message.includes('version'))).toBe(true);
  });

  test('reports a scroll it could not compare as unverified, not up-to-date', () => {
    const project = createTempTree({
      '.agents/rules/unreachable.md': installedRule(
        '1.0.0',
        '/no/such/source/anywhere',
        'rules/style.md'
      )
    });

    const file = statusOf(project).project?.files[0];

    expect(file?.classification).toBe('unverified');
    expect(file?.provenance[0]?.comparison).toEqual({
      status: 'unverified',
      reason: 'source-unavailable'
    });
  });

  test('reports a path that moved upstream as unverified', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });
    const project = createTempTree({
      '.agents/rules/moved.md': installedRule('1.0.0', source.dir, 'rules/renamed-away.md')
    });

    const file = statusOf(project).project?.files[0];

    expect(file?.classification).toBe('unverified');
    expect(file?.provenance[0]?.comparison).toEqual({
      status: 'unverified',
      reason: 'path-missing'
    });
  });

  // Version provenance against an upstream that has dropped its ward version cannot be compared at
  // all, and guessing "current" there would report a clean bill of health nothing established.
  test('reports version provenance against an unversioned upstream as unverified', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });

    writeTree(source.dir, { 'rules/style.md': '# Rule, ward header dropped.\n' });
    commitAll(source, 'drop the ward header');

    const project = createTempTree({
      '.agents/rules/style.md': installedRule('1.0.0', source.dir, 'rules/style.md')
    });

    const file = statusOf(project).project?.files[0];

    expect(file?.classification).toBe('unverified');
    expect(file?.provenance[0]?.comparison).toEqual({
      status: 'unverified',
      reason: 'source-version-missing'
    });
  });

  // A broken upstream header and a dropped upstream version send the user to two different places,
  // so they carry two different reasons.
  test('reports an unparseable upstream header under its own reason', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });

    writeTree(source.dir, { 'rules/style.md': '---\nward:\n  kind: rule\n  version: 1.0\n---\n' });
    commitAll(source, 'break the ward header');

    const project = createTempTree({
      '.agents/rules/style.md': installedRule('1.0.0', source.dir, 'rules/style.md')
    });

    const file = statusOf(project).project?.files[0];

    expect(file?.classification).toBe('unverified');
    expect(file?.provenance[0]?.comparison).toEqual({
      status: 'unverified',
      reason: 'source-header-invalid'
    });
  });

  test('exits 2 when the scope root does not exist', () => {
    const result = runCli(['status', '--scope', 'project', '--project', '/no/such/project/root']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Not a directory');
  });

  test('classifies a provenance entry against the ref it recorded', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });

    gitIn(source.dir, 'tag', 'v1');
    writeTree(source.dir, { 'rules/style.md': versionedRule('2.0.0') });
    commitAll(source, 'bump style to 2.0.0');

    const project = createTempTree({
      '.agents/rules/pinned.md': ruleScroll({
        version: '1.0.0',
        description: 'A pinned rule.',
        provenance: [{ source: source.dir, path: 'rules/style.md', ref: 'v1', version: '1.0.0' }]
      })
    });

    const file = statusOf(project).project?.files[0];

    expect(file?.classification).toBe('up-to-date');
    expect(file?.provenance[0]?.sourceVersion).toBe('1.0.0');
  });
});

// A template never lands in `.agents/`: it describes a file the project already owns, so its
// provenance rides in that file's own ward block. Without scanning those fixed paths, template
// drift would be invisible to every command.
describe('template carriers', () => {
  test('classifies a template recorded in the scope root AGENTS.md', () => {
    const source = createGitRepo({ 'templates/agents.md': versionedRule('1.0.0') });
    const project = createTempTree({
      'AGENTS.md': ruleScroll({
        version: '1.0.0',
        description: 'This project AGENTS.md, descended from a template.',
        provenance: [{ source: source.dir, path: 'templates/agents.md', version: '1.0.0' }],
        body: '# AGENTS.md\n'
      })
    });

    const before = statusOf(project).project?.files[0];

    expect(before?.path).toBe('AGENTS.md');
    expect(before?.classification).toBe('up-to-date');

    writeTree(source.dir, { 'templates/agents.md': versionedRule('2.0.0') });
    commitAll(source, 'bump the template to 2.0.0');

    const after = statusOf(project).project?.files[0];

    expect(after?.classification).toBe('outdated');
    expect(after?.provenance[0]?.sourceVersion).toBe('2.0.0');
  });

  test('classifies a template recorded in .codex/AGENTS.md', () => {
    const source = createGitRepo({ 'templates/agents.md': versionedRule('1.0.0') });
    const project = createTempTree({
      '.codex/AGENTS.md': ruleScroll({
        version: '1.0.0',
        description: 'A Codex-scoped AGENTS.md, descended from a template.',
        provenance: [{ source: source.dir, path: 'templates/agents.md', version: '1.0.0' }],
        body: '# AGENTS.md\n'
      })
    });

    const file = statusOf(project).project?.files[0];

    expect(file?.path).toBe('.codex/AGENTS.md');
    expect(file?.classification).toBe('up-to-date');
  });

  // A project's own AGENTS.md usually has nothing to do with wards, so carrying no ward header is
  // its normal state, not an unmanaged file sitting in a managed directory.
  test('passes over an AGENTS.md carrying no ward header', () => {
    const project = createTempTree({
      'AGENTS.md': '# AGENTS.md\n\nOrdinary project instructions.\n',
      '.agents/rules/local.md': versionedRule('1.0.0')
    });

    const report = statusOf(project);

    expect(report.project?.files.map(file => file.path)).toEqual(['.agents/rules/local.md']);
  });

  // A carrier that declares itself a scroll is the project's own claim that wards manages it, so a
  // template install that forgot the provenance entry is reported rather than passing every gate
  // vacuously.
  test('reports an AGENTS.md whose ward block records no provenance', () => {
    const project = createTempTree({
      'AGENTS.md': ruleScroll({
        version: '1.0.0',
        description: 'A project AGENTS.md marked as a scroll but carrying no provenance.',
        body: '# AGENTS.md\n'
      }),
      '.agents/rules/local.md': versionedRule('1.0.0')
    });

    const report = statusOf(project);

    expect(report.project?.files.map(file => file.path)).toEqual([
      '.agents/rules/local.md',
      'AGENTS.md'
    ]);
    expect(report.project?.files[1]?.classification).toBe('foreign');
  });
});

// Scrolls are routinely symlinked in from a dotfiles repo, and a scan that skipped them reported an
// empty scope, so wards would never offer their updates. Windows needs privileges to create one, so
// the test states plainly when the platform cannot exercise it.
describe('symlinked scrolls', () => {
  test('walks a scroll that is a symlink to its real file', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });
    const project = createTempTree({
      'dotfiles/style.md': installedRule('1.0.0', source.dir, 'rules/style.md')
    });

    // Creating a symlink needs developer mode or an elevated shell on Windows; where it is not
    // available the case is left to the platforms that can run it (CI is Linux).
    if (!linkFile(path.join(project, 'dotfiles/style.md'), `${project}/.agents/rules/style.md`)) {
      return;
    }

    const report = statusOf(project);

    expect(report.project?.files.map(file => file.path)).toEqual(['.agents/rules/style.md']);
    expect(report.project?.files[0]?.classification).toBe('up-to-date');
  });
});

function linkFile(target: string, link: string): boolean {
  try {
    // oxlint-disable-next-line node/no-sync -- test setup, synchronous IO keeps it linear.
    mkdirSync(path.dirname(link), { recursive: true });
    // oxlint-disable-next-line node/no-sync -- test setup, synchronous IO keeps it linear.
    symlinkSync(target, link);

    return true;
  } catch {
    return false;
  }
}

describe('status reporting for the update flow', () => {
  test('reports the ref it compared against, so an update can fetch the same one', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });

    gitIn(source.dir, 'tag', 'v1');
    writeTree(source.dir, { 'rules/style.md': versionedRule('2.0.0') });
    commitAll(source, 'bump style to 2.0.0');

    const project = createTempTree({
      '.agents/rules/pinned.md': ruleScroll({
        version: '1.0.0',
        description: 'A pinned rule.',
        provenance: [{ source: source.dir, path: 'rules/style.md', ref: 'v1', version: '1.0.0' }]
      })
    });

    expect(statusOf(project).project?.files[0]?.provenance[0]?.ref).toBe('v1');
  });

  test('exits 1 when a scroll carries metadata that does not parse', () => {
    const broken = [
      '---',
      'ward:',
      '  kind: rule',
      '  description: A managed rule.',
      '  version: nonsense',
      '---',
      '# Rule\n'
    ].join('\n');

    const project = createTempTree({ '.agents/rules/broken.md': broken });
    const result = runCli(['status', '--scope', 'project', '--project', project]);

    expect(result.exitCode).toBe(1);
  });
});
