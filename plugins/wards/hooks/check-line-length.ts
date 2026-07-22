// oxlint-disable node/no-sync -- one-shot hook process, synchronous IO is intentional.
// oxlint-disable unicorn/no-process-exit -- the hook protocol communicates via exit codes.

// PostToolUse hook: warns the agent when a source file it just edited has lines exceeding the
// limit from the general-code-style skill.
// Exits with code 2 so the warning (offending line numbers) is fed back to the agent to fix.
//
// Executable TypeScript: erasable-syntax-only, so Node runs it directly via type stripping
// (--experimental-strip-types on Node 22.6+, on by default since 23.6).
//
// The limit's exceptions live in the general-code-style skill; suppression comments are exempted
// mechanically, and the judgment-call exceptions are named in the warning for the agent to weigh.
//
// Per-project configuration via an optional wards.config.json at the project root (the hook's
// working directory); plugin hooks get no per-project env, so a config file it is. The schema is
// documented in the wards README. Each key present replaces its default wholesale (defaults
// target JS/TS), so a config listing "extensions" must name every extension it wants checked.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

interface CheckLineLengthConfig {
  extensions: string[];
  suppressions: string;
  maxLength: number;
}

const defaults: CheckLineLengthConfig = {
  extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
  suppressions: 'oxlint-disable|eslint-disable|biome-ignore|@ts-expect-error|@ts-ignore',
  maxLength: 100
};

// Never block the tool: any unexpected condition (bad payload, unreadable file) makes the hook
// bow out silently.
try {
  run();
} catch {
  process.exit(0);
}

function run(): void {
  const config = loadConfig();

  // Hook payload is JSON on stdin.
  const payload: unknown = JSON.parse(readFileSync(0, 'utf8'));
  const filePath = filePathOf(payload);

  if (filePath == null) {
    return;
  }

  const extension = path.extname(filePath).replace('.', '').toLowerCase();

  if (!config.extensions.includes(extension)) {
    return;
  }

  // A single read doubles as the existence check (the file may be gone by the time the hook runs).
  const content = tryReadFile(filePath);

  if (content == null) {
    return;
  }

  const suppressions = compileSuppressions(config.suppressions);
  const graphemes = new Intl.Segmenter();

  // 1-based line numbers exceeding the limit, skipping suppression directives. Lines split on LF
  // with any trailing CR dropped, so CRLF checkouts measure like LF ones. String length counts
  // UTF-16 units (a surrogate pair counts as 2), so lines over the limit are re-measured in
  // grapheme clusters — the columns an editor shows — keeping the common path allocation-free.
  const offending = content.split(/\r?\n/u).flatMap((line, index) => {
    const over =
      line.length > config.maxLength && [...graphemes.segment(line)].length > config.maxLength;
    const exempt = !over || suppressions?.test(line);

    return exempt ? [] : [index + 1];
  });

  if (offending.length == 0) {
    return;
  }

  const [noun, verb, pronoun] =
    offending.length == 1 ? ['line', 'exceeds', 'it'] : ['lines', 'exceed', 'them'];

  process.stderr.write(
    `${filePath}: ${offending.length} ${noun} ${verb} the ${config.maxLength}-character limit. ` +
      `Offending ${noun}: ${offending.join(', ')}.\n` +
      `Wrap or shorten ${pronoun}, unless the excess is an unsplittable string or an exempt file.\n`
  );

  process.exit(2);
}

// A config the hook ignores must never look like it took effect, so every ignored piece of config
// warns on stderr before falling back to the defaults.
function loadConfig(): CheckLineLengthConfig {
  const config = { ...defaults };
  const raw = tryReadFile(path.join(process.cwd(), 'wards.config.json'));

  if (raw == null) {
    return normalize(config);
  }

  let parsed: unknown = null;

  try {
    parsed = JSON.parse(raw);
  } catch {
    warnConfig('is not valid JSON; using the defaults');

    return normalize(config);
  }

  if (typeof parsed != 'object' || parsed == null) {
    warnConfig('must contain a JSON object; using the defaults');

    return normalize(config);
  }

  const section = (parsed as Record<string, unknown>).checkLineLength;

  if (section == null) {
    return normalize(config);
  }

  if (typeof section != 'object') {
    warnConfig('"checkLineLength" must be an object; using the defaults');

    return normalize(config);
  }

  const { extensions, suppressions, maxLength } = section as Partial<CheckLineLengthConfig>;

  if (extensions !== undefined) {
    if (Array.isArray(extensions)) {
      config.extensions = extensions.map(String);
    } else {
      warnConfig('"extensions" must be an array; keeping the default');
    }
  }

  if (suppressions !== undefined) {
    if (typeof suppressions == 'string') {
      config.suppressions = suppressions;
    } else {
      warnConfig('"suppressions" must be a string; keeping the default');
    }
  }

  if (maxLength !== undefined) {
    if (typeof maxLength == 'number') {
      config.maxLength = maxLength;
    } else {
      warnConfig('"maxLength" must be a number; keeping the default');
    }
  }

  return normalize(config);
}

// Lowercased once at load so the per-file extension test needs no per-call mapping.
function normalize(config: CheckLineLengthConfig): CheckLineLengthConfig {
  config.extensions = config.extensions.map(ext => ext.toLowerCase());

  return config;
}

// A user pattern that is not a valid ECMAScript unicode-mode regex must not kill the hook: warn
// and check every line, without the exemption.
function compileSuppressions(pattern: string): RegExp | null {
  if (!pattern) {
    return null;
  }

  try {
    return new RegExp(pattern, 'u');
  } catch {
    warnConfig('"suppressions" is not a valid regex; checking without the exemption');

    return null;
  }
}

function warnConfig(problem: string): void {
  process.stderr.write(`wards.config.json ${problem}.\n`);
}

function tryReadFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
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
