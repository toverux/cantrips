// Source resolution: turns a user-supplied source string into a clone URL and an optional ref. A
// source is a git URL, an `owner/repo` GitHub shorthand, or a local path (the form the tests and
// dogfooding lean on); a `#ref` suffix pins a branch, tag, or commit. Provenance records a bare
// source too, so `status` and `fetch` resolve the same strings the same way.

import path from 'node:path';

export interface ResolvedSource {
  // The original string, minus the ref suffix, echoed back in user-facing command output.
  spec: string;
  url: string;
  // The pinned branch, tag, or commit, or undefined to take the source's default branch.
  ref: string | undefined;
}

const shorthandPattern = /^[\w.-]+\/[\w.-]+$/u;

export function resolveSource(raw: string): ResolvedSource {
  const hash = raw.indexOf('#');
  const spec = hash == -1 ? raw : raw.slice(0, hash);
  const ref = hash == -1 ? '' : raw.slice(hash + 1);

  return { spec, url: toUrl(spec), ref: ref == '' ? undefined : ref };
}

// A path that says it is one wins first, so a fixture repo or a checked-out clone resolves to
// itself; then a URL passes through; then an `owner/repo` shorthand expands to a GitHub HTTPS URL.
// Anything else goes to git verbatim, which reports a clear error if it is not a source it
// understands. Whether a directory happens to exist decides nothing: probing the filesystem would
// bind the same provenance entry to whatever directory the process was launched from, and would let
// a local `owner/repo` directory stand in for the GitHub repository of that name.
function toUrl(spec: string): string {
  if (isLocalPath(spec)) {
    return path.resolve(spec);
  }

  if (isUrl(spec)) {
    return spec;
  }

  if (shorthandPattern.test(spec)) {
    return `https://github.com/${spec}.git`;
  }

  return spec;
}

// An absolute path, or a relative one written as such: a leading `./` or `../`, with the backslash
// forms Windows also accepts.
function isLocalPath(spec: string): boolean {
  return path.isAbsolute(spec) || /^\.\.?[/\\]/u.test(spec);
}

function isUrl(spec: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//u.test(spec) || spec.startsWith('git@');
}
