// /roadmap's script: reads the repo's roadmap section from its loop config and drives the tracker through `gh`.
// Runs as-is under node >= 22.18: strippable TypeScript, no dependencies.

import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
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

// The file the sync owns in a feature folder. Its name is neither spec.md nor NN-*.md, so the panel never reads it.
const NUMBERS = 'mirror.json';
// The file whose presence strikes a feature folder from the mirror.
const STRUCK = 'no-mirror';
// GitHub's limit on an issue's or a comment's body, in characters.
const BODY_LIMIT = 65536;

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
  in-flight <folder>      Mark in flight the items on the \`Roadmap items:\` line of the feature folder's spec.md:
                          #N on the tracker, owner/repo#N on that repo. Only in a clone marked by ${MARK}.
  close <folder> [--done | --not-planned]
                          Before the folder is deleted: sync it, close its mirrored issues still open, and clear
                          the in-flight mark from its items still open. Without a word, closes as done only a feature
                          whose tickets are all resolved. Reads no roadmap section where the config has none.
  sync <folder> [--tracker <owner/repo>]
                          Make the tracker's issues match the feature folder: the spec as an issue, each ticket as
                          its sub-issue. The tracker is required on the first sync; ${NUMBERS} in the folder holds it after,
                          so without it the sync only catches up a mirrored folder. Once every ticket is resolved, prints
                          the closing keyword a commit uses to close the spec's issue.
                          A folder holding a file named ${STRUCK} is never synced.
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
// The config keeps no GitHub roadmap.
class NoRoadmap extends Fault {}

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
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NoRoadmap(local);
    throw new Fault(`cannot read ${CONFIG}: ${(error as Error).message}`);
  }
  const section = /^## Roadmap[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1];
  if (section === undefined) throw new NoRoadmap(local);
  const field = (name: string) => new RegExp(`^- ${name}:[ \\t]*(.*)$`, 'm').exec(section)?.[1].trim();
  const unquote = (value: string) => value.trim().replace(/^`(.*)`$/, '$1').trim();

  const backend = unquote(field('Backend') ?? '').toLowerCase();
  if (backend === 'local file') throw new NoRoadmap(local);
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

function readSpec(folder: string): string {
  const spec = path.join(folder, 'spec.md');
  try {
    return fs.readFileSync(spec, 'utf8');
  } catch (error) {
    throw new Fault(`cannot read ${spec}: ${(error as Error).message}`);
  }
}

// The items on the `Roadmap items:` line of a feature folder's spec, each with the repo whose tracker holds it.
function featureItems(roadmap: Roadmap, folder: string | undefined): { name: string; repo: string; number: string }[] {
  if (!folder?.trim()) throw new Fault('needs the feature folder: see --help');
  const line = /^\W*Roadmap items:(.*)$/im.exec(readSpec(folder))?.[1] ?? '';
  return [...line.matchAll(/([\w.-]+\/[\w.-]+)?#(\d+)/g)].map(([name, repo, number]) => ({ name, repo: repo ?? roadmap.tracker, number }));
}

// Sets or clears the in-flight label on the feature's items; clearing passes over the items already closed.
function flight(roadmap: Roadmap, folder: string | undefined, set: boolean): string {
  const items = featureItems(roadmap, folder);
  if (items.length === 0) return `the spec in ${folder} lists no roadmap items\n`;
  if (!marked()) return `not changed: this clone lacks the ${MARK} mark, so ${items.map((i) => i.name).join(', ')} keep their in-flight state\n`;
  const done: string[] = [];
  for (const item of items) {
    if (!set && JSON.parse(gh('issue', 'view', item.number, '--repo', item.repo, '--json', 'state')).state !== 'OPEN') continue;
    gh('issue', 'edit', item.number, '--repo', item.repo, set ? '--add-label' : '--remove-label', 'in flight');
    done.push(item.name);
  }
  return `${set ? 'in flight' : 'in-flight mark cleared'}: ${done.join(', ') || 'none, every item is closed'}\n`;
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
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined;
}

// The keyword a commit closes the spec's issue with once every ticket is resolved, bare where this repo is the tracker.
function closing(folder: string, numbers: Numbers): string {
  const spec = numbers.files['spec.md']?.issue;
  if (spec === undefined || !allResolved(folder)) return '';
  const origin = spawnSync('git', ['-C', repoRoot(), 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).stdout.trim();
  const here = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(origin)?.[1];
  const ref = `${here?.toLowerCase() === numbers.tracker.toLowerCase() ? '' : numbers.tracker}#${spec}`;
  return `every ticket is resolved: the commit's message closes the spec's issue with "Closes ${ref}"\n`;
}

function close(args: string[]): string {
  const { first: folder, flags } = parse('close', args, [], ['--done', '--not-planned']);
  if (flags['--done'] && flags['--not-planned']) throw new Fault('close takes --done or --not-planned, not both');
  let roadmap: Roadmap | undefined;
  try {
    roadmap = readRoadmap();
  } catch (error) {
    if (!(error instanceof NoRoadmap)) throw error;
  }
  const openIssues = () => Object.values(readNumbers(folder)?.files ?? {}).filter((file) => !file.closed).map((file) => file.issue);
  const mirrored = openIssues().length > 0;
  const reason = flags['--not-planned'] ? 'not planned' : flags['--done'] || allResolved(folder) ? 'completed' : undefined;
  if (mirrored && !reason) throw new Fault(`not closed: not every ticket of ${folder} is resolved; say --done or --not-planned`);
  if (!marked()) return `not closed: this clone lacks the ${MARK} mark, so ${folder}'s issues and items keep their state\n`;
  // A sync first closes what the folder settles itself: a resolved ticket as completed, a dropped one as not planned.
  const synced = mirrored ? sync([folder], false) : '';
  const open = openIssues();
  const tracker = readNumbers(folder)?.tracker;
  for (const issue of open) gh('issue', 'close', String(issue), '--repo', tracker!, '--reason', reason!);
  const closed = open.length > 0 ? `closed as ${reason} on ${tracker}: ${open.map((n) => `#${n}`).join(', ')}\n` : '';
  return synced + closed + (roadmap ? flight(roadmap, folder, false) : '');
}

function sync(args: string[], keyword = true): string {
  const { first: folder, flags } = parse('sync', args, ['--tracker']);
  if (fs.existsSync(path.join(folder, STRUCK))) return '';
  const numbersFile = path.join(folder, NUMBERS);
  const numbers: Numbers = readNumbers(folder) ?? { tracker: flags['--tracker']?.[0] ?? '', files: {} };
  // Not an error: /commit's catch-all meets a feature no write verb has mirrored yet, and says so in one line.
  if (!numbers.tracker) return `not synced: ${folder} is not mirrored yet, so nothing was published; a first sync takes --tracker <owner/repo>\n`;
  if (!/^[\w.-]+\/[\w.-]+$/.test(numbers.tracker)) throw new Fault(`not synced: "${numbers.tracker}" is no <owner/repo>`);
  // A folder two repos share is mirrored from the repo that holds it, so a link never publishes it a second time.
  const real = fs.existsSync(folder) ? fs.realpathSync(folder) : folder;
  if (!fs.existsSync(numbersFile) && path.relative(repoRoot(), real).startsWith('..')) {
    const holder = spawnSync('git', ['-C', real, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim() || real;
    throw new Fault(`not synced: ${folder} is linked from ${holder}; run its first sync there`);
  }
  if (!marked()) return `not synced: this clone lacks the ${MARK} mark, so nothing of ${folder} was published\n`;
  const read = (name: string) => fs.readFileSync(path.join(folder, name), 'utf8');
  const title = (text: string) => /^# (.+)/.exec(text)?.[1].trim();
  let created = 0;
  let updated = 0;
  // Each push is saved at once, so a failed call leaves the file true to what the tracker holds.
  const save = () => fs.writeFileSync(numbersFile, `${JSON.stringify(numbers, null, 2)}\n`);
  const leaks = (name: string, text: string) => {
    const secret = SECRETS.find(([, pattern]) => pattern.test(text));
    if (secret) process.stderr.write(`not published: ${name} holds what looks like ${secret[0]}; reword it\n`);
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

  const feature = path.basename(path.resolve(folder));
  const spec = readSpec(folder);
  const specTitle = title(spec);
  const [specBody, notes = ''] = spec.split(/^##\s+comments\s*$/im);
  push('spec.md', specTitle ? `${feature}: ${specTitle}` : feature, specBody, ['--label', 'spec']);
  const tickets = ticketNames(folder);
  const parent = numbers.files['spec.md']?.issue;
  // Each dated entry under the comments heading, a bullet or a heading, posted once, in order; a flagged one holds back those after it.
  const annotations = notes.split(/^(?:- |#+ )(?=\d{4}-\d{2}-\d{2})/m).slice(1);
  for (const note of parent === undefined ? [] : annotations.slice(numbers.annotations ?? 0)) {
    if (leaks('an annotation of spec.md', note)) break;
    gh('issue', 'comment', String(parent), '--repo', numbers.tracker, '--body', `${note.trimEnd()}\n`);
    numbers.annotations = (numbers.annotations ?? 0) + 1;
    updated++;
    save();
  }
  for (const name of parent === undefined ? [] : tickets) {
    const text = read(name);
    push(name, title(text) ?? name.replace(/\.md$/, ''), text, ['--label', 'ticket', '--parent', String(parent)]);
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
  // Read as the panel reads it: every other ticket number the "Blocked by" line names, none where it opens with "none",
  // each once its issue exists. A blocker the line stops naming loses its relation.
  const issueOf = (number: number) => numbers.files[tickets.find((name) => parseInt(name) === number) ?? '']?.issue;
  for (const name of tickets) {
    const known = numbers.files[name];
    if (!known) continue;
    const prose = /^\*\*Blocked by:\*\*[ \t]*(.*?)[ \t]*(?:\*\*Blocks:\*\*|$)/m.exec(read(name))?.[1] ?? '';
    const named = /^none\b/i.test(prose) ? [] : [...prose.matchAll(/\b(\d{2,3})\b/g)];
    const blockers = named.map(([, number]) => issueOf(Number(number))).filter((issue): issue is number => issue !== undefined && issue !== known.issue);
    const had = known.blockedBy ?? [];
    const added = [...new Set(blockers)].filter((issue) => !had.includes(issue));
    const removed = had.filter((issue) => !blockers.includes(issue));
    if (added.length + removed.length === 0) continue;
    const change = (flag: string, issues: number[]) => (issues.length > 0 ? [flag, issues.join(',')] : []);
    gh('issue', 'edit', String(known.issue), '--repo', numbers.tracker, ...change('--add-blocked-by', added), ...change('--remove-blocked-by', removed));
    known.blockedBy = [...had.filter((issue) => !removed.includes(issue)), ...added];
    updated++;
    save();
  }
  const done = created + updated === 0 ? `${folder} already matches ${numbers.tracker}\n` : `synced ${folder} to ${numbers.tracker}: ${created} created, ${updated} updated\n`;
  return done + (keyword ? closing(folder, numbers) : '');
}

const COMMANDS: Record<string, (roadmap: Roadmap, args: string[]) => string> = {
  list, search, add, park, claim, hit, drop, labels,
  'in-flight': (roadmap, [folder]) => flight(roadmap, folder, true),
};

function main(args: string[]): void {
  const [command, ...rest] = args;
  if (command === undefined || command === '--help') {
    process.stdout.write(HELP);
    return;
  }
  // A mirror repo may keep its roadmap in a local file: the sync reads no loop config, and close reads it only where it can.
  if (command === 'sync' || command === 'close') {
    process.stdout.write((command === 'sync' ? sync : close)(rest));
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
