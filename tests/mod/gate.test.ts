// The gate's state file and the words drawn from it, under node --test.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  barCells,
  fitIds,
  gateChip,
  gateStatus,
  headline,
  isGateCall,
  metaLine,
  parseGate,
  resumeCommand,
  startPath,
  stopText,
  verdictParts,
  wayOut,
} from '../../mod/core/gate.ts'
import { INITIAL, chipText } from '../../mod/core/loop.ts'
import type { GateView } from '../../mod/types/index.d.ts'

const SCRIPT = 'node "/plugins/cantrips/skills/review-gate/scripts/findings.ts"'
const PATH = '/tmp/cantrips-1000/review-gate/sid-1-0123456789ab.json'

const finding = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  held: false,
  location: `a.ts:${id}`,
  also: [],
  summary: `summary ${id}`,
  failure_scenario: 'F',
  category: 'correctness',
  verdict: 'confirmed',
  ...over,
})

// A --loop run in its third round: a batch in flight, fixes landed, a skip, a decline, two parked
// as one reverted batch and one parked alone.
const state = (over: Record<string, unknown> = {}) => ({
  level: 'medium',
  mode: 'loop',
  target: 'the working tree against main',
  phase: 'fixing',
  findings: [
    finding(1, { outcome: 'fixed' }),
    finding(2, { verdict: 'plausible', outcome: 'skipped' }),
    finding(3, { outcome: 'skipped', ruling: 'decline' }),
    finding(4, { outcome: 'parked', kind: 'user', with: [5] }),
    finding(5, { outcome: 'parked', kind: 'user' }),
    finding(6, { outcome: 'parked', kind: 'user' }),
    finding(7),
    finding(8, { verdict: 'plausible' }),
    finding(9, { verdict: null, outcome: 'no_change_needed' }),
  ],
  refuted: [{ location: 'b.ts:1', summary: 'R', reason: 'no' }],
  autonomous: false,
  queue: [7, 8],
  rounds: [{ n: 1 }, { n: 2 }, { n: 3 }],
  epoch: 0,
  novel_rounds: [2],
  record: [],
  stop: null,
  due: false,
  recertified: false,
  stopped: false,
  ...over,
})

const view = (over: Record<string, unknown> = {}): GateView => {
  const parsed = parseGate(JSON.stringify(state(over)))
  assert.ok(parsed !== null)
  return parsed
}

test('isGateCall knows a shell command naming the findings script', () => {
  assert.equal(isGateCall(`${SCRIPT} report <<'EOF'\n{}\nEOF`), true)
  assert.equal(isGateCall('node scripts/findings.ts ledger'), true)
  // A Windows path, its separators backslashes.
  assert.equal(isGateCall('node C:\\cantrips\\scripts\\findings.ts start'), true)
  assert.equal(isGateCall('cat findings.txt'), false)
  assert.equal(isGateCall('node scripts/my-findings.tsx start'), false)
})

test('startPath takes the state line a start call prints after the delimiter', () => {
  const output = `── agent ──\nstate: ${PATH}\nnext: run Scope and the gate, then call report\n`
  assert.equal(startPath(`${SCRIPT} start <<'EOF'\n{"level":"low"}\nEOF`, output), PATH)
  // A path with a space in the temporary directory holds whole.
  const spaced = output.replace('/tmp/', '/tmp dir/')
  assert.equal(startPath(`${SCRIPT} start`, spaced), PATH.replace('/tmp/', '/tmp dir/'))
  // A shell that hands the output over with CRLF line ends.
  assert.equal(startPath(`${SCRIPT} start`, output.replaceAll('\n', '\r\n')), PATH)
})

test('startPath answers null for any other call or output', () => {
  const output = `── agent ──\nstate: ${PATH}\n`
  // A fault prints the line too, on a call that is not a start.
  assert.equal(startPath(`${SCRIPT} report`, output), null)
  assert.equal(startPath('echo start', output), null)
  const failed = '── agent ──\ninput error: input.level: missing\n'
  assert.equal(startPath(`${SCRIPT} start`, failed), null)
  // The line counts only below the delimiter, where the script's agent lines go.
  assert.equal(startPath(`${SCRIPT} start`, `state: ${PATH}\n`), null)
})

test('parseGate reads the run as the script recorded it', () => {
  const gate = view()
  assert.equal(gate.level, 'medium')
  assert.equal(gate.mode, 'loop')
  assert.equal(gate.isAutonomous, false)
  assert.equal(gate.target, 'the working tree against main')
  assert.equal(gate.phase, 'fixing')
  assert.equal(gate.round, 3)
  assert.deepEqual(gate.queue, [7, 8])
  assert.equal(gate.stop, null)
})

test('parseGate counts each finding once by where it stands', () => {
  assert.deepEqual(view().counts, {
    done: 2,
    skipped: 1,
    declined: 1,
    // A reverted batch parks as one item: F5 rides under F4.
    forYou: 2,
    queued: 2,
    open: 0,
    held: 0,
  })
  assert.deepEqual(view().verdicts, { confirmed: 6, plausible: 2, unverified: 1, refuted: 1 })
  const report = view({
    mode: 'report',
    phase: 'done',
    findings: [finding(1), finding(2), finding(3, { held: true })],
    queue: [],
    rounds: [],
  })
  assert.deepEqual(report.counts, {
    done: 0,
    skipped: 0,
    declined: 0,
    forYou: 0,
    queued: 0,
    open: 2,
    held: 1,
  })
})

test('parseGate lists what waits on the user with its summary', () => {
  assert.deepEqual(view().forYou, [
    { id: 4, summary: 'summary 4' },
    { id: 6, summary: 'summary 6' },
  ])
})

test('parseGate leaves to the arbiter what --fsd puts to it, until a stop hands it back', () => {
  const findings = [
    finding(1, { outcome: 'parked', kind: 'worth' }),
    finding(2, { outcome: 'parked', kind: 'user' }),
  ]
  const ids = (over: Record<string, unknown>) =>
    view({ findings, ...over }).forYou.map(one => one.id)
  assert.deepEqual(ids({ autonomous: true }), [2])
  // The arbiter's question still counts, as open work.
  const counts = view({ findings, autonomous: true }).counts
  assert.deepEqual([counts.forYou, counts.open], [1, 1])
  assert.deepEqual(ids({ autonomous: true, phase: 'stopped', stopped: true }), [1, 2])
  assert.deepEqual(ids({}), [1, 2])
})

test('parseGate answers null where a field the pane reads is missing or malformed', () => {
  assert.equal(parseGate('not json'), null)
  assert.equal(parseGate('null'), null)
  const fields = ['level', 'mode', 'target', 'phase', 'findings', 'refuted', 'queue', 'rounds']
  for (const field of [...fields, 'stop', 'autonomous']) {
    const held: Record<string, unknown> = state()
    delete held[field]
    assert.equal(parseGate(JSON.stringify(held)), null, field)
  }
  // A run the script started before it recorded its phase, or a phase it does not know.
  assert.equal(parseGate(JSON.stringify(state({ phase: 'idle' }))), null)
  assert.equal(parseGate(JSON.stringify(state({ stop: { condition: 'x' } }))), null)
  assert.equal(parseGate(JSON.stringify(state({ queue: ['4'] }))), null)
  const bad = [{ id: 'F1' }, { verdict: 'refuted' }, { summary: 3 }, { with: ['F2'] }]
  for (const over of bad) {
    const findings = [{ ...finding(1), ...over }]
    assert.equal(parseGate(JSON.stringify(state({ findings }))), null, JSON.stringify(over))
  }
})

test('headline words the phase and the round', () => {
  assert.equal(headline(view({ phase: 'reviewing' })), 'reviewing round 4')
  assert.equal(headline(view({ phase: 'reviewing', rounds: [] })), 'reviewing round 1')
  assert.equal(headline(view()), 'fixing · round 3')
  assert.equal(headline(view({ phase: 'waiting' })), 'waiting on you · round 3')
  assert.equal(headline(view({ phase: 'green' })), 'green · 3 rounds')
  assert.equal(headline(view({ phase: 'stopped' })), 'stopped · round 3')
  assert.equal(headline(view({ mode: 'report', phase: 'reviewing', rounds: [] })), 'reviewing')
  assert.equal(headline(view({ mode: 'report', phase: 'done', rounds: [] })), 'reported')
  assert.equal(headline(view({ mode: 'fix', phase: 'done', rounds: [] })), 'fixed')
  // A --fix run that fixed nothing only reported.
  const unfixed = { mode: 'fix', phase: 'done', rounds: [], queue: [] }
  const skipped = [finding(1, { outcome: 'skipped' })]
  assert.equal(headline(view({ ...unfixed, findings: skipped })), 'reported')
  assert.equal(headline(view({ ...unfixed, findings: [] })), 'reported')
  assert.equal(headline(view({ mode: 'fix', phase: 'fixing', rounds: [] })), 'fixing')
})

test('metaLine names the level, the argument and the target', () => {
  const target = 'the working tree against main'
  assert.equal(metaLine(view()), `medium · --loop · ${target}`)
  assert.equal(metaLine(view({ autonomous: true })), `medium · --fsd · ${target}`)
  assert.equal(metaLine(view({ mode: 'fix' })), `medium · --fix · ${target}`)
  // A run given no flag shows none.
  assert.equal(metaLine(view({ mode: 'report' })), `medium · ${target}`)
})

test('verdictParts words the verdicts, a zero left out', () => {
  assert.deepEqual(verdictParts(view()), [
    'confirmed 6',
    'plausible 2',
    'not verified 1',
    'refuted 1',
  ])
  assert.deepEqual(verdictParts(view({ findings: [finding(1)], refuted: [] })), ['confirmed 1'])
  assert.deepEqual(verdictParts(view({ findings: [], refuted: [] })), [])
})

test('barCells shares the width by count, a non-zero state keeping a cell', () => {
  const counts = {
    ...view().counts,
    done: 142,
    skipped: 12,
    declined: 4,
    forYou: 3,
    queued: 15,
    open: 24,
  }
  const cells = barCells(counts, 40)
  // The arbiter's declines come last, past what the run still works on.
  assert.deepEqual(
    cells.map(one => one.kind),
    ['done', 'skipped', 'forYou', 'queued', 'open', 'declined'],
  )
  assert.equal(cells.reduce((sum, one) => sum + one.cells, 0), 40)
  assert.ok(cells.every(one => one.cells >= 1))
  // 3 of 200 is under one cell's share, and keeps one.
  assert.equal(cells.find(one => one.kind === 'forYou')?.cells, 1)
  const ones = { done: 1000, skipped: 1, declined: 1, forYou: 1, queued: 1, open: 1 }
  assert.deepEqual(barCells({ ...counts, ...ones }, 6).map(one => one.cells), [1, 1, 1, 1, 1, 1])
  const none = { done: 0, skipped: 0, declined: 0, forYou: 0, queued: 0, open: 0 }
  assert.deepEqual(barCells({ ...counts, ...none }, 40), [])
})

test('fitIds fits the ids it can, then counts the rest', () => {
  assert.equal(fitIds([7, 8], 40), 'F7 F8')
  const many = Array.from({ length: 15 }, (_, i) => 40 + i)
  assert.equal(fitIds(many, 30), 'F40 F41 F42 F43 F44 F45 F46 +8')
  assert.equal(fitIds(many, 29), 'F40 F41 F42 F43 F44 F45 +9')
  assert.ok(fitIds(many, 30).length <= 30)
  assert.equal(fitIds(many, 3), '+15')
  assert.equal(fitIds([], 30), '')
})

test('stopText words each condition the script trips, and a new one as given', () => {
  const stop = (condition: string, tripped: string) => view({ stop: { condition, tripped } })
  assert.equal(stopText(stop('fix_not_taking', 'F41, F44')), "Fixes didn't hold for F41, F44.")
  assert.equal(stopText(stop('fourth_novel_round', 'R2–R5')), 'Rounds R2–R5 each found new issues.')
  assert.equal(stopText(stop('asked_twice', 'F4, F5')), 'F4, F5 came back after your answer.')
  assert.equal(stopText(stop('out_of_time', 'R9')), 'out_of_time: R9.')
  assert.equal(stopText(view()), null)
})

test('wayOut names the argument that continues the run', () => {
  assert.equal(resumeCommand(view({ autonomous: true })), '/review-gate --fsd')
  assert.equal(wayOut(view()), "Settle what's for you, then /review-gate --loop.")
  const handsOff = view({ autonomous: true })
  assert.equal(wayOut(handsOff), "Settle what's for you, then /review-gate --fsd.")
})

test('gateStatus speaks once the run stopped or waits on the user, and is clear otherwise', () => {
  const stop = { condition: 'fix_not_taking', tripped: 'F41, F44' }
  assert.equal(
    gateStatus(view({ phase: 'stopped', stop, stopped: true })),
    "review gate stopped. Fixes didn't hold for F41, F44. " +
      "Settle what's for you, then /review-gate --loop.",
  )
  // A stop tripped in a run still at work may lapse before it closes.
  assert.equal(gateStatus(view({ stop })), undefined)
  assert.equal(gateStatus(view({ phase: 'waiting' })), 'review gate waits on you: F4, F6 parked.')
  const many = view({
    phase: 'waiting',
    findings: Array.from({ length: 8 }, (_, i) => finding(i + 1, { outcome: 'parked' })),
  })
  const named = 'F1, F2, F3, F4, F5 and 3 more'
  assert.equal(gateStatus(many), `review gate waits on you: ${named} parked.`)
  assert.equal(gateStatus(view({ phase: 'green' })), undefined)
  assert.equal(gateStatus(null), undefined)
})

test('gateChip carries the one fact that matters most', () => {
  assert.equal(gateChip(view({ phase: 'stopped' })), 'gate stopped')
  assert.equal(gateChip(view()), '2 for you')
  assert.equal(gateChip(view({ findings: [finding(7), finding(8)] })), '2 queued')
  assert.equal(gateChip(view({ phase: 'green', findings: [], queue: [] })), 'gate green')
  const report = view({ mode: 'report', phase: 'done', findings: [finding(1)], queue: [] })
  assert.equal(gateChip(report), '1 open')
  assert.equal(gateChip(view({ phase: 'reviewing', findings: [], queue: [] })), null)
})

test('chipText carries the gate while a run is in view', () => {
  const inView = { ...INITIAL, stage: 'review-gate' as const, gate: view() }
  assert.equal(chipText(inView), 'review-gate · 2 for you')
  const quiet = view({ phase: 'reviewing', findings: [], queue: [] })
  assert.equal(chipText({ ...INITIAL, stage: 'review-gate', gate: quiet }), 'review-gate')
  assert.equal(chipText({ ...INITIAL, stage: 'review-gate' }), 'review-gate')
})
