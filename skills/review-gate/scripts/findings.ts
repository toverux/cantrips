// /review-gate's findings ledger: holds every finding's lifecycle for one run and renders every surface
// the user reads. The agent declares its judgements as JSON on stdin, in the contract SKILL.md states.
// Runs as-is under node >= 22.18, bun, or deno (`deno run -A`): strippable TypeScript, no dependencies.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';

const DELIMITER = '── agent ──';
const CAPS = { inline: 4, low: 4, medium: 8, high: 15 };
const LIMITS = { summary: 80, failure_scenario: 100 };
// The ledger rides every gate call, and a finder omits on the gist of a reason, so an entry keeps this much of it.
const LEDGER_REASON = 200;
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const LEVELS = ['inline', 'low', 'medium', 'high'];
const MODES = ['report', 'fix', 'loop'];
const QUALITY = ['reuse', 'simplification', 'efficiency', 'design', 'conventions'];
const CATEGORIES = ['correctness', 'spec', ...QUALITY];
const VERDICTS = ['confirmed', 'plausible', 'refuted'];
const OUTCOMES = ['fixed', 'no_change_needed', 'skipped', 'parked', 'routed'];
const CHECKS = ['baseline', 'red', 'none'];
const ACTIONS = ['shrink', 'back out'];
// The kinds of step a hand-off resumes, one Stop hook each in SKILL.md's frontmatter, which labels it.
const HANDOFFS = ['fix', 'round', 'close'];
const LEGEND: [string, string][] = [
  ['🐛', 'correctness'],
  ['📜', 'spec'],
  ['🧹', 'quality'],
  ['🤔', 'unconfirmed'],
  ['⚖️', 'arbiter'],
  ['⏭️', 'skipped'],
];

type Level = 'inline' | 'low' | 'medium' | 'high';
type Mode = 'report' | 'fix' | 'loop';
type Handoff = 'fix' | 'round' | 'close';

interface Option {
  choice: string;
  reasoning: string;
  recommended: boolean;
}

interface Finding {
  id: number;
  held: boolean;
  location: string;
  also: string[];
  summary: string;
  failure_scenario: string;
  category: string;
  verdict: 'confirmed' | 'plausible' | null;
  evidence?: string;
  ruling?: 'fix' | 'decline';
  opinion?: string;
  options?: Option[];
  outcome?: string;
  reason?: string;
  tried?: string;
  tried_yours?: boolean;
  route?: string;
  // --loop only
  against?: number; // an arbiter's own finding: the finding whose applied fix it answers
  action?: string; // an arbiter's own finding: shrink or back out
  retried?: boolean; // came back once after its outcome and was queued again
  came_back?: boolean; // came back after its retry: parked for the user next
  answered_epoch?: number; // the epoch of its last answer, for asked_twice
  with?: number[]; // a reverted batch parked as one item under this finding
}

interface Refuted {
  location: string;
  summary: string;
  reason: string;
}

interface Round {
  n: number;
  delta_over: number[] | null;
  level: Level;
  found: number;
  new: number;
  declined: number;
  judged: boolean; // an arbiter's reply came with the round
  recertify: boolean; // the arbiter asked for one more certifying pass, and the run granted it
  unjudged: number[];
  checks: string;
  trajectory?: string;
  settled_inline: number;
  spec: boolean;
}

interface Stop {
  condition: string;
  tripped: string;
}

interface State {
  level: Level;
  mode: Mode;
  target: string;
  findings: Finding[];
  refuted: Refuted[];
  // --loop only
  queue: number[];
  rounds: Round[];
  epoch: number; // bumped when a stopped run continues, so its stop counts start fresh
  novel_rounds: number[];
  record: number[]; // the batch edits awaiting their delta round, kept until a gate call reviews them
  stop: Stop | null;
  due: boolean; // a certifying pass is due: at the start, where a stopped run is relaunched, once where the arbiter asks
  recertified: boolean; // the arbiter's one extra certifying pass is spent
  stopped: boolean; // close ended the run on its stop
}

class InputError extends Error {}

// ── input validation ───────────────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

function object(value: unknown, where: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InputError(`${where}: expected an object`);
  }
  return value as Json;
}

function text(o: Json, key: string, where: string, required = true): string | undefined {
  const value = o[key];
  if (value === undefined || value === null || value === '') {
    if (required) throw new InputError(`${where}.${key}: missing`);
    return undefined;
  }
  if (typeof value !== 'string') throw new InputError(`${where}.${key}: expected a string`);
  return value.replace(/\s+/g, ' ').trim();
}

function choice(o: Json, key: string, allowed: string[], where: string, required = true): string | undefined {
  // The skill writes verdicts upper-case (CONFIRMED), so enumerated values match in any case.
  const value = text(o, key, where, required)?.toLowerCase();
  if (value !== undefined && !allowed.includes(value)) {
    throw new InputError(`${where}.${key}: "${value}" is not one of ${allowed.join(', ')}`);
  }
  return value;
}

function list(o: Json, key: string, where: string): unknown[] {
  const value = o[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new InputError(`${where}.${key}: expected an array`);
  return value;
}

function options(o: Json, where: string): Option[] | undefined {
  if (o.options === undefined) return undefined;
  const parsed = list(o, 'options', where).map((raw, i) => {
    const option = object(raw, `${where}.options[${i}]`);
    return {
      choice: text(option, 'choice', `${where}.options[${i}]`) as string,
      reasoning: text(option, 'reasoning', `${where}.options[${i}]`) as string,
      recommended: option.recommended === true,
    };
  });
  if (parsed.length < 2) throw new InputError(`${where}.options: give at least two`);
  if (parsed.filter((option) => option.recommended).length !== 1) {
    throw new InputError(`${where}.options: mark exactly one recommended`);
  }
  return parsed;
}

function findingId(state: State, raw: unknown, where: string): Finding {
  const match = typeof raw === 'string' ? /^F?(\d+)$/.exec(raw) : null;
  const id = typeof raw === 'number' ? raw : match ? Number(match[1]) : NaN;
  const finding = byId(state, id);
  if (!finding) throw new InputError(`${where}: unknown finding ${JSON.stringify(raw)}`);
  return finding;
}

function byId(state: State, id: number): Finding {
  return state.findings.find((f) => f.id === id) as Finding;
}

function location(o: Json, where: string): string {
  const section = text(o, 'section', where, false);
  if (section) return `spec: ${section}`;
  const file = text(o, 'file', where, false);
  if (!file) throw new InputError(`${where}: give a file (with its line) or a spec section`);
  const line = o.line;
  if (line === undefined || line === null) return file;
  if (!Number.isInteger(line)) throw new InputError(`${where}.line: expected an integer`);
  return `${file}:${line}`;
}

// ── state ──────────────────────────────────────────────────────────────────────────────────────

// Per user, since the temp directory may be shared and the state directory is private.
function stateDir(): string {
  return path.join(os.tmpdir(), `cantrips-${process.getuid?.() ?? ''}`, 'review-gate');
}

// Its name is predictable in a shared directory, so nothing is read, written or pruned under it unless the
// per-user directory is a real directory of the user's own.
function claimStateDir(): string {
  const dir = stateDir();
  const root = path.dirname(dir);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || (process.getuid && stat.uid !== process.getuid())) {
    throw new Error(`${root} is not a directory of your own: remove it, then rerun`);
  }
  fs.chmodSync(root, 0o700);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function envSession(): string | undefined {
  // Codex exports its conversation as CODEX_THREAD_ID and its root session as CODEX_SESSION_ID.
  return process.env.CLAUDE_CODE_SESSION_ID || process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID;
}

function statePath(session = envSession()): string {
  let toplevel: string;
  try {
    toplevel = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    toplevel = process.cwd();
  }
  const worktree = createHash('sha256').update(toplevel).digest('hex').slice(0, 12);
  const name = session ? `${session.replace(/[^\w-]/g, '_')}-${worktree}` : worktree;
  return path.join(stateDir(), `${name}.json`);
}

function load(file: string): State {
  claimStateDir();
  if (!fs.existsSync(file)) throw new InputError('no run in this session and worktree: call start first');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as State;
}

// A hand-off's step waits beside the state file, named by its kind so the Stop hook finds it by a glob.
function handoffPath(file: string, kind: string): string {
  return file.replace(/\.json$/, `.${kind}.pending`);
}

function save(file: string, state: State): void {
  claimStateDir();
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(state, null, 1)}\n`, { mode: 0o600 });
  fs.renameSync(temp, file);
}

function prune(): void {
  const dir = claimStateDir();
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (Date.now() - fs.statSync(file).mtimeMs > PRUNE_AFTER_MS) fs.rmSync(file, { force: true });
  }
}

// ── rendering ──────────────────────────────────────────────────────────────────────────────────

function classOf(f: Finding): string {
  return QUALITY.includes(f.category) ? 'quality' : f.category;
}

function classEmoji(f: Finding): string {
  return (LEGEND.find(([, name]) => name === classOf(f)) as [string, string])[0];
}

// "2 correctness, 1 quality": the findings counted per class, empty classes left out.
function classCounts(findings: Finding[]): string {
  return ['correctness', 'spec', 'quality']
    .map((name) => [findings.filter((f) => classOf(f) === name).length, name] as const)
    .filter(([n]) => n)
    .map(([n, name]) => `${n} ${name}`)
    .join(', ');
}

function heading(f: Finding): string {
  // A finding no verifier judged is as uncertain as a plausible one, so it carries the same mark.
  const mark = f.verdict === 'confirmed' ? '' : '🤔';
  const lens = QUALITY.includes(f.category) ? ` ${f.category}` : '';
  const where = [f.location, ...f.also].map((l) => `\`${l}\``).join(', ');
  return `${classEmoji(f)}${mark}${lens} ${where}: ${f.summary}`;
}

function letter(i: number): string {
  return String.fromCharCode(65 + i);
}

function row(f: Finding, lines: string[], opts?: Option[], struck = false): string {
  let out = `- **F${f.id}** ${struck ? `~~${heading(f)}~~` : heading(f)}`;
  for (const line of lines) out += `\\\n  ${line}`;
  if (opts) {
    out += '\n  - ❓ Options:';
    opts.forEach((o, i) => {
      const tag = o.recommended ? `${letter(i)}, recommended` : letter(i);
      const stop = /[.!?]$/.test(o.reasoning) ? '' : '.';
      const reasoning = o.reasoning.charAt(0).toUpperCase() + o.reasoning.slice(1) + stop;
      out += `\n    - ${tag}: ${o.choice.replace(/\.$/, '')}. ${reasoning}`;
    });
  }
  return out;
}

function declineLine(f: Finding): string {
  return `⚖️ declined: ${f.opinion}`;
}

// An arbiter's own finding states its change where any other states its failure scenario.
function scenarioLine(f: Finding): string {
  return f.action ? `${f.action}: ${f.failure_scenario}` : `→ ${f.failure_scenario}`;
}

function reportRow(state: State, f: Finding): string {
  const lines = [scenarioLine(f)];
  if (f.ruling === 'decline') lines.push(declineLine(f));
  // Under --fix the route is asked when the batch lands; a report-only run leaves it to the user now.
  return row(f, lines, state.mode === 'report' ? f.options : undefined);
}

function outcomeRow(f: Finding): string {
  switch (f.outcome) {
    case 'fixed':
    case 'no_change_needed':
      return row(f, [], undefined, true);
    case 'skipped':
      // The arbiter's reasons carry their own ⚖️.
      return row(f, [f.reason?.startsWith('⚖️') ? f.reason : `⏭️ ${f.reason}`]);
    case 'routed':
      return row(f, [`📜 route ${f.route}, ${f.reason}`]);
    case 'parked': {
      const lines = [scenarioLine(f)];
      if (f.evidence) lines.push(`🔍 ${f.evidence}`);
      const notes = [f.tried_yours ? 'your edit' : '', f.with?.length ? `reverted with ${ids(f.with)}` : ''];
      const note = notes.filter(Boolean).join('; ');
      if (f.tried) lines.push(`🧪 tried${note ? ` (${note})` : ''}: ${f.tried}`);
      return row(f, lines, f.options);
    }
    default:
      return row(f, [scenarioLine(f)]);
  }
}

function legend(text: string): string {
  const used = LEGEND.filter(([emoji]) => text.includes(emoji));
  return used.map(([emoji, name]) => `${emoji} ${name}`).join(' · ');
}

function withLegend(body: string): string {
  const key = legend(body);
  return key ? `${key}\n\n${body}` : body;
}

function ids(list: (Finding | number)[], prefix = 'F'): string {
  const sorted = list.map((f) => (typeof f === 'number' ? f : f.id)).sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) {
      runs.push(`${prefix}${sorted[i]}–${prefix}${sorted[j]}`);
      i = j;
    } else {
      runs.push(`${prefix}${sorted[i]}`);
    }
  }
  return runs.join(', ');
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// ── subcommands ────────────────────────────────────────────────────────────────────────────────

interface Step {
  handoff?: Handoff;
  lines: string[];
}

interface Result {
  user: string;
  agent: string[];
  // A block followed by more work ends its turn, where an agent relays a block reliably: the agent lines
  // wait for the Stop hook, which resumes the agent with them.
  handoff?: Handoff;
}

function start(file: string, input: Json): Result {
  const level = choice(input, 'level', LEVELS, 'input') as Level;
  const mode = choice(input, 'mode', MODES, 'input') as Mode;
  const target = text(input, 'target', 'input') as string;
  prune();
  let previous: State | undefined;
  try {
    previous = mode === 'loop' ? load(file) : undefined;
  } catch {
    // A missing or corrupt state starts a fresh run.
  }
  if (previous?.mode === 'loop' && previous.stop) {
    // A --loop start over a stopped run continues it, IDs and ledgers kept, stop counts fresh.
    resume(previous);
    Object.assign(previous, { level, target, due: true });
    save(file, previous);
    const open = openParked(previous);
    const agent = [`state: ${file}`, `continuing the stopped run from R${previous.rounds.length + 1}, its stop counts fresh`];
    if (open.length) agent.push(`still parked: ${ids(open)}`);
    return { user: '', agent: [...agent, 'next: run Scope, then a certifying pass', ...ledgerLines(previous)] };
  }
  save(file, {
    level,
    mode,
    target,
    findings: [],
    refuted: [],
    queue: [],
    rounds: [],
    epoch: 0,
    novel_rounds: [],
    record: [],
    stop: null,
    due: true,
    recertified: false,
    stopped: false,
  });
  return { user: '', agent: [`state: ${file}`, 'next: run Scope and the gate, then call report'] };
}

function resume(state: State): void {
  state.epoch++;
  state.novel_rounds = [];
  state.stop = null;
  state.stopped = false;
}

// A reverted batch's other findings wait under the finding it parked as, so only that one is open.
function openParked(state: State): Finding[] {
  const members = new Set(state.findings.flatMap((f) => f.with ?? []));
  return state.findings.filter((f) => f.outcome === 'parked' && !members.has(f.id));
}

function report(file: string, input: Json): Result {
  const state = load(file);
  const loop = state.mode === 'loop';
  if (loop && state.stopped) throw new InputError('the run stopped: answers or a --loop start continues it');
  const agent: string[] = [];
  let level = state.level;
  if (loop && input.level !== undefined) {
    level = choice(input, 'level', LEVELS, 'input') as Level;
    if (input.delta_over === undefined && LEVELS.indexOf(level) < LEVELS.indexOf(state.level)) {
      throw new InputError(`input.level: a certifying pass runs at the invoked level, ${state.level}`);
    }
    if (level === 'inline' && state.level !== 'inline') {
      throw new InputError(`input.level: a run invoked at ${state.level} runs every gate call at low or above`);
    }
    if (LEVELS.indexOf(level) > LEVELS.indexOf(state.level)) {
      agent.push(`warning: a gate call runs at most at the invoked level, so this one counts as ${state.level}`);
      level = state.level;
    }
  }
  const unverified = level === 'inline';
  const arbiter = input.arbiter === undefined ? undefined : object(input.arbiter, 'input.arbiter');
  const judged = arbiter !== undefined;
  const verifiers = input.verifiers === undefined ? undefined : object(input.verifiers, 'input.verifiers');
  const verifierCount = verifiers ? (verifiers.count ?? 0) : 0;
  if (typeof verifierCount !== 'number' || !Number.isInteger(verifierCount) || verifierCount < 0) {
    throw new InputError('input.verifiers.count: expected a whole number');
  }
  const grouping = verifiers && verifierCount > 0 ? text(verifiers, 'grouping', 'input.verifiers') : undefined;
  if (typeof input.spec !== 'boolean') throw new InputError('input.spec: expected true or false');

  const checks = loop ? (choice(input, 'checks', CHECKS, 'input') as string) : '';
  const deltaOver =
    loop && input.delta_over !== undefined
      ? list(input, 'delta_over', 'input').map((raw, i) => findingId(state, raw, `input.delta_over[${i}]`).id)
      : null;

  const fresh: Finding[] = [];
  const refound: Finding[] = [];
  let settledInline = 0;
  list(input, 'candidates', 'input').forEach((raw, i) => {
    const where = `input.candidates[${i}]`;
    const c = object(raw, where);
    const settled = c.settled_inline === true;
    if (settled) settledInline++;
    let verdict = choice(c, 'verdict', VERDICTS, where, false);
    if (!verdict && !unverified && !settled) {
      throw new InputError(`${where}.verdict: missing — a verified pass drops a candidate no verifier judged`);
    }
    const loc = location(c, where);
    const summary = text(c, 'summary', where) as string;
    if (verdict === 'refuted') {
      const reason = text(c, 'evidence', where) as string;
      state.refuted.push({ location: loc, summary, reason });
      return;
    }
    const ruling = choice(c, 'ruling', ['fix', 'decline'], where, false) as Finding['ruling'];
    if (c.same_as !== undefined) {
      if (!loop) throw new InputError(`${where}.same_as: only a --loop run tags re-finds`);
      const earlier = findingId(state, c.same_as, `${where}.same_as`);
      // A re-find the arbiter declines is not the finding back: it neither retries nor stops the run, and is
      // recorded as a declined finding of its own, so finders omit it from then on.
      if (ruling !== 'decline') {
        if (!refound.includes(earlier)) refound.push(earlier);
        return;
      }
    }
    if (unverified) verdict = undefined;
    const category = choice(c, 'category', CATEGORIES, where) as string;
    const finding: Finding = {
      id: 0,
      held: false,
      location: loc,
      also: list(c, 'also', where).map((a, j) => {
        if (typeof a !== 'string' || !a) throw new InputError(`${where}.also[${j}]: expected a location string`);
        return a;
      }),
      summary,
      failure_scenario: text(c, 'failure_scenario', where) as string,
      category,
      verdict: (verdict ?? (unverified ? null : 'confirmed')) as Finding['verdict'],
      evidence: text(c, 'evidence', where, false),
      ruling,
      opinion: text(c, 'opinion', where, ruling !== undefined),
      options: options(c, where),
    };
    if (ruling === 'decline') {
      finding.outcome = 'skipped';
      finding.reason = declineLine(finding);
    }
    fresh.push(finding);
  });
  const own = loop && arbiter ? arbiterFindings(state, arbiter, agent) : [];

  // Under --loop the cap sizes each batch rather than the report, so nothing is held back; a decline takes
  // no row, so it takes no place under the cap either.
  const kept = [...fresh, ...own];
  const cap = CAPS[state.level];
  let rows = 0;
  kept.forEach((f, i) => {
    f.id = state.findings.length + i + 1;
    f.held = !loop && f.ruling !== 'decline' && rows++ >= cap;
  });
  state.findings.push(...kept);
  agent.push(...warnings(kept));

  const declined = fresh.filter((f) => f.ruling === 'decline');
  // Every run applying fixes has an arbiter, so a finding it left unruled is named unjudged.
  const unjudged = state.mode !== 'report' ? fresh.filter((f) => !f.ruling) : [];
  if (loop) {
    const round: Round = {
      n: state.rounds.length + 1,
      delta_over: deltaOver,
      level,
      found: fresh.length + refound.length + own.length,
      new: kept.length,
      declined: declined.length,
      judged,
      recertify: false,
      unjudged: unjudged.map((f) => f.id),
      checks,
      trajectory: arbiter ? text(arbiter, 'trajectory', 'input.arbiter', false) : undefined,
      settled_inline: settledInline,
      spec: input.spec as boolean,
    };
    if (arbiter?.recertify !== undefined && typeof arbiter.recertify !== 'boolean') {
      throw new InputError('input.arbiter.recertify: expected true or false');
    }
    return loopRound(file, state, round, fresh, own, refound, agent, arbiter?.recertify === true);
  }

  // The report rows what the run acts on; its declines are a footer count, listed by held on request.
  const shown = kept.filter((f) => !f.held && f.ruling !== 'decline');
  const held = kept.filter((f) => f.held);

  const classes = classCounts(shown);
  const footer = [classes ? `Kept ${classes}` : 'Kept no findings'];
  if (held.length) footer.push(`${ids(held)} held back (ask for ${held.length === 1 ? 'it' : 'them'})`);
  if (unverified) {
    footer.push('single pass, unverified');
  } else {
    const verification = [
      settledInline ? `${settledInline} settled inline` : '',
      verifierCount ? `${plural(verifierCount, 'verifier')} (by ${grouping})` : '',
    ].filter(Boolean);
    if (verification.length) footer.push(verification.join(', '));
  }
  if (!input.spec) footer.push('no spec available');
  if (declined.length) footer.push(`⚖️ ${declined.length} declined (ask for ${declined.length === 1 ? 'it' : 'them'})`);
  if (unjudged.length) footer.push(`⚖️ unjudged: ${ids(unjudged)}`);

  const body = shown.map((f) => reportRow(state, f)).join('\n');
  const user = withLegend([body, footer.join(' · ')].filter(Boolean).join('\n\n'));

  save(file, state);
  if (state.mode === 'report') {
    agent.push('next: nothing to apply; call outcomes when a finding gets fixed later in this session');
  } else {
    const apply = shown.filter((f) => f.category !== 'spec');
    const spec = shown.filter((f) => f.category === 'spec');
    if (apply.length) agent.push(`next: apply ${ids(apply)} in ID order`);
    if (spec.length) agent.push(parkRoutes(spec));
    agent.push(shown.length ? `then: call outcomes over ${ids(shown)}` : 'next: close with the flow pointer');
  }
  if (held.length) agent.push(`held back: ${ids(held)}; call held when the user asks for them`);
  if (declined.length) agent.push(`declined by the arbiter: ${ids(declined)}; call held when the user asks for them`);
  return { user, agent, handoff: state.mode === 'fix' && shown.length ? 'fix' : undefined };
}

function parkRoutes(spec: Finding[]): string {
  return `next: park ${ids(spec)} with the two routes as options, since the user picks the route`;
}

function arbiterFindings(state: State, arbiter: Json, agent: string[]): Finding[] {
  const answered = new Set(state.findings.filter((f) => f.against).map((f) => f.against));
  return list(arbiter, 'findings', 'input.arbiter').flatMap((raw, i) => {
    const where = `input.arbiter.findings[${i}]`;
    const o = object(raw, where);
    const fix = findingId(state, o.against, `${where}.against`);
    if (!changed(fix)) throw new InputError(`${where}.against: F${fix.id} has no applied fix to answer`);
    const action = choice(o, 'action', ACTIONS, where) as string;
    // A route is the user's pick, so the arbiter weighs what its edit costs and leaves the route standing.
    if (fix.outcome === 'routed' && action === 'back out') {
      throw new InputError(`${where}.action: F${fix.id} took the route the user picked, so it can be shrunk, never backed out`);
    }
    const summary = text(o, 'summary', where) as string;
    const change = text(o, 'change', where) as string;
    // The arbiter gets one finding per applied fix over the whole run.
    if (answered.has(fix.id)) {
      agent.push(`not queued: the arbiter already answered F${fix.id}'s fix`);
      return [];
    }
    answered.add(fix.id);
    const own: Finding = {
      id: 0,
      held: false,
      location: fix.location,
      also: [],
      summary,
      failure_scenario: change,
      category: fix.category,
      verdict: 'confirmed',
      against: fix.id,
      action,
    };
    return [own];
  });
}

function loopRound(
  file: string,
  state: State,
  round: Round,
  fresh: Finding[],
  own: Finding[],
  refound: Finding[],
  agent: string[],
  asked: boolean,
): Result {
  const certifying = round.delta_over === null;
  const stood: Finding[] = [];
  const retry: Finding[] = [];
  for (const f of refound) {
    // Queued, parked, skipped and routed findings are not new; a returning outcome is retried once.
    if (f.outcome !== 'fixed' && f.outcome !== 'no_change_needed') continue;
    if (certifying && f.outcome === 'fixed') {
      stood.push(f);
    } else {
      if (f.retried) f.came_back = true;
      else f.retried = true;
      retry.push(f);
    }
    f.outcome = undefined;
  }
  if (stood.length) state.stop = { condition: 'fix_not_taking', tripped: ids(stood) };
  const queued = [...fresh.filter((f) => f.ruling !== 'decline'), ...own];
  state.queue.push(...[...queued, ...retry].map((f) => f.id));
  state.queue.unshift(...stood.map((f) => f.id));

  // fourth_novel_round counts gate calls past the run's first that left, after declines, a finding none before had.
  if (round.n > 1 && queued.length) {
    state.novel_rounds.push(round.n);
    if (state.novel_rounds.length >= 4 && !state.stop) {
      state.stop = { condition: 'fourth_novel_round', tripped: ids(state.novel_rounds, 'R') };
    }
  }
  if (certifying) state.due = false;
  // The arbiter may ask for one more certifying pass where delta rounds cannot vouch for the whole; the run grants one.
  if (asked && state.recertified) agent.push("not granted: the arbiter's one extra certifying pass is spent");
  if (asked && !state.recertified) state.due = state.recertified = round.recertify = true;
  // A delta round re-reviews only the fixes it names; the rest stay on the record for the next one.
  state.record = state.record.filter((id) => round.delta_over && !round.delta_over.includes(id));
  state.rounds.push(round);
  const step = next(state, !certifying);
  save(file, state);

  const back = retry.filter((f) => !f.came_back);
  if (back.length) agent.push(`retry: ${ids(back)} came back after ${back.length === 1 ? 'its' : 'their'} outcome, queued for one retry`);
  // The block rows only what the run acts on; its declines are a header count.
  return { user: roundBlock(state, round, queued), agent: [...agent, ...step.lines], handoff: step.handoff };
}

function checksText(checks: string): string {
  return checks === 'none' ? 'no checks' : checks === 'red' ? 'checks red' : 'checks at baseline';
}

function roundBlock(state: State, round: Round, rows: Finding[]): string {
  const scope = round.delta_over ? `🔬 delta over ${ids(round.delta_over) || 'nothing'}` : '🔎 certifying';
  const parts = [`**R${round.n}** ${scope}`, round.level, `${round.found} found`, `${round.new} new`];
  if (round.judged) parts.push(`⚖️ ${round.declined} declined`);
  if (round.recertify) parts.push('⚖️ asks a certifying pass');
  parts.push(checksText(round.checks));
  if (round.unjudged.length) parts.push(`⚖️ unjudged: ${ids(round.unjudged)}`);
  let head = parts.join(' · ');
  if (round.trajectory) head += `\n\n⚖️ *“${round.trajectory}”*`;
  return [head, rows.map((f) => reportRow(state, f)).join('\n')].filter(Boolean).join('\n\n');
}

// The loop's order, which LOOP.md leaves to these lines: certify the whole target once, apply the next batch, run a
// delta round over what it fixed, and close once nothing is left of either; a stop ends the run once its round ends.
function next(state: State, roundEnd: boolean): Step {
  const record = pendingRecord(state);
  // The novelty stop bounds a run that keeps finding work: one whose round ends with nothing left has converged,
  // and the stop lapses, which the caller saves.
  const novelty = state.stop?.condition === 'fourth_novel_round';
  if (novelty && roundEnd && !blocked(state)) state.stop = null;
  const stop = state.stop && `${state.stop.condition} — ${state.stop.tripped}`;
  if (stop && (roundEnd || state.stop?.condition === 'fix_not_taking')) {
    const bare = state.queue.filter((id) => !byId(state, id).options);
    const standing = bare.length ? ` with \`standing\` options for ${ids(bare)}` : '';
    return { handoff: 'close', lines: [`next: call close${standing}; the run stops on ${stop}`] };
  }
  const out: string[] = [];
  // A red the last gate call reported is settled first, lest the next batch take the blame for it.
  const red = !record.length && state.rounds.at(-1)?.checks === 'red';
  if (red) out.push('next: settle the red checks as LOOP.md says');
  let handoff: Handoff | undefined;
  if (record.length) {
    handoff = 'round';
    out.push(
      `next: run the checks, settling a red batch as LOOP.md says, then a delta round over the batch at the level it earns, at most ${state.level}; call report with delta_over ${JSON.stringify(record.map((f) => `F${f.id}`))} and that level and, where it has a candidate, the arbiter's reply`,
      ...ledgerLines(state),
    );
  } else if (state.queue.length) {
    handoff = 'fix';
    out.push(...batchAdvice(state));
  } else if (!stop && !blocked(state)) {
    // close needs no input here, so nothing is handed over: the agent calls it in the same turn.
    out.push('next: call close');
  } else if (red && !state.due) {
    // An edit made in settling the red joins the record through outcomes; a red settled without one needs only a
    // round to record that it is gone.
    out.push(
      'then: call outcomes over any edit repaired or backed out in settling it; where none was, rerun the checks and call report with delta_over [] and no candidates',
    );
  } else {
    handoff = 'round';
    out.push(`next: a certifying pass over the whole target at ${state.level}, then call report`, ...ledgerLines(state));
  }
  if (red) handoff = 'fix';
  if (stop) out.push(`then: call close once this round ends; the run stops on ${stop}${novelty ? ' if work is still standing then' : ''}`);
  return { handoff, lines: out };
}

// A stop a certifying pass tripped waits for that pass's batch, as the line its report printed says.
function roundEnded(state: State): boolean {
  const batch = state.stop?.condition === 'fourth_novel_round' && !state.rounds.at(-1)?.delta_over && state.queue.length;
  return !pendingRecord(state).length && !batch;
}

// What still keeps the run from GREEN or WAITING, which both rest on nothing being left to fix or re-review.
function blocked(state: State): string | undefined {
  const unreviewed = pendingRecord(state);
  if (state.queue.length) return `${ids(state.queue)} still queued`;
  if (unreviewed.length) return `${ids(unreviewed)} fixed but not yet re-reviewed`;
  if (state.due) return 'a certifying pass is due';
  if (state.rounds.at(-1)?.checks === 'red') return 'the checks are red';
}

// A routed finding's route may have changed the code, so it counts with the fixes wherever an edit does.
function changed(f: Finding): boolean {
  return f.outcome === 'fixed' || f.outcome === 'routed';
}

// A backed-out or reverted edit loses its outcome, so settling a red batch leaves the rest of its record.
function pendingRecord(state: State): Finding[] {
  return state.record.map((id) => byId(state, id)).filter(changed);
}

function batchAdvice(state: State): string[] {
  const batch = state.queue.slice(0, CAPS[state.level]).map((id) => byId(state, id));
  const routes = batch.filter(
    (f) => f.category === 'spec' && f.answered_epoch === undefined && !f.against && !f.came_back,
  );
  const back = batch.filter((f) => f.came_back);
  const apply = batch.filter((f) => !routes.includes(f) && !back.includes(f));
  const out: string[] = [];
  if (apply.length) out.push(`next: apply ${ids(apply)}`);
  if (routes.length) out.push(parkRoutes(routes));
  if (back.length) out.push(`next: park ${ids(back)}, since it came back after its retry`);
  out.push(`then: call outcomes over ${ids(batch)}`);
  return out;
}

// A finding the arbiter declined and nothing has overruled since: a count on every surface, listed by held.
function arbiterSkipped(f: Finding): boolean {
  return f.outcome === 'skipped' && f.ruling === 'decline';
}

// The disposition ledger's standing entries: what the run settled without a change to the tree.
function standing(f: Finding): boolean {
  return f.outcome === 'skipped' || f.outcome === 'routed';
}

// The finder-brief block: what a finder omits, so a skipped or refuted candidate is not raised again.
function ledgerLines(state: State): string[] {
  const gist = (reason: string | undefined) => {
    const chars = [...(reason ?? '')];
    return chars.length > LEDGER_REASON ? `${chars.slice(0, LEDGER_REASON).join('').trimEnd()}…` : chars.join('');
  };
  const entries = [
    ...state.findings.filter(standing).map((f) => {
      const reason = f.outcome === 'routed' ? `routed: route ${f.route}, ${gist(f.reason)}` : `skipped: ${gist(f.reason)}`;
      return `- F${f.id} \`${f.location}\`: ${f.summary} — ${reason}`;
    }),
    ...state.refuted.map((r) => `- \`${r.location}\`: ${r.summary} — refuted: ${gist(r.reason)}`),
  ];
  if (!entries.length) return [];
  return [
    'ledger, for every finder brief:',
    'Omit a candidate matching an entry below — same defect at the same location for the same reason; a different mechanism at a listed location, or a refuted entry whose proving line the tree no longer holds, is new.',
    ...entries,
  ];
}

function outcomes(file: string, input: Json): Result {
  const state = load(file);
  const loop = state.mode === 'loop';
  const batch: Finding[] = [];
  list(input, 'outcomes', 'input').forEach((raw, i) => {
    const where = `input.outcomes[${i}]`;
    const o = object(raw, where);
    const f = findingId(state, o.id, `${where}.id`);
    const outcome = choice(o, 'outcome', OUTCOMES, where) as string;
    const declinedSkip = outcome === 'skipped' && f.ruling === 'decline';
    const reason = text(o, 'reason', where, (outcome === 'skipped' && !declinedSkip) || outcome === 'routed');
    if (f.with && outcome !== 'parked') {
      // A reverted batch's item settled another way hands the rest of its batch, still parked, back to the queue.
      for (const m of f.with.map((id) => byId(state, id)).filter((m) => m.outcome === 'parked')) {
        m.outcome = undefined;
        state.queue.push(m.id);
      }
      f.with = undefined;
    }
    f.outcome = outcome;
    f.reason = declinedSkip && !reason ? declineLine(f) : reason;
    f.route = outcome === 'routed' ? text(o, 'route', where) : undefined;
    if (outcome === 'parked') {
      f.evidence = text(o, 'evidence', where, false) ?? f.evidence;
      f.tried = text(o, 'tried', where, false);
      f.tried_yours = o.tried_yours === true;
      f.options = options(o, where) ?? f.options;
      if (!f.options) throw new InputError(`${where}.options: a parked finding needs its options`);
      f.came_back = undefined;
      if (o.with !== undefined) {
        f.with = list(o, 'with', where).map((raw, j) => {
          const id = findingId(state, raw, `${where}.with[${j}]`).id;
          if (id === f.id) throw new InputError(`${where}.with[${j}]: F${id} is the finding the batch parks under`);
          return id;
        });
        if (!f.tried) throw new InputError(`${where}.tried: say what the reverted batch tried`);
        for (const id of f.with) byId(state, id).outcome = 'parked';
      }
      // asked_twice: a finding about to reach the user again after they answered it, a reverted batch counting as its item.
      const again = [f.id, ...(f.with ?? [])].filter((id) => byId(state, id).answered_epoch === state.epoch);
      // A pending novelty stop may lapse, so it gives way to this one.
      const free = !state.stop || state.stop.condition === 'fourth_novel_round';
      if (loop && again.length && free) state.stop = { condition: 'asked_twice', tripped: ids(again) };
    }
    if (outcome === 'fixed' && f.action === 'back out') {
      // A back-out turns the finding whose fix it removed to skipped, with the arbiter's reason.
      const answered = byId(state, f.against as number);
      Object.assign(answered, { outcome: 'skipped', reason: `⚖️ backed out by F${f.id}: ${f.summary}` });
      if (!batch.includes(answered)) batch.push(answered);
    }
    if (!batch.includes(f)) batch.push(f);
  });
  if (!batch.length) throw new InputError('input.outcomes: give at least one outcome');
  const record = batch.filter(changed);
  if (loop) {
    const gone = new Set(batch.flatMap((f) => [f.id, ...(f.with ?? [])]));
    state.queue = state.queue.filter((id) => !gone.has(id));
    state.record = [...new Set([...state.record, ...record.map((f) => f.id)])];
  }
  const step = loop && !state.stopped ? next(state, roundEnded(state)) : undefined;
  save(file, state);

  const rows = batch.sort((a, b) => a.id - b.id).map(outcomeRow).join('\n');
  // Under --loop the legend rides only on the closing report, so a long run does not repeat it.
  const user = loop ? rows : withLegend(rows);
  const agent: string[] = [];
  const parked = batch.filter((f) => f.outcome === 'parked');
  if (loop) {
    if (parked.length) {
      agent.push(`parked: ${ids(parked)}; keep working, and fold the user's answers in through answers at a round boundary`);
    }
    // A fix after a STOP is re-reviewed only where the user continues the run, never by waking the agent into a round.
    if (!step) return { user, agent: [...agent, 'next: the run stopped; answers or a --loop start continues it'] };
    return { user, agent: [...agent, ...step.lines], handoff: step.handoff };
  }
  const pending = state.findings.filter((f) => !f.held && !f.outcome);
  const waiting = openParked(state);
  if (waiting.length) {
    agent.push(`next: wait for the user's answers on ${ids(waiting)}, then call outcomes with what each led to`);
  }
  if (state.mode === 'fix' && pending.length) agent.push(`no outcome yet: ${ids(pending)}`);
  if (!waiting.length && !(state.mode === 'fix' && pending.length)) agent.push('next: close with the flow pointer');
  return { user, agent };
}

function held(file: string): Result {
  const state = load(file);
  const found = state.findings.filter((f) => f.held || arbiterSkipped(f));
  if (!found.length) return { user: 'Nothing was held back or declined.', agent: [] };
  const rows = found.map((f) => (f.outcome && !arbiterSkipped(f) ? outcomeRow(f) : reportRow(state, f)));
  return { user: withLegend(rows.join('\n')), agent: [] };
}

function answers(file: string, input: Json): Result {
  const state = load(file);
  if (state.mode !== 'loop') {
    throw new InputError('answers folds replies into a --loop run; elsewhere, call outcomes with what each answer led to');
  }
  const replies = list(input, 'answers', 'input');
  if (!replies.length) throw new InputError('input.answers: give at least one answer');
  // Answering after a STOP continues the run with fresh stop counts; after WAITING it resumes with its counts.
  if (state.stopped) resume(state);
  replies.forEach((raw, i) => {
    const where = `input.answers[${i}]`;
    const o = object(raw, where);
    const f = findingId(state, o.id, `${where}.id`);
    if (arbiterSkipped(f)) {
      throw new InputError(`${where}.id: F${f.id} was declined by the arbiter: to overrule it, apply the fix and call outcomes`);
    }
    if (!openParked(state).includes(f)) {
      throw new InputError(`${where}.id: F${f.id} is not waiting on an answer`);
    }
    const action = choice(o, 'action', ['queue', 'skip'], where) as string;
    const reason = text(o, 'reason', where, action === 'skip');
    for (const m of [f, ...(f.with ?? []).map((id) => byId(state, id))]) {
      m.answered_epoch = state.epoch;
      if (action === 'queue') {
        Object.assign(m, { outcome: undefined, reason: undefined });
        state.queue.push(m.id);
      } else {
        Object.assign(m, { outcome: 'skipped', reason });
      }
    }
    f.with = undefined;
  });
  const step = next(state, roundEnded(state));
  save(file, state);
  return { user: '', agent: step.lines };
}

function close(file: string, input: Json): Result {
  const state = load(file);
  if (state.mode !== 'loop') throw new InputError('close ends a --loop run; a one-shot run ends on its flow pointer');
  let line: string;
  let pointer: string;
  if (state.stop) {
    // The findings still queued stand with the parked ones, each with its options.
    const given = new Map<number, Option[] | undefined>();
    list(input, 'standing', 'input').forEach((raw, i) => {
      const where = `input.standing[${i}]`;
      const o = object(raw, where);
      given.set(findingId(state, o.id, `${where}.id`).id, options(o, where));
    });
    const missing = state.queue.filter((id) => !given.get(id) && !byId(state, id).options);
    if (missing.length) throw new InputError(`input.standing: give options for ${ids(missing)}, still queued`);
    for (const id of state.queue) {
      const f = byId(state, id);
      Object.assign(f, { outcome: 'parked', options: given.get(id) ?? f.options, came_back: undefined });
    }
    state.queue = [];
    line = `STOP: ${state.stop.condition} — ${state.stop.tripped}`;
    pointer =
      'pointer: /review-gate --loop (user-invoked) once the standing findings are settled, since nothing has reviewed the fixes since; answers or a --loop start continues this run with fresh stop counts';
    state.stopped = true;
  } else {
    const why = blocked(state);
    if (why) throw new InputError(`no ending reached: ${why}`);
    const open = openParked(state);
    line = open.length
      ? `WAITING: nothing left to fix or re-review, checks at baseline; ${open.length} parked — ${ids(open)}`
      : 'GREEN: nothing left to fix or re-review, checks at baseline';
    pointer = open.length
      ? `pointer: none until the user answers ${ids(open)}; answers resumes this run`
      : 'pointer: /commit (user-invoked), since every fix was re-reviewed';
  }
  save(file, state);
  return { user: closingReport(state, line), agent: [pointer] };
}

function closingReport(state: State, line: string): string {
  const rounds = state.rounds;
  const checks = rounds.at(-1)?.checks;
  const qualifier = [
    checks === 'none' ? 'The project has no checks' : checks === 'red' ? 'Checks red' : 'Checks at baseline',
  ];
  const unverified = rounds.filter((r) => r.level === 'inline').map((r) => r.n);
  if (unverified.length) {
    qualifier.push(unverified.length === rounds.length ? 'every pass ran unverified' : `${ids(unverified, 'R')} ran unverified`);
  }
  const declined = state.findings.filter(arbiterSkipped).length;
  if (declined) qualifier.push(`⚖️ ${declined} declined (ask for ${declined === 1 ? 'it' : 'them'})`);
  const unjudged = rounds.filter((r) => r.unjudged.length).map((r) => r.n);
  if (unjudged.length) qualifier.push(`⚖️ ${ids(unjudged, 'R')} ran unjudged`);

  const certifying = rounds.filter((r) => !r.delta_over).length;
  const fixed = state.findings.filter((f) => f.outcome === 'fixed' && !f.against);
  const classes = classCounts(fixed);
  const settled = rounds.reduce((sum, r) => sum + r.settled_inline, 0);
  const ledger = [
    `🧾 ${certifying} certifying ${certifying === 1 ? 'pass' : 'passes'}, ${plural(rounds.length - certifying, 'delta round')}`,
    classes ? `fixed ${classes}` : 'nothing fixed',
    settled ? `${settled} settled inline` : '',
    rounds.some((r) => r.spec) ? '' : 'no spec available',
  ].filter(Boolean);
  const head = [`\`${line}\``, qualifier.join(' · '), ledger.join(' · ')].join('\\\n');

  // The arbiter's declines stay the qualifier's count, as on round blocks.
  const settledRows = state.findings
    .filter((f) => standing(f) && !arbiterSkipped(f))
    .map(outcomeRow)
    .join('\n');
  const open = openParked(state).sort((a, b) => a.id - b.id);
  const example = open.map((f) => `F${f.id}: ${letter((f.options ?? []).findIndex((o) => o.recommended))}`);
  const waiting = open.length
    ? `⏸️ **Waiting on you** (answer as ${example.join(', ')})\n\n${open.map(outcomeRow).join('\n')}`
    : '';
  const key = legend([qualifier.join(' '), settledRows, waiting].join('\n'));
  return [head, key, settledRows, waiting].filter(Boolean).join('\n\n');
}

function ledger(file: string): Result {
  const lines = ledgerLines(load(file));
  return { user: '', agent: lines.length ? lines : ['ledger: empty, nothing skipped or refuted yet'] };
}

function warnings(findings: Finding[]): string[] {
  const out: string[] = [];
  // The limits are the finders'; an arbiter's own finding carries its change where a scenario would sit.
  for (const f of findings.filter((f) => !f.against)) {
    for (const [key, limit] of Object.entries(LIMITS)) {
      const length = [...(f[key as keyof typeof LIMITS] as string)].length;
      if (length > limit) out.push(`warning: F${f.id} ${key} runs ${length} characters, over the ${limit} limit`);
    }
  }
  return out;
}

// ── main ───────────────────────────────────────────────────────────────────────────────────────

function readInput(): Json {
  let raw = '';
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch (error) {
    // A call that takes no input may get a stdin nothing writes to, which reads as EAGAIN.
    if ((error as { code?: string }).code !== 'EAGAIN') throw error;
  }
  if (!raw.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new InputError(`stdin: malformed JSON (${(error as Error).message})`);
  }
  return object(parsed, 'input');
}

function emit(user: string, agent: string[]): void {
  const top = user ? `${user}\n\n` : '';
  // The cue sits where the agent reads on, since the next lines pull it past the block it owes the user.
  const lines = user ? ['paste: everything above the delimiter into your message, unaltered', ...agent] : agent;
  process.stdout.write(`${top}${DELIMITER}\n${lines.join('\n')}${lines.length ? '\n' : ''}`);
}

// An agent holds a block back until its turn ends, so a block followed by more work is the turn's last act,
// its agent lines left for the Stop hook to resume the agent with; a later call supersedes one never collected.
// Only Claude Code runs the skill's Stop hooks, and only node runs them, so elsewhere the block and its step
// stay in one output.
function handOver(file: string, result: Result): void {
  for (const kind of HANDOFFS) fs.rmSync(handoffPath(file, kind), { force: true });
  const hooked = process.env.CLAUDE_CODE_SESSION_ID && !process.versions.bun && !process.versions.deno;
  if (!result.handoff || !hooked) return emit(result.user, result.agent);
  fs.writeFileSync(handoffPath(file, result.handoff), `${result.agent.join('\n')}\n`, { mode: 0o600 });
  process.stdout.write(
    `${result.user}\n\n${DELIMITER}\npaste: everything above the delimiter into your message, unaltered, then end your turn: the gate resumes you with the next step\n`,
  );
}

// The agent's own call, where the user resumed the run in place of the Stop hook.
function resumed(file: string): Result {
  claimStateDir();
  for (const kind of HANDOFFS) {
    const pending = handoffPath(file, kind);
    if (!fs.existsSync(pending)) continue;
    const lines = fs.readFileSync(pending, 'utf8').trimEnd().split('\n');
    fs.rmSync(pending);
    return { user: '', agent: lines };
  }
  return { user: '', agent: ['nothing handed over: no step is pending'] };
}

// A hand-off is collected at the turn end that follows its call within seconds; one older than this was
// left by a turn that never ended normally, and waking the agent into it later would resume a stale run, so
// it waits for the agent's own resume or the next call.
const HANDOFF_TTL_MS = 10 * 60 * 1000;

// The Stop hook's call, at every turn end of a session that ran the skill: exit 2 wakes the agent with
// stderr as its next step, and nothing else may exit 2, so a hand-off wakes the agent at most once.
// The hook's own input names the session, since a hook's environment may not.
function resumeHook(kind: string): void {
  try {
    if (!HANDOFFS.includes(kind)) throw new Error(`unknown hand-off "${kind}": give ${HANDOFFS.join(', ')}`);
    const input = JSON.parse(fs.readFileSync(0, 'utf8')) as Json;
    // Most turn ends hand nothing over, so they stop here, before git runs; no state directory, no run.
    let names: string[] = [];
    try {
      names = fs.readdirSync(stateDir());
    } catch {
      return;
    }
    if (!names.some((name) => name.endsWith(`.${kind}.pending`))) return;
    if (typeof input.cwd === 'string') process.chdir(input.cwd);
    const sessions = [...new Set([envSession(), input.session_id].filter((s) => typeof s === 'string' && s))];
    claimStateDir();
    for (const session of sessions.length ? (sessions as string[]) : [undefined]) {
      const pending = handoffPath(statePath(session), kind);
      if (!fs.existsSync(pending)) continue;
      if (Date.now() - fs.statSync(pending).mtimeMs >= HANDOFF_TTL_MS) return;
      const step = fs.readFileSync(pending, 'utf8');
      fs.rmSync(pending);
      process.stderr.write(step);
      process.exitCode = 2;
      return;
    }
  } catch (error) {
    process.stderr.write(`/review-gate could not resume the run: ${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}

function main(): void {
  const command = process.argv[2];
  if (command === 'resume' && process.argv[3] !== undefined) return resumeHook(process.argv[3]);
  let file = '(unresolved)';
  try {
    file = statePath();
    let result: Result;
    if (command === 'start') result = start(file, readInput());
    else if (command === 'report') result = report(file, readInput());
    else if (command === 'outcomes') result = outcomes(file, readInput());
    else if (command === 'answers') result = answers(file, readInput());
    else if (command === 'close') result = close(file, readInput());
    else if (command === 'held') result = held(file);
    else if (command === 'ledger') result = ledger(file);
    else if (command === 'resume') result = resumed(file);
    else {
      throw new InputError(
        `unknown subcommand "${command}": give start, report, outcomes, answers, close, held, ledger or resume`,
      );
    }
    if (['held', 'ledger', 'resume'].includes(command)) emit(result.user, result.agent);
    else handOver(file, result);
  } catch (error) {
    if (error instanceof InputError) {
      emit('', [`input error: ${error.message}`]);
      process.exitCode = 2;
    } else {
      emit('', [`fault: ${(error as Error).stack ?? error}`, `state: ${file}`]);
      process.exitCode = 1;
    }
  }
}

main();
