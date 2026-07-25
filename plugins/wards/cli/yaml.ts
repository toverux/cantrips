// A minimal YAML-subset parser, deliberately tiny: it covers exactly the grammar a ward header
// needs and nothing more, so wards stays zero-dependency. Supported: block mappings, block
// sequences of scalars or of mappings, single-line scalars (plain, single-quoted with `''`
// escaping, double-quoted with `\` escapes), and whole-line `#` comments. Every leaf is a string.
// Unsupported by design: flow collections (`[]`/`{}`), anchors and aliases, multi-line and typed
// scalars, tab indentation, and trailing comments after a value, since a `#` mid-line is content.
//
// The parser is written as functions over a mutable cursor rather than a class: the production
// runtime is Node's type stripping, which on the pinned floor version does not erase class access
// modifiers, so the codebase stays modifier-free and functional.

export type YamlValue = string | YamlValue[] | YamlMap;

export interface YamlMap {
  [key: string]: YamlValue;
}

// A parse failure carrying the 1-based source line, so callers can point at the offending text.
// The members carry no accessibility modifier on purpose: the pinned Node floor's type stripping
// cannot erase them, and adding them would break the production runtime.
/* oxlint-disable typescript/explicit-member-accessibility -- modifier-free for type stripping. */
export class YamlSyntaxError extends Error {
  line: number;

  constructor(message: string, line: number) {
    super(message);
    this.name = 'YamlSyntaxError';
    this.line = line;
  }
}
/* oxlint-enable typescript/explicit-member-accessibility */

interface SourceLine {
  indent: number;
  text: string;
  number: number;
}

// The parser's position within the retained lines, threaded through and advanced in place.
interface Cursor {
  lines: SourceLine[];
  position: number;
}

export function parseYaml(source: string): YamlValue {
  const lines = toSourceLines(source);
  const [first] = lines;

  if (first == null) {
    return {};
  }

  const cursor: Cursor = { lines, position: 0 };
  const value = parseBlock(cursor, first.indent);
  const trailing = cursor.lines[cursor.position];

  if (trailing != null) {
    throw new YamlSyntaxError(`Unexpected indentation.`, trailing.number);
  }

  return value;
}

// Comment lines and blank lines carry no structure, so both are dropped up front; every retained
// line keeps its original 1-based number for diagnostics and its indentation measured in leading
// spaces.
function toSourceLines(source: string): SourceLine[] {
  return source
    .split(/\r?\n/u)
    .map((raw, index) => ({ raw, number: index + 1 }))
    .filter(line => line.raw.trim() != '' && !isCommentLine(line.raw))
    .map(line => {
      const indent = line.raw.length - line.raw.trimStart().length;

      return { indent, text: line.raw.slice(indent).trimEnd(), number: line.number };
    });
}

// A `#` opens a comment only as a line's first non-space character; mid-line it is content. Real
// YAML would end a plain scalar there, but nothing writes these headers through a serializer: a
// scroll author types them by hand and the installer writes `notes` prose the same way, so
// truncating at a `#` would silently eat the text an update later reads for context.
function isCommentLine(raw: string): boolean {
  return raw.trimStart().startsWith('#');
}

function parseBlock(cursor: Cursor, indent: number): YamlValue {
  const line = cursor.lines[cursor.position];

  if (line == null) {
    return '';
  }

  return isSequenceItem(line.text) ? parseSequence(cursor, indent) : parseMapping(cursor, indent);
}

function parseMapping(cursor: Cursor, indent: number): YamlMap {
  // A null-prototype map: on a plain object literal a `__proto__` key would reach
  // Object.prototype's setter instead of becoming an entry, letting a header advertise fields it
  // never declares and slipping past the duplicate-key check below.
  const map = Object.create(null) as YamlMap;

  while (cursor.position < cursor.lines.length) {
    const line = cursor.lines[cursor.position];

    if (line == null || line.indent < indent) {
      break;
    }

    if (line.indent > indent) {
      throw new YamlSyntaxError(`Unexpected indentation in mapping.`, line.number);
    }

    if (isSequenceItem(line.text)) {
      throw new YamlSyntaxError(`Expected a mapping key, found a sequence item.`, line.number);
    }

    const entry = splitMappingEntry(line);

    if (Object.hasOwn(map, entry.key)) {
      throw new YamlSyntaxError(`Duplicate mapping key "${entry.key}".`, line.number);
    }

    cursor.position++;

    map[entry.key] =
      entry.inlineValue == null ? parseNestedBlock(cursor, indent) : parseScalar(entry.inlineValue);
  }

  return map;
}

// A key with no inline value introduces either a more-indented block or, for a sequence, items that
// may sit at the key's own indentation; a bare key with neither becomes an empty string.
function parseNestedBlock(cursor: Cursor, parentIndent: number): YamlValue {
  const next = cursor.lines[cursor.position];

  if (next == null) {
    return '';
  }

  if (next.indent > parentIndent) {
    return parseBlock(cursor, next.indent);
  }

  if (next.indent == parentIndent && isSequenceItem(next.text)) {
    return parseSequence(cursor, parentIndent);
  }

  return '';
}

function parseSequence(cursor: Cursor, indent: number): YamlValue[] {
  const items: YamlValue[] = [];

  while (cursor.position < cursor.lines.length) {
    const line = cursor.lines[cursor.position];

    if (line == null || line.indent < indent || !isSequenceItem(line.text)) {
      break;
    }

    if (line.indent > indent) {
      throw new YamlSyntaxError(`Unexpected indentation in sequence.`, line.number);
    }

    items.push(parseSequenceItem(cursor, indent, line));
  }

  return items;
}

function parseSequenceItem(cursor: Cursor, indent: number, line: SourceLine): YamlValue {
  const rest = line.text == '-' ? '' : line.text.slice(2);

  if (rest == '') {
    cursor.position++;
    const next = cursor.lines[cursor.position];

    return next != null && next.indent > indent ? parseBlock(cursor, next.indent) : '';
  }

  // `- key: value` opens a mapping whose keys align two columns past the dash. Rewriting the line
  // in place lets parseMapping read that first key and the aligned siblings uniformly.
  if (isMappingEntry(rest)) {
    const keyIndent = indent + 2;

    cursor.lines[cursor.position] = { indent: keyIndent, text: rest, number: line.number };

    return parseMapping(cursor, keyIndent);
  }

  cursor.position++;

  return parseScalar(rest);
}

function splitMappingEntry(line: SourceLine): { key: string; inlineValue: string | null } {
  const match = /^(?<key>[A-Za-z_][\w-]*):(?:\s+(?<value>.*))?$/u.exec(line.text);
  const key = match?.groups?.key;

  if (key == null) {
    throw new YamlSyntaxError(`Expected a "key: value" mapping entry.`, line.number);
  }

  const value = match?.groups?.value;

  return { key, inlineValue: value == null || value.trim() == '' ? null : value };
}

function parseScalar(raw: string): string {
  const text = raw.trim();

  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return unquoteDouble(text.slice(1, -1));
  }

  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replaceAll("''", "'");
  }

  return text;
}

function unquoteDouble(inner: string): string {
  return inner.replaceAll(/\\(?<character>.)/gu, (_match, character: string) => {
    switch (character) {
      case 'n': {
        return '\n';
      }
      case 't': {
        return '\t';
      }
      default: {
        return character;
      }
    }
  });
}

function isSequenceItem(text: string): boolean {
  return text == '-' || text.startsWith('- ');
}

function isMappingEntry(text: string): boolean {
  return /^[A-Za-z_][\w-]*:(?:\s|$)/u.test(text);
}
