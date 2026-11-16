// CLI tests for roadmap.ts, through the command line the agent calls. Run: mise run test.
// Each test runs the script in a fresh folder with a stand-in `gh` first on PATH: it records every call it
// receives and replays the answers the test gives it, applying `--limit` the way the real one does.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const SCRIPT = fileURLToPath(new URL('./roadmap.ts', import.meta.url));

// The stand-in: answers `issue list` and `label list` from the canned state, applies `--state` (default open),
// `--search` (every word in the title) and `--limit` (default 30), records `issue create` and `label create`,
// and fails every call with the canned error where one is set.
const FAKE_GH = `
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(args) + '\\n');
const state = JSON.parse(fs.readFileSync(process.env.FAKE_GH_STATE, 'utf8'));
if (state.fail) {
  process.stderr.write(state.fail + '\\n');
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
  process.stdout.write(JSON.stringify(state.labels.slice(0, limit).map((name) => ({ name }))));
} else if (group === 'issue' && verb === 'create') {
  process.stdout.write('https://github.com/' + flag('--repo') + '/issues/101\\n');
} else if (group !== 'label' || verb !== 'create') {
  process.stderr.write('unexpected call\\n');
  process.exit(2);
}
`;

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
  calls: string[][];
}

function sandbox(config: string | null, state: { issues?: unknown[]; labels?: string[]; fail?: string } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-test-'));
  const bin = path.join(tmp, 'bin');
  const repo = path.join(tmp, 'repo');
  fs.mkdirSync(bin);
  fs.mkdirSync(repo);
  fs.writeFileSync(path.join(bin, 'gh'), `#!${process.execPath}\n${FAKE_GH}`, { mode: 0o755 });
  const log = path.join(tmp, 'calls.jsonl');
  fs.writeFileSync(log, '');
  const stateFile = path.join(tmp, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ issues: [], labels: [], ...state }));
  if (config !== null) {
    fs.mkdirSync(path.join(repo, 'docs/agents'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'docs/agents/cantrips-loop.md'), config);
  }
  const run = (...args: string[]): Run => runWith('', ...args);
  const runWith = (input: string, ...args: string[]): Run => {
    const result = spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd: repo,
      input,
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        FAKE_GH_LOG: log,
        FAKE_GH_STATE: stateFile,
        GIT_CEILING_DIRECTORIES: tmp,
      },
      encoding: 'utf8',
    });
    const calls = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, calls };
  };
  return { run, runWith, repo };
}

function loopConfig(roadmap: string) {
  return `# The cantrips loop in this repo\n\n## Storage backend\n\nLocal markdown.\n\n${roadmap}\n## Knowledge stores\n\n- \`docs/adr/\` — **disabled**.\n`;
}

const GITHUB = loopConfig(`## Roadmap

Read and write this repo's roadmap through \`/roadmap\`.

- Backend: GitHub issues
- Tracker: \`acme/widgets\`
- Labels: \`area: mod\`, \`area: skills\`
- Note: the development backlog, not the public roadmap.
`);

function issue(number: number, title: string, ...labels: string[]) {
  return { number, title, labels: ['roadmap', ...labels].map((name) => ({ name })) };
}

function flagValues(call: string[], name: string) {
  return call.flatMap((arg, i) => (arg === name ? [call[i + 1]] : []));
}

function oneLine(text: string) {
  assert.equal(text.trimEnd().split('\n').length, 1, `expected one line, got:\n${text}`);
}

test('--help lists the commands', () => {
  const { run } = sandbox(null);
  const out = run('--help');
  assert.equal(out.status, 0);
  assert.match(out.stdout, /\blist\b/);
  assert.match(out.stdout, /\blabels\b/);
  assert.match(out.stdout, /\bsearch\b/);
  assert.match(out.stdout, /\badd\b/);
  assert.deepEqual(out.calls, []);
});

test('list returns every open item past the default page size, one compact line each', () => {
  const issues = Array.from({ length: 75 }, (_, i) => issue(i + 1, `Item ${i + 1}`));
  issues[0] = issue(1, 'Panel shows the inbox', 'priority: high', 'cost: cheap', 'in flight');
  const { run } = sandbox(GITHUB, { issues });
  const out = run('list');
  assert.equal(out.status, 0, out.stderr);
  const lines = out.stdout.trimEnd().split('\n');
  assert.equal(lines.length, 75);
  assert.equal(lines[0], '#1 Panel shows the inbox [priority: high, cost: cheap, in flight]');
  assert.equal(lines[74], '#75 Item 75');
  assert.equal(out.calls.length, 1);
  const call = out.calls[0];
  assert.deepEqual(call.slice(0, 2), ['issue', 'list']);
  assert.equal(call[call.indexOf('--repo') + 1], 'acme/widgets');
  assert.equal(call[call.indexOf('--label') + 1], 'roadmap');
  assert.equal(call[call.indexOf('--state') + 1], 'open');
});

test('labels creates the standard set and the repo\'s own, and a second run creates nothing', () => {
  const { run } = sandbox(GITHUB, { labels: ['bug'] });
  const out = run('labels');
  assert.equal(out.status, 0, out.stderr);
  const created = out.calls.filter((c) => c[0] === 'label' && c[1] === 'create').map((c) => c[2]);
  assert.deepEqual(created, [
    'roadmap',
    'priority: high',
    'priority: medium',
    'priority: low',
    'cost: trivial',
    'cost: cheap',
    'cost: moderate',
    'cost: large',
    'in flight',
    'area: mod',
    'area: skills',
  ]);
  for (const call of out.calls) assert.equal(call[call.indexOf('--repo') + 1], 'acme/widgets');

  // GitHub matches label names regardless of case, so an existing `Roadmap` is the `roadmap` label.
  const again = sandbox(GITHUB, { labels: ['bug', 'Roadmap', ...created.slice(1)] }).run('labels');
  assert.equal(again.status, 0, again.stderr);
  assert.deepEqual(again.calls.filter((c) => c[1] === 'create'), []);
});

test('list reads a config checked out with CRLF line ends', () => {
  const { run } = sandbox(GITHUB.replaceAll('\n', '\r\n'), { issues: [issue(1, 'Item 1')] });
  const out = run('list');
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout, '#1 Item 1\n');
});

test('search returns the items the words find, open and closed, saying how a closed one closed', () => {
  const issues = [
    issue(1, 'Panel shows the inbox', 'priority: high'),
    { ...issue(2, 'Panel shows the inbox count'), state: 'CLOSED', stateReason: 'NOT_PLANNED' },
    { ...issue(3, 'Inbox in the panel footer'), state: 'CLOSED', stateReason: 'COMPLETED' },
    { ...issue(5, 'Inbox panel badge'), state: 'CLOSED', stateReason: 'DUPLICATE' },
    issue(4, 'Deputy reads the roadmap'),
  ];
  const { run } = sandbox(GITHUB, { issues });
  const out = run('search', 'panel', 'inbox');
  assert.equal(out.status, 0, out.stderr);
  assert.equal(
    out.stdout,
    '#1 Panel shows the inbox [priority: high]\n#2 Panel shows the inbox count (closed as not planned)\n#3 Inbox in the panel footer (closed as completed)\n#5 Inbox panel badge (closed as duplicate)\n',
  );
  const [call] = out.calls;
  assert.equal(call[call.indexOf('--state') + 1], 'all');
  assert.equal(call[call.indexOf('--label') + 1], 'roadmap');
  assert.equal(call[call.indexOf('--search') + 1], 'panel inbox');
  assert.equal(call[call.indexOf('--limit') + 1], '100000');

  const none = run('search', 'nothing');
  assert.equal(none.status, 0, none.stderr);
  oneLine(none.stdout);
});

test('add creates one issue with the title, the body as written, and the roadmap label beside the labels given', () => {
  const { runWith } = sandbox(GITHUB);
  const body = 'The panel shows the inbox.\n\n- Evidence: session 0f3c2a9e-1b2d-4c5e-8f9a-0b1c2d3e4f5a, commit 8d0d248.\n';
  const out = runWith(body, 'add', 'Panel shows the inbox', '--label', 'priority: medium', '--label', 'cost: cheap', '--label', 'area: mod');
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout, 'https://github.com/acme/widgets/issues/101\n');
  assert.equal(out.calls.length, 1);
  const [call] = out.calls;
  assert.deepEqual(call.slice(0, 2), ['issue', 'create']);
  assert.equal(call[call.indexOf('--repo') + 1], 'acme/widgets');
  assert.equal(call[call.indexOf('--title') + 1], 'Panel shows the inbox');
  assert.equal(call[call.indexOf('--body') + 1], body);
  assert.deepEqual(flagValues(call, '--label'), ['roadmap', 'priority: medium', 'cost: cheap', 'area: mod']);
});

for (const [name, text] of [
  ['a GitHub token', 'Token ghp_abcdefghijklmnopqrstuvwxyz0123456789 leaked'],
  ['an API key', 'Uses sk-ant-api03-abcdefghijklmnopqrstuvwxyz'],
  ['a private key', '-----BEGIN OPENSSH PRIVATE KEY-----'],
  ['a password in a URL', 'Clone https://bot:hunter2secret@github.com/acme/widgets.git'],
  ['a secret assignment', 'Set password=Tr0ub4dor&3 in the env'],
  ['an email address', 'Reported by jane.doe@example.com'],
  ['an email address before a colon', 'Reported by jane.doe@example.com: it crashes'],
] as const) {
  test(`add publishes nothing holding ${name}, and reports it in one line`, () => {
    const { runWith } = sandbox(GITHUB);
    for (const out of [runWith(text, 'add', 'An item'), runWith('A body.', 'add', text)]) {
      assert.notEqual(out.status, 0);
      oneLine(out.stderr);
      assert.match(out.stderr, /not published/);
      assert.deepEqual(out.calls, []);
    }
  });
}

test('add lets a session identifier, a commit hash and git remote addresses through', () => {
  const { runWith } = sandbox(GITHUB);
  const body = [
    'Session 0f3c2a9e-1b2d-4c5e-8f9a-0b1c2d3e4f5a, commit 8d0d248b1c4e5f60718293a4b5c6d7e8f9012345.',
    'Remotes: git@github.com:acme/widgets.git, ssh://git@github.com/acme/widgets.git, https://github.com/acme/widgets.git.',
    'Package @anthropic-ai/sdk@1.2.3, token cost: moderate.',
  ].join('\n');
  const out = runWith(body, 'add', 'An item');
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.calls.length, 1);
});

for (const [name, config] of [
  ['no loop config', null],
  ['no roadmap section', loopConfig('')],
  ['the local-file backend', loopConfig('## Roadmap\n\nRead and write this repo\'s roadmap through `/roadmap`.\n\n- Backend: local file\n')],
] as const) {
  test(`tracker commands refuse in one line on ${name}`, () => {
    const { run } = sandbox(config);
    for (const command of ['list', 'labels', 'search', 'add']) {
      const out = run(command);
      assert.notEqual(out.status, 0);
      oneLine(out.stderr);
      assert.match(out.stderr, /\.scratch\/ROADMAP\.md/);
      assert.deepEqual(out.calls, []);
    }
  });
}

for (const [name, section] of [
  ['an unknown backend', '- Backend: Jira\n'],
  ['a GitHub backend with no tracker', '- Backend: GitHub issues\n'],
  ['a malformed tracker', '- Backend: GitHub issues\n- Tracker: `widgets`\n'],
] as const) {
  test(`a roadmap section with ${name} faults in one line`, () => {
    const { run } = sandbox(loopConfig(`## Roadmap\n\nRead and write this repo's roadmap through \`/roadmap\`.\n\n${section}`));
    const out = run('list');
    assert.notEqual(out.status, 0);
    oneLine(out.stderr);
    assert.match(out.stderr, /cantrips-loop\.md/);
    assert.deepEqual(out.calls, []);
  });
}

test('a failed gh call ends in one line carrying gh\'s error and a non-zero exit', () => {
  const { run } = sandbox(GITHUB, { fail: 'HTTP 404: Not Found\n(https://api.github.com/graphql)' });
  const out = run('list');
  assert.notEqual(out.status, 0);
  oneLine(out.stderr);
  assert.match(out.stderr, /HTTP 404: Not Found/);
  assert.doesNotMatch(out.stderr, /sandbox/);
});

test('a gh call refused by the environment names a sandbox as the likely cause', () => {
  const { run } = sandbox(GITHUB, { fail: 'error connecting to api.github.com\ncheck your internet connection' });
  const out = run('list');
  assert.notEqual(out.status, 0);
  oneLine(out.stderr);
  assert.match(out.stderr, /error connecting to api\.github\.com/);
  assert.match(out.stderr, /sandbox/);
});

test('an unknown command faults in one line', () => {
  const out = sandbox(GITHUB).run('frobnicate');
  assert.notEqual(out.status, 0);
  oneLine(out.stderr);
  assert.match(out.stderr, /--help/);
});
