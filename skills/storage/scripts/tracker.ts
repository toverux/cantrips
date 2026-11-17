// What /storage's mirror and /roadmap's script share: the tracker's gh, the clone's write mark, and the secret checks.
// Runs as-is under node >= 22.18: strippable TypeScript, no dependencies.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

// The local git config key setup sets in a clone where agents may write to the tracker without asking.
export const MARK = 'cantrips.trackerWrites';
// Enough for any roadmap: gh pages through the tracker up to this many items, where its default stops at 30.
export const ALL = '100000';
// A tracker, as owner/repo.
export const TRACKER = /^[\w.-]+\/[\w.-]+$/;
// gh's own words when the network or a write was refused, which a sandbox is the likely cause of.
const REFUSED = /error connecting|dial tcp|could not resolve|network is unreachable|operation not permitted|permission denied|EACCES|EPERM|ENOTFOUND|ECONNREFUSED/i;

// What a text must never carry onto a tracker. Commit hashes and session identifiers match none of these;
// a git remote's `git@host:` or `ssh://git@host/` is no email.
export const SECRETS: [string, RegExp][] = [
  ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['a GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_\w{20,})/],
  ['an API key', /\b(?:sk-[\w-]{20,}|AKIA[0-9A-Z]{16}\b|AIza[\w-]{35}|xox[abposr]-[\w-]{10,})/],
  ['a JSON web token', /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/],
  ['a password in a URL', /\b\w+:\/\/[^\s/:@]+:[^\s/@]+@/],
  ['a secret assignment', /\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*['"]?(?=[^\s'"]*\d)[^\s'"]{8,}/i],
  ['an email address', /(?<![\w.+-]|:\/\/)[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![\w.-]*:\S)/],
];

export class Fault extends Error {}

export function repoRoot(): string {
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return git.status === 0 ? git.stdout.trim() : process.cwd();
}

export function gh(...args: string[]): string {
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

export function checkPublishable(text: string): void {
  const hit = SECRETS.find(([, pattern]) => pattern.test(text));
  if (hit) throw new Fault(`not published: the text holds what looks like ${hit[0]}; reword it`);
}

// The first argument, then the flags allowed after it; `--label` repeats, a flag absent from `valued` takes no value.
export function parse(command: string, args: string[], valued: string[], bare: string[] = []) {
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

export function marked(): boolean {
  return spawnSync('git', ['-C', repoRoot(), 'config', '--type=bool', '--get', MARK], { encoding: 'utf8' }).stdout?.trim() === 'true';
}

export function readSpec(folder: string): string {
  const spec = path.join(folder, 'spec.md');
  try {
    return fs.readFileSync(spec, 'utf8');
  } catch (error) {
    throw new Fault(`cannot read ${spec}: ${(error as Error).message}`);
  }
}

// Creates only what the tracker lacks, so a second run changes nothing; GitHub matches label names regardless of case.
// gh prints nothing, not [], for a tracker with no label.
export function labels(tracker: string, names: string[]): string {
  const existing = new Set(
    (JSON.parse(gh('label', 'list', '--repo', tracker, '--limit', ALL, '--json', 'name') || '[]') as { name: string }[]).map((l) => l.name.toLowerCase()),
  );
  const created: string[] = [];
  for (const name of names) {
    if (existing.has(name.toLowerCase())) continue;
    gh('label', 'create', name, '--repo', tracker);
    existing.add(name.toLowerCase());
    created.push(name);
  }
  return created.length > 0 ? `created on ${tracker}: ${created.join(', ')}\n` : `every label exists on ${tracker}\n`;
}
