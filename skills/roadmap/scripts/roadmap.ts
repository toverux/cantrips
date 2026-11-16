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
  list     Print every open roadmap item, one line each: #<number> <title> [<labels>].
  labels   Create the roadmap labels the tracker lacks: the standard set and the repo's own.
  --help   Print this help.
`;

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

function list(roadmap: Roadmap): string {
  const items: { number: number; title: string; labels: { name: string }[] }[] = JSON.parse(
    gh('issue', 'list', '--repo', roadmap.tracker, '--label', ROADMAP_LABEL, '--state', 'open', '--limit', ALL, '--json', 'number,title,labels'),
  );
  return items
    .map((item) => {
      const labels = item.labels.map((l) => l.name).filter((name) => name.toLowerCase() !== ROADMAP_LABEL);
      return `#${item.number} ${item.title}${labels.length > 0 ? ` [${labels.join(', ')}]` : ''}\n`;
    })
    .join('');
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

const COMMANDS: Record<string, (roadmap: Roadmap) => string> = { list, labels };

function main(args: string[]): void {
  const [command] = args;
  if (command === undefined || command === '--help') {
    process.stdout.write(HELP);
    return;
  }
  const run = COMMANDS[command];
  if (!run) throw new Fault(`unknown command "${command}": see --help`);
  process.stdout.write(run(readRoadmap()));
}

try {
  main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof Fault)) throw error;
  process.stderr.write(`roadmap: ${error.message}\n`);
  process.exitCode = 1;
}
