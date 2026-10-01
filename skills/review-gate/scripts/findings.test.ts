// CLI tests for findings.ts, through the command line the agent calls. Run: mise run test.
// Each test spawns the current runtime on the script with TMPDIR pointed at a fresh directory.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const SCRIPT = fileURLToPath(new URL('./findings.ts', import.meta.url));
const DELIMITER = '── agent ──';
const HANDOFF =
  'paste: everything above the delimiter into your message, unaltered, then end your turn: the gate resumes you with the next step';

interface Output {
  status: number | null;
  user: string;
  // What the agent reads: the lines below the delimiter, then the step a hand-off delivers at the turn end.
  agent: string;
  shown: string;
  handoff?: string;
}

function sandbox(env: Record<string, string | undefined> = { CLAUDE_CODE_SESSION_ID: 'test-session' }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'findings-test-'));
  const base: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !/^(CLAUDE_CODE_SESSION_ID|CODEX_THREAD_ID|CODEX_SESSION_ID)$/.test(key)) {
      base[key] = value;
    }
  }
  const dir = path.join(tmp, `cantrips-${process.getuid?.() ?? ''}`, 'review-gate');
  const pending = () => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.pending')) : []);
  // A hand-off's step is read as the Stop hook would deliver it; the file stays for the script to collect or drop.
  const call = (command: string, input?: unknown): Output => {
    const run = spawnSync(process.execPath, [SCRIPT, command], {
      input: input === undefined ? '' : typeof input === 'string' ? input : JSON.stringify(input),
      env: { ...base, ...env, TMPDIR: tmp } as Record<string, string>,
      encoding: 'utf8',
    });
    const [user, shown = ''] = run.stdout.split(`${DELIMITER}\n`);
    const out: Output = { status: run.status, user: user.trimEnd(), agent: shown.trimEnd(), shown: shown.trimEnd() };
    const [marker] = pending();
    if (marker && run.status === 0 && !['held', 'ledger', 'resume'].includes(command)) {
      out.handoff = marker.split('.').at(-2);
      out.agent = [out.agent, fs.readFileSync(path.join(dir, marker), 'utf8').trimEnd()].join('\n');
    }
    return out;
  };
  // The Stop hook's call, as the harness makes it: the hook input on stdin, its session in the environment, and
  // a working directory that is not the project's.
  const hook = (kind: string, input: unknown = { session_id: env.CLAUDE_CODE_SESSION_ID, cwd: process.cwd() }) => {
    const session = (input as { session_id?: unknown } | null)?.session_id;
    const run = spawnSync(process.execPath, [SCRIPT, 'resume', kind], {
      input: typeof input === 'string' ? input : JSON.stringify(input),
      env: { ...base, ...(typeof session === 'string' && { CLAUDE_CODE_SESSION_ID: session }), TMPDIR: tmp },
      cwd: tmp,
      encoding: 'utf8',
    });
    return { status: run.status, stdout: run.stdout, stderr: run.stderr };
  };
  return { dir, call, hook, pending, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

function withSandbox(name: string, body: (s: ReturnType<typeof sandbox>) => void, env?: Record<string, string>) {
  test(name, () => {
    const s = sandbox(env);
    try {
      body(s);
    } finally {
      s.cleanup();
    }
  });
}

const worktreeHash = createHash('sha256')
  .update(spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim())
  .digest('hex')
  .slice(0, 12);

function bug(n: number, extra: Record<string, unknown> = {}) {
  return {
    file: `src/f${n}.ts`,
    line: n,
    summary: `bug ${n}`,
    failure_scenario: `input ${n} → wrong output`,
    category: 'correctness',
    verdict: 'confirmed',
    evidence: `\`f${n}.ts:${n}\` reads it`,
    ...extra,
  };
}

const LRU = {
  file: 'src/cache/lru.ts',
  line: 42,
  summary: '`evict()` drops the entry it just inserted',
  failure_scenario: 'capacity=2, set a, b, c → `get(c)` is undefined',
  category: 'correctness',
  verdict: 'confirmed',
  evidence: '`lru.ts:44` deletes `this.newest`',
};
const RETRIES = {
  file: 'src/jobs/sync.ts',
  line: 63,
  summary: '`retries || 3` treats 0 as unset',
  failure_scenario: '`retries: 0` configured → the job still retries 3 times',
  category: 'correctness',
  verdict: 'plausible',
  evidence: 'would confirm if `retries` can be configured 0',
};
const REUSE = {
  file: 'src/api/client.ts',
  line: 88,
  also: ['src/api/admin.ts:12'],
  summary: 'reimplements `retry()` from `utils/retry.ts`',
  failure_scenario: 'two backoff policies to keep in sync; this one lacks jitter',
  category: 'reuse',
  settled_inline: true,
};
const SPEC = {
  section: 'Rate limiting §2',
  summary: 'the limit is keyed per user, but the spec says per API key',
  failure_scenario: 'a user with 2 keys gets half the quota the spec promises',
  category: 'spec',
  verdict: 'confirmed',
  evidence: '`limits.ts:22` keys the bucket on `user.id`',
};
const ROUTES = [
  { choice: 'key the limit per API key', reasoning: 'The spec is the contract.', recommended: true },
  { choice: 'annotate the spec', reasoning: 'per user may have been deliberate' },
];

// ── start and state ────────────────────────────────────────────────────────────────────────────

withSandbox('start keys the state file on the session and worktree, in a private directory', (s) => {
  const out = s.call('start', { level: 'medium', mode: 'report', target: 'uncommitted changes' });
  assert.equal(out.status, 0);
  assert.equal(out.user, '');
  assert.doesNotMatch(out.agent, /^paste:/m);
  const file = path.join(s.dir, `test-session-${worktreeHash}.json`);
  assert.match(out.agent, new RegExp(`^state: ${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.ok(fs.existsSync(file));
  assert.equal(fs.statSync(s.dir).mode & 0o777, 0o700);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

withSandbox('a per-user directory that is not a real directory of the user faults before touching anything', (s) => {
  const elsewhere = path.join(path.dirname(path.dirname(s.dir)), 'elsewhere');
  fs.mkdirSync(path.join(elsewhere, 'review-gate'), { recursive: true });
  const old = path.join(elsewhere, 'review-gate', 'old.txt');
  fs.writeFileSync(old, '');
  fs.utimesSync(old, new Date(0), new Date(0));
  fs.symlinkSync(elsewhere, path.dirname(s.dir));
  const mode = fs.statSync(elsewhere).mode;
  const out = s.call('start', { level: 'medium', mode: 'report', target: 't' });
  assert.equal(out.status, 1);
  assert.match(out.agent, /is not a directory of your own/);
  assert.ok(fs.existsSync(old));
  assert.equal(fs.statSync(elsewhere).mode, mode);
});

withSandbox(
  'without a session variable the worktree hash alone names the state file',
  (s) => {
    s.call('start', { level: 'low', mode: 'report', target: 't' });
    assert.deepEqual(fs.readdirSync(s.dir), [`${worktreeHash}.json`]);
  },
  {},
);

withSandbox(
  'under Codex the thread id keys the state file',
  (s) => {
    s.call('start', { level: 'low', mode: 'report', target: 't' });
    assert.deepEqual(fs.readdirSync(s.dir), [`thread-1-${worktreeHash}.json`]);
  },
  { CODEX_THREAD_ID: 'thread-1', CODEX_SESSION_ID: 'root-1' },
);

withSandbox('start replaces the previous run, IDs and held findings included', (s) => {
  s.call('start', { level: 'inline', mode: 'report', target: 't' });
  s.call('report', { spec: true, candidates: [1, 2, 3, 4, 5, 6].map((n) => bug(n)) });
  s.call('start', { level: 'medium', mode: 'report', target: 't' });
  const out = s.call('report', { spec: true, verifiers: { count: 1, grouping: 'file' }, candidates: [bug(7)] });
  assert.match(out.user, /^- \*\*F1\*\* 🐛 `src\/f7\.ts:7`/m);
  assert.equal(s.call('held').user, 'Nothing was held back or declined.');
});

withSandbox('start prunes state files older than a week and keeps the rest', (s) => {
  fs.mkdirSync(s.dir, { recursive: true });
  const old = path.join(s.dir, 'old.json');
  const recent = path.join(s.dir, 'recent.json');
  fs.writeFileSync(old, '{}');
  fs.writeFileSync(recent, '{}');
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  fs.utimesSync(old, eightDaysAgo, eightDaysAgo);
  s.call('start', { level: 'low', mode: 'report', target: 't' });
  assert.ok(!fs.existsSync(old));
  assert.ok(fs.existsSync(recent));
});

// ── report ─────────────────────────────────────────────────────────────────────────────────────

withSandbox('report renders rows, the legend of used emojis, declines and the footer', (s) => {
  s.call('start', { level: 'medium', mode: 'fix', target: 'uncommitted changes' });
  const out = s.call('report', {
    spec: true,
    verifiers: { count: 6, grouping: 'file' },
    arbiter: {},
    candidates: [
      { ...LRU, ruling: 'fix', opinion: 'one line' },
      { ...RETRIES, ruling: 'fix', opinion: 'use ??' },
      { ...REUSE, ruling: 'decline', opinion: '`utils/retry.ts` takes no abort signal' },
      { ...bug(9), verdict: 'refuted', evidence: 'guarded at `f9.ts:3`' },
    ],
  });
  assert.equal(out.status, 0);
  assert.equal(
    out.user,
    [
      '🐛 correctness · 🤔 unconfirmed · ⚖️ arbiter',
      '',
      '- **F1** 🐛 `src/cache/lru.ts:42`: `evict()` drops the entry it just inserted\\',
      '  → capacity=2, set a, b, c → `get(c)` is undefined',
      '- **F2** 🐛🤔 `src/jobs/sync.ts:63`: `retries || 3` treats 0 as unset\\',
      '  → `retries: 0` configured → the job still retries 3 times',
      '',
      'Kept 2 correctness · 1 settled inline, 6 verifiers (by file) · ⚖️ 1 declined (ask for it)',
    ].join('\n'),
  );
  assert.equal(out.shown, HANDOFF);
  assert.equal(out.handoff, 'fix');
  assert.match(out.agent, /^next: apply F1, F2 in ID order$/m);
  assert.match(out.agent, /^declined by the arbiter: F3; call held when the user asks for them$/m);
  assert.match(out.agent, /^then: call outcomes over F1, F2$/m);
  assert.equal(
    s.call('held').user,
    [
      '🧹 quality · ⚖️ arbiter',
      '',
      '- **F3** 🧹 reuse `src/api/client.ts:88`, `src/api/admin.ts:12`: reimplements `retry()` from `utils/retry.ts`\\',
      '  → two backoff policies to keep in sync; this one lacks jitter\\',
      '  ⚖️ declined: `utils/retry.ts` takes no abort signal',
    ].join('\n'),
  );
  s.call('start', { level: 'medium', mode: 'fix', target: 'uncommitted changes' });
  const declined = s.call('report', {
    spec: true,
    verifiers: { count: 1, grouping: 'file' },
    arbiter: {},
    candidates: [{ ...REUSE, ruling: 'decline', opinion: 'no' }],
  });
  assert.match(declined.agent, /^next: close with the flow pointer$/m);
});

withSandbox('verdicts and other enumerated values match in any case, as the skill writes them', (s) => {
  s.call('start', { level: 'Medium', mode: 'report', target: 't' });
  const out = s.call('report', {
    spec: true,
    verifiers: { count: 1, grouping: 'file' },
    candidates: [{ ...RETRIES, verdict: 'PLAUSIBLE', category: 'Correctness' }, { ...LRU, verdict: 'REFUTED' }],
  });
  assert.equal(out.status, 0);
  assert.match(out.user, /^- \*\*F1\*\* 🐛🤔 `src\/jobs\/sync\.ts:63`/m);
  assert.doesNotMatch(out.user, /F2/);
});

withSandbox('the legend lists only the emojis the report uses', (s) => {
  s.call('start', { level: 'medium', mode: 'report', target: 't' });
  const out = s.call('report', { spec: true, verifiers: { count: 1, grouping: 'file' }, candidates: [LRU] });
  assert.equal(out.user.split('\n')[0], '🐛 correctness');
});

withSandbox('the cap holds back findings under IDs held prints unchanged', (s) => {
  s.call('start', { level: 'medium', mode: 'report', target: 't' });
  const candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => bug(n));
  const out = s.call('report', { spec: true, verifiers: { count: 3, grouping: 'file' }, candidates });
  assert.equal((out.user.match(/^- \*\*F/gm) ?? []).length, 8);
  assert.match(out.user, /^- \*\*F8\*\* 🐛 `src\/f8\.ts:8`: bug 8\\$/m);
  assert.match(out.user, /Kept 8 correctness · F9, F10 held back \(ask for them\) · 3 verifiers \(by file\)$/);
  assert.match(out.agent, /^held back: F9, F10; call held/m);
  const held = s.call('held');
  assert.equal(held.status, 0);
  assert.match(held.user, /^🐛 correctness\n\n- \*\*F9\*\* 🐛 `src\/f9\.ts:9`: bug 9\\\n {2}→ input 9 → wrong output\n- \*\*F10\*\* /);
  s.call('outcomes', { outcomes: [{ id: 'F9', outcome: 'fixed' }] });
  assert.match(s.call('held').user, /^- \*\*F9\*\* ~~🐛 `src\/f9\.ts:9`: bug 9~~\n- \*\*F10\*\* 🐛 /m);
});

withSandbox('an inline pass says so once and marks every finding plausible', (s) => {
  s.call('start', { level: 'inline', mode: 'report', target: 't' });
  const out = s.call('report', { spec: false, candidates: [{ ...RETRIES, verdict: 'confirmed' }, { ...SPEC, options: ROUTES }] });
  assert.match(out.user, /^- \*\*F1\*\* 🐛🤔 `src\/jobs/m);
  assert.match(out.user, /^- \*\*F2\*\* 📜🤔 /m);
  assert.match(out.user, /^ {4}- A, recommended: key the limit per API key\./m);
  assert.match(out.user, /Kept 1 correctness, 1 spec · single pass, unverified · no spec available$/);
  assert.match(out.agent, /^next: nothing to apply/m);
  const fixed = s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] });
  assert.match(fixed.agent, /^next: close with the flow pointer$/m);
});

withSandbox('a low pass is verified: a candidate needs a verdict, and the footer counts the verifier', (s) => {
  s.call('start', { level: 'low', mode: 'report', target: 't' });
  const unjudged = s.call('report', { spec: true, candidates: [{ ...LRU, verdict: undefined }] });
  assert.equal(unjudged.status, 2);
  assert.match(unjudged.agent, /input\.candidates\[0\]\.verdict: missing/);
  const low = s.call('report', { spec: true, verifiers: { count: 1, grouping: 'file' }, candidates: [LRU] });
  assert.match(low.user, /Kept 1 correctness · 1 verifier \(by file\)$/);
});

withSandbox('inline --fix applies the findings the session ruled fix, still unverified', (s) => {
  s.call('start', { level: 'inline', mode: 'fix', target: 't' });
  const out = s.call('report', {
    spec: false,
    arbiter: {},
    candidates: [fix(1), bug(2, { ruling: 'decline', opinion: 'rare' }), { ...SPEC, ruling: 'fix', opinion: 'ok', options: ROUTES }],
  });
  assert.match(out.user, /^- \*\*F1\*\* 🐛🤔 /m);
  assert.match(out.user, /Kept 1 correctness, 1 spec · single pass, unverified · no spec available · ⚖️ 1 declined \(ask for it\)$/);
  assert.equal(out.handoff, 'fix');
  assert.match(out.agent, /^next: apply F1 in ID order$/m);
  assert.match(out.agent, /^next: park F3 with the two routes as options/m);
  assert.match(out.agent, /^then: call outcomes over F1, F3$/m);
});

for (const level of ['inline', 'low', 'medium']) {
  withSandbox(`at ${level}, findings the arbiter left unruled in a run applying fixes are named unjudged`, (s) => {
    s.call('start', { level, mode: 'fix', target: 't' });
    const out = s.call('report', {
      spec: true,
      verifiers: { count: 2, grouping: 'file' },
      arbiter: {},
      candidates: [{ ...LRU, ruling: 'fix', opinion: 'ok' }, RETRIES],
    });
    assert.match(out.user, / · ⚖️ unjudged: F2$/);
  });
}

for (const level of ['inline', 'low']) {
  withSandbox(`${level} caps the report at 4`, (s) => {
    s.call('start', { level, mode: 'report', target: 't' });
    const out = s.call('report', { spec: true, verifiers: { count: 1, grouping: 'file' }, candidates: [1, 2, 3, 4, 5, 6].map((n) => bug(n)) });
    assert.equal((out.user.match(/^- \*\*F/gm) ?? []).length, 4);
    assert.match(out.user, / · F5, F6 held back \(ask for them\) · /);
  });
}

withSandbox('a low delta round inside a medium loop is judged, so a missing arbiter shows', (s) => {
  loopWithFix(s);
  const out = s.call('report', { ...VERIFIED, level: 'low', delta_over: ['F1'], candidates: [bug(2)] });
  assert.match(out.user, / · ⚖️ unjudged: F2$/m);
});

withSandbox('a report-only spec finding carries its routes as lettered options, one recommended', (s) => {
  s.call('start', { level: 'medium', mode: 'report', target: 't' });
  const out = s.call('report', {
    spec: true,
    verifiers: { count: 1, grouping: 'section' },
    candidates: [{ ...SPEC, options: ROUTES }],
  });
  assert.equal(
    out.user,
    [
      '📜 spec',
      '',
      '- **F1** 📜 `spec: Rate limiting §2`: the limit is keyed per user, but the spec says per API key\\',
      '  → a user with 2 keys gets half the quota the spec promises',
      '  - ❓ Options:',
      '    - A, recommended: key the limit per API key. The spec is the contract.',
      '    - B: annotate the spec. Per user may have been deliberate.',
      '',
      'Kept 1 spec · 1 verifier (by section)',
    ].join('\n'),
  );
});

withSandbox('under --fix a spec finding is parked for its route rather than asked in the report', (s) => {
  s.call('start', { level: 'medium', mode: 'fix', target: 't' });
  const out = s.call('report', {
    spec: true,
    verifiers: { count: 1, grouping: 'section' },
    arbiter: {},
    candidates: [{ ...SPEC, ruling: 'fix', opinion: 'ok', options: ROUTES }],
  });
  assert.doesNotMatch(out.user, /Options/);
  assert.match(out.agent, /^next: park F1 with the two routes as options/m);
  const parked = s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'parked' }] });
  assert.equal(parked.status, 0);
  assert.match(parked.user, /🔍 `limits\.ts:22` keys the bucket on `user\.id`\n {2}- ❓ Options:\n {4}- A, recommended: /);
});

withSandbox('over-limit fields print whole and are flagged below the delimiter', (s) => {
  s.call('start', { level: 'medium', mode: 'report', target: 't' });
  const long = 'x'.repeat(90);
  const out = s.call('report', {
    spec: true,
    verifiers: { count: 1, grouping: 'file' },
    candidates: [bug(1, { summary: long })],
  });
  assert.equal(out.status, 0);
  assert.ok(out.user.includes(long));
  assert.match(out.agent, /^warning: F1 summary runs 90 characters, over the 80 limit$/m);
});

// ── outcomes ───────────────────────────────────────────────────────────────────────────────────

withSandbox('outcomes reprints the batch: gone rows struck, open rows with their outcome line', (s) => {
  s.call('start', { level: 'medium', mode: 'fix', target: 't' });
  s.call('report', {
    spec: true,
    verifiers: { count: 4, grouping: 'file' },
    arbiter: {},
    candidates: [
      { ...LRU, ruling: 'fix', opinion: 'ok' },
      { ...RETRIES, ruling: 'fix', opinion: 'ok' },
      { ...SPEC, ruling: 'fix', opinion: 'ok' },
      { ...REUSE, ruling: 'decline', opinion: 'no abort signal there' },
      fix(5),
      fix(6),
    ],
  });
  const out = s.call('outcomes', {
    outcomes: [
      { id: 'F1', outcome: 'fixed' },
      { id: 'F2', outcome: 'skipped', reason: 'no case goes red: the config never yields 0' },
      { id: 'F3', outcome: 'routed', route: 'B', reason: 'spec annotated: per user is deliberate' },
      { id: 'F4', outcome: 'skipped' },
      { id: 5, outcome: 'no_change_needed' },
      {
        id: 'F6',
        outcome: 'parked',
        tried: 'moved the guard; the suite then failed `f6.test.ts`',
        tried_yours: true,
        options: [
          { choice: 'retry with the failing test as the target', reasoning: 'It pins the case.', recommended: true },
          { choice: 'skip', reasoning: 'The path is unreachable in production.' },
        ],
      },
    ],
  });
  assert.equal(out.status, 0);
  assert.equal(
    out.user,
    [
      '🐛 correctness · 📜 spec · 🧹 quality · 🤔 unconfirmed · ⚖️ arbiter · ⏭️ skipped',
      '',
      '- **F1** ~~🐛 `src/cache/lru.ts:42`: `evict()` drops the entry it just inserted~~',
      '- **F2** 🐛🤔 `src/jobs/sync.ts:63`: `retries || 3` treats 0 as unset\\',
      '  ⏭️ no case goes red: the config never yields 0',
      '- **F3** 📜 `spec: Rate limiting §2`: the limit is keyed per user, but the spec says per API key\\',
      '  📜 route B, spec annotated: per user is deliberate',
      '- **F4** 🧹 reuse `src/api/client.ts:88`, `src/api/admin.ts:12`: reimplements `retry()` from `utils/retry.ts`\\',
      '  ⚖️ declined: no abort signal there',
      '- **F5** ~~🐛 `src/f5.ts:5`: bug 5~~',
      '- **F6** 🐛 `src/f6.ts:6`: bug 6\\',
      '  → input 6 → wrong output\\',
      '  🔍 `f6.ts:6` reads it\\',
      '  🧪 tried (your edit): moved the guard; the suite then failed `f6.test.ts`',
      '  - ❓ Options:',
      '    - A, recommended: retry with the failing test as the target. It pins the case.',
      '    - B: skip. The path is unreachable in production.',
    ].join('\n'),
  );
  assert.match(out.agent, /^next: wait for the user's answers on F6/m);
});

withSandbox('outcomes under --fix keeps waiting on a finding an earlier call parked', (s) => {
  s.call('start', { level: 'medium', mode: 'fix', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1), fix(2)] });
  s.call('outcomes', { outcomes: [1, 2].map((n) => ({ id: `F${n}`, outcome: 'parked', options: OPTIONS })) });
  const out = s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] });
  assert.match(out.agent, /^next: wait for the user's answers on F2, /m);
  assert.doesNotMatch(out.agent, /^next: close/m);
});

withSandbox('outcomes under --fix names the findings still without one', (s) => {
  s.call('start', { level: 'medium', mode: 'fix', target: 't' });
  s.call('report', {
    spec: true,
    verifiers: { count: 1, grouping: 'file' },
    arbiter: {},
    candidates: [1, 2, 3].map((n) => fix(n)),
  });
  const partial = s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] });
  assert.match(partial.agent, /^no outcome yet: F2, F3$/m);
  const rest = s.call('outcomes', {
    outcomes: [
      { id: 'F2', outcome: 'fixed' },
      { id: 'F3', outcome: 'fixed' },
    ],
  });
  assert.match(rest.agent, /^next: close with the flow pointer$/m);
});

withSandbox('a finding fixed later in the session is re-reported under its ID, the state kept', (s) => {
  const start = s.call('start', { level: 'medium', mode: 'report', target: 't' });
  s.call('report', { spec: true, verifiers: { count: 1, grouping: 'file' }, candidates: [bug(1), bug(2)] });
  const out = s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'fixed' }] });
  assert.equal(out.user, '🐛 correctness\n\n- **F2** ~~🐛 `src/f2.ts:2`: bug 2~~');
  const file = /^state: (.+)$/m.exec(start.agent)?.[1] as string;
  assert.ok(fs.existsSync(file));
});

// ── --loop ─────────────────────────────────────────────────────────────────────────────────────

const VERIFIED = { spec: true, verifiers: { count: 1, grouping: 'file' }, checks: 'baseline' };
const OPTIONS = [
  { choice: 'fix it', reasoning: 'The case is real.', recommended: true },
  { choice: 'skip', reasoning: 'The path is rare.' },
];

function fix(n: number, extra: Record<string, unknown> = {}) {
  return bug(n, { ruling: 'fix', opinion: 'ok', ...extra });
}

// A --loop run, at medium unless named, whose first certifying pass queued F1..Fn and applied F1 as fixed.
function loopWithFix(s: ReturnType<typeof sandbox>, n = 1, level = 'medium') {
  s.call('start', { level, mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: Array.from({ length: n }, (_, i) => fix(i + 1)) });
  return s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] });
}

withSandbox('a --loop report prints the round block: header, trajectory, and rows for the findings it queued', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  const out = s.call('report', {
    ...VERIFIED,
    verifiers: { count: 3, grouping: 'file' },
    arbiter: { trajectory: 'early: nothing settled yet' },
    candidates: [
      { ...LRU, ruling: 'fix', opinion: 'one line' },
      { ...RETRIES, ruling: 'fix', opinion: 'use ??' },
      { ...REUSE, ruling: 'decline', opinion: 'no abort signal there' },
      { ...bug(9), verdict: 'refuted', evidence: 'guarded at `f9.ts:3`' },
    ],
  });
  assert.equal(out.status, 0);
  assert.equal(
    out.user,
    [
      '**R1** 🔎 certifying · medium · 3 found · 3 new · ⚖️ 1 declined · checks at baseline',
      '',
      '⚖️ *“early: nothing settled yet”*',
      '',
      '- **F1** 🐛 `src/cache/lru.ts:42`: `evict()` drops the entry it just inserted\\',
      '  → capacity=2, set a, b, c → `get(c)` is undefined',
      '- **F2** 🐛🤔 `src/jobs/sync.ts:63`: `retries || 3` treats 0 as unset\\',
      '  → `retries: 0` configured → the job still retries 3 times',
    ].join('\n'),
  );
  assert.match(out.agent, /^next: apply F1, F2$/m);
  assert.match(out.agent, /^then: call outcomes over F1, F2$/m);
});

withSandbox('the loop queues everything found, sizes each batch by the cap, and continues IDs across rounds', (s) => {
  s.call('start', { level: 'inline', mode: 'loop', target: 't' });
  const first = s.call('report', { spec: true, checks: 'none', candidates: [1, 2, 3, 4, 5, 6].map((n) => bug(n)) });
  assert.equal((first.user.match(/^- \*\*F/gm) ?? []).length, 6);
  assert.match(first.user, /^\*\*R1\*\* 🔎 certifying · inline · 6 found · 6 new · no checks · ⚖️ unjudged: F1–F6$/m);
  assert.match(first.agent, /^next: apply F1–F4$/m);
  const outcome = s.call('outcomes', { outcomes: [1, 2, 3, 4].map((id) => ({ id, outcome: 'fixed' })) });
  assert.match(outcome.agent, /^next: run the checks, settling a red batch as LOOP\.md says, then a delta round over the batch at the level it earns, at most inline; call report with delta_over \["F1","F2","F3","F4"\] and that level and, where it has a candidate, the arbiter's reply$/m);
  const delta = s.call('report', { spec: true, checks: 'none', level: 'inline', delta_over: ['F1', 'F2', 'F3', 'F4'], candidates: [bug(7)] });
  assert.match(delta.user, /^\*\*R2\*\* 🔬 delta over F1–F4 · inline · 1 found · 1 new · no checks · ⚖️ unjudged: F7$/m);
  assert.match(delta.user, /^- \*\*F7\*\* /m);
  assert.match(delta.agent, /^next: apply F5–F7$/m);
});

withSandbox('a routed finding joins the delta round, since its route may have changed the code', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1), { ...SPEC, ruling: 'fix', opinion: 'ok', options: ROUTES }] });
  const out = s.call('outcomes', {
    outcomes: [
      { id: 'F1', outcome: 'fixed' },
      { id: 'F2', outcome: 'routed', route: 'A', reason: 'code aligned' },
    ],
  });
  assert.match(out.agent, /delta_over \["F1","F2"\] /);
});

withSandbox('settling a red batch in a later call keeps the delta round over the rest of it', (s) => {
  s.call('start', { level: 'inline', mode: 'loop', target: 't' });
  s.call('report', { spec: true, checks: 'none', candidates: [1, 2, 3, 4, 5].map((n) => bug(n)) });
  s.call('outcomes', { outcomes: [1, 2, 3, 4].map((id) => ({ id, outcome: 'fixed' })) });
  const parked = s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'parked', tried: 'backed out', options: OPTIONS }] });
  assert.match(parked.agent, /delta_over \["F1","F3","F4"\] /);
  assert.doesNotMatch(parked.agent, /^next: apply/m);
  const answered = s.call('answers', { answers: [{ id: 'F2', action: 'queue' }] });
  assert.match(answered.agent, /delta_over \["F1","F3","F4"\] /);
  s.call('report', { spec: true, checks: 'none', delta_over: ['F1', 'F3', 'F4'], candidates: [] });
  const next = s.call('outcomes', { outcomes: [{ id: 'F5', outcome: 'no_change_needed' }] });
  assert.doesNotMatch(next.agent, /delta round/);
});

withSandbox('a delta round at a level above the invoked one counts at the invoked level', (s) => {
  loopWithFix(s);
  const out = s.call('report', { ...VERIFIED, level: 'high', delta_over: ['F1'], arbiter: {}, candidates: [] });
  assert.match(out.user, /^\*\*R2\*\* 🔬 delta over F1 · medium · /m);
  assert.match(out.agent, /^warning: a gate call runs at most at the invoked level/m);
  const lower = s.call('report', { ...VERIFIED, level: 'low', arbiter: {}, candidates: [] });
  assert.equal(lower.status, 2);
  assert.match(lower.agent, /^input error: input\.level: a certifying pass runs at the invoked level, medium$/m);
});

withSandbox('a run invoked above inline rejects an inline gate call', (s) => {
  for (const level of ['low', 'medium']) {
    loopWithFix(s, 1, level);
    const out = s.call('report', { ...VERIFIED, level: 'inline', delta_over: ['F1'], arbiter: {}, candidates: [] });
    assert.equal(out.status, 2);
    assert.match(out.agent, new RegExp(`^input error: input\\.level: a run invoked at ${level} runs every gate call at low or above$`, 'm'));
  }
});

withSandbox('a finding that comes back is queued for one retry, then parked', (s) => {
  loopWithFix(s);
  const refind = { ...bug(1), same_as: 'F1' };
  const first = s.call('report', { ...VERIFIED, delta_over: ['F1'], arbiter: {}, candidates: [refind] });
  assert.match(first.user, /· 1 found · 0 new ·/);
  assert.doesNotMatch(first.user, /^- /m);
  assert.match(first.agent, /^retry: F1 came back after its outcome, queued for one retry$/m);
  assert.match(first.agent, /^next: apply F1$/m);
  s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] });
  const second = s.call('report', { ...VERIFIED, delta_over: ['F1'], arbiter: {}, candidates: [refind] });
  assert.match(second.agent, /^next: park F1, since it came back after its retry$/m);
});

withSandbox('a re-find of a skipped, parked or queued finding is not new', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', {
    ...VERIFIED,
    arbiter: {},
    candidates: [fix(1), fix(2), bug(3, { ruling: 'decline', opinion: 'rare' }), fix(4)],
  });
  s.call('outcomes', {
    outcomes: [
      { id: 'F1', outcome: 'fixed' },
      { id: 'F2', outcome: 'parked', options: OPTIONS },
    ],
  });
  const out = s.call('report', {
    ...VERIFIED,
    delta_over: ['F1'],
    arbiter: {},
    candidates: [
      { ...bug(2), same_as: 'F2' },
      { ...bug(3), same_as: 'F3' },
      { ...bug(4), same_as: 'F4' },
    ],
  });
  assert.match(out.user, /· 3 found · 0 new ·/);
  assert.match(out.agent, /^next: apply F4$/m);
  assert.match(out.agent, /^then: call outcomes over F4$/m);
});

withSandbox('fix_not_taking stops on a certifying pass that brings back a fixed finding', (s) => {
  loopWithFix(s, 2);
  s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'fixed' }] });
  s.call('report', { ...VERIFIED, delta_over: ['F1', 'F2'], arbiter: {}, candidates: [] });
  const out = s.call('report', {
    ...VERIFIED,
    arbiter: {},
    candidates: [{ ...bug(1), same_as: 'F1' }, fix(8)],
  });
  assert.match(out.agent, /^next: call close with `standing` options for F1, F3; the run stops on fix_not_taking — F1$/m);
  const missing = s.call('close', {});
  assert.equal(missing.status, 2);
  assert.match(missing.agent, /^input error: input\.standing: give options for F1, F3, still queued$/m);
  const closed = s.call('close', {
    standing: [
      { id: 'F1', options: OPTIONS },
      { id: 'F3', options: OPTIONS },
    ],
  });
  assert.equal(closed.status, 0);
  assert.match(closed.user, /^`STOP: fix_not_taking — F1`\\$/m);
  assert.match(closed.user, /^⏸️ \*\*Waiting on you\*\* \(answer as F1: A, F3: A\)$/m);
  assert.match(closed.agent, /^pointer: \/review-gate --loop \(user-invoked\) once the standing findings are settled/m);
});

withSandbox('asked_twice stops when an answered finding is parked again, never on silence', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1), fix(2)] });
  s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'parked', options: OPTIONS }] });
  const unanswered = s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'parked', options: OPTIONS }] });
  assert.doesNotMatch(unanswered.agent, /asked_twice/);
  s.call('answers', { answers: [{ id: 'F1', action: 'queue' }] });
  const again = s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'parked', tried: 'the fix broke `f1.test.ts`' }] });
  assert.match(again.agent, /^next: call close with `standing` options for F2; the run stops on asked_twice — F1$/m);
});

withSandbox('a stop asks options only for the queued findings that hold none', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1), fix(2), fix(3)] });
  for (const id of ['F2', 'F1']) {
    s.call('outcomes', { outcomes: [{ id, outcome: 'parked', options: OPTIONS }] });
    s.call('answers', { answers: [{ id, action: 'queue' }] });
  }
  const again = s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'parked', options: OPTIONS }] });
  assert.match(again.agent, /^next: call close with `standing` options for F3; the run stops on asked_twice — F1$/m);
  assert.match(s.call('close', { standing: [{ id: 'F3', options: OPTIONS }] }).user, /STOP/);
});

withSandbox('an answered finding in a reverted batch trips asked_twice through the item it parks under', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1), fix(2)] });
  s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'parked', options: OPTIONS }] });
  s.call('answers', { answers: [{ id: 'F2', action: 'queue' }] });
  const out = s.call('outcomes', {
    outcomes: [{ id: 'F1', outcome: 'parked', with: ['F2'], tried: 'reverted the batch; `suite` stays red', options: OPTIONS }],
  });
  assert.match(out.agent, /stops on asked_twice — F2$/m);
});

// A certifying pass, and a delta round over one finding it first records as fixed.
function rounds(s: ReturnType<typeof sandbox>) {
  const certifying = (candidates: unknown[]) => s.call('report', { ...VERIFIED, arbiter: {}, candidates });
  const delta = (id: number, candidates: unknown[]) => {
    s.call('outcomes', { outcomes: [{ id, outcome: 'fixed' }] });
    return s.call('report', { ...VERIFIED, delta_over: [id], arbiter: {}, candidates });
  };
  return { certifying, delta };
}

withSandbox('fourth_novel_round counts rounds past the first whose novelty survived the declines, and lapses where its round leaves nothing', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  const { certifying, delta } = rounds(s);
  certifying([fix(1)]); // R1, the run's first gate call, never counts
  delta(1, [fix(2)]); // R2 novel
  delta(2, [bug(3, { ruling: 'decline', opinion: 'rare' })]); // R3: declined only
  certifying([fix(4)]); // R4 novel
  delta(4, [fix(5)]); // R5 novel
  delta(5, []); // R6
  const fourth = certifying([fix(6)]); // R7 novel: the stop waits for the round's end
  assert.match(fourth.agent, /^next: apply F6$/m);
  assert.match(fourth.agent, /^then: call close once this round ends; the run stops on fourth_novel_round — R2, R4, R5, R7 if work is still standing then$/m);
  // The round ends with nothing left: the run has converged, and the stop lapses.
  assert.match(delta(6, []).agent, /^next: call close$/m);
  assert.match(s.call('close').user, /^`GREEN: /);
  s.call('outcomes', { outcomes: [{ id: 'F3', outcome: 'fixed' }] });
  const fifth = delta(3, [fix(7)]); // R9 novel, with work standing
  assert.match(fifth.agent, /^next: call close with `standing` options for F7; the run stops on fourth_novel_round — R2, R4, R5, R7, R9$/m);
});

withSandbox('a lapsed novelty stop stays lapsed for a later answer, and never hides a question asked twice', (s) => {
  const stopping = () => {
    s.call('start', { level: 'medium', mode: 'loop', target: 't' });
    const { certifying, delta } = rounds(s);
    certifying([fix(1), fix(2)]);
    s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'parked', options: OPTIONS }] });
    delta(1, [fix(3)]);
    delta(3, [fix(4)]);
    delta(4, [fix(5)]);
    delta(5, []);
    certifying([fix(6)]); // the fourth novel round: the stop waits for its batch
    return delta;
  };
  assert.match(stopping()(6, []).agent, /^next: call close$/m);
  assert.match(s.call('answers', { answers: [{ id: 'F2', action: 'queue' }] }).agent, /^next: apply F2$/m);
  stopping();
  s.call('answers', { answers: [{ id: 'F2', action: 'queue' }] });
  const again = s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'parked', tried: 'the fix broke `f2.test.ts`' }] });
  assert.match(again.agent, /; the run stops on asked_twice — F2$/m);
});

withSandbox('an answer during a stopping certifying pass leaves its batch to land first', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  const { certifying, delta } = rounds(s);
  certifying([fix(1), fix(2)]);
  s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'parked', options: OPTIONS }] });
  delta(1, [fix(3)]);
  delta(3, [fix(4)]);
  delta(4, [fix(5)]);
  delta(5, []);
  assert.match(certifying([fix(6)]).agent, /^then: call close once this round ends; the run stops on fourth_novel_round/m);
  const out = s.call('answers', { answers: [{ id: 'F2', action: 'skip', reason: 'no' }] });
  assert.match(out.agent, /^next: apply F6$/m);
  assert.match(out.agent, /^then: call close once this round ends; the run stops on fourth_novel_round/m);
});

withSandbox('a parked item prints in full when found and the loop keeps working', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1), { ...RETRIES, ruling: 'fix', opinion: 'ok' }, fix(3)] });
  const out = s.call('outcomes', {
    outcomes: [
      { id: 'F1', outcome: 'fixed' },
      { id: 'F2', outcome: 'parked', tried: 'guarded with `??`; the caller then fails', tried_yours: true, options: OPTIONS },
      { id: 'F3', outcome: 'fixed' },
    ],
  });
  assert.equal(
    out.user,
    [
      '- **F1** ~~🐛 `src/f1.ts:1`: bug 1~~',
      '- **F2** 🐛🤔 `src/jobs/sync.ts:63`: `retries || 3` treats 0 as unset\\',
      '  → `retries: 0` configured → the job still retries 3 times\\',
      '  🔍 would confirm if `retries` can be configured 0\\',
      '  🧪 tried (your edit): guarded with `??`; the caller then fails',
      '  - ❓ Options:',
      '    - A, recommended: fix it. The case is real.',
      '    - B: skip. The path is rare.',
      '- **F3** ~~🐛 `src/f3.ts:3`: bug 3~~',
    ].join('\n'),
  );
  assert.match(out.agent, /^parked: F2; keep working/m);
  assert.match(out.agent, /^next: run the checks, settling a red batch as LOOP\.md says, then a delta round over the batch .* delta_over \["F1","F3"\] /m);
});

withSandbox('a reverted batch parks as one item under the finding it answered', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1), fix(2), fix(3)] });
  const out = s.call('outcomes', {
    outcomes: [{ id: 'F1', outcome: 'parked', with: ['F2', 'F3'], tried: 'reverted the batch; `f1.test.ts` stays red', options: OPTIONS }],
  });
  assert.match(out.user, /^ {2}🧪 tried \(reverted with F2, F3\): reverted the batch; `f1\.test\.ts` stays red$/m);
  assert.doesNotMatch(out.user, /\*\*F2\*\*/);
  assert.match(out.agent, /^next: call close$/m);
  const answered = s.call('answers', { answers: [{ id: 'F1', action: 'queue' }] });
  assert.match(answered.agent, /^next: apply F1–F3$/m);
});

withSandbox('a reverted batch lists only the rest of it, and its holder settled another way re-queues the rest', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1), fix(2)] });
  const self = s.call('outcomes', {
    outcomes: [{ id: 'F1', outcome: 'parked', with: ['F1', 'F2'], tried: 'reverted the batch', options: OPTIONS }],
  });
  assert.equal(self.status, 2);
  assert.match(self.agent, /input\.outcomes\[0\]\.with\[0\]: F1 is the finding the batch parks under/);
  s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'parked', with: ['F2'], tried: 'reverted the batch', options: OPTIONS }] });
  s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] });
  const delta = s.call('report', { ...VERIFIED, delta_over: ['F1'], arbiter: {}, candidates: [] });
  assert.match(delta.agent, /^next: apply F2$/m);
  // A member settled before its holder keeps its outcome.
  s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'parked', with: ['F2'], tried: 'reverted the batch again', options: OPTIONS }] });
  const both = s.call('outcomes', {
    outcomes: [
      { id: 'F2', outcome: 'fixed' },
      { id: 'F1', outcome: 'fixed' },
    ],
  });
  assert.match(both.agent, /delta_over \["F2","F1"\] /);
  const again = s.call('report', { ...VERIFIED, delta_over: ['F1', 'F2'], arbiter: {}, candidates: [] });
  assert.match(again.agent, /^next: call close$/m);
});

withSandbox('a red certifying pass is never clean: the red is settled before the run closes', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1)] });
  s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'parked', tried: '`suite` stays red', options: OPTIONS }] });
  const red = s.call('report', { ...VERIFIED, checks: 'red', arbiter: {}, candidates: [] });
  assert.match(red.agent, /^next: settle the red checks as LOOP\.md says\nthen: call outcomes over any edit repaired or backed out in settling it; where none was, rerun the checks and call report with delta_over \[\] and no candidates$/m);
  assert.match(s.call('close').agent, /^input error: no ending reached: the checks are red$/m);
  const skipped = s.call('answers', { answers: [{ id: 'F1', action: 'skip', reason: 'you: a known flaky test' }] });
  assert.match(skipped.agent, /^next: settle the red checks/m);
  const rerun = s.call('report', { ...VERIFIED, delta_over: [], candidates: [] });
  assert.match(rerun.user, /^\*\*R3\*\* 🔬 delta over nothing · /);
  assert.match(rerun.agent, /^next: call close$/m);
  assert.match(s.call('close').user, /^`GREEN: /);
  const queued = s.call('report', { ...VERIFIED, checks: 'red', arbiter: {}, candidates: [fix(2)] });
  assert.match(queued.agent, /^next: settle the red checks as LOOP\.md says\nnext: apply F2$/m);
});

withSandbox('answers re-queue or skip mid-run, and reject a finding that is not waiting', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1), fix(2), fix(3)] });
  s.call('outcomes', {
    outcomes: [
      { id: 'F1', outcome: 'parked', options: OPTIONS },
      { id: 'F2', outcome: 'parked', options: OPTIONS },
    ],
  });
  const out = s.call('answers', {
    answers: [
      { id: 'F1', action: 'queue' },
      { id: 'F2', action: 'skip', reason: 'you: the path is test-only' },
    ],
  });
  assert.equal(out.status, 0);
  assert.equal(out.user, '');
  assert.match(out.agent, /^next: apply F1, F3$/m);
  assert.match(s.call('ledger').agent, /^- F2 `src\/f2\.ts:2`: bug 2 — skipped: you: the path is test-only$/m);
  const wrong = s.call('answers', { answers: [{ id: 'F3', action: 'queue' }] });
  assert.equal(wrong.status, 2);
  assert.match(wrong.agent, /input\.answers\[0\]\.id: F3 is not waiting on an answer/);
});

withSandbox('close reaches WAITING with parked items open, and answering resumes the run to GREEN', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', {
    ...VERIFIED,
    arbiter: {},
    candidates: [
      { ...LRU, ruling: 'fix', opinion: 'ok' },
      { ...RETRIES, ruling: 'fix', opinion: 'ok' },
      { ...REUSE, ruling: 'decline', opinion: 'no abort signal there' },
    ],
  });
  s.call('outcomes', {
    outcomes: [
      { id: 'F1', outcome: 'fixed' },
      { id: 'F2', outcome: 'parked', tried: 'no case goes red', options: OPTIONS },
    ],
  });
  const early = s.call('close', {});
  assert.equal(early.status, 2);
  assert.match(early.agent, /^input error: no ending reached: F1 fixed but not yet re-reviewed$/m);
  const delta = s.call('report', { spec: true, level: 'low', checks: 'baseline', delta_over: ['F1'], candidates: [] });
  assert.match(delta.agent, /^next: call close$/m);
  const waiting = s.call('close');
  assert.equal(waiting.status, 0);
  assert.equal(
    waiting.user,
    [
      '`WAITING: nothing left to fix or re-review, checks at baseline; 1 parked — F2`\\',
      'Checks at baseline · ⚖️ 1 declined (ask for it)\\',
      '🧾 1 certifying pass, 1 delta round · fixed 1 correctness · 1 settled inline',
      '',
      '🐛 correctness · 🤔 unconfirmed · ⚖️ arbiter',
      '',
      '⏸️ **Waiting on you** (answer as F2: A)',
      '',
      '- **F2** 🐛🤔 `src/jobs/sync.ts:63`: `retries || 3` treats 0 as unset\\',
      '  → `retries: 0` configured → the job still retries 3 times\\',
      '  🔍 would confirm if `retries` can be configured 0\\',
      '  🧪 tried: no case goes red',
      '  - ❓ Options:',
      '    - A, recommended: fix it. The case is real.',
      '    - B: skip. The path is rare.',
    ].join('\n'),
  );
  assert.equal(
    waiting.agent,
    'paste: everything above the delimiter into your message, unaltered\npointer: none until the user answers F2; answers resumes this run',
  );
  const resumed = s.call('answers', { answers: [{ id: 'F2', action: 'skip', reason: 'you: 0 is never configured' }] });
  assert.match(resumed.agent, /^next: call close$/m);
  const green = s.call('close');
  assert.match(green.user, /^`GREEN: nothing left to fix or re-review, checks at baseline`\\$/m);
  assert.match(green.user, /^- \*\*F2\*\* 🐛🤔 `src\/jobs\/sync\.ts:63`: `retries \|\| 3` treats 0 as unset\\\n {2}⏭️ you: 0 is never configured$/m);
  assert.doesNotMatch(green.user, /Waiting on you|~~/);
  assert.match(green.agent, /^pointer: \/commit \(user-invoked\), since every fix was re-reviewed$/m);
});

withSandbox('a decline the user overruled rows at the close and leaves held', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [bug(1, { ruling: 'decline', opinion: 'rare' })] });
  s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'routed', route: 'A', reason: 'fixed at your request' }] });
  assert.equal(s.call('held').user, 'Nothing was held back or declined.');
  s.call('report', { ...VERIFIED, delta_over: ['F1'], arbiter: {}, candidates: [] });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [] });
  const green = s.call('close');
  assert.match(green.user, /^`GREEN: /);
  assert.match(green.user, /^- \*\*F1\*\* /m);
  assert.doesNotMatch(green.user, /declined/);
});

withSandbox('answering after WAITING keeps the stop counts; after a STOP they start fresh', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1), fix(2)] });
  s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'parked', options: OPTIONS }] });
  let last = 1;
  const novel = () => {
    s.call('outcomes', { outcomes: [{ id: `F${last}`, outcome: 'fixed' }] });
    const id = s.call('report', { ...VERIFIED, delta_over: [`F${last}`], arbiter: {}, candidates: [fix(last + 10)] });
    last = Number(/\*\*F(\d+)\*\*/.exec(id.user)?.[1]);
    return id;
  };
  novel();
  novel();
  novel();
  s.call('outcomes', { outcomes: [{ id: `F${last}`, outcome: 'fixed' }] });
  s.call('report', { ...VERIFIED, delta_over: [`F${last}`], arbiter: {}, candidates: [] });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [] });
  assert.match(s.call('close').user, /^`WAITING: /);
  s.call('answers', { answers: [{ id: 'F2', action: 'queue' }] });
  last = 2;
  const stopped = novel();
  assert.match(stopped.agent, /stops on fourth_novel_round — R2–R4, R7$/m);
  s.call('close', { standing: [{ id: `F${last}`, options: OPTIONS }] });
  const continued = s.call('answers', { answers: [{ id: `F${last}`, action: 'queue' }] });
  assert.match(continued.agent, /^next: apply F\d+$/m);
  assert.doesNotMatch(novel().agent, /stops/);
});

withSandbox('a --loop start over a stopped run continues it; over any other run it starts afresh', (s) => {
  loopWithFix(s, 2);
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [{ ...bug(1), same_as: 'F1' }] });
  s.call('close', {
    standing: [
      { id: 'F1', options: OPTIONS },
      { id: 'F2', options: OPTIONS },
    ],
  });
  const continued = s.call('start', { level: 'high', mode: 'loop', target: 't' });
  assert.match(continued.agent, /^continuing the stopped run from R3, its stop counts fresh$/m);
  assert.match(continued.agent, /^still parked: F1, F2$/m);
  assert.match(s.call('close').agent, /^input error: no ending reached: a certifying pass is due$/m);
  const round = s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(9)] });
  assert.match(round.user, /^\*\*R3\*\* 🔎 certifying · high · /m);
  assert.match(round.user, /^- \*\*F3\*\* /m);
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  const fresh = s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(9)] });
  assert.match(fresh.user, /^\*\*R1\*\* .*\n\n- \*\*F1\*\* /);
});

withSandbox('ledger prints the finder-brief block for the agent only', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  assert.equal(s.call('ledger').agent, 'ledger: empty, nothing skipped or refuted yet');
  s.call('report', {
    ...VERIFIED,
    arbiter: {},
    candidates: [
      { ...REUSE, ruling: 'decline', opinion: 'no abort signal there' },
      { ...bug(9), verdict: 'refuted', evidence: 'guarded at `f9.ts:3`' },
      fix(1),
    ],
  });
  const out = s.call('ledger');
  assert.equal(out.user, '');
  assert.equal(
    out.agent,
    [
      'ledger, for every finder brief:',
      'Omit a candidate matching an entry below — same defect at the same location for the same reason; a different mechanism at a listed location, or a refuted entry whose proving line the tree no longer holds, is new.',
      '- F1 `src/api/client.ts:88`: reimplements `retry()` from `utils/retry.ts` — skipped: ⚖️ declined: no abort signal there',
      '- `src/f9.ts:9`: bug 9 — refuted: guarded at `f9.ts:3`',
    ].join('\n'),
  );
  const next = s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'fixed' }] });
  assert.ok(next.agent.includes(out.agent), 'the ledger rides with the suggestion of a gate call');
  s.call('report', { ...VERIFIED, delta_over: ['F2'], arbiter: {}, candidates: [{ ...bug(8), verdict: 'refuted', evidence: 'e'.repeat(300) }] });
  assert.match(s.call('ledger').agent, /^- `src\/f8\.ts:8`: bug 8 — refuted: e{200}…$/m);
});

withSandbox("an arbiter's own finding renders under the class of the fix it answers; a back-out skips that finding", (s) => {
  loopWithFix(s);
  const out = s.call('report', {
    ...VERIFIED,
    delta_over: ['F1'],
    arbiter: {
      trajectory: 'polishing settled lines',
      findings: [
        { against: 'F1', action: 'back out', summary: 'the fix for F1 adds 40 lines for a path no caller takes', change: 'revert F1' },
        { against: 'F1', action: 'shrink', summary: 'the fix for F1 again', change: 'x' },
      ],
    },
    candidates: [],
  });
  assert.equal(
    out.user,
    [
      '**R2** 🔬 delta over F1 · medium · 1 found · 1 new · ⚖️ 0 declined · checks at baseline',
      '',
      '⚖️ *“polishing settled lines”*',
      '',
      '- **F2** 🐛 `src/f1.ts:1`: the fix for F1 adds 40 lines for a path no caller takes\\',
      '  back out: revert F1',
    ].join('\n'),
  );
  assert.match(out.agent, /^not queued: the arbiter already answered F1's fix$/m);
  assert.match(out.agent, /^next: apply F2$/m);
  const backedOut = s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'fixed' }] });
  assert.equal(
    backedOut.user,
    [
      '- **F1** 🐛 `src/f1.ts:1`: bug 1\\',
      '  ⚖️ backed out by F2: the fix for F1 adds 40 lines for a path no caller takes',
      '- **F2** ~~🐛 `src/f1.ts:1`: the fix for F1 adds 40 lines for a path no caller takes~~',
    ].join('\n'),
  );
  const wrong = s.call('report', {
    ...VERIFIED,
    delta_over: ['F2'],
    arbiter: { findings: [{ against: 'F1', action: 'shrink', summary: 's', change: 'c' }] },
    candidates: [],
  });
  assert.equal(wrong.status, 2);
  assert.match(wrong.agent, /against: F1 has no applied fix to answer/);
});

withSandbox('--loop inputs are checked: checks status, answers and close outside a loop', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  const noChecks = s.call('report', { spec: true, verifiers: { count: 1, grouping: 'file' }, candidates: [] });
  assert.equal(noChecks.status, 2);
  assert.match(noChecks.agent, /input\.checks: missing/);
  s.call('start', { level: 'medium', mode: 'fix', target: 't' });
  assert.equal(s.call('answers', { answers: [] }).status, 2);
  assert.match(s.call('close').agent, /close ends a --loop run/);
  const tagged = s.call('report', { ...VERIFIED, candidates: [{ ...bug(1), same_as: 'F1' }] });
  assert.match(tagged.agent, /same_as: only a --loop run tags re-finds/);
});

withSandbox('the arbiter answers a routed fix like an applied one', (s) => {
  loopWithFix(s, 2);
  s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'routed', route: 'A', reason: 'aligned the code' }] });
  const out = s.call('report', {
    ...VERIFIED,
    delta_over: ['F1', 'F2'],
    arbiter: { findings: [{ against: 'F2', action: 'shrink', summary: 'the route for F2 rewrote more than it needed', change: 'keep the guard '.repeat(8) }] },
    candidates: [],
  });
  assert.equal(out.status, 0);
  assert.doesNotMatch(out.agent, /^warning:/m);
  assert.match(out.agent, /^next: apply F3$/m);
});

withSandbox('answers names the overrule route for a finding the arbiter declined', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [bug(1, { ruling: 'decline', opinion: 'not worth it' })] });
  const out = s.call('answers', { answers: [{ id: 'F1', action: 'queue' }] });
  assert.equal(out.status, 2);
  assert.match(
    out.agent,
    /^input error: input\.answers\[0\]\.id: F1 was declined by the arbiter: to overrule it, apply the fix and call outcomes$/m,
  );
});

withSandbox("at every level, a delta round with a candidate is reported with the arbiter's reply", (s) => {
  assert.match(loopWithFix(s).agent, /; call report with delta_over \["F1"\] and that level and, where it has a candidate, the arbiter's reply$/m);
  s.call('start', { level: 'inline', mode: 'loop', target: 't' });
  s.call('report', { spec: false, checks: 'baseline', candidates: [bug(1)] });
  assert.match(s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] }).agent, /; call report with delta_over \["F1"\] and that level and, where it has a candidate, the arbiter's reply$/m);
  const closing = s.call('report', { spec: false, checks: 'baseline', delta_over: ['F1'], candidates: [] });
  assert.match(closing.agent, /^next: call close$/m);
  assert.match(s.call('close').user, /^Checks at baseline · every pass ran unverified · ⚖️ R1 ran unjudged\\$/m);
});

withSandbox('a certifying re-find the arbiter declines leaves the fix standing and is recorded as declined', (s) => {
  loopWithFix(s);
  s.call('report', { ...VERIFIED, delta_over: ['F1'], arbiter: {}, candidates: [] });
  const out = s.call('report', {
    ...VERIFIED,
    arbiter: {},
    candidates: [{ ...bug(1), same_as: 'F1', ruling: 'decline', opinion: 'the fix stands; the re-find is a nit' }],
  });
  assert.doesNotMatch(out.agent, /fix_not_taking/);
  assert.match(out.agent, /^next: call close$/m);
  assert.match(out.user, /· 1 found · 1 new · ⚖️ 1 declined ·/);
  assert.match(s.call('ledger').agent, /^- F2 `src\/f1\.ts:1`: bug 1 — skipped: ⚖️ declined: the fix stands; the re-find is a nit$/m);
  assert.match(s.call('held').user, /\*\*F2\*\*/);
});

withSandbox('the arbiter may shrink a routed fix but never back out the route the user picked', (s) => {
  loopWithFix(s, 2);
  s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'routed', route: 'A', reason: 'aligned the code' }] });
  const back = s.call('report', {
    ...VERIFIED,
    delta_over: ['F1', 'F2'],
    arbiter: { findings: [{ against: 'F2', action: 'back out', summary: 's', change: 'c' }] },
    candidates: [],
  });
  assert.equal(back.status, 2);
  assert.match(back.agent, /^input error: input\.arbiter\.findings\[0\]\.action: F2 took the route the user picked, so it can be shrunk, never backed out$/m);
});

// ── hand-off ───────────────────────────────────────────────────────────────────────────────────

withSandbox('a block the run acts on ends the turn, and the Stop hook resumes it with the step once', (s) => {
  s.call('start', { level: 'medium', mode: 'fix', target: 't' });
  const out = s.call('report', { spec: false, candidates: [bug(1)] });
  assert.equal(out.shown, HANDOFF);
  assert.equal(out.handoff, 'fix');
  assert.equal(s.hook('round').status, 0);
  assert.equal(s.pending().length, 1);
  const resumed = s.hook('fix');
  assert.equal(resumed.status, 2);
  assert.equal(resumed.stdout, '');
  assert.match(resumed.stderr, /^next: apply F1 in ID order\nthen: call outcomes over F1$/m);
  assert.deepEqual(s.pending(), []);
  assert.deepEqual(s.hook('fix'), { status: 0, stdout: '', stderr: '' });
});

withSandbox('each loop step hands over under its kind; a clean pass, a report-only run and a finished --fix run hand nothing over', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  assert.equal(s.call('report', { spec: false, checks: 'baseline', arbiter: {}, candidates: [bug(1)] }).handoff, 'fix');
  assert.equal(s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] }).handoff, 'round');
  const clean = s.call('report', { spec: false, checks: 'baseline', delta_over: ['F1'], candidates: [] });
  assert.equal(clean.handoff, undefined);
  assert.match(clean.agent, /^next: call close$/m);
  assert.equal(s.call('close').handoff, undefined);
  s.call('start', { level: 'medium', mode: 'report', target: 't' });
  assert.equal(s.call('report', { spec: false, candidates: [bug(1)] }).handoff, undefined);
  s.call('start', { level: 'medium', mode: 'fix', target: 't' });
  s.call('report', { spec: false, candidates: [bug(1)] });
  const last = s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] });
  assert.equal(last.handoff, undefined);
  assert.match(last.shown, /^paste: everything above the delimiter into your message, unaltered\nnext: close with the flow pointer$/);
});

withSandbox('an edit repaired in settling a red is recorded first, and blocks the close until a round covers it', (s) => {
  loopWithFix(s);
  const red = s.call('report', { ...VERIFIED, checks: 'red', delta_over: ['F1'], candidates: [] });
  assert.match(
    red.agent,
    /^then: call outcomes over any edit repaired or backed out in settling it; where none was, rerun the checks and call report with delta_over \[\] and no candidates$/m,
  );
  const repaired = s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] });
  assert.match(repaired.agent, /; call report with delta_over \["F1"\] /m);
  assert.match(s.call('close').agent, /^input error: no ending reached: F1 fixed but not yet re-reviewed$/m);
});

withSandbox('a fix the delta round did not name stays to be re-reviewed', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1), fix(2)] });
  s.call('outcomes', { outcomes: [1, 2].map((n) => ({ id: `F${n}`, outcome: 'fixed' })) });
  const partial = s.call('report', { ...VERIFIED, delta_over: ['F1'], candidates: [] });
  assert.match(partial.agent, /; call report with delta_over \["F2"\] /m);
  assert.match(s.call('close').agent, /^input error: no ending reached: F2 fixed but not yet re-reviewed$/m);
});

withSandbox('a round whose candidates were all refuted, with no arbiter reply, carries no arbiter count', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  const out = s.call('report', { ...VERIFIED, candidates: [{ ...bug(1), verdict: 'refuted', settled_inline: true }] });
  assert.doesNotMatch(out.user, /⚖️/);
});

withSandbox('the run certifies once, and the arbiter may ask for one more pass, once, a stop notwithstanding', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  assert.match(s.call('close').agent, /^input error: no ending reached: a certifying pass is due$/m);
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1)] });
  s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] });
  const asked = s.call('report', { ...VERIFIED, delta_over: ['F1'], arbiter: { recertify: true }, candidates: [fix(2)] });
  assert.match(asked.user, /^\*\*R2\*\* 🔬 delta over F1 · medium · 1 found · 1 new · ⚖️ 0 declined · ⚖️ asks a certifying pass · /);
  s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'fixed' }] });
  // A round with no candidate wakes no arbiter, so its block carries none.
  const delta = s.call('report', { ...VERIFIED, delta_over: ['F2'], candidates: [] });
  assert.doesNotMatch(delta.user, /⚖️/);
  assert.match(delta.agent, /^next: a certifying pass over the whole target at medium, then call report$/m);
  const certified = s.call('report', { ...VERIFIED, arbiter: { recertify: true }, candidates: [fix(3)] });
  assert.match(certified.agent, /^not granted: the arbiter's one extra certifying pass is spent$/m);
  s.call('outcomes', { outcomes: [{ id: 'F3', outcome: 'parked', options: OPTIONS }] });
  s.call('answers', { answers: [{ id: 'F3', action: 'queue' }] });
  s.call('outcomes', { outcomes: [{ id: 'F3', outcome: 'parked', tried: 'the fix broke `f3.test.ts`' }] });
  assert.match(s.call('close').user, /STOP: asked_twice/);
  s.call('answers', { answers: [{ id: 'F3', action: 'queue' }] });
  s.call('outcomes', { outcomes: [{ id: 'F3', outcome: 'fixed' }] });
  const again = s.call('report', { ...VERIFIED, delta_over: ['F3'], arbiter: { recertify: true }, candidates: [] });
  assert.match(again.agent, /^not granted: the arbiter's one extra certifying pass is spent\nnext: call close$/m);
  assert.match(s.call('close').user, /^`GREEN: /);
});

withSandbox('a fix answered in after a GREEN close continues the run into a delta round', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { spec: false, checks: 'baseline', arbiter: {}, candidates: [bug(1, { ruling: 'decline', opinion: 'no' })] });
  assert.match(s.call('close').user, /GREEN/);
  s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'parked', options: OPTIONS }] });
  assert.match(s.call('answers', { answers: [{ id: 'F1', action: 'queue' }] }).agent, /^next: apply F1$/m);
  const out = s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] });
  assert.equal(out.handoff, 'round');
  assert.match(out.agent, /delta_over \["F1"\]/);
});

withSandbox('a stop tripped after a GREEN close is announced, and the run it continues re-reviews its fixes', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { spec: false, checks: 'baseline', arbiter: {}, candidates: [bug(1, { ruling: 'decline', opinion: 'no' })] });
  assert.match(s.call('close').user, /GREEN/);
  s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'parked', options: OPTIONS }] });
  s.call('answers', { answers: [{ id: 'F1', action: 'queue' }] });
  const again = s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'parked', tried: 'the fix broke `f1.test.ts`', options: OPTIONS }] });
  assert.match(again.agent, /^next: call close; the run stops on asked_twice — F1$/m);
  assert.match(s.call('close', { standing: [] }).user, /STOP: asked_twice/);
  s.call('answers', { answers: [{ id: 'F1', action: 'queue' }] });
  assert.match(s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] }).agent, /delta_over \["F1"\]/);
});

withSandbox('a fix recorded after a STOP hands nothing over and points at what continues the run', (s) => {
  s.call('start', { level: 'medium', mode: 'loop', target: 't' });
  s.call('report', { ...VERIFIED, arbiter: {}, candidates: [fix(1), fix(2)] });
  s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'parked', options: OPTIONS }] });
  s.call('answers', { answers: [{ id: 'F1', action: 'queue' }] });
  s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'parked', tried: 'the fix broke `f1.test.ts`' }] });
  assert.match(s.call('close', { standing: [{ id: 'F2', options: OPTIONS }] }).user, /STOP/);
  const out = s.call('outcomes', { outcomes: [{ id: 'F2', outcome: 'fixed' }] });
  assert.equal(out.handoff, undefined);
  assert.match(out.shown, /^next: the run stopped; answers or a --loop start continues it$/m);
});

for (const [where, env] of [
  ['a harness without the Stop hook', { CODEX_THREAD_ID: 'codex-thread' }],
  [
    'a runtime other than node, which runs the Stop hook,',
    { CLAUDE_CODE_SESSION_ID: 'test-session', NODE_OPTIONS: '--import=data:text/javascript,process.versions.bun=String(1)' },
  ],
] as const) {
  withSandbox(
    `${where} keeps the block and its step in one output`,
    (s) => {
      s.call('start', { level: 'medium', mode: 'fix', target: 't' });
      const out = s.call('report', { spec: false, candidates: [bug(1)] });
      assert.equal(out.handoff, undefined);
      assert.match(out.shown, /^paste: everything above the delimiter into your message, unaltered\nnext: apply F1 in ID order$/m);
    },
    env,
  );
}

withSandbox('a later call drops the hand-off its turn end never collected', (s) => {
  s.call('start', { level: 'medium', mode: 'fix', target: 't' });
  s.call('report', { spec: false, candidates: [bug(1)] });
  assert.equal(s.pending().length, 1);
  s.call('held');
  assert.equal(s.pending().length, 1);
  s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'fixed' }] });
  assert.deepEqual(s.pending(), []);
});

withSandbox('a run the user resumes, no hook having run, takes its step from resume', (s) => {
  s.call('start', { level: 'medium', mode: 'fix', target: 't' });
  s.call('report', { spec: false, candidates: [bug(1)] });
  const out = s.call('resume');
  assert.equal(out.status, 0);
  assert.equal(out.user, '');
  assert.match(out.agent, /^next: apply F1 in ID order$/m);
  assert.deepEqual(s.pending(), []);
  assert.match(s.call('resume').agent, /^nothing handed over: no step is pending$/);
});

withSandbox('a hand-off older than its turn never wakes the agent, and waits for the run its user resumes', (s) => {
  s.call('start', { level: 'medium', mode: 'fix', target: 't' });
  s.call('report', { spec: false, candidates: [bug(1)] });
  const [marker] = s.pending();
  const old = new Date(Date.now() - 11 * 60 * 1000);
  fs.utimesSync(path.join(s.dir, marker), old, old);
  assert.deepEqual(s.hook('fix'), { status: 0, stdout: '', stderr: '' });
  assert.equal(s.pending().length, 1);
  assert.match(s.call('resume').agent, /^next: apply F1 in ID order$/m);
});

test('each hand-off kind has a Stop hook in the frontmatter, run by node alone and its exit code kept, so any shell runs it', () => {
  const skill = fs.readFileSync(fileURLToPath(new URL('../SKILL.md', import.meta.url)), 'utf8');
  const frontmatter = skill.split('\n---\n')[0];
  const commands = [...frontmatter.matchAll(/^ +command: '(.*)'$/gm)].map((m) => m[1]);
  assert.deepEqual(
    commands,
    ['fix', 'round', 'close'].map((kind) => `node "\${CLAUDE_PLUGIN_ROOT}/skills/review-gate/scripts/findings.ts" resume ${kind}; exit $LASTEXITCODE`),
  );
});

withSandbox("the Stop hook never wakes the agent on a bad input, a missing run or another session's hand-off", (s) => {
  assert.equal(s.hook('fix', 'not json').status, 1);
  assert.equal(s.hook('fix', { session_id: 'other', cwd: process.cwd() }).status, 0);
  assert.equal(s.hook('sideways').status, 1);
  s.call('start', { level: 'medium', mode: 'fix', target: 't' });
  s.call('report', { spec: false, candidates: [bug(1)] });
  assert.deepEqual(s.hook('fix', { session_id: 'other', cwd: process.cwd() }), { status: 0, stdout: '', stderr: '' });
  assert.equal(s.pending().length, 1);
});

// ── failures ───────────────────────────────────────────────────────────────────────────────────

withSandbox('input errors exit 2 and name the field or ID below the delimiter', (s) => {
  const early = s.call('report', { spec: true, candidates: [] });
  assert.equal(early.status, 2);
  assert.equal(early.agent, 'input error: no run in this session and worktree: call start first');

  s.call('start', { level: 'medium', mode: 'fix', target: 't' });
  const cases: [string, unknown, RegExp][] = [
    ['report', '{not json', /^input error: stdin: malformed JSON/],
    ['report', { spec: true, candidates: [{ ...LRU, category: 'style' }] }, /input\.candidates\[0\]\.category: "style"/],
    ['report', { spec: true, candidates: [{ ...LRU, verdict: undefined }] }, /input\.candidates\[0\]\.verdict: missing/],
    ['report', { candidates: [] }, /input\.spec: expected true or false/],
    ['report', { spec: true, candidates: [{ ...LRU, failure_scenario: undefined }] }, /\.failure_scenario: missing/],
    ['report', { spec: true, candidates: [{ ...SPEC, options: [ROUTES[1], ROUTES[1]] }] }, /options: mark exactly one recommended/],
    ['outcomes', { outcomes: [{ id: 'F99', outcome: 'fixed' }] }, /input\.outcomes\[0\]\.id: unknown finding "F99"/],
    ['start', { level: 'max', mode: 'fix', target: 't' }, /input\.level: "max" is not one of inline, low, medium, high/],
  ];
  for (const [command, input, message] of cases) {
    const out = s.call(command, input);
    assert.equal(out.status, 2, `${command} ${JSON.stringify(input)}`);
    assert.equal(out.user, '');
    assert.match(out.agent, message);
  }
  s.call('report', { spec: true, verifiers: { count: 1, grouping: 'file' }, candidates: [LRU] });
  const skipped = s.call('outcomes', { outcomes: [{ id: 'F1', outcome: 'skipped' }] });
  assert.equal(skipped.status, 2);
  assert.match(skipped.agent, /input\.outcomes\[0\]\.reason: missing/);
});

withSandbox('a stdin held open with nothing written reads as no input', (s) => {
  const run = spawnSync('sh', ['-c', 'sleep 1 | "$0" "$1" close', process.execPath, SCRIPT], {
    env: { ...process.env, CLAUDE_CODE_SESSION_ID: 'test-session', TMPDIR: path.dirname(path.dirname(s.dir)) },
    encoding: 'utf8',
  });
  assert.equal(run.status, 2);
  assert.match(run.stdout, /^input error: no run in this session and worktree/m);
});

withSandbox('a rejected call leaves the run as it was', (s) => {
  s.call('start', { level: 'medium', mode: 'report', target: 't' });
  s.call('report', { spec: true, candidates: [LRU, { ...LRU, category: 'style' }] });
  const out = s.call('report', { spec: true, verifiers: { count: 1, grouping: 'file' }, candidates: [LRU] });
  assert.match(out.user, /^- \*\*F1\*\*/m);
});

withSandbox('a fault exits 1 with the error and the state file path', (s) => {
  const start = s.call('start', { level: 'medium', mode: 'report', target: 't' });
  const file = /^state: (.+)$/m.exec(start.agent)?.[1] as string;
  fs.writeFileSync(file, 'corrupt');
  const out = s.call('report', { spec: true, candidates: [] });
  assert.equal(out.status, 1);
  assert.equal(out.user, '');
  assert.match(out.agent, /^fault: /);
  assert.ok(out.agent.endsWith(`state: ${file}`));
});
