// CLI tests for roadmap.ts, through the command line the agent calls. Run: mise run test.
// Each test runs the script in a fresh folder with a stand-in `gh` first on PATH: it records every call it
// receives and replays the answers the test gives it, applying `--limit` the way the real one does.

import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const SCRIPT = fileURLToPath(new URL('./roadmap.ts', import.meta.url));

// The stand-in: answers `issue list` and `label list` from the canned state, applies `--state` (default open),
// `--search` (every word in the title) and `--limit` (default 30), answers `issue view` with the item's canned
// comments, records `issue create`, `issue comment` and `label create`, and fails every call with the canned error
// where one is set.
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
} else if (group === 'issue' && verb === 'view') {
  process.stdout.write(JSON.stringify({ comments: (state.comments[args[2]] ?? []).map((body) => ({ body })) }));
} else if (group === 'issue' && verb === 'comment') {
  process.stdout.write('https://github.com/' + flag('--repo') + '/issues/' + args[2] + '#issuecomment-7\\n');
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

const SESSION = '0f3c2a9e-1b2d-4c5e-8f9a-0b1c2d3e4f5a';

function sandbox(config: string | null, state: { issues?: unknown[]; labels?: string[]; comments?: Record<string, string[]>; fail?: string } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-test-'));
  const bin = path.join(tmp, 'bin');
  const repo = path.join(tmp, 'repo');
  fs.mkdirSync(bin);
  fs.mkdirSync(repo);
  fs.writeFileSync(path.join(bin, 'gh'), `#!${process.execPath}\n${FAKE_GH}`, { mode: 0o755 });
  const log = path.join(tmp, 'calls.jsonl');
  fs.writeFileSync(log, '');
  const stateFile = path.join(tmp, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ issues: [], labels: [], comments: {}, ...state }));
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
  return { run, runWith, start, repo };
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
  for (const command of ['park', 'claim', 'hit', 'drop']) assert.match(out.stdout, new RegExp(`\\b${command}\\b`));
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
    for (const command of ['list', 'labels', 'search', 'add', 'park', 'claim', 'hit', 'drop']) {
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

// A git repo at the sandbox's folder, ignoring what the given .gitignore says.
function gitInit(repo: string, gitignore: string) {
  assert.equal(spawnSync('git', ['init', '-q', repo]).status, 0);
  fs.writeFileSync(path.join(repo, '.gitignore'), gitignore);
}

// The panel's own reading of a feature file, from mod/core/feature.ts.
const FEATURE_FILE = (name: string) => name === 'spec.md' || /^(\d{2,})-.+\.md$/.test(name);

test('park writes one standalone file per candidate into the inbox, and makes no gh call', () => {
  const { runWith, repo } = sandbox(GITHUB);
  gitInit(repo, '.scratch/\n');
  const body = 'The panel lists no roadmap inbox.\n\nEvidence: 3 candidates sat unseen in .scratch/roadmap-inbox/.\n';
  const out = runWith(body, 'park', '42 panel shows the inbox', '--label', 'priority: medium', '--label', 'area: mod');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(out.calls, []);
  oneLine(out.stdout);
  const inbox = path.join(repo, '.scratch/roadmap-inbox');
  const [name, ...others] = fs.readdirSync(inbox);
  assert.deepEqual(others, []);
  assert.ok(!FEATURE_FILE(name), name);
  assert.match(out.stdout, new RegExp(name));
  assert.equal(
    fs.readFileSync(path.join(inbox, name), 'utf8'),
    '# 42 panel shows the inbox\n\nThe panel lists no roadmap inbox.\n\nEvidence: 3 candidates sat unseen in .scratch/roadmap-inbox/.\n\n' +
      'Labels: `priority: medium`, `area: mod`\nSession: 0f3c2a9e-1b2d-4c5e-8f9a-0b1c2d3e4f5a\n',
  );

  assert.equal(runWith('Same title, another candidate.', 'park', '42 panel shows the inbox').status, 0);
  assert.equal(fs.readdirSync(inbox).length, 2);
});

test('park refuses in one line where git does not report the inbox ignored, and with no body', () => {
  for (const setup of [(repo: string) => gitInit(repo, 'node_modules/\n'), () => {}]) {
    const { runWith, repo } = sandbox(GITHUB);
    setup(repo);
    const out = runWith('A body.', 'park', 'An item');
    assert.notEqual(out.status, 0);
    oneLine(out.stderr);
    assert.match(out.stderr, /roadmap-inbox/);
    assert.ok(!fs.existsSync(path.join(repo, '.scratch')));
  }
  const { runWith, repo } = sandbox(GITHUB);
  gitInit(repo, '.scratch/\n');
  const empty = runWith(' \n', 'park', 'An item');
  assert.notEqual(empty.status, 0);
  oneLine(empty.stderr);
  assert.ok(!fs.existsSync(path.join(repo, '.scratch/roadmap-inbox')));
});

const INBOX = '.scratch/roadmap-inbox';
const CLAIMED = `${INBOX}/claimed`;

// A git repo with an ignored .scratch/, the candidates given parked in its inbox, and the mark set where asked.
function drainable(state: Parameters<typeof sandbox>[1] = {}, { candidates = ['panel shows the inbox'], mark = true } = {}) {
  const box = sandbox(GITHUB, state);
  gitInit(box.repo, '.scratch/\n');
  if (mark) assert.equal(spawnSync('git', ['-C', box.repo, 'config', 'cantrips.roadmapWrites', 'true']).status, 0);
  fs.mkdirSync(path.join(box.repo, INBOX), { recursive: true });
  for (const [i, title] of candidates.entries()) {
    fs.writeFileSync(path.join(box.repo, INBOX, `candidate-${i}.md`), `# ${title}\n\nWhat was met.\n\nLabels: none\nSession: earlier\n`);
  }
  const claimed = () => (fs.existsSync(path.join(box.repo, CLAIMED)) ? fs.readdirSync(path.join(box.repo, CLAIMED)) : []);
  const claimOne = () => {
    const out = box.run('claim');
    assert.equal(out.status, 0, out.stderr);
    return path.join(CLAIMED, claimed()[0]);
  };
  return { ...box, claimed, claimOne };
}

test('claim returns each candidate with its text and the items a search on its title finds, open and closed', () => {
  const issues = [issue(1, 'Panel shows the inbox'), { ...issue(2, 'The panel shows the inbox count'), state: 'CLOSED', stateReason: 'NOT_PLANNED' }];
  const { run, claimed, repo } = drainable({ issues });
  const out = run('claim');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(fs.readdirSync(path.join(repo, INBOX)), ['claimed']);
  const [name] = claimed();
  assert.match(name, new RegExp(`^candidate-0\\.${SESSION}\\.\\d+\\.md$`));
  assert.equal(
    out.stdout,
    `== ${CLAIMED}/${name}\n# panel shows the inbox\n\nWhat was met.\n\nLabels: none\nSession: earlier\n-- search: panel shows the inbox\n` +
      '#1 Panel shows the inbox\n#2 The panel shows the inbox count (closed as not planned)\n',
  );
  const [call] = out.calls;
  assert.equal(call[call.indexOf('--state') + 1], 'all');
});

test('an empty inbox claims nothing in one line and creates no folder', () => {
  const { run, repo } = sandbox(GITHUB);
  const out = run('claim');
  assert.equal(out.status, 0, out.stderr);
  oneLine(out.stdout);
  assert.deepEqual(out.calls, []);
  assert.ok(!fs.existsSync(path.join(repo, '.scratch')));
});

test('of two drains run at once, exactly one holds each candidate', async () => {
  const titles = Array.from({ length: 40 }, (_, i) => `candidate ${i}`);
  const { start, claimed } = drainable({}, { candidates: titles });
  const [a, b] = await Promise.all([start('session-a', 'claim'), start('session-b', 'claim')]);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  const held = (out: Run) => [...out.stdout.matchAll(/^# (.*)$/gm)].map((m) => m[1]);
  const all = [...held(a), ...held(b)];
  assert.deepEqual([...all].sort(), [...titles].sort());
  assert.equal(claimed().length, 40);
});

test('claim takes up another session\'s claim older than a day, leaves a fresh one, and returns its own at any age', () => {
  const { run, claimed, repo } = drainable({}, { candidates: [] });
  const dir = path.join(repo, CLAIMED);
  fs.mkdirSync(dir, { recursive: true });
  const old = Date.now() - 25 * 60 * 60 * 1000;
  const write = (name: string, title: string) => fs.writeFileSync(path.join(dir, name), `# ${title}\n\nBody.\n`);
  write(`candidate-stale.other.${old}.md`, 'stale other');
  write(`candidate-fresh.other.${Date.now()}.md`, 'fresh other');
  write(`candidate-mine.${SESSION}.${old - 1000}.md`, 'mine');
  const out = run('claim');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual([...out.stdout.matchAll(/^# (.*)$/gm)].map((m) => m[1]).sort(), ['mine', 'stale other']);
  const names = claimed();
  assert.ok(names.some((n) => n.startsWith('candidate-fresh.other.')));
  assert.ok(names.some((n) => new RegExp(`^candidate-stale\\.${SESSION}\\.`).test(n)));
  assert.ok(!names.some((n) => n.startsWith('candidate-stale.other.')));
});

test('hit comments the running count, the date, the evidence and the session, and settles its candidate', () => {
  const { runWith, claimOne, claimed } = drainable({ comments: { '7': ['Hit 2 · 2026-01-02\nOld.\nSession: x', 'A human remark.'] } });
  const candidate = claimOne();
  const out = runWith('Met again in\nthe drain.\n', 'hit', '7', '--candidate', candidate);
  assert.equal(out.status, 0, out.stderr);
  oneLine(out.stdout);
  const call = out.calls.find((c) => c[1] === 'comment')!;
  assert.equal(call[2], '7');
  assert.equal(call[call.indexOf('--repo') + 1], 'acme/widgets');
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(call[call.indexOf('--body') + 1], `Hit 3 · ${today}\nMet again in the drain.\nSession: ${SESSION}\n`);
  assert.deepEqual(claimed(), []);

  const first = drainable().runWith('Evidence.', 'hit', '9');
  assert.equal(first.status, 0, first.stderr);
  const comment = first.calls.find((c) => c[1] === 'comment')!;
  assert.match(comment[comment.indexOf('--body') + 1], /^Hit 1 · /);
});

test('without the clone\'s mark, a hit is returned as a proposal and posts only once approved', () => {
  const { runWith, claimOne, claimed } = drainable({}, { mark: false });
  const candidate = claimOne();
  const out = runWith('Evidence.', 'hit', '7', '--candidate', candidate);
  assert.equal(out.status, 0, out.stderr);
  oneLine(out.stdout);
  assert.match(out.stdout, /not posted/);
  assert.equal(out.calls.filter((c) => c[1] === 'view' || c[1] === 'comment').length, 0);
  assert.equal(claimed().length, 1);

  const approved = runWith('Evidence.', 'hit', '7', '--candidate', candidate, '--approved');
  assert.equal(approved.status, 0, approved.stderr);
  assert.equal(approved.calls.filter((c) => c[1] === 'comment').length, 1);
  assert.deepEqual(claimed(), []);
});

test('a hit whose evidence looks like a secret is not posted, and its candidate stays claimed', () => {
  const { runWith, claimOne, claimed } = drainable();
  const candidate = claimOne();
  const out = runWith('Reported by jane.doe@example.com', 'hit', '7', '--candidate', candidate);
  assert.notEqual(out.status, 0);
  oneLine(out.stderr);
  assert.match(out.stderr, /not published/);
  assert.equal(out.calls.filter((c) => c[1] === 'comment').length, 0);
  assert.equal(claimed().length, 1);
});

test('add with a candidate creates the item and settles it; drop settles one writing nothing', () => {
  const { runWith, run, claimOne, claimed } = drainable({}, { candidates: ['one', 'two'] });
  const candidate = claimOne();
  const out = runWith('Body.', 'add', 'One', '--label', 'priority: low', '--candidate', candidate);
  assert.equal(out.status, 0, out.stderr);
  const create = out.calls.find((c) => c[1] === 'create')!;
  assert.deepEqual(flagValues(create, '--label'), ['roadmap', 'priority: low']);
  assert.equal(claimed().length, 1);

  const before = out.calls.length;
  const dropped = run('drop', path.join(CLAIMED, claimed()[0]));
  assert.equal(dropped.status, 0, dropped.stderr);
  oneLine(dropped.stdout);
  assert.equal(dropped.calls.length, before);
  assert.deepEqual(claimed(), []);
});

test('a failed write leaves the candidate claimed', () => {
  const box = drainable();
  const candidate = box.claimOne();
  const stateFile = path.join(path.dirname(box.repo), 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ issues: [], labels: [], comments: {}, fail: 'HTTP 502' }));
  for (const args of [['add', 'One'], ['hit', '7']]) {
    const out = box.runWith('Body.', ...args, '--candidate', candidate);
    assert.notEqual(out.status, 0);
    oneLine(out.stderr);
  }
  assert.equal(box.claimed().length, 1);
});

test('settling a claim another drain took up refuses in one line and writes nothing', () => {
  const { runWith, claimOne, claimed, repo } = drainable();
  const candidate = claimOne();
  // Another drain took it up: the file now carries that session's name.
  const name = path.basename(candidate).replace(SESSION, 'other');
  fs.renameSync(path.join(repo, candidate), path.join(repo, CLAIMED, name));
  for (const args of [['drop', candidate], ['drop', path.join(CLAIMED, name)], ['add', 'One', '--candidate', candidate], ['hit', '7', '--candidate', candidate]]) {
    const out = runWith('Body.', ...args);
    assert.notEqual(out.status, 0);
    oneLine(out.stderr);
    assert.match(out.stderr, /another drain/);
    assert.equal(out.calls.length, 1, 'only the claim\'s search');
  }
  assert.equal(claimed().length, 1);
});

test('claim given files takes only those of the new candidates', () => {
  const { run, claimed, repo } = drainable({}, { candidates: ['one', 'two', 'three'] });
  const out = run('claim', path.join(INBOX, 'candidate-0.md'), path.join(repo, INBOX, 'candidate-2.md'));
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual([...out.stdout.matchAll(/^# (.*)$/gm)].map((m) => m[1]), ['one', 'three']);
  assert.equal(claimed().length, 2);
  assert.ok(fs.existsSync(path.join(repo, INBOX, 'candidate-1.md')));
});
