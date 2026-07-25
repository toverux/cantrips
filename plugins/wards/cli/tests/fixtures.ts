// oxlint-disable node/no-sync -- test helpers, synchronous IO keeps them linear and readable.

// Shared test fixtures for the wards CLI. The approved test seam is the CLI subprocess boundary, so
// `runCli` invokes the binary exactly as production does; the rest build the temp directories and
// temp git repositories the subprocess runs against. Later CLI tickets (list, status, fetch) reuse
// these, so they are kept general and framework-free (no bun:test import here).

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// A tree of files to materialize, keyed by POSIX-style relative path; parent directories are
// created as needed.
export type FileTree = Record<string, string>;

// One installed-side provenance entry, written into a scroll fixture's ward header.
export interface ProvenanceFixture {
  source: string;
  path: string;
  ref?: string;
  version?: string;
  commit?: string;
}

export interface RuleFixture {
  version: string;
  description?: string;
  applicability?: string[];
  scope?: string;
  // Present on a scroll that stands for an installed copy; absent on one that stands for a source.
  provenance?: ProvenanceFixture[];
  body?: string;
}

export interface HookFixture {
  version: string;
  description?: string;
  scope?: string;
  event?: string;
  body?: string;
}

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  json: () => unknown;
}

export interface GitRepo {
  dir: string;
  head: string;
}

const cliPath = path.join(import.meta.dirname, '..', 'wards-cli.ts');
const nodeFlags = ['--disable-warning=ExperimentalWarning', '--experimental-strip-types'];

// Every temp path created in a run, torn down by `cleanupFixtures` so a suite leaves no residue.
const tempRoots: string[] = [];

// A Markdown rule scroll, carrying the required ward fields plus whatever the case is actually
// about. Written line by line rather than through a YAML library, so the fixtures exercise the same
// hand-authored text a scroll author writes.
export function ruleScroll(fixture: RuleFixture): string {
  const lines = [
    '---',
    'ward:',
    '  kind: rule',
    `  description: ${fixture.description ?? 'A versioned rule.'}`,
    `  version: ${fixture.version}`
  ];

  if (fixture.applicability != null) {
    lines.push(
      '  applicability:',
      ...fixture.applicability.map(glob => `    - ${JSON.stringify(glob)}`)
    );
  }

  if (fixture.scope != null) {
    lines.push(`  scope: ${fixture.scope}`);
  }

  if (fixture.provenance != null) {
    lines.push('  provenance:', ...fixture.provenance.flatMap(entry => provenanceLines(entry)));
  }

  lines.push('---', fixture.body ?? '# Rule\n');

  return lines.join('\n');
}

// An executable hook scroll: the same grammar carried by a leading line-comment header.
export function hookScroll(fixture: HookFixture): string {
  const lines = [
    '// ward:',
    '//   kind: hook',
    `//   description: ${fixture.description ?? 'A versioned hook.'}`,
    `//   version: ${fixture.version}`
  ];

  if (fixture.scope != null) {
    lines.push(`//   scope: ${fixture.scope}`);
  }

  if (fixture.event != null) {
    lines.push(`//   event: ${fixture.event}`);
  }

  lines.push('', fixture.body ?? "console.log('hi');\n");

  return lines.join('\n');
}

export function createTempDir(prefix = 'wards-'): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));

  tempRoots.push(dir);

  return dir;
}

export function writeTree(root: string, files: FileTree): string {
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(root, relative);

    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }

  return root;
}

export function createTempTree(files: FileTree, prefix = 'wards-tree-'): string {
  return writeTree(createTempDir(prefix), files);
}

// A path for a directory the CLI subprocess creates and fills (`fetch --out`). Its parent is
// registered up front, so the suite tears the output down even though nothing in-process wrote it.
export function outDir(prefix = 'wards-out-'): string {
  return path.join(createTempDir(prefix), 'out');
}

// A committed git repository the CLI can treat as a source. The commit identity is pinned locally
// to keep the fixture self-contained and deterministic regardless of the caller's git config.
export function createGitRepo(files: FileTree = {}, prefix = 'wards-repo-'): GitRepo {
  const dir = createTempDir(prefix);

  git(dir, 'init', '--quiet', '--initial-branch=main');
  git(dir, 'config', 'user.email', 'wards@example.test');
  git(dir, 'config', 'user.name', 'Wards Fixture');
  writeTree(dir, files);
  git(dir, 'add', '--all');
  git(dir, 'commit', '--quiet', '--message', 'initial');

  return { dir, head: git(dir, 'rev-parse', 'HEAD').trim() };
}

export function commitAll(repo: GitRepo, message: string): string {
  git(repo.dir, 'add', '--all');
  git(repo.dir, 'commit', '--quiet', '--message', message);

  return git(repo.dir, 'rev-parse', 'HEAD').trim();
}

// Runs the CLI as a child process under the production Node flags, mirroring how the /wards skill
// shells out. Never throws on a non-zero exit; the exit code is part of what tests assert on.
export function runCli(args: string[], cwd?: string): CliResult {
  const result = spawnSync('node', [...nodeFlags, cliPath, ...args], {
    encoding: 'utf8',
    ...(cwd == null ? {} : { cwd })
  });

  const stdout = result.stdout ?? '';

  return {
    stdout,
    stderr: result.stderr ?? '',
    exitCode: result.status ?? -1,
    json: (): unknown => JSON.parse(stdout)
  };
}

// Runs a raw git command inside a fixture repo, for the cases a test needs beyond commit history:
// tagging a release, reading a commit hash, checking out a ref. Returns git's stdout.
export function gitIn(dir: string, ...args: string[]): string {
  return git(dir, ...args);
}

export function cleanupFixtures(): void {
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop();

    if (dir != null) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

function provenanceLines(entry: ProvenanceFixture): string[] {
  return [
    // The source is a temp path on every platform, so it is quoted: a Windows path would otherwise
    // read as a YAML scalar full of backslashes.
    `    - source: ${JSON.stringify(entry.source)}`,
    `      path: ${entry.path}`,
    ...(entry.ref == null ? [] : [`      ref: ${entry.ref}`]),
    ...(entry.version == null ? [] : [`      version: ${entry.version}`]),
    ...(entry.commit == null ? [] : [`      commit: ${entry.commit}`])
  ];
}

// The fixtures shell out to git themselves rather than reusing the CLI's git.ts: a harness built
// on the code under test cannot fail when that code regresses.
function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });

  if (result.status != 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }

  return result.stdout ?? '';
}
