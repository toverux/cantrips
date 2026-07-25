// oxlint-disable node/no-sync -- one-shot CLI process, synchronous IO is intentional.

// The tree-scanning primitives shared by the commands that read files off disk: `validate` walks a
// source clone, `status` walks an install scope, and both classify what they find by content. One
// copy of the walk keeps the two scans agreeing on what a tree contains.

import { Buffer } from 'node:buffer';
import { type Dirent, closeSync, openSync, readSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export interface WalkOptions {
  // Whether a symlink resolving to a file counts. An install scope says yes: a scroll is routinely
  // linked in from a dotfiles repo, and missing it hides the file from `status` entirely. A source
  // tree says no: a link there is a derived artifact (a harness integration pointing at the
  // canonical file), and git hands back the link's target text rather than the file it names, so
  // offering it would install 20 bytes of path. Linked directories are skipped either way, since
  // no scroll layout needs them and they invite cycles.
  followSymlinks: boolean;
}

// Directories that never hold scrolls and can be large; skipped so a scan stays fast and quiet.
const skippedDirectories = new Set(['.git', 'node_modules']);

// Ward metadata is a leading header by construction -- frontmatter or the file's first comment
// block -- so a scan reads a bounded prefix instead of whole files. The budget is orders of
// magnitude above any header a human writes, and a scroll whose header does not fit in it is not a
// scroll anyone can read either.
// oxlint-disable-next-line no-magic-numbers -- the byte count for a 16 KiB read buffer.
const HEAD_BYTES = 16 * 1024;

// Every file under `root`, recursively. An unreadable directory contributes nothing rather than
// throwing: a scan target is routinely absent (a scope with no hooks installed yet), and a caller
// that requires its root to exist checks that itself before walking.
export function walkFiles(root: string, options: WalkOptions): string[] {
  const files: string[] = [];

  collectFiles(root, options, files);

  return files;
}

// Whether the path resolves to a directory, following symlinks. A caller that requires its scan
// root to exist asks first, since the walk itself tolerates a missing directory.
export function isDirectory(target: string): boolean {
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

// Asserts that a scan root exists, for the callers that require one: the walk itself tolerates a
// missing directory, so without this a command pointed at nothing reports a clean, empty result.
export function requireDirectory(root: string): void {
  if (!isDirectory(root)) {
    throw new Error(`Not a directory: ${root}`);
  }
}

// Orders two strings by code unit. The scans sort their payloads with this rather than
// `localeCompare`, whose ordering follows the host's locale: a machine-readable report has to come
// out in the same order everywhere.
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// The leading bytes of a file as text, or undefined when it is unreadable or binary. A NUL byte in
// the head is the cheap tell for binary, which is never a scroll. A multi-byte character straddling
// the cut decodes to a replacement character, which only ever lands past the header.
export function tryReadHead(filePath: string): string | undefined {
  let handle: number;

  try {
    handle = openSync(filePath, 'r');
  } catch {
    return undefined;
  }

  const buffer = Buffer.alloc(HEAD_BYTES);
  let read: number;

  try {
    read = readSync(handle, buffer, 0, HEAD_BYTES, 0);
  } catch {
    return undefined;
  } finally {
    closeSync(handle);
  }

  const head = buffer.subarray(0, read);

  return head.includes(0) ? undefined : head.toString('utf8');
}

// Paths travel through ward metadata in POSIX form on every platform, so a scan reports what a
// provenance entry or an offering can quote verbatim.
export function toPosixRelative(root: string, absolute: string): string {
  return path.relative(root, absolute).replaceAll(path.sep, '/');
}

// The final segment of a POSIX path, or undefined when the path names no file: empty, or ending in
// a slash, which names a directory. Callers materializing a source path need that distinction,
// since `split('/').pop()` answers with an empty string rather than nothing.
export function posixBasename(posixPath: string): string | undefined {
  const segment = posixPath.split('/').pop();

  return segment == null || segment == '' ? undefined : segment;
}

// One accumulator threads through the whole walk: spreading each subtree into its parent would copy
// every path once per level of nesting, and blow the argument limit on a large tree.
function collectFiles(root: string, options: WalkOptions, files: string[]): void {
  let entries: Dirent[];

  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolute = path.join(root, entry.name);

    if (entry.isSymbolicLink()) {
      if (options.followSymlinks && isFile(absolute)) {
        files.push(absolute);
      }
    } else if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) {
        collectFiles(absolute, options, files);
      }
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }
}

function isFile(target: string): boolean {
  try {
    return statSync(target).isFile();
  } catch {
    return false;
  }
}
