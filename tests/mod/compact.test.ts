// The keep list a compaction carries, under node --test.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { keepList, withKeepList } from '../../mod/core/compact.ts'
import { buildFeatureView } from '../../mod/core/feature.ts'
import { INITIAL } from '../../mod/core/loop.ts'
import type { GateView, LoopState } from '../../mod/types/index.d.ts'

const feature = buildFeatureView(
  'csv-export',
  [
    { name: 'spec.md', text: '# CSV export\n' },
    { name: '03-header-row.md', text: '# 03 — Header row\n\n- [ ] A header.\n' },
  ],
  '03-header-row.md',
)

const gate: GateView = {
  level: 'high',
  mode: 'loop',
  isAutonomous: false,
  target: 'the staged changes',
  phase: 'waiting',
  round: 2,
  counts: { done: 3, skipped: 0, declined: 0, forYou: 2, queued: 0, open: 0, held: 0 },
  verdicts: { confirmed: 5, plausible: 0, unverified: 0, refuted: 1 },
  queue: [],
  forYou: [
    { id: 4, summary: 'an empty report exports no header row' },
    { id: 7, summary: 'the delimiter setting is ignored on re-export' },
  ],
  stop: null,
}

const LEAD =
  'Copy these cantrips loop lines into the summary verbatim, keeping paths, not file contents:'
const ASK =
  "Also keep from the chat: the user's intent for this diff, in their words; each decision on" +
  " the spec, a ticket or a finding, with the finding's id and the reason; what was tried and" +
  ' ruled out on this ticket; the questions still open to the user.'

const state = (over: Partial<LoopState> = {}): LoopState => ({
  ...INITIAL,
  stage: 'review-gate',
  feature,
  ...over,
})

test('no feature selected, no keep list', () => {
  assert.equal(keepList(state({ feature: null, gate })), null)
})

test('a waiting gate run lists its arguments, round and parked findings', () => {
  assert.equal(
    keepList(state({ gate, deputy: 'advisor' })),
    [
      LEAD,
      '- csv-export at /review-gate; .scratch/csv-export/spec.md,' +
        ' .scratch/csv-export/03-header-row.md',
      '- /review-gate high --loop on the staged changes, round 2, waiting on the user for' +
        ' F4 (an empty report exports no header row), F7 (the delimiter setting is ignored on' +
        ' re-export)',
      '- Deputy: advisor',
      ASK,
    ].join('\n'),
  )
})

test('a feature alone: no stage, no ticket, no gate, no deputy reported or one dismissed', () => {
  const bare = { ...feature, litTicket: null }
  for (const deputy of [null, 'off'] as const) {
    assert.equal(
      keepList(state({ stage: null, feature: bare, deputy })),
      [LEAD, '- csv-export; .scratch/csv-export/spec.md', ASK].join('\n'),
    )
  }
  const unspecified = { ...bare, hasSpec: false }
  assert.equal(
    keepList(state({ stage: 'tickets', feature: unspecified })),
    [LEAD, '- csv-export at /tickets', ASK].join('\n'),
  )
})

test('the gate line words each phase, the way out only once the run stopped', () => {
  const line = (over: Partial<GateView>) =>
    keepList(state({ gate: { ...gate, forYou: [], ...over } }))?.split('\n')[2]
  assert.equal(
    line({ phase: 'reviewing' }),
    '- /review-gate high --loop on the staged changes, round 3, reviewing',
  )
  assert.equal(
    line({ phase: 'fixing' }),
    '- /review-gate high --loop on the staged changes, round 2, fixing',
  )
  assert.equal(
    line({ phase: 'green', isAutonomous: true }),
    '- /review-gate high --fsd on the staged changes, round 2, green',
  )
  assert.equal(
    line({ phase: 'stopped', stop: { condition: 'rounds', tripped: 'round 5 reached' } }),
    '- /review-gate high --loop on the staged changes, round 2, stopped; then /review-gate --loop',
  )
  assert.equal(
    line({ mode: 'report', phase: 'done', round: 0 }),
    '- /review-gate high on the staged changes, done',
  )
  assert.equal(
    line({ mode: 'fix', phase: 'fixing', round: 0 }),
    '- /review-gate high --fix on the staged changes, fixing',
  )
})

test('every parked finding is kept with its summary', () => {
  const forYou = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, summary: `s${i + 1}` }))
  const line = keepList(state({ gate: { ...gate, forYou } }))?.split('\n')[2]
  assert.match(line ?? '', /waiting on the user for F1 \(s1\), .*F6 \(s6\), F7 \(s7\)$/)
  const fixing = keepList(state({ gate: { ...gate, phase: 'fixing', forYou: forYou.slice(0, 1) } }))
  assert.match(fixing ?? '', /round 2, fixing, parked for the user: F1 \(s1\)$/m)
})

test('the keep list follows the instructions typed, or stands alone', () => {
  assert.equal(withKeepList(undefined, 'LIST'), 'LIST')
  assert.equal(withKeepList('  ', 'LIST'), 'LIST')
  assert.equal(withKeepList('for code review', 'LIST'), 'for code review\n\nLIST')
})
