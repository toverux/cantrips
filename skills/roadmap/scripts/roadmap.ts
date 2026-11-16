// /roadmap's script: reads the repo's roadmap section from its loop config and drives the tracker through `gh`.
// Runs as-is under node >= 22.18: strippable TypeScript, no dependencies.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

const CONFIG = 'docs/agents/cantrips-loop.md';
const LOCAL_FILE = '.scratch/ROADMAP.md';
const INBOX = '.scratch/roadmap-inbox';
const CLAIMED = `${INBOX}/claimed`;
// A claim another session holds is taken up once it is older than this.
const STALE_MS = 24 * 60 * 60 * 1000;
// The local git config key setup sets in a clone where agents may write to the roadmap without asking.
const MARK = 'cantrips.roadmapWrites';
const ROADMAP_LABEL = 'roadmap';
const STANDARD_LABELS = [
  ROADMAP_LABEL,
  ...['high', 'medium', 'low'].map((p) => `priority: ${p}`),
  ...['trivial', 'cheap', 'moderate', 'large'].map((c) => `cost: ${c}`),
  'in flight',
];
// Enough for any roadmap: gh pages through the tracker up to this many items, where its default stops at 30.
const ALL = '100000';
// gh's own words when the network or a write was refused, which a sandbox is the likely cause of.
const REFUSED = /error connecting|dial tcp|could not resolve|network is unreachable|operation not permitted|permission denied|EACCES|EPERM|ENOTFOUND|ECONNREFUSED/i;

const HELP = `Usage: node roadmap.ts <command>

Reads the roadmap section of ${CONFIG}; the tracker commands need its GitHub backend and gh.

Commands:
  list                    Print every open roadmap item, one line each: #<number> <title> [<labels>].
  search <words>...       Print the roadmap items, open and closed, a search on the words finds, in list's form.
  add <title> [--label <name>]... [--candidate <file>]
                          Create one roadmap item, its body read from stdin as written, with the roadmap label
                          and the labels given. Refuses a title or body holding what looks like a secret or an email.
                          With --candidate, settles that claimed candidate: its file is removed once the item exists.
  park <title> [--label <name>]...
                          Write one candidate into ${INBOX}/, its body read from stdin: what was met and
                          the evidence. The labels given are suggestions. Makes no tracker call.
  claim [<file>]...       Claim the inbox for a drain: the new candidates, this session's claims, and other
                          sessions' claims older than a day; given files, only those of the new candidates.
                          Prints each claimed file, its text, and the items a search on its title finds.
  hit <number> [--candidate <file>] [--approved]
                          Comment a hit on the item: the running count and the date, the one line of evidence
                          read from stdin, and the session. Posts only in a clone marked by ${MARK} or with
                          --approved, otherwise prints the hit to propose. With --candidate, settles it as add does.
  drop <file>             Settle a claimed candidate as declined: remove its file, writing nothing.
  labels                  Create the roadmap labels the tracker lacks: the standard set and the repo's own.
  --help                  Print this help.
`;

// What a text must never carry onto a tracker. Commit hashes and session identifiers match none of these;
// a git remote's `git@host:` or `ssh://git@host/` is no email.
const SECRETS: [string, RegExp][] = [
  ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['a GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_\w{20,})/],
  ['an API key', /\b(?:sk-[\w-]{20,}|AKIA[0-9A-Z]{16}\b|AIza[\w-]{35}|xox[abposr]-[\w-]{10,})/],
  ['a JSON web token', /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/],
  ['a password in a URL', /\b\w+:\/\/[^\s/:@]+:[^\s/@]+@/],
  ['a secret assignment', /\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*['"]?(?=[^\s'"]*\d)[^\s'"]{8,}/i],
  ['an email address', /(?<![\w.+-]|:\/\/)[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![\w.-]*:\S)/],
];

class Fault extends Error {}

interface Roadmap {
  tracker: string;
  labels: string[];
}

function repoRoot(): string {
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return git.status === 0 ? git.stdout.trim() : process.cwd();
}

// The GitHub roadmap the config declares; anything else refuses or faults in one line.
function readRoadmap(): Roadmap {
  const file = path.join(repoRoot(), CONFIG);
  const local = `this repo's roadmap is the local file ${LOCAL_FILE}: edit it directly, no tracker command applies`;
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Fault(local);
    throw new Fault(`cannot read ${CONFIG}: ${(error as Error).message}`);
  }
  const section = /^## Roadmap[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1];
  if (section === undefined) throw new Fault(local);
  const field = (name: string) => new RegExp(`^- ${name}:[ \\t]*(.*)$`, 'm').exec(section)?.[1].trim();
  const unquote = (value: string) => value.trim().replace(/^`(.*)`$/, '$1').trim();

  const backend = unquote(field('Backend') ?? '').toLowerCase();
  if (backend === 'local file') throw new Fault(local);
  if (backend !== 'github issues') {
    throw new Fault(`${CONFIG}: the roadmap section's "- Backend:" line must read "local file" or "GitHub issues"`);
  }
  const tracker = unquote(field('Tracker') ?? '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(tracker)) {
    throw new Fault(`${CONFIG}: the roadmap section needs a "- Tracker: \`owner/repo\`" line for its GitHub backend`);
  }
  const labels = (field('Labels') ?? '').split(',').map(unquote).filter(Boolean);
  return { tracker, labels };
}

function gh(...args: string[]): string {
  const run = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (run.error) {
    const reason = (run.error as NodeJS.ErrnoException).code === 'ENOENT' ? 'gh is not on PATH' : run.error.message;
    throw new Fault(`gh ${args[0]} ${args[1]} failed: ${reason}`);
  }
  if (run.status !== 0) {
    const message = run.stderr.trim().split('\n').map((l) => l.trim()).filter(Boolean).join(' ') || `exit ${run.status}`;
    const hint = REFUSED.test(message) ? ' (a sandbox blocking the network or the write is the likely cause)' : '';
    throw new Fault(`gh ${args[0]} ${args[1]} failed: ${message}${hint}`);
  }
  return run.stdout;
}

interface Item {
  number: number;
  title: string;
  labels: { name: string }[];
  state?: string;
  stateReason?: string;
}

function lines(items: Item[]): string {
  return items
    .map((item) => {
      const labels = item.labels.map((l) => l.name).filter((name) => name.toLowerCase() !== ROADMAP_LABEL);
      const closed = item.state === 'CLOSED' ? ` (closed as ${(item.stateReason || 'COMPLETED').toLowerCase().replace('_', ' ')})` : '';
      return `#${item.number} ${item.title}${labels.length > 0 ? ` [${labels.join(', ')}]` : ''}${closed}\n`;
    })
    .join('');
}

function issues(roadmap: Roadmap, ...filters: string[]): string {
  return lines(JSON.parse(gh('issue', 'list', '--repo', roadmap.tracker, '--label', ROADMAP_LABEL, ...filters, '--limit', ALL, '--json', 'number,title,labels,state,stateReason')));
}

function list(roadmap: Roadmap): string {
  return issues(roadmap, '--state', 'open');
}

function search(roadmap: Roadmap, words: string[]): string {
  if (words.length === 0) throw new Fault('search needs the words to search for');
  return issues(roadmap, '--state', 'all', '--search', words.join(' ')) || 'no roadmap item matches\n';
}

function checkPublishable(text: string): void {
  const hit = SECRETS.find(([, pattern]) => pattern.test(text));
  if (hit) throw new Fault(`not published: the text holds what looks like ${hit[0]}; reword it`);
}

// The first argument, then the flags allowed after it; `--label` repeats, a flag absent from `valued` takes no value.
function parse(command: string, args: string[], valued: string[], bare: string[] = []) {
  const [first, ...rest] = args;
  if (!first?.trim()) throw new Fault(`${command} needs its argument: see --help`);
  const flags: Record<string, string[]> = {};
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (bare.includes(flag)) {
      flags[flag] = [];
    } else if (valued.includes(flag) && rest[i + 1] !== undefined) {
      (flags[flag] ??= []).push(rest[++i]);
    } else {
      throw new Fault(`${command} takes ${[...valued.map((f) => `${f} <value>`), ...bare].join(', ')} after its argument, got "${flag}"`);
    }
  }
  return { first, flags };
}

function session(): string {
  // Codex exports its conversation as CODEX_THREAD_ID and its root session as CODEX_SESSION_ID.
  return process.env.CLAUDE_CODE_SESSION_ID || process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID || 'unknown';
}

// The session as a claimed file's name carries it.
function owner(): string {
  return session().replace(/[^\w-]/g, '-');
}

// A claimed file is named <candidate>.<session>.<ms>.md: the rename that claims it records who and when in one step.
const CLAIM_NAME = /^(.+)\.([\w-]+)\.(\d+)\.md$/;

function claimedName(base: string): string {
  return `${base}.${owner()}.${Date.now()}.md`;
}

// The candidate file a settle names, checked to be a claim this session holds; the file stays until the write succeeds.
function claimedCandidate(file: string | undefined): string | undefined {
  if (file === undefined) return undefined;
  const full = path.resolve(file);
  const holder = CLAIM_NAME.exec(path.basename(full))?.[2];
  if (path.dirname(full) !== path.join(repoRoot(), CLAIMED) || holder === undefined) {
    throw new Fault(`not settled: ${file} is no claimed candidate in ${CLAIMED}/`);
  }
  if (holder !== owner() || !fs.existsSync(full)) {
    throw new Fault(`not settled: another drain took up the claim on ${path.basename(full)}`);
  }
  return full;
}

function stdin(): string {
  return process.stdin.isTTY ? '' : fs.readFileSync(0, 'utf8');
}

function add(roadmap: Roadmap, args: string[]): string {
  const { first: title, flags } = parse('add', args, ['--label', '--candidate']);
  const candidate = claimedCandidate(flags['--candidate']?.[0]);
  const body = stdin();
  checkPublishable(`${title}\n${body}`);
  const labels = [ROADMAP_LABEL, ...(flags['--label'] ?? [])];
  const url = gh('issue', 'create', '--repo', roadmap.tracker, '--title', title, '--body', body, ...labels.flatMap((l) => ['--label', l])).trim();
  if (candidate) fs.rmSync(candidate);
  return `${url}\n`;
}

// One file per candidate, standing alone. Its name starts with a letter, so the panel never reads it as a ticket.
function park(_roadmap: Roadmap, args: string[]): string {
  const { first: title, flags } = parse('park', args, ['--label']);
  const labels = flags['--label'] ?? [];
  const root = repoRoot();
  if (spawnSync('git', ['-C', root, 'check-ignore', '-q', `${INBOX}/`]).status !== 0) {
    throw new Fault(`not parked: git does not report ${INBOX}/ ignored in ${root}`);
  }
  const body = stdin().trim();
  if (!body) throw new Fault('park needs the candidate on stdin: what was met and the evidence');
  const text = [
    `# ${title}`,
    '',
    body,
    '',
    `Labels: ${labels.map((l) => `\`${l}\``).join(', ') || 'none'}`,
    `Session: ${session()}`,
    '',
  ].join('\n');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-|-$/g, '');
  const dir = path.join(root, INBOX);
  const file = path.join(dir, `candidate-${slug}-${randomBytes(3).toString('hex')}.md`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, text, { flag: 'wx' });
  return `parked in ${file}\n`;
}

// Each claim is a rename, so of two drains exactly one moves a given file; the loser's rename finds it gone.
function claim(roadmap: Roadmap, files: string[]): string {
  const root = repoRoot();
  const inbox = path.join(root, INBOX);
  const claimed = path.join(root, CLAIMED);
  const held: string[] = [];
  const take = (from: string, base: string) => {
    const to = path.join(claimed, claimedName(base));
    fs.mkdirSync(claimed, { recursive: true });
    try {
      fs.renameSync(from, to);
      held.push(to);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  };
  const read = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.md')).sort() : []);
  const named = files.map((file) => path.resolve(file));
  if (named.length === 0) {
    for (const name of read(claimed)) {
      const [, base, holder, ms] = CLAIM_NAME.exec(name) ?? [];
      if (base === undefined) continue;
      if (holder === owner()) held.push(path.join(claimed, name));
      else if (Date.now() - Number(ms) > STALE_MS) take(path.join(claimed, name), base);
    }
  }
  for (const name of read(inbox).filter((name) => named.length === 0 || named.includes(path.join(inbox, name)))) {
    take(path.join(inbox, name), name.replace(/\.md$/, ''));
  }
  if (held.length === 0) return 'the roadmap inbox is empty\n';
  return held
    .map((file) => {
      const text = fs.readFileSync(file, 'utf8');
      const title = /^# (.*)$/m.exec(text)?.[1].trim() ?? '';
      const matches = title ? issues(roadmap, '--state', 'all', '--search', title) : '';
      return `== ${path.relative(process.cwd(), file)}\n${text.trimEnd()}\n-- search: ${title}\n${matches || 'no roadmap item matches\n'}`;
    })
    .join('\n');
}

function marked(): boolean {
  return spawnSync('git', ['-C', repoRoot(), 'config', '--type=bool', '--get', MARK], { encoding: 'utf8' }).stdout.trim() === 'true';
}

function hit(roadmap: Roadmap, args: string[]): string {
  const { first: number, flags } = parse('hit', args, ['--candidate'], ['--approved']);
  if (!/^\d+$/.test(number)) throw new Fault(`hit needs an item number, got "${number}"`);
  const candidate = claimedCandidate(flags['--candidate']?.[0]);
  const evidence = stdin().replace(/\s+/g, ' ').trim();
  if (!evidence) throw new Fault('hit needs one line of evidence on stdin');
  checkPublishable(evidence);
  if (!marked() && !flags['--approved']) {
    return `not posted: this clone lacks the ${MARK} mark, so propose the hit on #${number}, and post it with --approved once approved\n`;
  }
  const comments = (JSON.parse(gh('issue', 'view', number, '--repo', roadmap.tracker, '--json', 'comments')) as { comments: { body: string }[] }).comments;
  const last = comments.map((c) => /^Hit (\d+) ·/.exec(c.body)?.[1]).filter((n) => n !== undefined).at(-1);
  const count = Number(last ?? 0) + 1;
  const body = `Hit ${count} · ${new Date().toISOString().slice(0, 10)}\n${evidence}\nSession: ${session()}\n`;
  const url = gh('issue', 'comment', number, '--repo', roadmap.tracker, '--body', body).trim();
  if (candidate) fs.rmSync(candidate);
  return `hit ${count} on #${number}: ${url}\n`;
}

function drop(_roadmap: Roadmap, args: string[]): string {
  const { first } = parse('drop', args, []);
  const candidate = claimedCandidate(first)!;
  fs.rmSync(candidate);
  return `dropped ${path.basename(candidate)}\n`;
}

// Creates only what the tracker lacks, so a second run changes nothing; GitHub matches label names regardless of case.
function labels(roadmap: Roadmap): string {
  const existing = new Set(
    (JSON.parse(gh('label', 'list', '--repo', roadmap.tracker, '--limit', ALL, '--json', 'name')) as { name: string }[]).map((l) => l.name.toLowerCase()),
  );
  const created: string[] = [];
  for (const name of [...STANDARD_LABELS, ...roadmap.labels]) {
    if (existing.has(name.toLowerCase())) continue;
    gh('label', 'create', name, '--repo', roadmap.tracker);
    existing.add(name.toLowerCase());
    created.push(name);
  }
  return created.length > 0 ? `created on ${roadmap.tracker}: ${created.join(', ')}\n` : `every roadmap label exists on ${roadmap.tracker}\n`;
}

const COMMANDS: Record<string, (roadmap: Roadmap, args: string[]) => string> = { list, search, add, park, claim, hit, drop, labels };

function main(args: string[]): void {
  const [command, ...rest] = args;
  if (command === undefined || command === '--help') {
    process.stdout.write(HELP);
    return;
  }
  const run = COMMANDS[command];
  if (!run) throw new Fault(`unknown command "${command}": see --help`);
  process.stdout.write(run(readRoadmap(), rest));
}

try {
  main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof Fault)) throw error;
  process.stderr.write(`roadmap: ${error.message}\n`);
  process.exitCode = 1;
}
