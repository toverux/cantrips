import { afterAll, describe, expect, test } from 'bun:test';
import { readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
// The payload types come from the modules under test, so a change to a reported shape shows up here
// as a type error rather than as a green assertion against a payload that no longer exists.
import type { FetchResult } from '../fetch.ts';
import type { StatusReport } from '../status.ts';
import {
  cleanupFixtures,
  commitAll,
  createGitRepo,
  createTempTree,
  gitIn,
  outDir,
  ruleScroll,
  runCli,
  writeTree
} from './fixtures.ts';

afterAll(cleanupFixtures);

function read(file: string): string {
  // oxlint-disable-next-line node/no-sync -- test assertion, synchronous read keeps it linear.
  return readFileSync(file, 'utf8');
}

function versionedRule(version: string, body = '# Rule\n'): string {
  return ruleScroll({ version, body });
}

describe('fetch with a baseline', () => {
  test('materializes the old baseline and the new upstream for a versioned scroll', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0', 'Original body.\n') });

    writeTree(source.dir, { 'rules/style.md': versionedRule('2.0.0', 'Revised body.\n') });
    commitAll(source, 'bump style to 2.0.0');

    const result = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'rules/style.md',
      '--out',
      outDir(),
      '--version',
      '1.0.0'
    ]);
    const fetched = result.json() as FetchResult;

    expect(result.exitCode).toBe(0);
    expect(fetched.version).toBe('2.0.0');
    expect(fetched.base).not.toBe(null);
    expect(read(fetched.base ?? '')).toContain('Original body.');
    expect(read(fetched.base ?? '')).toContain('version: 1.0.0');
    expect(read(fetched.upstream)).toContain('Revised body.');
    expect(read(fetched.upstream)).toContain('version: 2.0.0');
  });

  test('recovers an unversioned baseline by commit hash', () => {
    const source = createGitRepo({ 'docs/foreign.md': 'First revision.\n' });
    const firstCommit = source.head;

    writeTree(source.dir, { 'docs/foreign.md': 'Second revision.\n' });
    commitAll(source, 'revise foreign');

    const fetched = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'docs/foreign.md',
      '--out',
      outDir(),
      '--commit',
      firstCommit
    ]).json() as FetchResult;

    expect(fetched.version).toBe(null);
    expect(read(fetched.base ?? '')).toBe('First revision.\n');
    expect(read(fetched.upstream)).toBe('Second revision.\n');
  });

  test('lays out both sides in the caller-named directory, as input for git merge-file', () => {
    const body = ['Opening paragraph.', '', 'filler a', 'filler b', 'filler c', '', 'Closing.'];
    const revised = ['Opening paragraph, revised.', ...body.slice(1)];
    const out = outDir();
    const source = createGitRepo({
      'rules/style.md': versionedRule('1.0.0', `${body.join('\n')}\n`)
    });

    writeTree(source.dir, { 'rules/style.md': versionedRule('2.0.0', `${revised.join('\n')}\n`) });
    commitAll(source, 'bump');

    const fetched = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'rules/style.md',
      '--out',
      out,
      '--version',
      '1.0.0'
    ]).json() as FetchResult;

    expect(fetched.upstream).toBe(path.join(out, 'upstream', 'style.md'));
    expect(fetched.base).toBe(path.join(out, 'base', 'style.md'));

    // A three-way merge only proves anything when all three sides differ: the local file carries an
    // edit the upstream never had, so a merge that honors the baseline keeps both sides. Passing
    // the upstream as its own local side would echo it back whatever the baseline held.
    const local = path.join(out, 'local.md');

    // oxlint-disable-next-line node/no-sync -- test setup, synchronous IO keeps it linear.
    writeFileSync(local, `${read(fetched.base ?? '').trimEnd()}\n\nA local addition.\n`);

    const merge = gitIn(out, 'merge-file', '-p', local, fetched.base ?? '', fetched.upstream);

    expect(merge).toContain('Opening paragraph, revised.');
    expect(merge).toContain('A local addition.');
    expect(merge).not.toContain('<<<<<<<');
  });

  test('exits 2 when the version cannot be recovered from history', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });
    const result = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'rules/style.md',
      '--out',
      outDir(),
      '--version',
      '9.9.9'
    ]);

    expect(result.exitCode).toBe(2);
  });

  test('exits 2 when both a version and a commit are given', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });
    const result = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'rules/style.md',
      '--out',
      outDir(),
      '--version',
      '1.0.0',
      '--commit',
      source.head
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('at most one');
  });
});

// Without a baseline, `fetch` is the install path: it materializes the upstream alone and reports
// the provenance to synthesize for it, which is how a file carrying no ward metadata becomes
// updatable like a native scroll.
describe('fetch without a baseline', () => {
  test('materializes a file with no ward metadata and reports its commit', () => {
    const source = createGitRepo({ 'docs/notes.md': 'Foreign body.\n' });
    const fetched = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'docs/notes.md',
      '--out',
      outDir()
    ]).json() as FetchResult;

    expect(fetched.version).toBe(null);
    expect(fetched.base).toBe(null);
    expect(fetched.commit).toBe(source.head);
    expect(fetched.path).toBe('docs/notes.md');
    expect(read(fetched.upstream)).toBe('Foreign body.\n');
  });

  test('reports the ward version when the fetched file carries one', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('2.1.0') });
    const fetched = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'rules/style.md',
      '--out',
      outDir()
    ]).json() as FetchResult;

    expect(fetched.version).toBe('2.1.0');
    expect(read(fetched.upstream)).toContain('# Rule');
  });

  // The synthesized provenance has to name the commit that last changed the path, not the source
  // tip, or `status` would call a freshly installed foreign file outdated on the next unrelated
  // upstream commit.
  test('reports a commit that status accepts as current provenance', () => {
    const source = createGitRepo({ 'docs/notes.md': 'Foreign body.\n' });

    writeTree(source.dir, { 'unrelated.md': 'Something else entirely.\n' });

    const tip = commitAll(source, 'commit an unrelated file');
    const fetched = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'docs/notes.md',
      '--out',
      outDir()
    ]).json() as FetchResult;

    expect(fetched.commit).not.toBe(tip);

    const project = createTempTree({
      '.agents/rules/notes.md': ruleScroll({
        version: '1.0.0',
        description: 'Installed from a foreign file.',
        provenance: [{ source: source.dir, path: fetched.path, commit: fetched.commit }],
        body: read(fetched.upstream)
      })
    });

    const report = runCli([
      'status',
      '--scope',
      'project',
      '--project',
      project
    ]).json() as StatusReport;

    expect(report.project?.files[0]?.classification).toBe('up-to-date');
  });

  test('exits 2 when the path does not exist in the source', () => {
    const source = createGitRepo({ 'docs/notes.md': 'Foreign body.\n' });
    const result = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'docs/missing.md',
      '--out',
      outDir()
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('does not exist');
  });

  test('exits 2 when a source, a path, or an output directory is missing', () => {
    const result = runCli(['fetch', '--source', 'owner/repo', '--path', 'rules/style.md']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Usage');
  });
});

describe('fetch revision selection', () => {
  test('honors an explicit --ref naming a tag', () => {
    const source = createGitRepo({ 'docs/notes.md': 'First revision.\n' });

    gitIn(source.dir, 'tag', 'v1');
    writeTree(source.dir, { 'docs/notes.md': 'Second revision.\n' });
    commitAll(source, 'revise the notes');

    const fetched = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'docs/notes.md',
      '--out',
      outDir(),
      '--ref',
      'v1'
    ]).json() as FetchResult;

    expect(fetched.ref).toBe('v1');
    expect(read(fetched.upstream)).toBe('First revision.\n');
  });

  // A clone leaves every branch but the default one as a remote-tracking ref, and the clone here
  // has no working tree to check one out into, so the branch has to resolve on its bare name.
  test('honors a --ref naming a branch that is not the default one', () => {
    const source = createGitRepo({ 'docs/notes.md': 'Main revision.\n' });

    gitIn(source.dir, 'checkout', '--quiet', '-b', 'sidetrack');
    writeTree(source.dir, { 'docs/notes.md': 'Sidetrack revision.\n' });
    commitAll(source, 'revise the notes on a side branch');
    gitIn(source.dir, 'checkout', '--quiet', 'main');

    const fetched = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'docs/notes.md',
      '--out',
      outDir(),
      '--ref',
      'sidetrack'
    ]).json() as FetchResult;

    expect(fetched.ref).toBe('sidetrack');
    expect(read(fetched.upstream)).toBe('Sidetrack revision.\n');
  });

  test('exits 2 on a --ref that does not exist in the source', () => {
    const source = createGitRepo({ 'docs/notes.md': 'Main revision.\n' });
    const result = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'docs/notes.md',
      '--out',
      outDir(),
      '--ref',
      'no-such-branch'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('no-such-branch');
  });
});

describe('fetch baseline recovery', () => {
  // A source's own release tags are unrelated to a scroll's hand-bumped version, so a tag that
  // happens to share the number is not evidence of the baseline.
  test('ignores a same-named tag whose file carries a different ward version', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0', 'Body at 1.0.0.\n') });

    writeTree(source.dir, { 'rules/style.md': versionedRule('2.0.0', 'Body at 2.0.0.\n') });
    commitAll(source, 'bump style to 2.0.0');
    // The repo-wide release tag lands on the 2.0.0 commit, sharing the recorded version's number.
    gitIn(source.dir, 'tag', 'v1.0.0');
    writeTree(source.dir, { 'rules/style.md': versionedRule('3.0.0', 'Body at 3.0.0.\n') });
    commitAll(source, 'bump style to 3.0.0');

    const fetched = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'rules/style.md',
      '--out',
      outDir(),
      '--version',
      '1.0.0'
    ]).json() as FetchResult;

    expect(read(fetched.base ?? '')).toContain('Body at 1.0.0.');
    expect(read(fetched.base ?? '')).toContain('version: 1.0.0');
    expect(read(fetched.upstream)).toContain('Body at 3.0.0.');
  });

  // The baseline is the last upstream state at the recorded version, so a revision that kept the
  // version while revising the body wins over the earlier one a tag happens to sit on.
  test('takes the newest revision carrying the recorded version, tagged or not', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0', 'Tagged body.\n') });

    gitIn(source.dir, 'tag', 'v1.0.0');
    writeTree(source.dir, {
      'rules/style.md': versionedRule('1.0.0', 'Later body, same version.\n')
    });
    commitAll(source, 'revise style without bumping');
    writeTree(source.dir, { 'rules/style.md': versionedRule('2.0.0', 'Body at 2.0.0.\n') });
    commitAll(source, 'bump style to 2.0.0');

    const fetched = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'rules/style.md',
      '--out',
      outDir(),
      '--version',
      '1.0.0'
    ]).json() as FetchResult;

    expect(read(fetched.base ?? '')).toContain('Later body, same version.');
  });

  // The baseline has to come from the history of the ref that was fetched: a baseline taken from a
  // commit the pinned ref cannot reach is content the local file never derived from, and merging
  // against it reports the whole body as rewritten.
  test('searches only the history reachable from the pinned ref', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0', 'Main body.\n') });

    gitIn(source.dir, 'tag', 'v1.0.0');
    gitIn(source.dir, 'checkout', '--quiet', '-b', 'release');
    writeTree(source.dir, { 'rules/style.md': versionedRule('1.0.0', 'Release body.\n') });
    commitAll(source, 'revise style on the release branch');
    writeTree(source.dir, { 'rules/style.md': versionedRule('2.0.0', 'Release body at 2.0.0.\n') });
    commitAll(source, 'bump style to 2.0.0 on the release branch');
    gitIn(source.dir, 'checkout', '--quiet', 'main');

    const fetched = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'rules/style.md',
      '--out',
      outDir(),
      '--ref',
      'release',
      '--version',
      '1.0.0'
    ]).json() as FetchResult;

    expect(read(fetched.base ?? '')).toContain('Release body.');
    expect(read(fetched.upstream)).toContain('Release body at 2.0.0.');
  });
});

describe('fetch path validation', () => {
  test('exits 2 when the path names a directory', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });
    const result = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'rules',
      '--out',
      outDir(),
      '--commit',
      source.head
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('names a tree');
  });

  test('exits 2 on a trailing slash, naming the path rather than an EISDIR', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });
    const result = runCli(['fetch', '--source', source.dir, '--path', 'rules/', '--out', outDir()]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('does not name a file');
    expect(result.stderr).toContain('rules/');
  });

  // The baseline side reads an older revision, where the same path may have been something else
  // entirely; `git show` would hand back a tree listing to merge against.
  test('exits 2 when the path named a directory at the recorded commit', () => {
    const source = createGitRepo({ 'docs/notes.md/inner.md': 'Inside a directory.\n' });
    const treeCommit = source.head;

    // oxlint-disable-next-line node/no-sync -- test setup, synchronous IO keeps it linear.
    rmSync(path.join(source.dir, 'docs/notes.md'), { recursive: true, force: true });
    writeTree(source.dir, { 'docs/notes.md': 'Now a file.\n' });
    commitAll(source, 'replace the directory with a file of the same name');

    const result = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'docs/notes.md',
      '--out',
      outDir(),
      '--commit',
      treeCommit
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('names a tree');
  });

  // Git stores a symlink as a blob holding its target path, so a read that trusts the object type
  // installs that path as if it were the scroll.
  test('exits 2 when the path is a symlink in the source', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });

    const rule = path.join(source.dir, 'rules/style.md');

    if (!linkFile(rule, path.join(source.dir, 'rules/link.md'))) {
      return;
    }

    commitAll(source, 'link the rule under a second name');

    const result = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'rules/link.md',
      '--out',
      outDir()
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('names a symlink');
  });
});

describe('fetch and the local file', () => {
  // Git blobs carry LF while a Windows working tree normally holds CRLF, and `git merge-file`
  // compares bytes: without matching endings every line of the merge reads as changed.
  test('writes both sides with the line endings of the file named by --local', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0', 'First body.\n') });

    writeTree(source.dir, { 'rules/style.md': versionedRule('2.0.0', 'Second body.\n') });
    commitAll(source, 'bump style to 2.0.0');

    const out = outDir();
    const local = path.join(createTempTree({}), 'style.md');

    // oxlint-disable-next-line node/no-sync -- test setup, synchronous IO keeps it linear.
    writeFileSync(local, 'A local copy.\r\nWith CRLF endings.\r\n');

    const fetched = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'rules/style.md',
      '--out',
      out,
      '--version',
      '1.0.0',
      '--local',
      local
    ]).json() as FetchResult;

    expect(read(fetched.upstream)).toContain('Second body.\r\n');
    expect(read(fetched.base ?? '')).toContain('First body.\r\n');
  });

  test('leaves the blob endings alone when no local file is named', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0', 'First body.\n') });
    const fetched = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'rules/style.md',
      '--out',
      outDir()
    ]).json() as FetchResult;

    expect(read(fetched.upstream)).not.toContain('\r\n');
  });
});

describe('fetch argument validation', () => {
  // An empty value passes a `!= null` guard, and an empty path resolves to the working directory,
  // so `fetch --out ""` would quietly write into wherever the caller happened to stand.
  test('exits 2 on a flag given an empty value', () => {
    const source = createGitRepo({ 'rules/style.md': versionedRule('1.0.0') });
    const result = runCli([
      'fetch',
      '--source',
      source.dir,
      '--path',
      'rules/style.md',
      '--out',
      ''
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('needs a value');
  });
});

function linkFile(target: string, link: string): boolean {
  try {
    // oxlint-disable-next-line node/no-sync -- test setup, synchronous IO keeps it linear.
    symlinkSync(target, link);

    return true;
  } catch {
    return false;
  }
}
