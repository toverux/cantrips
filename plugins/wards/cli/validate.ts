// The `validate` subcommand: walk a directory tree, parse every file's ward metadata, and split the
// result into the scrolls that parsed cleanly and the diagnostics for the ones that did not. The
// check suite runs this over a source tree so a malformed header fails CI, not a user's install.

import { compareText, requireDirectory, toPosixRelative, tryReadHead, walkFiles } from './files.ts';
import { type WardMetadata, parseWardFile } from './ward-metadata.ts';

export interface ScrollEntry {
  path: string;
  ward: WardMetadata;
}

export interface Diagnostic {
  path: string;
  message: string;
}

export interface ValidateResult {
  ok: boolean;
  scrolls: ScrollEntry[];
  diagnostics: Diagnostic[];
}

export function validateTree(root: string): ValidateResult {
  // Pointing the command at a missing tree is a usage error, not an empty result.
  requireDirectory(root);

  const scrolls: ScrollEntry[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const absolute of walkFiles(root, { followSymlinks: false })) {
    const head = tryReadHead(absolute);

    if (head == null) {
      continue;
    }

    const relative = toPosixRelative(root, absolute);
    const result = parseWardFile(head);

    if (result.status == 'valid') {
      scrolls.push({ path: relative, ward: result.ward });
    } else if (result.status == 'invalid') {
      for (const message of result.errors) {
        diagnostics.push({ path: relative, message });
      }
    }
  }

  scrolls.sort((a, b) => compareText(a.path, b.path));
  diagnostics.sort((a, b) => compareText(a.path, b.path) || compareText(a.message, b.message));

  return { ok: diagnostics.length == 0, scrolls, diagnostics };
}
