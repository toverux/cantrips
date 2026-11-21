// The stand-in `gh` and the sandbox the scripts' CLI tests run in: each test runs a script in a fresh folder with the
// stand-in first on PATH, which records every call it receives and replays the answers the test gives it,
// applying `--limit` the way the real one does.

import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import assert from 'node:assert/strict';

// The stand-in: answers `issue list` and `label list` from the canned state, applies `--state` (default open),
// `--search` (every word in the title) and `--limit` (default 30), answers `issue view` with the item's canned
// comments and state, answers the blocked-by dependencies read with the canned `blockedBy` issues, which a blocked-by edit updates, records `issue create` (numbering the issues it creates from 101), `issue comment` (numbering its comments from 901), `issue edit`, `issue close`, `issue reopen`, `api` and `label create`, and fails every call with the canned error
// where one is set, or the calls holding the canned `failOn` text with the canned `failWith` error or a 502.
const FAKE_GH = `
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(args) + '\\n');
const state = JSON.parse(fs.readFileSync(process.env.FAKE_GH_STATE, 'utf8'));
if (state.fail || (state.failOn && args.join(' ').includes(state.failOn))) {
  process.stderr.write((state.fail || state.failWith || 'HTTP 502: Bad Gateway') + '\\n');
  process.exit(1);
}
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const limit = Number(flag('--limit') ?? 30);
const [group, verb] = args;
if (group === 'issue' && verb === 'list') {
  const fields = flag('--json').split(',');
  const wanted = flag('--state') ?? 'open';
  const words = (flag('--search') ?? '').toLowerCase().split(' ').filter(Boolean);
  const rows = state.issues
    .map((issue) => ({ state: 'OPEN', stateReason: '', ...issue }))
    .filter((issue) => wanted === 'all' || issue.state === wanted.toUpperCase())
    .filter((issue) => words.every((w) => issue.title.toLowerCase().includes(w)))
    .slice(0, limit).map((issue) => Object.fromEntries(fields.map((f) => [f, issue[f]])));
  process.stdout.write(JSON.stringify(rows));
} else if (group === 'label' && verb === 'list') {
  // The real gh prints nothing, not [], for a tracker with no label.
  if (state.labels.length > 0) process.stdout.write(JSON.stringify(state.labels.slice(0, limit).map((name) => ({ name }))));
} else if (group === 'issue' && verb === 'create') {
  const created = fs.readFileSync(process.env.FAKE_GH_LOG, 'utf8').split('\\n').filter((l) => l.startsWith('["issue","create"')).length;
  process.stdout.write('https://github.com/' + flag('--repo') + '/issues/' + (100 + created) + '\\n');
} else if (group === 'issue' && verb === 'view') {
  const issue = state.issues.find((i) => String(i.number) === args[2]);
  process.stdout.write(JSON.stringify({ state: issue?.state ?? 'OPEN', comments: (state.comments[args[2]] ?? []).map((body) => ({ body })) }));
} else if (group === 'issue' && verb === 'comment') {
  const posted = fs.readFileSync(process.env.FAKE_GH_LOG, 'utf8').split('\\n').filter((l) => l.startsWith('["issue","comment"')).length;
  process.stdout.write('https://github.com/' + flag('--repo') + '/issues/' + args[2] + '#issuecomment-' + (900 + posted) + '\\n');
} else if (group === 'api' && /\\/dependencies\\/blocked_by\\b/.test(verb)) {
  const [, repo, number] = /^repos\\/(.+)\\/issues\\/(\\d+)\\//.exec(verb);
  process.stdout.write(JSON.stringify((state.blockedBy?.[number] ?? []).map((n) => ({ number: n, repository_url: 'https://api.github.com/repos/' + repo }))));
} else if (group === 'issue' && verb === 'edit' && (flag('--add-blocked-by') || flag('--remove-blocked-by'))) {
  const held = new Set((state.blockedBy ??= {})[args[2]] ?? []);
  for (const n of (flag('--add-blocked-by') ?? '').split(',').filter(Boolean)) held.add(Number(n));
  for (const n of (flag('--remove-blocked-by') ?? '').split(',').filter(Boolean)) held.delete(Number(n));
  state.blockedBy[args[2]] = [...held];
  fs.writeFileSync(process.env.FAKE_GH_STATE, JSON.stringify(state));
} else if (!(group === 'label' && verb === 'create') && !(group === 'issue' && ['edit', 'close', 'reopen'].includes(verb)) && group !== 'api') {
  process.stderr.write('unexpected call\\n');
  process.exit(2);
}
`;

export interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
  calls: string[][];
}

export const SESSION = '0f3c2a9e-1b2d-4c5e-8f9a-0b1c2d3e4f5a';

export type State = { issues?: unknown[]; labels?: string[]; comments?: Record<string, string[]>; fail?: string; failOn?: string; failWith?: string; blockedBy?: Record<string, number[]> };

// The sandbox of the script at the given path.
export function sandboxFor(SCRIPT: string) {
  return function sandbox(config: string | null, state: State = {}) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-test-'));
    const bin = path.join(tmp, 'bin');
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(bin);
    fs.mkdirSync(repo);
    fs.writeFileSync(path.join(bin, 'gh'), `#!${process.execPath}\n${FAKE_GH}`, { mode: 0o755 });
    const log = path.join(tmp, 'calls.jsonl');
    fs.writeFileSync(log, '');
    const stateFile = path.join(tmp, 'state.json');
    const setState = (next: State) => fs.writeFileSync(stateFile, JSON.stringify({ issues: [], labels: [], comments: {}, ...next }));
    setState(state);
    if (config !== null) {
      fs.mkdirSync(path.join(repo, 'docs/agents'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'docs/agents/cantrips-loop.md'), config);
    }
    const env = (session: string) => ({
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      FAKE_GH_LOG: log,
      FAKE_GH_STATE: stateFile,
      GIT_CEILING_DIRECTORIES: tmp,
      GIT_CONFIG_GLOBAL: '/dev/null',
      XDG_CONFIG_HOME: tmp,
      CLAUDE_CODE_SESSION_ID: session,
    });
    const calls = () => fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const run = (...args: string[]): Run => runWith('', ...args);
    const runWith = (input: string, ...args: string[]): Run => {
      const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: repo, input, env: env(SESSION), encoding: 'utf8' });
      return { status: result.status, stdout: result.stdout, stderr: result.stderr, calls: calls() };
    };
    // Started without waiting, so two drains run at once.
    const start = (session: string, ...args: string[]): Promise<Run> =>
      new Promise((resolve) => {
        const child = spawn(process.execPath, [SCRIPT, ...args], { cwd: repo, env: env(session) });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => (stdout += chunk));
        child.stderr.on('data', (chunk) => (stderr += chunk));
        child.on('close', (status) => resolve({ status, stdout, stderr, calls: calls() }));
      });
    return { run, runWith, start, repo, setState, calls };
  };
}

export function loopConfig(roadmap: string) {
  return `# The cantrips loop in this repo\n\n## Storage backend\n\nLocal markdown.\n\n${roadmap}\n## Knowledge stores\n\n- \`docs/adr/\` — **disabled**.\n`;
}

export const GITHUB = loopConfig(`## Roadmap

Read and write this repo's roadmap through \`/roadmap\`.

- Backend: GitHub issues
- Tracker: \`acme/widgets\`
- Labels: \`area: mod\`, \`area: skills\`
- Note: the development backlog, not the public roadmap.
`);

export function issue(number: number, title: string, ...labels: string[]) {
  return { number, title, labels: ['roadmap', ...labels].map((name) => ({ name })) };
}

export function flagValues(call: string[], name: string) {
  return call.flatMap((arg, i) => (arg === name ? [call[i + 1]] : []));
}

export function oneLine(text: string) {
  assert.ok(text.trim(), 'expected one line, got nothing');
  assert.equal(text.trimEnd().split('\n').length, 1, `expected one line, got:\n${text}`);
}

// A git repo at the sandbox's folder, ignoring what the given .gitignore says.
export function gitInit(repo: string, gitignore: string) {
  assert.equal(spawnSync('git', ['init', '-q', repo]).status, 0);
  fs.writeFileSync(path.join(repo, '.gitignore'), gitignore);
}
