import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, symlinkSync } from 'node:fs';
import path from 'node:path';
// The payload type comes from the module under test, so a change to the reported shape shows up
// here as a type error rather than as a green assertion against a payload that no longer exists.
import type { Offering } from '../list.ts';
import {
  cleanupFixtures,
  commitAll,
  createGitRepo,
  createTempDir,
  gitIn,
  hookScroll,
  ruleScroll,
  runCli,
  writeTree
} from './fixtures.ts';

afterAll(cleanupFixtures);

const styleRule = ruleScroll({
  version: '2.1.0',
  description: 'General code style.',
  applicability: ['**/*.{ts,tsx}'],
  scope: 'project',
  body: '# General Code Style\n'
});

const checkHook = hookScroll({
  version: '1.0.0',
  description: 'Flag overlong lines after an edit.',
  event: 'fires-after-file-edit'
});

const installedCopy = ruleScroll({
  version: '2.1.0',
  description: 'An installed copy.',
  provenance: [{ source: 'owner/repo', path: 'rules/style.md', version: '2.1.0' }],
  body: '# Installed\n'
});

describe('list', () => {
  test('clones a source and emits its scroll offering as JSON', () => {
    const repo = createGitRepo({
      'rules/style.md': styleRule,
      'hooks/check.ts': checkHook,
      'README.md': '# Not a scroll\n'
    });

    const result = runCli(['list', repo.dir]);
    const offering = result.json() as Offering;

    expect(result.exitCode).toBe(0);
    expect(offering.ref).toBe(null);
    expect(offering.scrolls).toEqual([
      {
        path: 'hooks/check.ts',
        kind: 'hook',
        description: 'Flag overlong lines after an edit.',
        version: '1.0.0'
      },
      {
        path: 'rules/style.md',
        kind: 'rule',
        description: 'General code style.',
        version: '2.1.0',
        applicability: ['**/*.{ts,tsx}'],
        scope: 'project'
      }
    ]);
    expect(offering.diagnostics).toEqual([]);
  });

  test('honors a #ref suffix, offering the tree at that ref', () => {
    const repo = createGitRepo({ 'rules/style.md': styleRule });

    gitIn(repo.dir, 'tag', 'v1');
    writeTree(repo.dir, { 'rules/added.md': styleRule });
    commitAll(repo, 'add a second scroll after the tag');

    const atTag = runCli(['list', `${repo.dir}#v1`]).json() as Offering;
    const atHead = runCli(['list', repo.dir]).json() as Offering;

    expect(atTag.ref).toBe('v1');
    expect(atTag.scrolls.map(scroll => scroll.path)).toEqual(['rules/style.md']);
    expect(atHead.scrolls.map(scroll => scroll.path)).toEqual(['rules/added.md', 'rules/style.md']);
  });

  // `git clone --branch` rejects a bare commit hash, so a commit-pinned source has to fall back to
  // the full-history path even though listing itself needs only a tree.
  test('honors a #ref suffix naming a commit hash', () => {
    const repo = createGitRepo({ 'rules/style.md': styleRule });
    const firstCommit = repo.head;

    writeTree(repo.dir, { 'rules/added.md': styleRule });
    commitAll(repo, 'add a second scroll');

    const result = runCli(['list', `${repo.dir}#${firstCommit}`]);
    const offering = result.json() as Offering;

    expect(result.exitCode).toBe(0);
    expect(offering.ref).toBe(firstCommit);
    expect(offering.scrolls.map(scroll => scroll.path)).toEqual(['rules/style.md']);
  });

  test('exits 2 when no source is given', () => {
    const result = runCli(['list']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Usage');
  });

  test('exits 2 when the source cannot be cloned', () => {
    const result = runCli(['list', '/no/such/repo/anywhere']);

    expect(result.exitCode).toBe(2);
  });
});

// What a source string is, is decided by its shape alone. Probing the filesystem instead would bind
// a source to whatever directory the process was launched from, and would let a local `owner/repo`
// directory stand in for the GitHub repository of that name.
describe('list and source resolution', () => {
  test('resolves a source written as a relative path against the working directory', () => {
    const repo = createGitRepo({ 'rules/style.md': styleRule });
    const offering = runCli(
      ['list', `./${path.basename(repo.dir)}`],
      path.dirname(repo.dir)
    ).json() as Offering;

    expect(offering.scrolls.map(scroll => scroll.path)).toEqual(['rules/style.md']);
  });

  test('reports a missing relative path as a path, not as a GitHub shorthand', () => {
    const result = runCli(['list', './no-such-source'], createTempDir());

    expect(result.exitCode).toBe(2);
    expect(result.stderr).not.toContain('github.com');
  });
});

describe('list and derived artifacts', () => {
  // A source that dogfoods its own scrolls holds both the originals and the installed copies; only
  // the originals are on offer, or a user would install a copy that tracks a derived path.
  test('leaves provenance-carrying files out of the offering', () => {
    const repo = createGitRepo({
      'rules/style.md': styleRule,
      '.agents/rules/style.md': installedCopy
    });

    const offering = runCli(['list', repo.dir]).json() as Offering;

    expect(offering.scrolls.map(scroll => scroll.path)).toEqual(['rules/style.md']);
  });
});

describe('list and derived artifacts, continued', () => {
  test('reports excluded installed copies so an empty offering is not ambiguous', () => {
    const repo = createGitRepo({ '.agents/rules/style.md': installedCopy });
    const offering = runCli(['list', repo.dir]).json() as Offering;

    expect(offering.scrolls).toEqual([]);
    expect(offering.excluded).toEqual(['.agents/rules/style.md']);
  });

  // A link in a source tree is a harness integration pointing at the canonical file, and git hands
  // back the link's target text rather than the file, so offering it would install a path string.
  test('does not offer a scroll twice when the source symlinks it', () => {
    const repo = createGitRepo({ 'rules/style.md': styleRule });

    if (!linkFile(path.join(repo.dir, 'rules/style.md'), `${repo.dir}/.claude/rules/style.md`)) {
      return;
    }

    commitAll(repo, 'link the rule into the harness directory');

    const offering = runCli(['list', repo.dir]).json() as Offering;

    expect(offering.scrolls.map(scroll => scroll.path)).toEqual(['rules/style.md']);
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
