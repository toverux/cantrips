// /storage's script: mirrors a feature folder one way to a GitHub repo's issues through `gh`.
// Runs as-is under node >= 22.18: strippable TypeScript, no dependencies.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { isatty } from 'node:tty';
import { Fault, gh, labels, MARK, marked, parse, readSpec, repoRoot, SECRETS, TRACKER } from './tracker.ts';

// The file the sync owns in a feature folder. Its name is neither spec.md nor NN-*.md, so the panel never reads it.
const NUMBERS = 'mirror.json';
// The file whose presence strikes a feature folder from the mirror.
const STRUCK = 'no-mirror';
// The loop config, whose storage section declares the mirror's tracker and its features' folder for catch-up.
const CONFIG = 'docs/agents/cantrips-loop.md';
// A catch-up lock older than the Stop hook's 120 s timeout was left by a killed run.
const LOCK_MS = 2 * 60 * 1000;
// GitHub's limit on an issue's or a comment's body, in characters.
const BODY_LIMIT = 65536;

const HELP = `Usage: node mirror.ts <command>

Commands:
  sync <folder> [--tracker <owner/repo>] [--dry-run]
                          Make the tracker's issues match the feature folder: the spec as an issue, each ticket as
                          its sub-issue. The tracker is required on the first sync; ${NUMBERS} in the folder holds it after,
                          so without it the sync only catches up a mirrored folder. The spec's issue closes once every
                          ticket is resolved, and reopens when one is added or no longer resolved.
                          A folder holding a file named ${STRUCK} is never synced. With --dry-run, lists every title
                          it would publish, each with what looks like a secret, an email or a home path, and calls nothing.
                          Only in a clone marked by ${MARK}.
  close <folder> [--done | --not-planned]
                          Before the folder is deleted: sync it and close its mirrored issues still open, naming
                          /roadmap's close where the spec lists roadmap items. Without a word, closes as done only
                          a feature whose tickets are all resolved. Only in a clone marked by ${MARK}.
  labels --tracker <owner/repo>
                          Create the mirror's spec and ticket labels the tracker lacks.
  catch-up                The Stop hook's run: sync every mirrored folder under the features folder ${CONFIG}
                          declares, and first publish one holding a ticket. Prints one line where it published or
                          failed, nothing otherwise: a failure blocks the stop for the agent to fix, but on a stop
                          the hook's input marks as following a blocked one. Always exits 0.
  --help                  Print this help.
`;

// Where a sync reports what it holds back; catch-up gathers these.
let report = (line: string) => {
  process.stderr.write(line);
};

// Flagged by the dry run only: a home path names a user, but blocks no push.
const HOME_PATH = /(?:\/home\/|\/Users\/|\b[A-Za-z]:\\Users\\)\w/;

interface Numbers {
  tracker: string;
  // Each mirrored file's issue, a hash of what was last pushed for it, the blocking issues set on it, and whether the sync closed it.
  // The continuation comments of a body over the limit are recorded so a later sync edits them in place.
  files: Record<string, { issue: number; pushed: string; blockedBy?: number[]; closed?: boolean; continued?: number[] }>;
  // How many of the spec's annotations are posted: they only ever append, so a count is exact.
  annotations?: number;
}

// A body cut into pieces within the limit, each cut made before the last heading that fits.
function pieces(body: string): string[] {
  const out: string[] = [];
  while (body.length > BODY_LIMIT) {
    const cut = [...body.slice(0, BODY_LIMIT).matchAll(/\n(?=#{1,6} )/g)].at(-1)?.index;
    const end = cut ? cut + 1 : BODY_LIMIT;
    out.push(body.slice(0, end));
    body = body.slice(end);
  }
  return [...out, body];
}

const titleOf = (text: string) => /^# (.+)/.exec(text)?.[1].trim();
const featureOf = (folder: string) => `[${path.basename(path.resolve(folder))}]`;

// The spec's issue title: the feature's name in brackets, then the spec's title line where it has one.
function specHeading(folder: string, spec: string): string {
  const title = titleOf(spec);
  return title ? `${featureOf(folder)} ${title}` : featureOf(folder);
}

// A ticket's issue title: the feature, then the file's number and the title line without that number, or the file's slug.
function ticketHeading(folder: string, name: string, text: string): string {
  const [, number, slug] = /^(\d+)-(.+)\.md$/.exec(name)!;
  const title = titleOf(text)?.replace(new RegExp(`^0*${Number(number)}(?:\\s*[:–—-])?\\s+`), '');
  return `${featureOf(folder)} ticket ${number}: ${title || slug}`;
}

// What a first sync would publish, each title with its flags, read from the files alone.
function preview(folder: string): string {
  const spec = readSpec(folder);
  const files = [
    [specHeading(folder, spec), spec],
    ...ticketNames(folder).map((name) => {
      const text = fs.readFileSync(path.join(folder, name), 'utf8');
      return [ticketHeading(folder, name, text), text];
    }),
  ];
  const flagged: [string, RegExp][] = [...SECRETS, ['a home path', HOME_PATH]];
  const lines = files.map(([heading, text]) => {
    const flags = flagged.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
    return `  ${heading}${flags.length > 0 ? ` — flagged: ${flags.join(', ')}` : ''}\n`;
  });
  return `${folder} would publish, nothing sent:\n${lines.join('')}`;
}

// Read as the panel reads them.
const RESOLVED = /^Status:\s*resolved\b/im;

function ticketNames(folder: string): string[] {
  return fs.readdirSync(folder).filter((name) => /^\d{2,}-.+\.md$/.test(name)).sort((a, b) => parseInt(a) - parseInt(b));
}

function allResolved(folder: string): boolean {
  const tickets = ticketNames(folder);
  return tickets.length > 0 && tickets.every((name) => RESOLVED.test(fs.readFileSync(path.join(folder, name), 'utf8')));
}

function readNumbers(folder: string): Numbers | undefined {
  const file = path.join(folder, NUMBERS);
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Fault(`${file} is not valid JSON`);
  }
}

function close(args: string[]): string {
  const { first: folder, flags } = parse('close', args, [], ['--done', '--not-planned']);
  if (flags['--done'] && flags['--not-planned']) throw new Fault('close takes --done or --not-planned, not both');
  const openIssues = () => Object.values(readNumbers(folder)?.files ?? {}).filter((file) => !file.closed).map((file) => file.issue);
  // The roadmap's own close clears its items' in-flight mark; the spec says whether there are any, with no config read.
  const spec = path.join(folder, 'spec.md');
  const next = fs.existsSync(spec) && /^\W*Roadmap items:.*#\d/im.test(fs.readFileSync(spec, 'utf8')) ? 'the spec lists roadmap items: close the feature through /roadmap too, before deleting its folder\n' : '';
  if (openIssues().length === 0) return `${folder} has no mirrored issue open\n${next}`;
  const reason = flags['--not-planned'] ? 'not planned' : flags['--done'] || allResolved(folder) ? 'completed' : undefined;
  if (!reason) throw new Fault(`not closed: not every ticket of ${folder} is resolved; say --done or --not-planned`);
  if (!marked()) return `not closed: this clone lacks the ${MARK} mark, so ${folder}'s issues keep their state\n`;
  // A sync first closes what the folder settles itself: a resolved ticket as completed, a dropped one as not planned.
  const synced = sync([folder]);
  const open = openIssues();
  const tracker = readNumbers(folder)?.tracker;
  for (const issue of open) gh('issue', 'close', String(issue), '--repo', tracker!, '--reason', reason);
  return synced + (open.length > 0 ? `closed as ${reason} on ${tracker}: ${open.map((n) => `#${n}`).join(', ')}\n` : '') + next;
}

function sync(args: string[]): string {
  const { first: folder, flags } = parse('sync', args, ['--tracker'], ['--dry-run']);
  if (fs.existsSync(path.join(folder, STRUCK))) return '';
  if (flags['--dry-run']) return preview(folder);
  const numbersFile = path.join(folder, NUMBERS);
  const numbers: Numbers = readNumbers(folder) ?? { tracker: flags['--tracker']?.[0] ?? '', files: {} };
  // Not an error: /commit's catch-all meets a feature no write verb has mirrored yet, and says so in one line.
  if (!numbers.tracker) return `not synced: ${folder} is not mirrored yet, so nothing was published; a first sync takes --tracker <owner/repo>\n`;
  if (!TRACKER.test(numbers.tracker)) throw new Fault(`not synced: "${numbers.tracker}" is no <owner/repo>`);
  // A folder two repos share is mirrored from the repo that holds it, so a link never publishes it a second time.
  const real = fs.existsSync(folder) ? fs.realpathSync(folder) : folder;
  if (!fs.existsSync(numbersFile) && path.relative(repoRoot(), real).startsWith('..')) {
    const holder = spawnSync('git', ['-C', real, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim() || real;
    throw new Fault(`not synced: ${folder} is linked from ${holder}; run its first sync there`);
  }
  if (!marked()) return `not synced: this clone lacks the ${MARK} mark, so nothing of ${folder} was published\n`;
  const read = (name: string) => fs.readFileSync(path.join(folder, name), 'utf8');
  let created = 0;
  let updated = 0;
  // Each push is saved at once, so a failed call leaves the file true to what the tracker holds.
  const save = () => fs.writeFileSync(numbersFile, `${JSON.stringify(numbers, null, 2)}\n`);
  const leaks = (name: string, text: string) => {
    const secret = SECRETS.find(([, pattern]) => pattern.test(text));
    if (secret) report(`not published: ${name} holds what looks like ${secret[0]}; reword it\n`);
    return secret !== undefined;
  };
  const push = (name: string, heading: string, body: string, extra: string[]) => {
    const pushed = createHash('sha256').update(`${heading}\0${body}`).digest('hex');
    const known = numbers.files[name];
    if (known?.pushed === pushed) return;
    if (leaks(name, `${heading}\n${body}`)) return;
    const [first, ...more] = pieces(body);
    let file = known;
    if (file) {
      gh('issue', 'edit', String(file.issue), '--repo', numbers.tracker, '--title', heading, '--body', first);
    } else {
      const url = gh('issue', 'create', '--repo', numbers.tracker, '--title', heading, '--body', first, ...extra);
      file = numbers.files[name] = { issue: Number(/(\d+)\s*$/.exec(url)![1]), pushed: '' };
      save();
    }
    const ids = (file.continued ??= []);
    const comment = (id: number) => `repos/${numbers.tracker}/issues/comments/${id}`;
    for (const [i, text] of more.entries()) {
      if (i < ids.length) {
        gh('api', '-X', 'PATCH', comment(ids[i]), '-f', `body=${text}`);
      } else {
        ids.push(Number(/issuecomment-(\d+)/.exec(gh('issue', 'comment', String(file.issue), '--repo', numbers.tracker, '--body', text))![1]));
        save();
      }
    }
    while (ids.length > more.length) {
      gh('api', '-X', 'DELETE', comment(ids.at(-1)!));
      ids.pop();
      save();
    }
    if (ids.length === 0) delete file.continued;
    file.pushed = pushed;
    if (known) updated++;
    else created++;
    save();
  };

  const spec = readSpec(folder);
  const [specBody, notes = ''] = spec.split(/^##\s+comments\s*$/im);
  push('spec.md', specHeading(folder, spec), specBody, ['--label', 'spec']);
  const tickets = ticketNames(folder);
  const parent = numbers.files['spec.md']?.issue;
  // Each entry under the comments heading opening on its date, as a bullet, a heading or a bare line, posted once, in order;
  // a flagged one holds back those after it.
  const annotations = notes.split(/^(?:- |#+ )?(?=\d{4}-\d{2}-\d{2})/m).slice(1);
  for (const note of parent === undefined ? [] : annotations.slice(numbers.annotations ?? 0)) {
    if (leaks('an annotation of spec.md', note)) break;
    gh('issue', 'comment', String(parent), '--repo', numbers.tracker, '--body', `${note.trimEnd()}\n`);
    numbers.annotations = (numbers.annotations ?? 0) + 1;
    updated++;
    save();
  }
  for (const name of parent === undefined ? [] : tickets) {
    const text = read(name);
    push(name, ticketHeading(folder, name, text), text, ['--label', 'ticket', '--parent', String(parent)]);
    const resolved = RESOLVED.test(text);
    const known = numbers.files[name];
    if (!known || !!known.closed === resolved) continue;
    gh('issue', resolved ? 'close' : 'reopen', String(known.issue), '--repo', numbers.tracker, ...(resolved ? ['--reason', 'completed'] : []));
    known.closed = resolved;
    updated++;
    save();
  }
  // A ticket file dropped or renumbered closes its issue, unless the issue closed as resolved.
  for (const name of Object.keys(numbers.files).filter((name) => name !== 'spec.md' && !tickets.includes(name))) {
    const { issue, closed } = numbers.files[name];
    if (!closed) gh('issue', 'close', String(issue), '--repo', numbers.tracker, '--reason', 'not planned', '--comment', `The ticket ${name} was dropped or renumbered.`);
    delete numbers.files[name];
    updated++;
    save();
  }
  // The spec's issue follows its tickets: closed once every one is resolved, reopened when one is added or no longer resolved.
  const specFile = numbers.files['spec.md'];
  const finished = allResolved(folder);
  if (specFile && !!specFile.closed !== finished) {
    gh('issue', finished ? 'close' : 'reopen', String(specFile.issue), '--repo', numbers.tracker, ...(finished ? ['--reason', 'completed'] : []));
    specFile.closed = finished;
    updated++;
    save();
  }
  // Read as the panel reads it: every other ticket number the "Blocked by" line names, none where it opens with "none",
  // each once its issue exists. A blocker the line stops naming loses its relation.
  // A change diffs against the issue's blockers on GitHub, which applies a multi-edge edit one edge at a time, and sends one
  // edge per call: an edge GitHub refuses, a cycle, is reported and the others still land. A blocker from outside the
  // feature is left alone.
  const issueOf = (number: number) => numbers.files[tickets.find((name) => parseInt(name) === number) ?? '']?.issue;
  const ours = new Set(Object.values(numbers.files).map((file) => file.issue));
  for (const name of tickets) {
    const known = numbers.files[name];
    if (!known) continue;
    const prose = /^\*\*Blocked by:\*\*[ \t]*(.*?)[ \t]*(?:\*\*Blocks:\*\*|$)/m.exec(read(name))?.[1] ?? '';
    const named = /^none\b/i.test(prose) ? [] : [...prose.matchAll(/\b(\d{2,3})\b/g)];
    const blockers = [...new Set(named.map(([, number]) => issueOf(Number(number))))].filter((issue): issue is number => issue !== undefined && issue !== known.issue);
    const had = known.blockedBy ?? [];
    if (blockers.length === had.length && blockers.every((issue) => had.includes(issue))) continue;
    const listed = JSON.parse(gh('api', `repos/${numbers.tracker}/issues/${known.issue}/dependencies/blocked_by?per_page=100`) || '[]') as { number: number; repository_url: string }[];
    const live = listed.filter((issue) => issue.repository_url.toLowerCase().endsWith(`/repos/${numbers.tracker.toLowerCase()}`)).map((issue) => issue.number);
    const current = new Set(live.filter((issue) => ours.has(issue) || had.includes(issue)));
    const edge = (flag: string, issue: number) => {
      try {
        gh('issue', 'edit', String(known.issue), '--repo', numbers.tracker, flag, String(issue));
      } catch (error) {
        if (!(error instanceof Fault && /validation failed/i.test(error.message))) throw error;
        report(`not linked: GitHub refused #${issue} as a blocker of ${name}'s issue #${known.issue}: ${error.message}\n`);
        return;
      }
      if (flag === '--add-blocked-by') current.add(issue);
      else current.delete(issue);
      known.blockedBy = [...current];
      updated++;
      save();
    };
    for (const issue of blockers.filter((issue) => !current.has(issue))) edge('--add-blocked-by', issue);
    for (const issue of [...current].filter((issue) => !blockers.includes(issue))) edge('--remove-blocked-by', issue);
    known.blockedBy = [...current];
    save();
  }
  return created + updated === 0 ? `${folder} already matches ${numbers.tracker}\n` : `synced ${folder} to ${numbers.tracker}: ${created} created, ${updated} updated\n`;
}

// The Stop hook's run on Claude Code, in the repo of the current directory. A folder not yet mirrored is first published only
// once it holds a ticket, since /spec drafts at the spec's own path before the user approves it.
function catchUp(retry: boolean): string {
  if (!marked()) return '';
  const root = repoRoot();
  process.chdir(root);
  if (!fs.existsSync(CONFIG)) return '';
  const section = /^## Storage backend[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(fs.readFileSync(CONFIG, 'utf8'))?.[1] ?? '';
  const field = (name: string) => new RegExp(`^- ${name}:[ \\t]*\`?([^\`\\s]+)`, 'm').exec(section)?.[1];
  const tracker = field('Mirror');
  const features = field('Features');
  if (!tracker || !features || !fs.existsSync(features)) return '';
  // One run at a time per clone: two sessions ending a turn at once would otherwise both create a feature's issues.
  const lock = path.join(spawnSync('git', ['rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).stdout.trim(), 'cantrips-mirror.lock');
  try {
    fs.writeFileSync(lock, '', { flag: 'wx' });
  } catch {
    if (Date.now() - fs.statSync(lock).mtimeMs < LOCK_MS) return '';
    fs.writeFileSync(lock, '');
  }
  const lines: string[] = [];
  const problems: string[] = [];
  report = (line) => problems.push(line.trim());
  try {
    for (const name of fs.readdirSync(features).sort()) {
      const folder = path.join(features, name);
      if (!fs.existsSync(path.join(folder, 'spec.md'))) continue;
      const mirrored = fs.existsSync(path.join(folder, NUMBERS));
      // A folder another repo links in is mirrored from that repo.
      if (!mirrored && (ticketNames(folder).length === 0 || path.relative(root, fs.realpathSync(folder)).startsWith('..'))) continue;
      try {
        const out = sync(mirrored ? [folder] : [folder, '--tracker', tracker]).trim();
        if (out && !/already matches/.test(out)) lines.push(out);
      } catch (error) {
        problems.push((error as Error).message);
      }
    }
  } finally {
    fs.rmSync(lock, { force: true });
  }
  return answer(lines, problems, retry);
}

// What the Stop hook prints: a sync in one line for the user, and a problem sent back to the agent to fix, once a stop:
// on the stop that follows, a problem still there goes to the user too.
function answer(lines: string[], problems: string[], retry: boolean): string {
  const out: Record<string, string> = {};
  const shown = retry ? [...lines, ...problems] : lines;
  if (shown.length > 0) out.systemMessage = `mirror: ${shown.join('; ')}`;
  if (problems.length > 0 && !retry) {
    out.decision = 'block';
    out.reason = `The mirror of the feature folders to GitHub issues failed: ${problems.join('; ')}. Fix what you can of it without asking, such as rewording the line of the file it names, then end your turn, since this hook syncs again then. Where it is out of your reach, end your turn telling the user in one line.`;
  }
  return Object.keys(out).length > 0 ? `${JSON.stringify(out)}\n` : '';
}

const COMMANDS: Record<string, (args: string[]) => string> = {
  sync,
  close,
  labels: ([flag, tracker = '']) => {
    if (flag !== '--tracker' || !TRACKER.test(tracker)) throw new Fault('labels takes --tracker <owner/repo>');
    return labels(tracker, ['spec', 'ticket']);
  },
};

function main(args: string[]): void {
  const [command, ...rest] = args;
  // A turn's end must never fail: whatever goes wrong goes back to the agent or to the user, and the exit stays 0.
  if (command === 'catch-up') {
    // The hook's input marks a stop that follows a blocked one, whichever Stop hook blocked it. An input it cannot read
    // counts as one, so a problem goes to the user rather than block every stop. `isatty(0)`, since `process.stdin.isTTY`
    // makes a piped stdin non-blocking, and the read then throws EAGAIN on an input written late.
    let retry = true;
    try {
      retry = isatty(0) || JSON.parse(fs.readFileSync(0, 'utf8') || '{}').stop_hook_active === true;
    } catch {}
    try {
      process.stdout.write(catchUp(retry));
    } catch (error) {
      process.stdout.write(answer([], [(error as Error).message], retry));
    }
    return;
  }
  if (command === undefined || command === '--help') {
    process.stdout.write(HELP);
    return;
  }
  const run = COMMANDS[command];
  if (!run) throw new Fault(`unknown command "${command}": see --help`);
  process.stdout.write(run(rest));
}

try {
  main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof Fault)) throw error;
  process.stderr.write(`mirror: ${error.message}\n`);
  process.exitCode = 1;
}
