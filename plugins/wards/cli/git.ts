// oxlint-disable node/no-sync -- one-shot CLI process, synchronous git and IO are intentional.

// The git substrate: the CLI shells out to the user's `git` (so their existing auth covers private
// sources) and materializes clones into temp directories. Every git call is synchronous, matching
// the rest of the one-shot CLI; a failed call throws with the command and git's stderr so the edge
// in wards-cli.ts can report it. Written as functions over data, since the production runtime is
// Node's type stripping and the codebase stays class-free.
//
// `runGit` and `git` stay module-private on purpose: every clone this module hands out owns a temp
// directory the caller must tear down, and a raw git call is how that lifecycle gets bypassed.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

// How a clone is provisioned, chosen by what the caller reads from it rather than by a flag matrix:
//
// - `tip`: one commit deep with a working tree, for a scan of the checked-out files.
// - `history`: the whole history with a working tree, for a scan that also walks a file's past.
// - `history-only`: the whole history with no working tree, for reads that go through `git show`.
export type CloneMode = 'tip' | 'history' | 'history-only';

// What a tree entry is, read off its file mode. Only `file` is content a caller can install or
// merge.
export type EntryKind = 'file' | 'tree' | 'symlink' | 'submodule';

const entryKindsByMode: Record<string, EntryKind> = {
  '040000': 'tree',
  '100644': 'file',
  '100755': 'file',
  '120000': 'symlink',
  '160000': 'submodule'
};

// oxlint-disable-next-line no-magic-numbers -- spawnSync needs the byte count for a 64 MiB buffer.
const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;

// A git clone's pack files can stay briefly undeletable on Windows (a hardlinked inode, an indexing
// or antivirus handle), and losing the race leaks a whole clone, so removal retries over roughly
// five seconds before giving up.
const TEMP_REMOVAL_RETRIES = 10;
const TEMP_REMOVAL_DELAY_MS = 100;

const clonePrefix = 'wards-clone-';

interface GitResult {
  status: number;
  stdout: string;
  stderr: string;
}

// Clones a source into a fresh temp directory, which the caller owns and tears down.
export function cloneSource(url: string, ref: string | undefined, mode: CloneMode): string {
  // `git clone --branch` accepts branches and tags only, so a ref that reads as a commit hash goes
  // straight to the full-history path, where a checkout resolves every kind of ref.
  if (mode == 'tip' && !(ref != null && looksLikeCommitHash(ref))) {
    return cloneShallow(url, ref);
  }

  return cloneFullFresh(url, ref, mode);
}

// Removes a temp directory the CLI created. Cleanup failure never fails the command: the answer is
// already computed, and residue in the OS temp directory is the lesser outcome. The warning goes to
// stderr so the JSON payload on stdout stays machine-readable.
export function removeTempDir(dir: string): void {
  try {
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: TEMP_REMOVAL_RETRIES,
      retryDelay: TEMP_REMOVAL_DELAY_MS
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    process.stderr.write(`Warning: could not remove the temp directory ${dir}: ${detail}\n`);
  }
}

// The full commit hash of the newest commit that changed `posixPath` at `revision`, or undefined
// when the path has no history there. Used for commit-hash provenance: an unversioned upstream file
// is current exactly when this matches the recorded commit.
export function lastCommitOfPath(
  dir: string,
  posixPath: string,
  revision = 'HEAD'
): string | undefined {
  const output = git(dir, ['log', '-1', '--format=%H', revision, '--', posixPath]).trim();

  return output == '' ? undefined : output;
}

// The commit hashes reachable from `revision` that changed `posixPath`, newest first; the history
// the version-baseline search walks.
export function commitsForPath(dir: string, posixPath: string, revision = 'HEAD'): string[] {
  return git(dir, ['log', '--format=%H', revision, '--', posixPath])
    .split('\n')
    .map(line => line.trim())
    .filter(line => line != '');
}

// What the entry at `<commit>:<posixPath>` is, or undefined when the path does not resolve there.
// The answer comes from the entry's file mode rather than its object type, because git stores a
// symlink as a blob holding its target path: the object type calls it a file and only the mode
// tells them apart. `git show` answers for every kind of entry -- a listing for a tree, the target
// path for a symlink -- so a caller that needs file content asks first.
export function entryKindAt(dir: string, commit: string, posixPath: string): EntryKind | undefined {
  const result = runGit(dir, ['ls-tree', commit, '--', posixPath]);

  if (result.status != 0) {
    return undefined;
  }

  const [mode] = result.stdout.trim().split(' ');

  return mode == null ? undefined : entryKindsByMode[mode];
}

// The content of a file at a specific commit, or undefined when the file did not exist there.
export function fileAtCommit(dir: string, commit: string, posixPath: string): string | undefined {
  const result = runGit(dir, ['show', `${commit}:${posixPath}`]);

  return result.status == 0 ? result.stdout : undefined;
}

// Resolves a ref (tag, branch, or commit) to a full commit hash, or undefined when it does not
// exist. A clone leaves every branch but the default one as a remote-tracking ref that a bare name
// does not reach, so the `origin/`-qualified form is tried too; a tag or a hash answers first.
export function resolveRef(dir: string, ref: string): string | undefined {
  for (const candidate of [ref, `origin/${ref}`]) {
    const result = runGit(dir, ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`]);

    if (result.status == 0) {
      return result.stdout.trim();
    }
  }

  return undefined;
}

function cloneShallow(url: string, ref: string | undefined): string {
  const dir = makeTempDir();
  const branch = ref == null ? [] : ['--branch', ref];
  const result = cloneInto(dir, [...cloneArgs('tip'), '--depth', '1', ...branch, url, dir]);

  if (result.status == 0) {
    return dir;
  }

  removeTempDir(dir);

  if (ref == null) {
    throw new Error(`git clone failed: ${result.stderr.trim()}`);
  }

  // The ref may still be one git can resolve once the history is present (an abbreviated hash, a
  // commit that is not a branch tip), so the shallow rejection is a reason to retry, not to fail.
  // The retry takes a directory of its own: a removal that loses the race above would otherwise
  // leave a non-empty one, which `git clone` refuses outright.
  return cloneFullFresh(url, ref, 'tip');
}

// Runs a full clone into a fresh temp directory, tearing the directory down when the clone fails,
// since no caller ever learns its path.
function cloneFullFresh(url: string, ref: string | undefined, mode: CloneMode): string {
  const dir = makeTempDir();

  try {
    git(null, [...cloneArgs(mode), url, dir]);

    // A checked-out mode resolves the ref before checking it out, since `git checkout <name>`
    // reaches a remote-tracking branch only through git's DWIM guess, which the user's config can
    // disable; `resolveRef` answers for a tag, a hash, and both branch forms. A checkout-free clone
    // leaves resolution to the read helpers, which take the revision as an argument.
    if (mode != 'history-only' && ref != null) {
      const commit = resolveRef(dir, ref);

      if (commit == null) {
        throw new Error(`The ref "${ref}" does not exist in the source.`);
      }

      git(dir, ['checkout', '--quiet', commit]);
    }
  } catch (error) {
    removeTempDir(dir);

    throw error;
  }

  return dir;
}

// Runs a clone into a temp directory the CLI just created, tearing that directory down when the
// call throws (git missing from PATH, output past the buffer), so a failed spawn leaks nothing.
function cloneInto(dir: string, args: string[]): GitResult {
  try {
    return runGit(null, args);
  } catch (error) {
    removeTempDir(dir);

    throw error;
  }
}

function cloneArgs(mode: CloneMode): string[] {
  // `--no-hardlinks` matters for a local source: git would otherwise hardlink its read-only pack
  // files into the clone, so tearing the clone down fights the source repository's own inodes
  // (undeletable on Windows, and a chmod on one is a chmod on the other). It is inert for a remote.
  const args = ['clone', '--quiet', '--no-hardlinks'];

  if (mode == 'history-only') {
    // The working tree goes unread here, and its checkout is the expensive half of a clone. Its
    // blobs stay, though: this mode exists to read old revisions, and `--filter=blob:none` would
    // trade the checkout for a network round trip per commit walked.
    args.push('--no-checkout');
  } else {
    // Historical blobs are dead weight for a scan that reads only the checked-out tree; the blobs
    // the checkout itself needs still come down.
    args.push('--filter=blob:none');
  }

  return args;
}

function makeTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), clonePrefix));
}

function looksLikeCommitHash(ref: string): boolean {
  return /^[0-9a-f]{7,40}$/iu.test(ref);
}

// Runs git and returns its outcome without throwing, so callers that expect a command to fail
// sometimes (a missing path, a ref that is a commit rather than a branch) can branch on the status.
function runGit(cwd: string | null, args: string[]): GitResult {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    ...(cwd == null ? {} : { cwd })
  });

  if (result.error != null) {
    // The wrapped cause carries the spawn error's `code`, which is what tells a missing git
    // (ENOENT) apart from every other reason the process failed to start.
    throw new Error(`Failed to run git: ${result.error.message}`, { cause: result.error });
  }

  return { status: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

// Runs git and returns its stdout, throwing on a non-zero exit; for commands whose failure is a
// genuine error rather than an expected branch.
function git(cwd: string | null, args: string[]): string {
  const result = runGit(cwd, args);

  if (result.status != 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }

  return result.stdout;
}
