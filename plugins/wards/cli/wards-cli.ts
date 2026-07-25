// The wards CLI entry point. It runs under the production runtime
// (`node --disable-warning=ExperimentalWarning --experimental-strip-types`) from the plugin root,
// carries zero npm dependencies, and emits machine-readable JSON on stdout so the /wards skill
// spends its context on judgment rather than mechanical scanning. Business logic lives in the
// per-command modules; this edge only parses argv, prints JSON, and maps outcomes to exit codes.

import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { type FetchBaseline, fetchFromSource } from './fetch.ts';
import { listSource } from './list.ts';
import { type StatusReport, statusReport } from './status.ts';
import { validateTree } from './validate.ts';

type Scope = 'project' | 'user' | 'both';

// Ward metadata that failed validation exits 1; a usage error or a failed command exits 2.
const EXIT_INVALID = 1;
const EXIT_FAILURE = 2;

// The error types Node raises for a defect in this program rather than for bad input or a failed
// git call. A command's own failures are plain `Error`s, so these are the ones worth a stack.
const defectTypes = [TypeError, RangeError, ReferenceError, SyntaxError];

// The message a failed run reports to its caller; `main` is the only handler. Declared before the
// entry call because a class, unlike a function, is not hoisted past its definition.
class CliError extends Error {}

main();

// Failures travel as a thrown CliError rather than a `process.exit` call: exiting while stdout is
// still draining truncates the JSON payload when the caller reads it through a pipe, so every path
// sets an exit code and returns, letting Node flush and exit on its own.
function main(): void {
  try {
    dispatch(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error;
    }

    process.stderr.write(`${error.message}\n`);
    process.exitCode = EXIT_FAILURE;
  }
}

function dispatch(argv: string[]): void {
  const [command] = argv;

  if (command == 'validate') {
    validateCommand(argv.slice(1));
  } else if (command == 'list') {
    listCommand(argv.slice(1));
  } else if (command == 'status') {
    statusCommand(argv.slice(1));
  } else if (command == 'fetch') {
    fetchCommand(argv.slice(1));
  } else if (command == null) {
    fail(usage());
  } else {
    fail(`Unknown command "${command}".\n${usage()}`);
  }
}

// Exit non-zero on any invalid ward metadata; the JSON payload always carries both the scrolls that
// parsed and the diagnostics, so a caller reads the same shape whether the tree is clean or not.
function validateCommand(args: string[]): void {
  const [directory] = args;

  // An empty argument would resolve to the working directory, so it counts as no argument at all.
  if (directory == null || directory.trim() == '') {
    fail(`Usage: wards validate <dir>.`);
  }

  const result = run(() => validateTree(path.resolve(directory)));

  if (!result.ok) {
    process.exitCode = EXIT_INVALID;
  }
}

// `list <source>` where source is a git URL, an `owner/repo` shorthand, or a local path. A `#ref`
// suffix pins a branch, tag, or commit.
function listCommand(args: string[]): void {
  const { positionals } = parseArgs(args, []);
  const [source] = positionals;

  if (source == null) {
    fail(`Usage: wards list <source>[#ref].`);
  }

  run(() => listSource(source));
}

// `status` scans the canonical `.agents/rules` and `.agents/hooks` trees of a scope. `--scope`
// selects project, user, or both (default both); `--project` and `--user` override the roots, which
// otherwise default to the current directory and the home directory.
function statusCommand(args: string[]): void {
  const { flags } = parseArgs(args, ['scope', 'project', 'user']);
  const scope = readScope(flags.scope);
  const scansProject = scope == 'project' || scope == 'both';
  const scansUser = scope == 'user' || scope == 'both';

  const report = run(() =>
    statusReport({
      projectRoot: scansProject ? path.resolve(flags.project ?? process.cwd()) : null,
      userRoot: scansUser ? path.resolve(flags.user ?? homedir()) : null
    })
  );

  // A broken ward header is the same failure `validate` exits 1 for, so a caller gating on the exit
  // code hears about it here too rather than reading a clean 0 over an untracked file.
  if (hasInvalidScroll(report)) {
    process.exitCode = EXIT_INVALID;
  }
}

function hasInvalidScroll(report: StatusReport): boolean {
  return [report.project, report.user].some(scope =>
    (scope?.files ?? []).some(file => file.classification == 'invalid')
  );
}

// `fetch` materializes one path from a source into `--out`, which it creates and the caller owns.
// `--version`/`--commit` additionally recovers the recorded baseline, laying out an update merge;
// without either, only the upstream file lands. `--ref` picks the revision (default the source's
// default branch), and `--local` names the file the merge will run against, whose line endings the
// materialized sides then match.
function fetchCommand(args: string[]): void {
  const known = ['source', 'path', 'out', 'version', 'commit', 'ref', 'local'];
  const { flags } = parseArgs(args, known);
  const { source, out } = flags;
  const filePath = flags.path;

  if (source == null || filePath == null || out == null) {
    fail(`Usage: wards ${fetchUsage()}.`);
  }

  const baseline = readBaseline(flags.version, flags.commit);

  run(() =>
    fetchFromSource({
      source,
      path: filePath,
      out: path.resolve(out),
      baseline,
      ref: flags.ref,
      local: flags.local == null ? undefined : path.resolve(flags.local)
    })
  );
}

function readBaseline(
  version: string | undefined,
  commit: string | undefined
): FetchBaseline | undefined {
  if (version != null && commit != null) {
    return fail(`fetch takes at most one of --version or --commit.`);
  }

  if (version != null) {
    return { kind: 'version', value: version };
  }

  return commit == null ? undefined : { kind: 'commit', value: commit };
}

function readScope(raw: string | undefined): Scope {
  if (raw == null || raw == 'both') {
    return 'both';
  }

  if (raw == 'project' || raw == 'user') {
    return raw;
  }

  return fail(`--scope must be one of: project, user, both. Found "${raw}".`);
}

// A minimal flag parser: `--name value` pairs whose names are known, plus bare positionals. An
// unknown flag or a flag missing its value is a usage error, surfaced through the exit-2 channel.
function parseArgs(
  args: string[],
  known: string[]
): { flags: Record<string, string | undefined>; positionals: string[] } {
  const flags: Record<string, string | undefined> = {};
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? '';

    if (!arg.startsWith('--')) {
      positionals.push(arg);

      continue;
    }

    const name = arg.slice(2);

    if (!known.includes(name)) {
      fail(`Unknown flag "${arg}".`);
    }

    const value = args[index + 1];

    // A blank value is rejected here rather than at each guard downstream: those test for a missing
    // flag, and an empty path would sail past them to resolve as the working directory.
    if (value == null || value.startsWith('--') || value.trim() == '') {
      fail(`Flag "${arg}" needs a value.`);
    }

    flags[name] = value;
    index++;
  }

  return { flags, positionals };
}

// Runs a command that produces a JSON payload, printing it on success and mapping a thrown error to
// the exit-2 channel, so every command shares one success and one failure path.
function run<T>(command: () => T): T {
  let payload: T;

  try {
    payload = command();
  } catch (error) {
    // A defect is not an outcome to report: it travels untouched so `main` rethrows it and Node
    // prints the stack that says where it happened.
    if (defectTypes.some(type => error instanceof type)) {
      throw error;
    }

    // Everything else is an operational failure the caller asked about, reported by its message
    // with the original kept as the cause, so the chain that produced it survives.
    throw new CliError(messageOf(error), { cause: error });
  }

  emit(payload);

  return payload;
}

function emit(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fail(message: string): never {
  throw new CliError(message);
}

function usage(): string {
  return [
    `Usage: wards <command> [args]`,
    ``,
    `Commands:`,
    `  validate <dir>`,
    `  list <source>[#ref]`,
    `  status [--scope project|user|both] [--project <dir>] [--user <dir>]`,
    `  ${fetchUsage()}`
  ].join('\n');
}

function fetchUsage(): string {
  return [
    `fetch --source <source> --path <path> --out <dir>`,
    `[--version <v> | --commit <hash>] [--ref <ref>] [--local <path>]`
  ].join(' ');
}
