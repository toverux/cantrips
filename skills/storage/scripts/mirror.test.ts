// CLI tests for mirror.ts, through the command line the agent calls, in the sandbox of sandbox.ts. Run: mise run test.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flagValues, gitInit, GITHUB, issue, oneLine, sandboxFor } from './sandbox.ts';

const sandbox = sandboxFor(fileURLToPath(new URL('./mirror.ts', import.meta.url)));
// The Stop hook's entry, which gates on node's version before loading mirror.ts.
const hookSandbox = sandboxFor(fileURLToPath(new URL('./hook.mjs', import.meta.url)));

// A feature folder in a marked clone, its files as given; the sync reads no loop config.
function mirrorable(files: Record<string, string>, { mark = true, state = {} as Parameters<typeof sandbox>[1], config = null as string | null, hook = false } = {}) {
  const box = (hook ? hookSandbox : sandbox)(config, state);
  gitInit(box.repo, '.scratch/\n');
  if (mark) assert.equal(spawnSync('git', ['-C', box.repo, 'config', 'cantrips.trackerWrites', 'true']).status, 0);
  const folder = path.join(box.repo, '.scratch/first-sync');
  fs.mkdirSync(folder, { recursive: true });
  const write = (name: string, text: string) => fs.writeFileSync(path.join(folder, name), text);
  for (const [name, text] of Object.entries(files)) write(name, text);
  const sync = (...args: string[]) => box.run('sync', '.scratch/first-sync', ...args);
  return { ...box, folder, write, sync };
}

const SPEC = '# A first sync\n\n## Problem Statement\n\nWhy.\n\n## Comments\n\n- 2026-11-16: a note.\n';
const TICKET_1 = '# 01: Publish the spec\n\n**Blocked by:** None.\n\n- [ ] It works.\n';
const TICKET_2 = '# 02: Publish the tickets\n\n**Blocked by:** 01\n\n- [ ] It works.\n';

function creates(calls: string[][]) {
  return calls.filter((c) => c[0] === 'issue' && c[1] === 'create');
}

test('a first sync creates the spec\'s issue, then each ticket as its sub-issue in number order, with their labels', () => {
  const { sync } = mirrorable({ '02-tickets.md': TICKET_2, 'spec.md': SPEC, '01-spec.md': TICKET_1 });
  const out = sync('--tracker', 'acme/widgets');
  assert.equal(out.status, 0, out.stderr);
  const made = creates(out.calls);
  assert.deepEqual(made.map((c) => [flagValues(c, '--repo')[0], flagValues(c, '--title')[0], flagValues(c, '--label'), flagValues(c, '--parent')]), [
    ['acme/widgets', '[first-sync] A first sync', ['spec'], []],
    ['acme/widgets', '[first-sync] ticket 01: Publish the spec', ['ticket'], ['101']],
    ['acme/widgets', '[first-sync] ticket 02: Publish the tickets', ['ticket'], ['101']],
  ]);
  assert.equal(flagValues(made[0], '--body')[0], '# A first sync\n\n## Problem Statement\n\nWhy.\n\n');
  assert.equal(flagValues(made[2], '--body')[0], TICKET_2);
});

test('a first sync with no tracker passed, the catch-all form, publishes nothing and says so in one line', () => {
  const { sync, folder } = mirrorable({ 'spec.md': SPEC });
  const out = sync();
  assert.equal(out.status, 0, out.stderr);
  oneLine(out.stdout);
  assert.match(out.stdout, /not mirrored yet/);
  assert.deepEqual(out.calls, []);
  assert.ok(!fs.existsSync(path.join(folder, 'mirror.json')));
});

test('a spec with no title line is titled with the feature\'s name alone', () => {
  const { sync } = mirrorable({ 'spec.md': '## Problem Statement\n\nWhy.\n' });
  const out = sync('--tracker', 'acme/widgets');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(creates(out.calls).map((c) => flagValues(c, '--title')[0]), ['[first-sync]']);
});

test('a ticket is titled with its file\'s number and its title line\'s name, or its file\'s slug where it has no title line', () => {
  const { sync } = mirrorable({
    'spec.md': SPEC,
    '01-colon.md': '# 01: Named with a colon\n',
    '02-space.md': '# 02 Named with a space\n',
    '03-bare.md': '# Named bare\n',
    '10-no-title.md': 'No title line.\n',
  });
  const out = sync('--tracker', 'acme/widgets');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(creates(out.calls).slice(1).map((c) => flagValues(c, '--title')[0]), [
    '[first-sync] ticket 01: Named with a colon',
    '[first-sync] ticket 02: Named with a space',
    '[first-sync] ticket 03: Named bare',
    '[first-sync] ticket 10: no-title',
  ]);
});

test('a ticket\'s number leaves its title line with the dash after it', () => {
  const { sync } = mirrorable({
    'spec.md': SPEC,
    '01-hyphen.md': '# 01 - Named with a hyphen\n',
    '02-en.md': '# 02 – Named with an en dash\n',
    '03-em.md': '# 03 — Named with an em dash\n',
  });
  const out = sync('--tracker', 'acme/widgets');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(creates(out.calls).slice(1).map((c) => flagValues(c, '--title')[0]), [
    '[first-sync] ticket 01: Named with a hyphen',
    '[first-sync] ticket 02: Named with an en dash',
    '[first-sync] ticket 03: Named with an em dash',
  ]);
});

test('a second sync with nothing changed makes no gh call and leaves the numbers file untouched', () => {
  const { sync, folder } = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1 });
  assert.equal(sync('--tracker', 'acme/widgets').status, 0);
  const numbers = path.join(folder, 'mirror.json');
  const before = fs.statSync(numbers).mtimeMs;
  const calls = sync('--tracker', 'acme/widgets').calls.length;
  const out = sync();
  assert.equal(out.status, 0, out.stderr);
  oneLine(out.stdout);
  assert.equal(out.calls.length, calls);
  assert.equal(fs.statSync(numbers).mtimeMs, before);
});

test('a changed file rewrites its issue\'s body and an unchanged one is left alone', () => {
  const { sync, write } = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1 });
  const first = sync('--tracker', 'acme/widgets').calls.length;
  write('01-spec.md', TICKET_1.replace('[ ]', '[x]'));
  const out = sync();
  assert.equal(out.status, 0, out.stderr);
  const later = out.calls.slice(first);
  assert.deepEqual(later.map((c) => [c[1], c[2], flagValues(c, '--repo')[0], flagValues(c, '--body')[0]]), [
    ['edit', '102', 'acme/widgets', TICKET_1.replace('[ ]', '[x]')],
  ]);
});

test('a blocked-by line sets a relation for every other ticket number it names, and a line opening with none sets none', () => {
  const { sync } = mirrorable({
    'spec.md': SPEC,
    '01-spec.md': TICKET_1.replace('None.', 'None within this feature; see 03'),
    '02-tickets.md': TICKET_2.replace('01', '01 and 03'),
    '03-last.md': '# 03: Last\n\n**Blocked by:** 02, and 03 itself\n',
  });
  const out = sync('--tracker', 'acme/widgets');
  assert.equal(out.status, 0, out.stderr);
  const relations = out.calls.filter((c) => c.includes('--add-blocked-by'));
  assert.deepEqual(relations.map((c) => [c[2], flagValues(c, '--repo')[0], flagValues(c, '--add-blocked-by')[0]]), [
    ['103', 'acme/widgets', '102'],
    ['103', 'acme/widgets', '104'],
    ['104', 'acme/widgets', '103'],
  ]);
  assert.equal(sync().calls.length, out.calls.length);
});

test('a blocker GitHub refuses is reported in one line while the others land, one GitHub already holds is never sent, and the fixed line syncs clean', () => {
  const cycle = 'GraphQL: Validation failed: this dependency would create a cycle where the target is already blocked by the source (addBlockedBy)';
  const state = { blockedBy: { '104': [102] }, failOn: '--add-blocked-by 103', failWith: cycle };
  const { sync, write, folder, setState } = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1, '02-tickets.md': TICKET_1.replace('# 01', '# 02'), '03-last.md': '# 03: Last\n\n**Blocked by:** 01, 02\n' }, { state });
  const out = sync('--tracker', 'acme/widgets');
  assert.equal(out.status, 0, out.stderr);
  oneLine(out.stderr);
  assert.match(out.stderr, /#103 .*03-last\.md.*#104.*cycle/);
  assert.deepEqual(out.calls.filter((c) => c.includes('--add-blocked-by')).map((c) => [c[2], flagValues(c, '--add-blocked-by')[0]]), [['104', '103']]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(folder, 'mirror.json'), 'utf8')).files['03-last.md'].blockedBy, [102]);

  write('03-last.md', '# 03: Last\n\n**Blocked by:** 01\n');
  setState({ blockedBy: { '104': [102] } });
  const fixed = sync();
  assert.equal(fixed.status, 0, fixed.stderr);
  assert.equal(fixed.stderr, '');
  assert.deepEqual(fixed.calls.slice(out.calls.length).map((c) => c.slice(0, 3)), [['issue', 'edit', '104']]);
  assert.match(sync().stdout, /already matches/);
});

test('a blocker set by hand from outside the feature is left alone when the line changes', () => {
  const { sync, write, setState } = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1, '02-tickets.md': TICKET_2 });
  const first = sync('--tracker', 'acme/widgets');
  setState({ blockedBy: { '103': [102, 7] } });
  write('02-tickets.md', TICKET_2.replace('01', 'None.'));
  const out = sync();
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(out.calls.slice(first.calls.length).filter((c) => c.includes('--remove-blocked-by')).map((c) => flagValues(c, '--remove-blocked-by')[0]), ['102']);
});

test('a file holding a secret or an email is skipped and reported in one line until its text changes', () => {
  const leaky = TICKET_1.replace('It works.', 'Ask jane.doe@example.com.');
  const { sync, write } = mirrorable({ 'spec.md': SPEC, '01-spec.md': leaky, '02-tickets.md': TICKET_2 });
  const out = sync('--tracker', 'acme/widgets');
  assert.equal(out.status, 0, out.stderr);
  oneLine(out.stderr);
  assert.match(out.stderr, /01-spec\.md.*an email address/);
  assert.deepEqual(creates(out.calls).map((c) => flagValues(c, '--title')[0]), ['[first-sync] A first sync', '[first-sync] ticket 02: Publish the tickets']);
  assert.ok(!out.calls.some((c) => c.includes('--add-blocked-by')));

  write('01-spec.md', TICKET_1);
  const later = sync().calls.slice(out.calls.length).filter((c) => c[0] === 'issue');
  assert.deepEqual(later.map((c) => [c[1], flagValues(c, '--title')[0] ?? c[2], flagValues(c, '--add-blocked-by')[0]]), [
    ['create', '[first-sync] ticket 01: Publish the spec', undefined],
    ['edit', '102', '103'],
  ]);
});

test('a spec holding a secret is skipped, and its tickets wait for its issue', () => {
  const { sync } = mirrorable({ 'spec.md': SPEC.replace('Why.', 'Why. token = abcd1234efgh'), '01-spec.md': TICKET_1 });
  const out = sync('--tracker', 'acme/widgets');
  assert.equal(out.status, 0, out.stderr);
  oneLine(out.stderr);
  assert.match(out.stderr, /spec\.md.*a secret assignment/);
  assert.deepEqual(out.calls, []);
});

test('in a clone without the mark, sync makes no tracker call and says so in one line', () => {
  const { sync, folder, write } = mirrorable({ 'spec.md': SPEC }, { mark: false });
  const out = sync('--tracker', 'acme/widgets');
  assert.equal(out.status, 0, out.stderr);
  oneLine(out.stdout);
  assert.match(out.stdout, /cantrips\.trackerWrites/);
  assert.deepEqual(out.calls, []);
  assert.ok(!fs.existsSync(path.join(folder, 'mirror.json')));

  write('01-spec.md', '# 01: Done\n\nStatus: resolved\n');
  write('mirror.json', JSON.stringify({ tracker: 'acme/widgets', files: { 'spec.md': { issue: 101, pushed: '' } } }));
  const mirrored = sync();
  assert.match(mirrored.stdout, /cantrips\.trackerWrites/);
});

test('a sync failed after some creations ends in one line, and the next run completes it creating nothing twice', () => {
  const { sync, setState, folder } = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1, '02-tickets.md': TICKET_2 }, { state: { failOn: '02: Publish' } });
  const out = sync('--tracker', 'acme/widgets');
  assert.notEqual(out.status, 0);
  oneLine(out.stderr);
  assert.match(out.stderr, /HTTP 502/);
  const numbers = JSON.parse(fs.readFileSync(path.join(folder, 'mirror.json'), 'utf8'));
  assert.deepEqual(Object.fromEntries(Object.entries(numbers.files).map(([name, file]) => [name, (file as { issue: number }).issue])), { 'spec.md': 101, '01-spec.md': 102 });

  setState({});
  const again = sync();
  assert.equal(again.status, 0, again.stderr);
  const later = again.calls.slice(out.calls.length).filter((c) => c[0] === 'issue');
  assert.deepEqual(later.map((c) => [c[1], flagValues(c, '--title')[0] ?? c[2], flagValues(c, '--parent')[0] ?? flagValues(c, '--add-blocked-by')[0]]), [
    ['create', '[first-sync] ticket 02: Publish the tickets', '101'],
    ['edit', '104', '102'],
  ]);
});

test('a sync of a folder with no spec ends in one line and a non-zero exit', () => {
  const { sync } = mirrorable({ '01-spec.md': TICKET_1 });
  const out = sync('--tracker', 'acme/widgets');
  assert.notEqual(out.status, 0);
  oneLine(out.stderr);
  assert.match(out.stderr, /cannot read .*spec\.md/);
  assert.deepEqual(out.calls, []);
});

test('each annotation, a bullet, a heading or a paragraph opening on its date, is posted once as a dated comment across repeated syncs, on a closed issue too', () => {
  const { sync, write, folder } = mirrorable({ 'spec.md': SPEC }, { state: { issues: [{ ...issue(101, 'first-sync'), state: 'CLOSED' }] } });
  const first = sync('--tracker', 'acme/widgets');
  assert.equal(first.status, 0, first.stderr);
  write('spec.md', `${SPEC}- 2026-11-17: a second note,\n  on two lines.\n### 2026-11-18 — a dated heading\n\nIts text.\n2026-11-19: a dated paragraph.\n`);
  const out = sync();
  assert.equal(out.status, 0, out.stderr);
  assert.equal(sync().calls.length, out.calls.length);
  const comments = out.calls.filter((c) => c[1] === 'comment');
  assert.deepEqual(comments.map((c) => [c[2], flagValues(c, '--repo')[0], flagValues(c, '--body')[0]]), [
    ['101', 'acme/widgets', '2026-11-16: a note.\n'],
    ['101', 'acme/widgets', '2026-11-17: a second note,\n  on two lines.\n'],
    ['101', 'acme/widgets', '2026-11-18 — a dated heading\n\nIts text.\n'],
    ['101', 'acme/widgets', '2026-11-19: a dated paragraph.\n'],
  ]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(folder, 'mirror.json'), 'utf8')).annotations, 4);
});

test('a ticket marked resolved has its issue closed as completed, and one no longer resolved reopened', () => {
  const resolved = TICKET_1.replace('\n\n', '\n\nStatus: resolved\n\n').replace('[ ]', '[x]');
  const { sync, write } = mirrorable({ 'spec.md': SPEC, '01-spec.md': resolved });
  const first = sync('--tracker', 'acme/widgets');
  assert.equal(first.status, 0, first.stderr);
  const states = (calls: string[][]) => calls.filter((c) => ['close', 'reopen'].includes(c[1])).map((c) => [c[1], c[2], flagValues(c, '--repo')[0], flagValues(c, '--reason')[0]]);
  assert.deepEqual(states(first.calls), [['close', '102', 'acme/widgets', 'completed'], ['close', '101', 'acme/widgets', 'completed']]);
  assert.equal(sync().calls.length, first.calls.length);

  write('01-spec.md', TICKET_1);
  const out = sync();
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(states(out.calls.slice(first.calls.length)), [['reopen', '102', 'acme/widgets', undefined], ['reopen', '101', 'acme/widgets', undefined]]);
});

test('an issue whose ticket file no longer exists is closed as not planned with a one-line comment', () => {
  const { sync, folder } = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1, '02-tickets.md': TICKET_2 });
  const first = sync('--tracker', 'acme/widgets');
  assert.equal(first.status, 0, first.stderr);
  fs.renameSync(path.join(folder, '02-tickets.md'), path.join(folder, '03-tickets.md'));
  const out = sync();
  assert.equal(out.status, 0, out.stderr);
  const closes = out.calls.slice(first.calls.length).filter((c) => c[1] === 'close');
  assert.deepEqual(closes.map((c) => [c[2], flagValues(c, '--repo')[0], flagValues(c, '--reason')[0]]), [['103', 'acme/widgets', 'not planned']]);
  oneLine(flagValues(closes[0], '--comment')[0]);
  const again = sync();
  assert.equal(again.calls.filter((c) => c[1] === 'close').length, 1);
  assert.ok(!('02-tickets.md' in JSON.parse(fs.readFileSync(path.join(folder, 'mirror.json'), 'utf8')).files));
});

test('a blocker the "Blocked by" line stops naming has its relation removed', () => {
  const { sync, write } = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1, '02-tickets.md': TICKET_2, '03-last.md': '# 03: Last\n\n**Blocked by:** 01, 02\n' });
  const first = sync('--tracker', 'acme/widgets');
  assert.equal(first.status, 0, first.stderr);
  write('03-last.md', '# 03: Last\n\n**Blocked by:** 01\n');
  const out = sync();
  assert.equal(out.status, 0, out.stderr);
  const relations = out.calls.slice(first.calls.length).filter((c) => c.includes('--remove-blocked-by'));
  assert.deepEqual(relations.map((c) => [c[2], flagValues(c, '--repo')[0], flagValues(c, '--remove-blocked-by')[0]]), [['104', 'acme/widgets', '103']]);
  assert.equal(sync().calls.length, out.calls.length);
});

test('a body over GitHub\'s limit continues in comments cut at a heading, edited in place by later syncs', () => {
  const long = (b: string) => `# Long\n\n## Part A\n\n${'a'.repeat(40000)}\n\n## Part B\n\n${b.repeat(40000)}\n`;
  const { sync, write } = mirrorable({ 'spec.md': long('b') });
  const first = sync('--tracker', 'acme/widgets');
  assert.equal(first.status, 0, first.stderr);
  assert.equal(flagValues(creates(first.calls)[0], '--body')[0], `# Long\n\n## Part A\n\n${'a'.repeat(40000)}\n\n`);
  const posted = first.calls.filter((c) => c[1] === 'comment');
  assert.deepEqual(posted.map((c) => [c[2], flagValues(c, '--body')[0]]), [['101', `## Part B\n\n${'b'.repeat(40000)}\n`]]);

  write('spec.md', long('c'));
  const edited = sync();
  assert.equal(edited.status, 0, edited.stderr);
  const api = (calls: string[][]) => calls.filter((c) => c[0] === 'api').map((c) => [c[2], c[3], c[5]]);
  assert.deepEqual(api(edited.calls.slice(first.calls.length)), [['PATCH', 'repos/acme/widgets/issues/comments/901', `body=## Part B\n\n${'c'.repeat(40000)}\n`]]);
  assert.equal(edited.calls.filter((c) => c[1] === 'comment').length, 1);

  write('spec.md', '# Long\n\nShort now.\n');
  const shrunk = sync();
  assert.equal(shrunk.status, 0, shrunk.stderr);
  assert.deepEqual(api(shrunk.calls.slice(edited.calls.length)), [['DELETE', 'repos/acme/widgets/issues/comments/901', undefined]]);
  assert.equal(sync().calls.length, shrunk.calls.length);
});

test('a first sync through a linked folder refuses in one line, naming the repo holding the real folder', () => {
  const { sync, repo, folder } = mirrorable({});
  const home = path.join(path.dirname(repo), 'home');
  fs.mkdirSync(path.join(home, '.scratch/shared'), { recursive: true });
  assert.equal(spawnSync('git', ['init', '-q', home]).status, 0);
  fs.writeFileSync(path.join(home, '.scratch/shared/spec.md'), SPEC);
  fs.rmdirSync(folder);
  fs.symlinkSync(path.join(home, '.scratch/shared'), folder);
  const out = sync('--tracker', 'acme/widgets');
  assert.notEqual(out.status, 0);
  oneLine(out.stderr);
  assert.ok(out.stderr.includes(home), out.stderr);
  assert.deepEqual(out.calls, []);
  assert.ok(!fs.existsSync(path.join(home, '.scratch/shared/mirror.json')));
});

test('a folder carrying the strike marker is never synced, whenever the marker was added', () => {
  const { sync } = mirrorable({ 'spec.md': SPEC, 'no-mirror': '' });
  for (const args of [['--tracker', 'acme/widgets'], []]) {
    const struck = sync(...args);
    assert.equal(struck.status, 0, struck.stderr);
    assert.equal(struck.stdout + struck.stderr, '');
    assert.deepEqual(struck.calls, []);
  }

  const other = mirrorable({ 'spec.md': SPEC });
  const first = other.sync('--tracker', 'acme/widgets');
  other.write('no-mirror', '');
  other.write('spec.md', `${SPEC}- 2026-11-17: later.\n`);
  const later = other.sync();
  assert.equal(later.status, 0, later.stderr);
  assert.equal(later.calls.length, first.calls.length);
});

const RESOLVED_1 = TICKET_1.replace('\n\n', '\n\nStatus: resolved\n\n');
const RESOLVED_2 = TICKET_2.replace('\n\n', '\n\nStatus: resolved\n\n');

test('the spec\'s issue closes once every ticket is resolved, and reopens when a ticket is added or no longer resolved', () => {
  const box = mirrorable({ 'spec.md': SPEC, '01-spec.md': RESOLVED_1, '02-tickets.md': TICKET_2 });
  const specStates = (calls: string[][]) => calls.filter((c) => c[2] === '101' && ['close', 'reopen'].includes(c[1])).map((c) => [c[1], flagValues(c, '--reason')[0]]);
  const first = box.sync('--tracker', 'acme/widgets');
  assert.deepEqual(specStates(first.calls), []);
  box.write('02-tickets.md', RESOLVED_2);
  const done = box.sync();
  assert.equal(done.status, 0, done.stderr);
  assert.deepEqual(specStates(done.calls.slice(first.calls.length)), [['close', 'completed']]);
  assert.equal(box.sync().calls.length, done.calls.length);
  box.write('03-more.md', '# 03: More\n');
  const added = box.sync();
  assert.deepEqual(specStates(added.calls.slice(done.calls.length)), [['reopen', undefined]]);
  box.write('03-more.md', '# 03: More\n\nStatus: resolved\n');
  const again = box.sync();
  box.write('01-spec.md', TICKET_1);
  const undone = box.sync();
  assert.deepEqual(specStates(undone.calls.slice(again.calls.length)), [['reopen', undefined]]);
});

test('a spec with no ticket never closes on its tickets\' rule', () => {
  const box = mirrorable({ 'spec.md': SPEC });
  const out = box.sync('--tracker', 'acme/widgets');
  assert.equal(out.status, 0, out.stderr);
  assert.ok(!out.calls.some((c) => c[1] === 'close'));
});

// A mirrored feature whose spec lists #7 on its `Roadmap items:` line, first synced with its tickets as given.
function mirrored(tickets: Record<string, string>) {
  const box = mirrorable({ 'spec.md': SPEC.replace('Why.', 'Why.\n\n**Roadmap items:** #7'), ...tickets }, { config: GITHUB });
  assert.equal(box.sync('--tracker', 'acme/widgets').status, 0);
  const close = (...args: string[]) => {
    const before = box.calls().length;
    const out = box.run('close', '.scratch/first-sync', ...args);
    return { ...out, calls: out.calls.slice(before) };
  };
  return { ...box, close };
}

const closes = (calls: string[][]) => calls.filter((c) => c[1] === 'close').map((c) => [c[2], flagValues(c, '--reason')[0]]);

test('close needs no word and closes nothing more for a feature whose tickets are all resolved, its sync having closed every issue', () => {
  const { close } = mirrored({ '01-spec.md': RESOLVED_1, '02-tickets.md': RESOLVED_2 });
  const out = close();
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(closes(out.calls), []);
  assert.match(out.stdout, /no mirrored issue open/);
});

test('close names /roadmap\'s close as the next step only where the spec lists roadmap items', () => {
  const listed = mirrored({ '01-spec.md': RESOLVED_1 }).close();
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(listed.stdout.trimEnd().split('\n').at(-1), 'the spec lists roadmap items: close the feature through /roadmap too, before deleting its folder');
  const box = mirrorable({ 'spec.md': SPEC, '01-spec.md': RESOLVED_1 });
  box.sync('--tracker', 'acme/widgets');
  const unlisted = box.run('close', '.scratch/first-sync');
  assert.equal(unlisted.status, 0, unlisted.stderr);
  assert.doesNotMatch(unlisted.stdout, /roadmap/);
});

test('close says --not-planned or --done for a feature whose tickets are not all resolved', () => {
  const { close } = mirrored({ '01-spec.md': RESOLVED_1, '02-tickets.md': TICKET_2 });
  assert.deepEqual(closes(close('--not-planned').calls), [['101', 'not planned'], ['103', 'not planned']]);
  assert.deepEqual(closes(close('--done').calls), [['101', 'completed'], ['103', 'completed']]);
});

test('without a word, close refuses in one line and changes nothing for unresolved tickets or none', () => {
  for (const tickets of [{ '01-spec.md': TICKET_1 }, {}]) {
    const out = mirrored(tickets).close();
    assert.notEqual(out.status, 0);
    oneLine(out.stderr);
    assert.match(out.stderr, /--not-planned/);
    assert.deepEqual(out.calls, []);
  }
});

test('close closes the mirrored issues and touches no roadmap item, whatever the config says of the roadmap', () => {
  const out = mirrored({ '01-spec.md': TICKET_1 }).close('--done');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(out.calls.map((c) => c.slice(0, 3)), [['issue', 'close', '101'], ['issue', 'close', '102']]);
});

test('without the clone\'s mark, close of a mirrored feature makes no tracker call and says so in one line', () => {
  const box = mirrored({ '01-spec.md': TICKET_1 });
  spawnSync('git', ['-C', box.repo, 'config', '--unset', 'cantrips.trackerWrites']);
  const out = box.close('--done');
  assert.equal(out.status, 0, out.stderr);
  oneLine(out.stdout);
  assert.deepEqual(out.calls, []);
});

test('close is right after a skipped sync: a dropped ticket closes as not planned with its comment, a resolved one as completed', () => {
  const box = mirrored({ '01-spec.md': TICKET_1, '02-tickets.md': TICKET_2, '03-more.md': TICKET_2.replace('# 02', '# 03') });
  fs.rmSync(path.join(box.folder, '03-more.md'));
  box.write('01-spec.md', RESOLVED_1);
  const out = box.close('--not-planned');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(closes(out.calls), [['102', 'completed'], ['104', 'not planned'], ['101', 'not planned'], ['103', 'not planned']]);
  assert.match(flagValues(out.calls.find((c) => c[2] === '104')!, '--comment')[0], /dropped or renumbered/);
});

test('the dry run lists each title it would publish with its flags, and publishes nothing', () => {
  const { sync, folder } = mirrorable({
    'spec.md': SPEC.replace('Why.', 'Why, in /home/jane/notes.'),
    '01-spec.md': TICKET_1.replace('It works.', 'Ask jane.doe@example.com, token = abcd1234efgh.'),
    '02-tickets.md': TICKET_2,
  });
  const out = sync('--dry-run');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(out.stdout.trimEnd().split('\n').slice(1), [
    '  [first-sync] A first sync — flagged: a home path',
    '  [first-sync] ticket 01: Publish the spec — flagged: a secret assignment, an email address',
    '  [first-sync] ticket 02: Publish the tickets',
  ]);
  assert.deepEqual(out.calls, []);
  assert.ok(!fs.existsSync(path.join(folder, 'mirror.json')));
});

test('a home path blocks no push', () => {
  const { sync } = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1.replace('It works.', 'Reads /Users/jane/x.') });
  const out = sync('--tracker', 'acme/widgets');
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stderr, '');
  assert.equal(creates(out.calls).length, 2);
});

test('labels creates its set on a tracker that has no label at all', () => {
  const out = sandbox(null, { labels: [] }).run('labels', '--tracker', 'acme/mirror');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(out.calls.filter((c) => c[1] === 'create').map((c) => c[2]), ['spec', 'ticket']);
});

test('labels with a tracker creates the mirror\'s spec and ticket labels there, needing no config, and a second run creates nothing', () => {
  const out = sandbox(null, { labels: ['bug'] }).run('labels', '--tracker', 'acme/mirror');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(out.calls.filter((c) => c[1] === 'create').map((c) => [c[2], flagValues(c, '--repo')[0]]), [['spec', 'acme/mirror'], ['ticket', 'acme/mirror']]);
  const again = sandbox(null, { labels: ['Spec', 'ticket'] }).run('labels', '--tracker', 'acme/mirror');
  assert.equal(again.status, 0, again.stderr);
  assert.deepEqual(again.calls.filter((c) => c[1] === 'create'), []);
});

// The loop config of a repo whose storage section declares the mirror, as setup writes it.
const DECLARED = '# The cantrips loop in this repo\n\n## Storage backend\n\nLocal markdown.\n\n- Mirror: `acme/widgets`\n- Features: `.scratch/`\n\n## Knowledge stores\n\n- `docs/adr/` — **disabled**.\n';

// What the Stop hook prints: nothing, or one line of JSON.
function answer(stdout: string): { systemMessage?: string; decision?: string; reason?: string } | undefined {
  if (!stdout) return undefined;
  oneLine(stdout);
  return JSON.parse(stdout);
}
const message = (stdout: string) => answer(stdout)?.systemMessage;

test('catch-up is silent and calls nothing without the mark, without the declared mirror, or with nothing changed', () => {
  for (const [mark, config] of [[false, DECLARED], [true, null], [true, GITHUB]] as const) {
    const out = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1 }, { mark, config }).run('catch-up');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(out.stdout + out.stderr, '');
    assert.deepEqual(out.calls, []);
  }
  const box = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1 }, { config: DECLARED });
  box.sync('--tracker', 'acme/widgets');
  const before = box.calls().length;
  const out = box.run('catch-up');
  assert.equal(out.stdout + out.stderr, '');
  assert.equal(out.calls.length, before);
});

test('catch-up syncs a changed mirrored folder and says what in one line', () => {
  const box = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1 }, { config: DECLARED });
  box.sync('--tracker', 'acme/widgets');
  box.write('01-spec.md', RESOLVED_1);
  const out = box.run('catch-up');
  assert.equal(out.status, 0, out.stderr);
  assert.equal(message(out.stdout), 'mirror: synced .scratch/first-sync to acme/widgets: 0 created, 3 updated');
});

test('catch-up first-publishes a folder holding a spec and a ticket, and leaves a ticketless spec and a struck folder alone', () => {
  const box = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1 }, { config: DECLARED });
  for (const [name, files] of [['draft', { 'spec.md': SPEC }], ['struck', { 'spec.md': SPEC, '01-a.md': TICKET_1, 'no-mirror': '' }]] as const) {
    fs.mkdirSync(path.join(box.repo, '.scratch', name));
    for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(box.repo, '.scratch', name, file), text);
  }
  const out = box.run('catch-up');
  assert.equal(out.status, 0, out.stderr);
  assert.equal(message(out.stdout), 'mirror: synced .scratch/first-sync to acme/widgets: 2 created, 1 updated');
  assert.deepEqual(creates(out.calls).map((c) => flagValues(c, '--title')[0]), ['[first-sync] A first sync', '[first-sync] ticket 01: Publish the spec']);
});

test('catch-up sends a failed gh call or a flagged file back to the agent in one line, exiting 0', () => {
  const failed = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1 }, { config: DECLARED, state: { fail: 'error connecting to api.github.com' } }).run('catch-up');
  assert.equal(failed.status, 0);
  assert.equal(failed.stderr, '');
  const blocked = answer(failed.stdout)!;
  assert.equal(blocked.decision, 'block');
  assert.match(blocked.reason!, /error connecting.*sandbox.*telling the user/);
  assert.equal(blocked.systemMessage, undefined);

  const leaky = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1.replace('It works.', 'Ask jane.doe@example.com.') }, { config: DECLARED }).run('catch-up');
  assert.equal(leaky.status, 0);
  assert.equal(leaky.stderr, '');
  assert.match(answer(leaky.stdout)!.reason!, /01-spec\.md holds what looks like an email address/);
});

test('on the stop that follows a blocked one, catch-up shows a problem still there to the user and blocks no more', () => {
  const box = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1 }, { config: DECLARED, state: { fail: 'error connecting to api.github.com' } });
  const out = box.runWith(JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: true }), 'catch-up');
  assert.equal(out.status, 0);
  const shown = answer(out.stdout)!;
  assert.equal(shown.decision, undefined);
  assert.match(shown.systemMessage!, /^mirror: .*error connecting/);
});

test('catch-up shows a problem to the user and blocks nothing where it cannot read the hook input', () => {
  const box = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1 }, { config: DECLARED, state: { fail: 'error connecting to api.github.com' } });
  const out = box.runWith('not json', 'catch-up');
  assert.equal(out.status, 0);
  const shown = answer(out.stdout)!;
  assert.equal(shown.decision, undefined);
  assert.match(shown.systemMessage!, /^mirror: .*error connecting/);
});

test('catch-up names a corrupt mirror.json and still syncs the folders beside it', () => {
  const box = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1 }, { config: DECLARED });
  const broken = path.join(box.repo, '.scratch/aaa-broken');
  fs.mkdirSync(broken);
  fs.writeFileSync(path.join(broken, 'spec.md'), SPEC);
  fs.writeFileSync(path.join(broken, 'mirror.json'), '{');
  const out = box.run('catch-up');
  assert.equal(out.status, 0, out.stderr);
  const told = answer(out.stdout)!;
  assert.match(told.systemMessage!, /^mirror: synced \.scratch\/first-sync .*2 created/);
  assert.match(told.reason!, /\.scratch\/aaa-broken\/mirror\.json is not valid JSON/);
});

test('catch-up passes over a run another session holds, and takes up a lock its holder left past expiry', () => {
  const box = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1 }, { config: DECLARED });
  const lock = path.join(box.repo, '.git', 'cantrips-mirror.lock');
  fs.writeFileSync(lock, '');
  const held = box.run('catch-up');
  assert.equal(held.status, 0, held.stderr);
  assert.equal(held.stdout + held.stderr, '');
  assert.deepEqual(held.calls, []);
  const old = new Date(Date.now() - 60 * 60 * 1000);
  fs.utimesSync(lock, old, old);
  assert.match(message(box.run('catch-up').stdout)!, /2 created/);
  assert.ok(!fs.existsSync(lock));
});

test('the hook entry runs catch-up on a node that strips types', () => {
  const out = mirrorable({ 'spec.md': SPEC, '01-spec.md': TICKET_1 }, { config: DECLARED, hook: true }).run('catch-up');
  assert.equal(out.status, 0, out.stderr);
  assert.match(message(out.stdout)!, /2 created/);
});
