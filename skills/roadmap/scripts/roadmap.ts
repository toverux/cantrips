// /roadmap's script: reads the repo's roadmap section from its loop config and drives the tracker through `gh`.
// Runs as-is under node >= 22.18: strippable TypeScript, no dependencies.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

const CONFIG = 'docs/agents/cantrips-loop.md';
const LOCAL_FILE = '.scratch/ROADMAP.md';
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
  add <title> [--label <name>]...
                          Create one roadmap item, its body read from stdin as written, with the roadmap label
                          and the labels given. Refuses a title or body holding what looks like a secret or an email.
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

function add(roadmap: Roadmap, args: string[]): string {
  const [title, ...rest] = args;
  if (!title?.trim()) throw new Fault('add needs a title: add <title> [--label <name>]...');
  const labels = [ROADMAP_LABEL];
  for (let i = 0; i < rest.length; i += 2) {
    if (rest[i] !== '--label' || rest[i + 1] === undefined) throw new Fault(`add takes only --label <name> after the title, got "${rest[i]}"`);
    labels.push(rest[i + 1]);
  }
  const body = process.stdin.isTTY ? '' : fs.readFileSync(0, 'utf8');
  checkPublishable(`${title}\n${body}`);
  const url = gh('issue', 'create', '--repo', roadmap.tracker, '--title', title, '--body', body, ...labels.flatMap((l) => ['--label', l])).trim();
  return `${url}\n`;
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

const COMMANDS: Record<string, (roadmap: Roadmap, args: string[]) => string> = { list, search, add, labels };

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
