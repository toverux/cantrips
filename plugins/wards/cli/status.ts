// The `status` command: scan an install scope's canonical `.agents/rules` and `.agents/hooks`
// trees plus the fixed paths a template scroll may claim, read each file's installed provenance,
// and classify it against its source. Scope is a root-path parameter (a project root or the user's
// home), so one code path serves both, and the tests point the roots at fixture trees. A file with
// no provenance is foreign (present but unmanaged) and one whose header does not parse is invalid,
// carrying the parse errors; a managed file is outdated when any of its provenance entries has
// drifted from its source, by semver for versioned upstreams or by commit hash for unversioned
// ones. An entry the scan could not compare (an unreachable source, a path that moved upstream)
// makes the file unverified rather than current: a green report has to mean something was actually
// checked.

import assert from 'node:assert/strict';
import path from 'node:path';
import { compareText, requireDirectory, toPosixRelative, tryReadHead, walkFiles } from './files.ts';
import { cloneSource, lastCommitOfPath, removeTempDir } from './git.ts';
import { compareSemver } from './semver.ts';
import { type ResolvedSource, resolveSource } from './source.ts';
import { scopeSubdirectories, templateCarriers } from './ward-grammar.ts';
import { type ParseResult, type ProvenanceEntry, parseWardFile } from './ward-metadata.ts';

export type Classification = 'up-to-date' | 'outdated' | 'unverified' | 'foreign' | 'invalid';

// Why an entry could not be compared against its source. Each code is a distinct thing to fix, so
// the skill acting on the report branches on it instead of reading prose.
export type UnverifiedReason =
  // The clone failed: an unreachable source, or a ref that no longer exists. The entry's `ref` says
  // which ref was tried.
  | 'source-unavailable'
  // The path is not in the source at that ref.
  | 'path-missing'
  // Version provenance, but the source file no longer carries a version.
  | 'source-version-missing'
  // Version provenance, but the source file's own ward header does not parse, so there is nothing
  // to compare against and the thing to fix is upstream, not here.
  | 'source-header-invalid'
  // Commit provenance, but the path has no history in the source.
  | 'source-history-missing';

// The one three-state fact a provenance entry carries, as one value: an entry is compared and
// current, compared and drifted, or not compared at all for a named reason.
export type Comparison =
  | { status: 'current' }
  | { status: 'drifted' }
  | { status: 'unverified'; reason: UnverifiedReason };

export interface EntryStatus {
  source: string;
  path: string;
  // The ref the comparison ran against, so an update can fetch from the same place; null means the
  // source's default branch.
  ref: string | null;
  recordedVersion: string | null;
  recordedCommit: string | null;
  sourceVersion: string | null;
  sourceCommit: string | null;
  comparison: Comparison;
}

export interface FileStatus {
  path: string;
  classification: Classification;
  provenance: EntryStatus[];
  // The ward-header parse errors, on an `invalid` file; empty otherwise.
  diagnostics: string[];
}

export interface ScopeStatus {
  root: string;
  files: FileStatus[];
}

export interface StatusReport {
  project: ScopeStatus | null;
  user: ScopeStatus | null;
}

export interface StatusOptions {
  projectRoot: string | null;
  userRoot: string | null;
}

// A source is cloned at most once per run: many installed files share an upstream, and a clone that
// fails (an unreachable source) is remembered as a miss so it is not retried. Every clone dir is
// torn down when the scan finishes.
interface SourceCache {
  clones: Map<string, string | undefined>;
  dirs: string[];
}

// What a file carrying no ward header means, which depends on where it sits. In a canonical tree,
// where scrolls are the only thing that belongs, it is a foreign file: present but unmanaged. In a
// template carrier it is the ordinary state of a file the project owns, so it is not this
// command's business at all.
type HeaderlessPolicy = 'foreign' | 'skip';

export function statusReport(options: StatusOptions): StatusReport {
  const cache: SourceCache = { clones: new Map(), dirs: [] };

  try {
    return {
      project: options.projectRoot == null ? null : scanScope(options.projectRoot, cache),
      user: options.userRoot == null ? null : scanScope(options.userRoot, cache)
    };
  } finally {
    for (const dir of cache.dirs) {
      removeTempDir(dir);
    }
  }
}

function scanScope(root: string, cache: SourceCache): ScopeStatus {
  // Scanning a scope root that does not exist would otherwise report a clean, empty scope and pass
  // the install gate vacuously.
  requireDirectory(root);

  const scanned = scopeSubdirectories
    .flatMap(subdirectory =>
      walkFiles(path.join(root, '.agents', subdirectory), { followSymlinks: true })
    )
    .map(absolute => classifyFile(root, absolute, cache, 'foreign'));

  const templates = templateCarriers.map(carrier =>
    classifyFile(root, path.join(root, ...carrier.split('/')), cache, 'skip')
  );

  const files = [...scanned, ...templates].filter(file => file != null);

  files.sort((a, b) => compareText(a.path, b.path));

  return { root, files };
}

// The status of one file, or undefined when it is not this command's business: unreadable, absent
// (a template carrier the project never created), or carrying no ward header where that is the
// ordinary state. A carrier that does declare itself a scroll is reported, so a template install
// that never recorded its provenance is visible rather than silently passing every gate.
function classifyFile(
  root: string,
  absolute: string,
  cache: SourceCache,
  headerless: HeaderlessPolicy
): FileStatus | undefined {
  const head = tryReadHead(absolute);

  if (head == null) {
    return undefined;
  }

  const result = parseWardFile(head);

  if (result.status == 'absent' && headerless == 'skip') {
    return undefined;
  }

  const relativePath = toPosixRelative(root, absolute);

  // A header that fails to parse is reported as broken, with the parser's own messages: collapsing
  // it into `foreign` would hide a managed file from the updater and invite a fresh install over
  // the user's local deltas.
  if (result.status == 'invalid') {
    return {
      path: relativePath,
      classification: 'invalid',
      provenance: [],
      diagnostics: result.errors
    };
  }

  const provenance =
    result.status == 'valid' && result.ward.provenance != null ? result.ward.provenance : [];

  if (provenance.length == 0) {
    return { path: relativePath, classification: 'foreign', provenance: [], diagnostics: [] };
  }

  const entries = provenance.map(entry => checkEntry(entry, cache));

  return {
    path: relativePath,
    classification: classify(entries),
    provenance: entries,
    diagnostics: []
  };
}

function classify(entries: readonly EntryStatus[]): Classification {
  if (entries.some(entry => entry.comparison.status == 'drifted')) {
    return 'outdated';
  }

  if (entries.some(entry => entry.comparison.status == 'unverified')) {
    return 'unverified';
  }

  return 'up-to-date';
}

function checkEntry(entry: ProvenanceEntry, cache: SourceCache): EntryStatus {
  const resolved = resolveSource(entry.source);
  // An entry's own `ref` wins over a `#ref` suffix in its source string, so a pinned install is
  // compared against what it pinned.
  const ref = entry.ref ?? resolved.ref;
  const base: Omit<EntryStatus, 'comparison'> = {
    source: entry.source,
    path: entry.path,
    ref: ref ?? null,
    recordedVersion: entry.version ?? null,
    recordedCommit: entry.commit ?? null,
    sourceVersion: null,
    sourceCommit: null
  };

  const clone = getClone(cache, resolved, ref);

  if (clone == null) {
    return { ...base, comparison: { status: 'unverified', reason: 'source-unavailable' } };
  }

  // Reading the checked-out file doubles as the existence probe: a scroll is text by construction,
  // since it carries its ward header inline.
  const head = tryReadHead(path.join(clone, ...entry.path.split('/')));

  if (head == null) {
    return { ...base, comparison: { status: 'unverified', reason: 'path-missing' } };
  }

  // The last-changing commit costs a git spawn per file, and only commit-hash provenance is
  // classified from it; a versioned upstream answers from the header just read.
  const sourceCommit = entry.commit == null ? undefined : lastCommitOfPath(clone, entry.path);
  const sourceWard = parseWardFile(head);

  return {
    ...base,
    sourceCommit: sourceCommit ?? null,
    sourceVersion: sourceWard.status == 'valid' ? sourceWard.ward.version : null,
    comparison: compareDrift(entry, sourceWard, sourceCommit)
  };
}

// Commit-hash provenance drifts when the source file's newest commit no longer matches the recorded
// one (the recorded hash may be abbreviated, so a prefix match counts as current). Version
// provenance drifts when the source's current version is greater; a source that has dropped its
// version, or whose header stopped parsing, cannot be compared, so it is reported unverified rather
// than guessed, under the reason that names what to go and fix.
function compareDrift(
  entry: ProvenanceEntry,
  sourceWard: ParseResult,
  sourceCommit: string | undefined
): Comparison {
  if (entry.commit != null) {
    if (sourceCommit == null) {
      return { status: 'unverified', reason: 'source-history-missing' };
    }

    return { status: sourceCommit.startsWith(entry.commit) ? 'current' : 'drifted' };
  }

  // A provenance entry records a version or a commit: the metadata validator rejects an entry with
  // neither, so a file carrying one is classified invalid and never reaches a comparison.
  assert.ok(entry.version != null);

  if (sourceWard.status == 'invalid') {
    return { status: 'unverified', reason: 'source-header-invalid' };
  }

  if (sourceWard.status == 'absent') {
    return { status: 'unverified', reason: 'source-version-missing' };
  }

  return {
    status: compareSemver(sourceWard.ward.version, entry.version) > 0 ? 'drifted' : 'current'
  };
}

// The cache key carries the ref: two provenance entries can name the same repository at different
// refs, and they need their own checkouts to classify against.
function getClone(
  cache: SourceCache,
  resolved: ResolvedSource,
  ref: string | undefined
): string | undefined {
  const key = `${resolved.url}#${ref ?? ''}`;

  if (cache.clones.has(key)) {
    return cache.clones.get(key);
  }

  let dir: string | undefined;

  try {
    // Full history with a working tree: the scan reads each file from the checkout, and commit-hash
    // provenance is classified from a file's last-changing commit.
    dir = cloneSource(resolved.url, ref, 'history');

    cache.dirs.push(dir);
  } catch {
    dir = undefined;
  }

  cache.clones.set(key, dir);

  return dir;
}
