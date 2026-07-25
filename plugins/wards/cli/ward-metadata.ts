// Extracts and validates ward metadata from a single file's content. Two carriers, one grammar:
// Markdown scrolls hold the YAML in frontmatter, executable scrolls hold the same YAML in a leading
// line-comment header whose token is auto-detected. A file counts as a scroll only when the ward
// marker key is present; anything else is reported as absent and left alone. The installed-side
// provenance list is parsed here too, so later tickets read it through the same entry point.

import {
  type CommentToken,
  commentTokens,
  type WardEvent,
  type WardKind,
  type WardScope,
  wardEvents,
  wardKinds,
  wardMarkerKey,
  wardScopes,
  wardSourceFields
} from './ward-grammar.ts';
import { type YamlMap, type YamlValue, YamlSyntaxError, parseYaml } from './yaml.ts';

export interface ProvenanceEntry {
  source: string;
  path: string;
  // The branch, tag, or commit the install was pinned to, when it was pinned to one; without it an
  // update would silently track the source's default branch instead.
  ref?: string;
  version?: string;
  commit?: string;
  notes?: string;
}

export interface WardMetadata {
  kind: WardKind;
  description: string;
  version: string;
  applicability?: string[];
  scope?: WardScope;
  event?: WardEvent;
  provenance?: ProvenanceEntry[];
}

export type ParseResult =
  | { status: 'absent' }
  | { status: 'valid'; ward: WardMetadata }
  | { status: 'invalid'; errors: string[] };

interface HeaderCandidate {
  form: 'frontmatter' | 'comment';
  body: string;
}

// The author-written fields come from the grammar table, plus the provenance list the installer
// writes; anything else in a ward block is a typo.
const knownWardKeys = new Set([...wardSourceFields.map(field => field.name), 'provenance']);

// The fields the installer writes into a provenance entry; anything else is a typo whose prose the
// update flow would never read.
const knownProvenanceKeys = new Set(['source', 'path', 'ref', 'version', 'commit', 'notes']);

const semverPattern = /^\d+\.\d+\.\d+$/u;
const commitPattern = /^[0-9a-f]{7,40}$/u;
const wardMarkerPattern = new RegExp(`^${wardMarkerKey}:(?:\\s|$)`, 'mu');

export function parseWardFile(content: string): ParseResult {
  // A UTF-8 BOM sits ahead of the first character, where it would defeat the comment-token probe
  // and hide an executable scroll from every command.
  const header = extractHeader(content.startsWith('\uFEFF') ? content.slice(1) : content);

  if (header == null || !hasWardMarker(header.body)) {
    return { status: 'absent' };
  }

  let document: YamlValue;

  try {
    document = parseYaml(header.body);
  } catch (error) {
    const detail =
      error instanceof YamlSyntaxError ? `${error.message} (line ${error.line})` : 'unparseable';
    const carrier = header.form == 'frontmatter' ? 'YAML frontmatter' : 'comment header';

    return { status: 'invalid', errors: [`Malformed ${carrier}: ${detail}`] };
  }

  return validateWard(document);
}

export function wardVersionOf(content: string): string | undefined {
  const result = parseWardFile(content);

  return result.status == 'valid' ? result.ward.version : undefined;
}

function extractHeader(content: string): HeaderCandidate | null {
  const lines = content.split(/\r?\n/u);

  return (lines[0] ?? '').trim() == '---' ? extractFrontmatter(lines) : extractCommentHeader(lines);
}

function extractFrontmatter(lines: string[]): HeaderCandidate {
  const closing = lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)\s*$/u.test(line));
  const body = (closing == -1 ? lines.slice(1) : lines.slice(1, closing)).join('\n');

  return { form: 'frontmatter', body };
}

function extractCommentHeader(lines: string[]): HeaderCandidate | null {
  let index = (lines[0] ?? '').startsWith('#!') ? 1 : 0;

  while ((lines[index] ?? '').trim() == '' && index < lines.length) {
    index++;
  }

  const first = lines[index];
  const token = first == null ? null : detectToken(first);

  if (token == null) {
    return null;
  }

  const body: string[] = [];

  // The header is the `ward:` line plus the indented mapping under it, so it ends at the first
  // comment line back at column 0 carrying content. Without that stop, ordinary prose sitting
  // directly beneath the block (a license line, a description) is fed to the YAML parser and fails
  // the whole file. A bare comment line strips to nothing and separates rather than terminates, so
  // an author may space the mapping out without losing every field below the gap.
  for (let line = lines[index]; line != null && line.startsWith(token); line = lines[index]) {
    const stripped = stripToken(line, token);

    if (body.length > 0 && stripped.trim() != '' && !stripped.startsWith(' ')) {
      break;
    }

    body.push(stripped);
    index++;
  }

  return { form: 'comment', body: body.join('\n') };
}

function detectToken(line: string): CommentToken | null {
  return commentTokens.find(token => line.startsWith(token)) ?? null;
}

// Strip the token plus one following space, so a `//   key` line keeps its two-space YAML indent.
function stripToken(line: string, token: CommentToken): string {
  const rest = line.slice(token.length);

  return rest.startsWith(' ') ? rest.slice(1) : rest;
}

function hasWardMarker(body: string): boolean {
  return wardMarkerPattern.test(body);
}

function validateWard(document: YamlValue): ParseResult {
  if (!isMap(document)) {
    return { status: 'invalid', errors: [`Ward metadata must be a mapping.`] };
  }

  const ward = document[wardMarkerKey];

  if (ward === undefined) {
    return { status: 'invalid', errors: [`Missing the top-level "${wardMarkerKey}" key.`] };
  }

  if (!isMap(ward)) {
    return { status: 'invalid', errors: [`The "${wardMarkerKey}" key must be a mapping.`] };
  }

  const errors: string[] = [];

  // A misspelled field would otherwise be dropped in silence, so the author ships a scroll whose
  // applicability or scope never took effect and every gate calls it clean.
  for (const key of Object.keys(ward)) {
    if (!knownWardKeys.has(key)) {
      errors.push(`Unknown field "${key}". Known fields: ${[...knownWardKeys].join(', ')}.`);
    }
  }

  const kind = validateEnum('kind', ward.kind, errors, { allowed: wardKinds, required: true });
  const description = validateString('description', ward.description, true, errors);
  const version = validateSemver('version', ward.version, true, errors);
  const applicability = validateStringList('applicability', ward.applicability, errors);
  const scope = validateEnum('scope', ward.scope, errors, { allowed: wardScopes, required: false });
  const event = validateEvent(ward.event, kind, errors);
  const provenance = validateProvenance(ward.provenance, errors);

  if (errors.length > 0 || kind == null || description == null || version == null) {
    return { status: 'invalid', errors: errors.length > 0 ? errors : [`Missing required fields.`] };
  }

  return {
    status: 'valid',
    ward: {
      kind,
      description,
      version,
      ...(applicability == null ? {} : { applicability }),
      ...(scope == null ? {} : { scope }),
      ...(event == null ? {} : { event }),
      ...(provenance == null ? {} : { provenance })
    }
  };
}

function validateEnum<T extends string>(
  field: string,
  raw: YamlValue | undefined,
  errors: string[],
  spec: { allowed: readonly T[]; required: boolean }
): T | undefined {
  const value = validateString(field, raw, spec.required, errors);

  if (value == null) {
    return undefined;
  }

  if (!spec.allowed.includes(value as T)) {
    errors.push(`Field "${field}" must be one of: ${spec.allowed.join(', ')}. Found "${value}".`);

    return undefined;
  }

  return value as T;
}

function validateString(
  field: string,
  raw: YamlValue | undefined,
  required: boolean,
  errors: string[]
): string | undefined {
  if (raw === undefined) {
    if (required) {
      errors.push(`Missing required field "${field}".`);
    }

    return undefined;
  }

  if (typeof raw != 'string') {
    errors.push(`Field "${field}" must be a string.`);

    return undefined;
  }

  if (raw.trim() == '') {
    errors.push(`Field "${field}" must not be empty.`);

    return undefined;
  }

  return raw;
}

function validateSemver(
  field: string,
  raw: YamlValue | undefined,
  required: boolean,
  errors: string[]
): string | undefined {
  const value = validateString(field, raw, required, errors);

  if (value == null) {
    return undefined;
  }

  if (!semverPattern.test(value)) {
    errors.push(`Field "${field}" must use X.Y.Z notation (e.g. 1.2.3). Found "${value}".`);

    return undefined;
  }

  return value;
}

function validateStringList(
  field: string,
  raw: YamlValue | undefined,
  errors: string[]
): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    errors.push(`Field "${field}" must be a list of strings.`);

    return undefined;
  }

  const values: string[] = [];

  for (const item of raw) {
    if (typeof item != 'string') {
      errors.push(`Field "${field}" must contain only strings.`);

      return undefined;
    }

    values.push(item);
  }

  return values;
}

// The wiring event is meaningful only on hooks, so a value on any other kind is an error rather
// than silently ignored metadata.
function validateEvent(
  raw: YamlValue | undefined,
  kind: WardKind | undefined,
  errors: string[]
): WardEvent | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const value = validateEnum('event', raw, errors, { allowed: wardEvents, required: false });

  if (kind != null && kind != 'hook') {
    errors.push(`Field "event" applies only to hook scrolls, not "${kind}".`);

    return undefined;
  }

  return value;
}

// Installed-side provenance: a list because a composite file (AGENTS.md) can aggregate several
// upstreams. Each entry names a source and path and records either an upstream version or, when the
// source is unversioned, a commit hash.
function validateProvenance(
  raw: YamlValue | undefined,
  errors: string[]
): ProvenanceEntry[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    errors.push(`Field "provenance" must be a list of entries.`);

    return undefined;
  }

  const entries: ProvenanceEntry[] = [];

  for (const [index, item] of raw.entries()) {
    const entry = validateProvenanceEntry(item, index, errors);

    if (entry != null) {
      entries.push(entry);
    }
  }

  return entries;
}

function validateProvenanceEntry(
  item: YamlValue,
  index: number,
  errors: string[]
): ProvenanceEntry | undefined {
  const label = `provenance[${index}]`;

  if (!isMap(item)) {
    errors.push(`${label} must be a mapping.`);

    return undefined;
  }

  // A misspelled entry field is dropped in silence otherwise, and the update flow reads `notes` as
  // the semantic context for why the local side diverges.
  for (const key of Object.keys(item)) {
    if (!knownProvenanceKeys.has(key)) {
      const known = [...knownProvenanceKeys].join(', ');

      errors.push(`Unknown field "${label}.${key}". Known fields: ${known}.`);
    }
  }

  const source = validateString(`${label}.source`, item.source, true, errors);
  const path = validateString(`${label}.path`, item.path, true, errors);
  const ref = validateString(`${label}.ref`, item.ref, false, errors);
  const hasVersion = item.version !== undefined;
  const hasCommit = item.commit !== undefined;
  const version = hasVersion
    ? validateSemver(`${label}.version`, item.version, false, errors)
    : undefined;
  const commit = hasCommit ? validateCommit(`${label}.commit`, item.commit, errors) : undefined;
  const notes =
    item.notes === undefined
      ? undefined
      : validateString(`${label}.notes`, item.notes, false, errors);

  // Exactly one of the two: they are alternative ways to pin the same install, and a comparison
  // reading only the commit would quietly ignore the version the entry also claims.
  if (hasVersion && hasCommit) {
    errors.push(`${label} must record a version or a commit hash, not both.`);
  } else if (!hasVersion && !hasCommit) {
    errors.push(`${label} must record either a version or a commit hash.`);
  }

  if (source == null || path == null) {
    return undefined;
  }

  return {
    source,
    path,
    ...(ref == null ? {} : { ref }),
    ...(version == null ? {} : { version }),
    ...(commit == null ? {} : { commit }),
    ...(notes == null ? {} : { notes })
  };
}

function validateCommit(
  field: string,
  raw: YamlValue | undefined,
  errors: string[]
): string | undefined {
  const value = validateString(field, raw, false, errors);

  if (value == null) {
    return undefined;
  }

  if (!commitPattern.test(value)) {
    errors.push(`Field "${field}" must be a git commit hash (7-40 hex characters).`);

    return undefined;
  }

  return value;
}

function isMap(value: YamlValue | undefined): value is YamlMap {
  return typeof value == 'object' && value != null && !Array.isArray(value);
}
