// The `list` command: clone a source, scan the files as the ward index, and assemble the offering
// in memory. Only source-side fields belong in an offering; installed provenance belongs to the
// target, so it is not projected here. The clone is a throwaway, removed once scanning is done.

import { cloneSource, removeTempDir } from './git.ts';
import { resolveSource } from './source.ts';
import { type ScrollEntry, validateTree } from './validate.ts';
import type { WardKind, WardScope } from './ward-grammar.ts';

export interface OfferingEntry {
  path: string;
  kind: WardKind;
  description: string;
  version: string;
  applicability?: string[];
  scope?: WardScope;
}

export interface Offering {
  source: string;
  ref: string | null;
  url: string;
  scrolls: OfferingEntry[];
  // Scroll paths left out of the offering because they are installed copies, reported so an empty
  // offering can be told apart from one that was filtered.
  excluded: string[];
  diagnostics: Array<{ path: string; message: string }>;
}

export function listSource(rawSource: string): Offering {
  const resolved = resolveSource(rawSource);
  const { ref } = resolved;
  // Only the tree at the ref is scanned, so one commit of it is the whole answer.
  const clone = cloneSource(resolved.url, ref, 'tip');

  try {
    const scanned = validateTree(clone);
    // Provenance marks a file as an install of some other source's scroll, so it is a derived
    // artifact rather than something this source offers: a repo that dogfoods its own scrolls would
    // otherwise offer each one twice, and installing the copy would track a derived path upstream.
    const offered = scanned.scrolls.filter(scroll => scroll.ward.provenance == null);
    const excluded = scanned.scrolls.filter(scroll => scroll.ward.provenance != null);

    return {
      source: resolved.spec,
      ref: ref ?? null,
      url: resolved.url,
      scrolls: offered.map(scroll => toOfferingEntry(scroll)),
      excluded: excluded.map(scroll => scroll.path),
      diagnostics: scanned.diagnostics
    };
  } finally {
    removeTempDir(clone);
  }
}

function toOfferingEntry(scroll: ScrollEntry): OfferingEntry {
  const { path, ward } = scroll;

  return {
    path,
    kind: ward.kind,
    description: ward.description,
    version: ward.version,
    ...(ward.applicability == null ? {} : { applicability: ward.applicability }),
    ...(ward.scope == null ? {} : { scope: ward.scope })
  };
}
