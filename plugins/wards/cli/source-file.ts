// Reading one named path out of a cloned source, with everything provenance needs to name it. This
// is the step between "the source is on disk" and "the file is materialized somewhere the caller
// asked for", shared by every command that pulls a single file rather than scanning a tree.

import { posixBasename } from './files.ts';
import { entryKindAt, fileAtCommit, lastCommitOfPath } from './git.ts';
import { wardVersionOf } from './ward-metadata.ts';

// A file read from a source at its newest state, with everything provenance needs to name it.
export interface SourceFile {
  content: string;
  version: string | undefined;
  commit: string;
}

// Reads a path from a clone as of `revision`: the content, the ward version when the file carries
// one, and the commit that last changed it. Only a file qualifies: `git show` answers for a
// directory with a tree listing and for a symlink with its target path, either of which would
// otherwise be installed or merged as content.
export function readSourceFile(clone: string, posixPath: string, revision: string): SourceFile {
  const commit = lastCommitOfPath(clone, posixPath, revision);
  const kind = commit == null ? undefined : entryKindAt(clone, commit, posixPath);

  if (commit == null || kind == null) {
    throw new Error(`The path "${posixPath}" does not exist in the source.`);
  }

  if (kind != 'file') {
    throw new Error(`The path "${posixPath}" names a ${kind} in the source, not a file.`);
  }

  const content = fileAtCommit(clone, commit, posixPath);

  if (content == null) {
    throw new Error(`The path "${posixPath}" could not be read from the source.`);
  }

  return { content, version: wardVersionOf(content), commit };
}

// The name the materialized copy takes, rejecting a path that names no file before anything is
// cloned, so the caller gets the path back in the message rather than an EISDIR from deep inside.
export function requireFilename(posixPath: string): string {
  const filename = posixBasename(posixPath);

  if (filename == null) {
    throw new Error(`The path "${posixPath}" does not name a file; drop the trailing "/".`);
  }

  return filename;
}
