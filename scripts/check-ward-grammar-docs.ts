/* oxlint-disable node/no-sync -- sequential check script, synchronous IO is intentional. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { commentTokens, wardSourceFields } from '../plugins/wards/cli/ward-grammar.ts';

// The ward-header grammar lives in plugins/wards/cli/ward-grammar.ts, and the README documents it
// for scroll authors. Prose cannot import, so this check keeps the README a faithful rendering of
// the grammar: a field or a comment token added on one side fails the build until the other
// follows. Exits nonzero (via a failed assertion) on any drift.

const repoRoot = path.resolve(import.meta.dirname, '..');
const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

checkFieldTable();
checkCommentTokens();

// The authoring table: one row per source-side field, in the order the grammar declares them, with
// the required flag and every allowed value of an enumerated field.
function checkFieldTable(): void {
  const section = sliceSection(`The source-side fields`);
  const pattern = /^\|\s*`(?<name>[^`]+)`\s*\|\s*(?<required>yes|no)\s*\|(?<notes>.*)\|\s*$/gmu;
  const rows = [...section.matchAll(pattern)].map(match => ({
    name: match.groups?.name ?? '',
    required: match.groups?.required == 'yes',
    notes: match.groups?.notes ?? ''
  }));

  assert.deepEqual(
    rows.map(row => ({ name: row.name, required: row.required })),
    wardSourceFields.map(field => ({ name: field.name, required: field.required })),
    `The README's source-side field table must list every field of ward-grammar.ts, in the same ` +
      `order, with matching required flags.`
  );

  for (const [index, field] of wardSourceFields.entries()) {
    for (const value of field.values ?? []) {
      assert.ok(
        rows[index]?.notes.includes(`\`${value}\``),
        `The README row for "${field.name}" must name every allowed value of the field; ` +
          `"${value}" is missing.`
      );
    }
  }
}

// The comment tokens a hook header may open with, introduced in the README as a backticked list.
function checkCommentTokens(): void {
  const listed = /first line \((?<tokens>[^)]+)\)/u.exec(readme)?.groups?.tokens;

  assert.ok(
    listed != null,
    `README.md must introduce the comment tokens with a "from the first line (…)" list.`
  );

  const matches = [...listed.matchAll(/`(?<token>[^`]+)`/gu)];
  const tokens = matches.map(match => match.groups?.token ?? '');

  assert.deepEqual(
    tokens,
    [...commentTokens],
    `The README's comment-token list must match ward-grammar.ts, in the same order.`
  );
}

// A README passage plus everything up to the next top-level section, so a table is matched in its
// own context rather than anywhere in the file.
function sliceSection(marker: string): string {
  const start = readme.indexOf(marker);

  assert.notEqual(start, -1, `README.md must contain the "${marker}" passage.`);

  const rest = readme.slice(start);
  const end = rest.indexOf('\n## ');

  return end == -1 ? rest : rest.slice(0, end);
}
