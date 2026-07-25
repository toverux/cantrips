// oxlint-disable node/no-sync -- one-shot CLI process, synchronous git and IO are intentional.

// The `fetch` command: materialize one path from a source into a directory the caller names, and
// report what provenance to record for it. With a baseline (the version or commit the local file
// last applied) it also recovers that older revision, laying out the three-way update merge: the
// caller runs `git merge-file <local> <base> <upstream>`, so wards keeps the judgment (the conflict
// resolution) with the agent. Without one it is the plain install path, which is how a file with no
// ward metadata of its own becomes updatable like a native scroll.
//
// The output directory belongs to the caller: wards creates it and writes into it, and the caller
// chooses where it lives and when it goes away.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  cloneSource,
  commitsForPath,
  entryKindAt,
  fileAtCommit,
  removeTempDir,
  resolveRef
} from './git.ts';
import { readSourceFile, requireFilename } from './source-file.ts';
import { resolveSource } from './source.ts';
import { wardVersionOf } from './ward-metadata.ts';

// What the local file last applied, and therefore how to find it again upstream: a recorded version
// is searched for in history, a recorded commit pins it directly. The two are mutually exclusive,
// so they travel as one value rather than as two nullable fields.
export type FetchBaseline = { kind: 'version'; value: string } | { kind: 'commit'; value: string };

export interface FetchOptions {
  source: string;
  path: string;
  out: string;
  // The revision to recover alongside the upstream file, or undefined to materialize the upstream
  // alone.
  baseline: FetchBaseline | undefined;
  ref: string | undefined;
  // The local file the materialized sides will be merged against, or undefined to write them with
  // the line endings git stores.
  local: string | undefined;
}

export interface FetchResult {
  // The resolved source spec, echoed so the caller can record it as provenance verbatim.
  source: string;
  ref: string | null;
  path: string;
  upstream: string;
  // The materialized baseline, or null when none was asked for.
  base: string | null;
  version: string | null;
  commit: string;
}

export function fetchFromSource(options: FetchOptions): FetchResult {
  const resolved = resolveSource(options.source);
  const ref = options.ref ?? resolved.ref;
  const filename = requireFilename(options.path);
  // Full history: the provenance commit is the file's last-changing one, which a shallow clone
  // cannot tell apart from its tip, and a baseline lives further back still. Nothing here reads the
  // working tree, so the clone skips the checkout and every read names its revision.
  const clone = cloneSource(resolved.url, ref, 'history-only');

  try {
    const revision = revisionOf(clone, ref);
    const upstream = readSourceFile(clone, options.path, revision);
    const baseline =
      options.baseline == null
        ? undefined
        : recoverBaseline(clone, options.path, options.baseline, revision);

    const asLocal = lineEndingAdapter(options.local);
    const upstreamPath = write(options.out, 'upstream', filename, asLocal(upstream.content));
    const basePath =
      baseline == null ? null : write(options.out, 'base', filename, asLocal(baseline));

    return {
      source: resolved.spec,
      ref: ref ?? null,
      path: options.path,
      upstream: upstreamPath,
      base: basePath,
      version: upstream.version ?? null,
      commit: upstream.commit
    };
  } finally {
    removeTempDir(clone);
  }
}

// The revision every read runs against. A checkout-free clone leaves HEAD on the default branch, so
// a pinned ref is resolved to its commit once here rather than re-resolved per git call.
function revisionOf(clone: string, ref: string | undefined): string {
  if (ref == null) {
    return 'HEAD';
  }

  const commit = resolveRef(clone, ref);

  if (commit == null) {
    throw new Error(`The ref "${ref}" does not exist in the source.`);
  }

  return commit;
}

// The baseline is the upstream content the local file last applied. A commit hash pins it directly;
// a version is resolved by walking the file's history for the newest commit whose ward version
// equals the recorded one: the last upstream state at that version before a later bump.
function recoverBaseline(
  clone: string,
  posixPath: string,
  baseline: FetchBaseline,
  revision: string
): string {
  return baseline.kind == 'commit'
    ? baselineAtCommit(clone, posixPath, baseline.value)
    : baselineAtVersion(clone, posixPath, baseline.value, revision);
}

// A recorded commit pins the baseline directly, but what the path named back then is whatever the
// source held there, so the entry is checked exactly as the upstream read checks its own.
function baselineAtCommit(clone: string, posixPath: string, commit: string): string {
  const kind = entryKindAt(clone, commit, posixPath);

  if (kind != null && kind != 'file') {
    throw new Error(`The path "${posixPath}" names a ${kind} at commit ${commit}, not a file.`);
  }

  const content = kind == null ? undefined : fileAtCommit(clone, commit, posixPath);

  if (content == null) {
    throw new Error(`The path "${posixPath}" does not exist at commit ${commit}.`);
  }

  return content;
}

function baselineAtVersion(
  clone: string,
  posixPath: string,
  version: string,
  revision: string
): string {
  for (const commit of commitsForPath(clone, posixPath, revision)) {
    const content = fileAtCommit(clone, commit, posixPath);

    if (content != null && wardVersionOf(content) == version) {
      return content;
    }
  }

  throw new Error(`Could not recover version ${version} of "${posixPath}" from source history.`);
}

// Both sides go out with the local file's line endings when the caller names it: git stores blobs
// with LF, a Windows working tree normally holds CRLF, and `git merge-file` compares bytes, so a
// mismatch makes every line of the merge read as changed. Without the flag the blob stands as is.
function lineEndingAdapter(local: string | undefined): (content: string) => string {
  if (local == null || !readFileSync(local, 'utf8').includes('\r\n')) {
    return content => content;
  }

  return content => content.replaceAll(/\r?\n/gu, '\r\n');
}

// The layout is uniform whatever was asked for: one subdirectory per side, each holding the file
// under its upstream name, so a merge command reads the same three paths every time.
function write(out: string, side: string, filename: string, content: string): string {
  const target = path.join(out, side, filename);

  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);

  return target;
}
