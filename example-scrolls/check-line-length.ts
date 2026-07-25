// ward:
//   kind: hook
//   description: Flag source lines exceeding the 100-character limit right after an edit.
//   version: 1.0.0
//   scope: project
//   event: fires-after-file-edit

// oxlint-disable node/no-sync -- one-shot hook process, synchronous IO is intentional.
// oxlint-disable unicorn/no-process-exit -- the hook protocol communicates via exit codes.

// PostToolUse hook: warns the agent when a source file it just edited has lines exceeding the
// limit from the general-code-style rule.
// Exits with code 2 so the warning (offending line numbers) is fed back to the agent to fix.
//
// Executable TypeScript: erasable-syntax-only, so Node runs it directly via type stripping
// (--experimental-strip-types on Node 22.6+, on by default since 23.6).
//
// The limit's exceptions live in the general-code-style rule; suppression comments are exempted
// mechanically, and the judgment-call exceptions are named in the warning for the agent to weigh.
//
// Two required flags configure the check; the hook has no baked-in defaults, so an unconfigured
// invocation exits with an agent-readable error naming the missing flags and an example fix:
//   --extensions ts,tsx,js   comma-separated extensions to check (no dots, case-insensitive).
//   --suppressions <regex>   ECMAScript unicode-mode regex source; matching lines are exempt.
// An invalid --suppressions regex is not fatal: the hook warns on stderr and checks every line.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const maxLength = 100;
const flagNames = new Set(['--extensions', '--suppressions']);

// Built on first use and kept for the rest of the process: constructing a segmenter initializes
// ICU segmentation data, and a file whose every line fits -- the common case for a hook that runs
// after each edit -- never needs one. Declared above the entry call below, since `let` stays in the
// temporal dead zone until its declaration is reached.
let graphemes: Intl.Segmenter | undefined;

// The conditions worth tolerating are handled where they arise (an absent or unparseable payload,
// an unreadable file), so nothing wraps this call: a throw from here on is a bug in the hook, and
// Node's own exit 1 puts the stack on stderr where it can be seen. Only exit 2 blocks the tool, so
// a loud crash still lets the edit through.
run();

function run(): void {
  const args = process.argv.slice(2);
  const extensionsArg = argValue(args, '--extensions');
  const suppressionsArg = argValue(args, '--suppressions');

  // Misconfiguration is surfaced, not silently defaulted: exit 2 feeds the fix back to the agent.
  if (extensionsArg == null || suppressionsArg == null) {
    reportUnconfigured(extensionsArg, suppressionsArg);
    process.exit(2);
  }

  const extensions = parseExtensions(extensionsArg);
  const suppressions = parseSuppressions(suppressionsArg);

  // An extension list that names nothing (empty, or only separators) would match no file and check
  // nothing, which reads as a clean pass on every edit. That is the one failure a hook must never
  // have, so it is reported like a missing flag rather than honored.
  if (extensions.size == 0) {
    reportUnconfigured(null, suppressionsArg);
    process.exit(2);
  }

  const filePath = filePathOf(readPayload());

  if (filePath == null) {
    return;
  }

  const extension = path.extname(filePath).replace('.', '').toLowerCase();

  if (!extensions.has(extension)) {
    return;
  }

  // A single read doubles as the existence check (the file may be gone by the time the hook runs).
  const content = tryReadFile(filePath);

  if (content == null) {
    return;
  }

  // 1-based line numbers exceeding the limit, skipping suppression directives. Lines split on LF
  // with any trailing CR dropped, so CRLF checkouts measure like LF ones.
  const offending: number[] = [];

  for (const [index, line] of content.split(/\r?\n/u).entries()) {
    const over = line.length > maxLength && graphemeLength(line) > maxLength;

    if (over && (suppressions == null || !suppressions.test(line))) {
      offending.push(index + 1);
    }
  }

  if (offending.length == 0) {
    return;
  }

  const [noun, verb, pronoun] =
    offending.length == 1 ? ['line', 'exceeds', 'it'] : ['lines', 'exceed', 'them'];

  process.stderr.write(
    `${filePath}: ${offending.length} ${noun} ${verb} the ${maxLength}-character limit. ` +
      `Offending ${noun}: ${offending.join(', ')}.\n` +
      `Wrap or shorten ${pronoun}, unless the excess is an unsplittable string or an exempt file.\n`
  );

  process.exit(2);
}

function reportUnconfigured(extensionsArg: string | null, suppressionsArg: string | null): void {
  const missing = [
    extensionsArg == null ? '--extensions' : null,
    suppressionsArg == null ? '--suppressions' : null
  ].filter((flag): flag is string => flag != null);

  const noun = missing.length == 1 ? 'flag' : 'flags';
  const pronoun = missing.length == 1 ? 'it' : 'them';

  process.stderr.write(
    `check-line-length: missing required ${noun} ${missing.join(' and ')}. ` +
      `Add ${pronoun} to the hook command in .claude/settings.json, for example:\n` +
      `  --extensions ts,tsx,js,jsx,mjs,cjs ` +
      `--suppressions 'oxlint-disable|eslint-disable|biome-ignore|@ts-expect-error|@ts-ignore'\n`
  );
}

function parseExtensions(source: string): Set<string> {
  return new Set(
    source
      .split(',')
      .map(extension => extension.trim().replace(/^\.+/u, '').toLowerCase())
      .filter(extension => extension !== '')
  );
}

// An empty pattern means "exempt nothing": compiling it would produce a regex that matches every
// line, silently exempting the whole file and disabling the check.
function parseSuppressions(source: string): RegExp | null {
  if (source.trim() == '') {
    return null;
  }

  try {
    return new RegExp(source, 'u');
  } catch {
    process.stderr.write('check-line-length: invalid --suppressions regex; checking every line.\n');

    return null;
  }
}

// A flag's value is the next argument, unless that argument is one of this hook's own flags:
// swallowing one would leave the real flag unset while looking configured, and the check would
// pass on every file. Only those two names are excluded, since a suppressions pattern may
// legitimately start with `--` (it is the line-comment marker in SQL, Lua, and Haskell).
function argValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index == -1 ? null : (args[index + 1] ?? null);

  return value == null || flagNames.has(value) ? null : value;
}

// The hook payload is JSON on stdin. A harness that invokes the hook with no stdin, or with
// something that is not JSON, gets no check rather than a crash: the hook has nothing to say about
// a file it cannot identify.
function readPayload(): unknown {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

function tryReadFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

// Grapheme clusters are the columns an editor shows, so a line already over the limit in UTF-16
// units (where a surrogate pair counts as 2) is re-measured in them before it is reported.
function graphemeLength(line: string): number {
  graphemes ??= new Intl.Segmenter();

  return [...graphemes.segment(line)].length;
}

function filePathOf(payload: unknown): string | null {
  if (typeof payload != 'object' || payload == null) {
    return null;
  }

  const toolInput = (payload as Record<string, unknown>).tool_input;

  if (typeof toolInput != 'object' || toolInput == null) {
    return null;
  }

  const filePath = (toolInput as Record<string, unknown>).file_path;

  return typeof filePath == 'string' && filePath !== '' ? filePath : null;
}
