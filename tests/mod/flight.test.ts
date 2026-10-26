// The features in flight and their store records, under node --test.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  SESSION_TTL_MS,
  featureRecord,
  flightRows,
  flightText,
  formatAge,
  listedFlight,
  liveTicket,
  pruneRecords,
  recordedFeature,
  selectFeature,
  staleSessions,
  touchFeature,
} from '../../mod/core/flight.ts'
import type { Records } from '../../mod/core/flight.ts'
import { buildFeatureView, parseTicket } from '../../mod/core/feature.ts'
import type { Entry } from '../../mod/core/feature.ts'
import { INITIAL, reduceSkill } from '../../mod/core/loop.ts'
import type { FeatureRecord, FlightRow } from '../../mod/types/index.d.ts'

const file = (name: string, mtimeMs = 0): Entry => ({ name, kind: 'file', mtimeMs })

const OPEN = '# 01 — Open\n\n- [ ] Pending.\n'
const DONE = '# 02 — Done\n\nStatus: resolved\n\n- [x] Done.\n'
const view = buildFeatureView(
  'alpha',
  [
    { name: 'spec.md', text: '# Alpha\n' },
    { name: '01-open.md', text: OPEN },
    { name: '02-done.md', text: DONE },
  ],
  null,
)

const record = (over: Partial<FeatureRecord> = {}): FeatureRecord => ({
  session: 'sid-old',
  stage: 'implement',
  trail: ['grilling', 'spec', 'tickets', 'implement'],
  touchedAt: 500,
  ...over,
})

test('stages entered before a touch join the first feature touched, and only it', () => {
  const grilled = reduceSkill(INITIAL, 'cantrips:grilling', 'cantrips', 1)
  const specced = reduceSkill(grilled, 'cantrips:spec', 'cantrips', 2)
  assert.deepEqual(specced.pending, ['grilling', 'spec'])

  const first = touchFeature(specced, 'alpha', undefined)
  assert.equal(first.touched, 'alpha')
  assert.deepEqual(first.trail, ['grilling', 'spec'])
  assert.deepEqual(first.pending, [])
  assert.equal(touchFeature(first, 'alpha', record()), first)

  // A stage entered once a feature is touched stays off the pending list.
  const ticketed = reduceSkill(first, 'cantrips:tickets', 'cantrips', 3)
  assert.deepEqual(ticketed.trail, ['grilling', 'spec', 'tickets'])
  assert.deepEqual(ticketed.pending, [])

  // A switch carries no stage: the new feature keeps its own trail and stored stage.
  const stored = record({ stage: 'spec', trail: ['spec'] })
  const second = touchFeature(ticketed, 'beta', stored)
  assert.deepEqual(second.trail, ['spec'])
  assert.deepEqual(featureRecord('sid-1', second, stored, 9).stage, 'spec')
})

test('a touched feature takes its stored trail ahead of the pending stages', () => {
  const state = reduceSkill(INITIAL, 'cantrips:review-gate', 'cantrips', 1)
  const touched = touchFeature(state, 'alpha', record())
  assert.deepEqual(touched.trail, ['grilling', 'spec', 'tickets', 'implement', 'review-gate'])
})

test('featureRecord keeps the stored stage while the session has none, and the lit ticket', () => {
  const selected = selectFeature(INITIAL, view, '01-open.md', record())
  assert.deepEqual(featureRecord('sid-new', selected, record(), 900), {
    session: 'sid-new',
    stage: 'implement',
    trail: ['grilling', 'spec', 'tickets', 'implement'],
    ticket: '01-open.md',
    touchedAt: 900,
  })
  const committing = reduceSkill(selected, 'cantrips:commit', 'cantrips', 2)
  assert.equal(featureRecord('sid-new', committing, record(), 900).stage, 'commit')
})

test('a call lights the ticket it names, else the stored one while it stands unresolved', () => {
  const specced = reduceSkill(INITIAL, 'cantrips:spec', 'cantrips', 1)
  const named = selectFeature(specced, view, '02-done.md', record({ ticket: '01-open.md' }))
  assert.equal(named.feature?.litTicket, '02-done.md')
  assert.equal(named.touched, 'alpha')
  assert.deepEqual(named.trail, ['grilling', 'spec', 'tickets', 'implement'])
  assert.deepEqual(named.pending, [])

  const bare = (ticket?: string | null) => selectFeature(INITIAL, view, null, record({ ticket }))
  assert.equal(bare('01-open.md').feature?.litTicket, '01-open.md')
  assert.equal(bare('02-done.md').feature?.litTicket, null)
  assert.equal(bare('09-gone.md').feature?.litTicket, null)
  // A record written before the ticket was kept has none.
  assert.equal(bare(undefined).feature?.litTicket, null)
  assert.equal(liveTicket('01-open.md', view.tickets), '01-open.md')
  assert.equal(liveTicket(null, view.tickets), null)
})

test('recordedFeature finds the feature a resumed session last selected', () => {
  const records: Records = {
    alpha: record({ session: 'sid-a', touchedAt: 100 }),
    beta: record({ session: 'sid-a', touchedAt: 300 }),
    gamma: record({ session: 'sid-b', touchedAt: 900 }),
  }
  assert.equal(recordedFeature(records, 'sid-a'), 'beta')
  assert.equal(recordedFeature(records, 'sid-new'), null)
  assert.equal(recordedFeature(records, null), null)
})

test('pruneRecords drops the features whose folder is gone', () => {
  const records: Records = { alpha: record(), gone: record() }
  assert.deepEqual(Object.keys(pruneRecords(records, ['alpha', 'beta'])), ['alpha'])
  const kept = { alpha: record() }
  assert.equal(pruneRecords(kept, ['alpha']), kept)
})

test('staleSessions names the session records past the TTL or never stamped', () => {
  const now = SESSION_TTL_MS + 10_000
  const entries: [string, unknown][] = [
    ['session:fresh', { at: now - 1000 }],
    ['session:old', { at: 5_000 }],
    ['session:unstamped', { isPaneClosed: true }],
    ['repo:/r', {}],
  ]
  assert.deepEqual(staleSessions(entries, now), ['session:old', 'session:unstamped'])
})

test('flightRows reads stage, last touch, spec and tickets, and offers Resume elsewhere', () => {
  const folders = [
    { slug: 'alpha', entries: [file('spec.md', 100), file('01-a.md', 700)], stored: null },
    { slug: 'beta', entries: [file('spec.md', 200), file('notes.md', 9_000)], stored: null },
    { slug: 'gamma', entries: [file('spec.md', 300)], stored: null },
  ]
  const records: Records = {
    alpha: record({ session: 'sid-now', touchedAt: 600 }),
    beta: record({ session: 'sid-old', stage: 'grilling', touchedAt: 800 }),
  }
  const rows = flightRows(folders, records, 'sid-now')
  assert.deepEqual(rows, [
    {
      slug: 'beta',
      stage: 'grilling',
      touchedAt: 9_000,
      hasSpec: true,
      tickets: 0,
      ticket: null,
      resume: 'sid-old',
    },
    {
      slug: 'alpha',
      stage: 'implement',
      touchedAt: 700,
      hasSpec: true,
      tickets: 1,
      ticket: null,
      resume: null,
    },
    {
      slug: 'gamma',
      stage: 'spec',
      touchedAt: 300,
      hasSpec: true,
      tickets: 0,
      ticket: null,
      resume: null,
    },
  ])
})

test('a row shows the stored ticket while it stands unresolved', () => {
  const entries = [file('spec.md'), file('01-open.md'), file('02-done.md')]
  const row = (stored: ReturnType<typeof parseTicket> | null) =>
    flightRows([{ slug: 'alpha', entries, stored }], {}, null)[0]?.ticket
  assert.equal(row(parseTicket('01-open.md', OPEN)), '01')
  assert.equal(row(parseTicket('02-done.md', DONE)), null)
  assert.equal(row(null), null)
})

test('flightText words a row', () => {
  const row: FlightRow = {
    slug: 'alpha',
    stage: 'implement',
    touchedAt: 1_000,
    hasSpec: true,
    tickets: 6,
    ticket: null,
    resume: null,
  }
  assert.equal(flightText(row, 1_000 + 7_500_000), 'implement · 2h05m ago · spec ✓ · 6 tickets')
  assert.equal(flightText({ ...row, ticket: '03' }, 1_000), 'implement · 0s ago · spec ✓ · 03/6')
  const bare = { ...row, stage: null, touchedAt: 0, hasSpec: false, tickets: 1 }
  assert.equal(flightText(bare, 5), 'no spec · 1 ticket')
  assert.equal(
    flightText({ ...row, tickets: 0 }, 1_000),
    'implement · 0s ago · spec ✓ · no tickets',
  )
  assert.equal(formatAge(3 * 24 * 60 * 60 * 1000 + 5), '3d ago')
})

test('listedFlight lists nothing that only repeats the feature in view', () => {
  const row: FlightRow = {
    slug: 'alpha',
    stage: 'spec',
    touchedAt: 1,
    hasSpec: true,
    tickets: 0,
    ticket: null,
    resume: null,
  }
  const feature = { slug: 'alpha', hasSpec: true, annotations: 0, tickets: [], litTicket: null }
  const alone = { ...INITIAL, feature, inFlight: [row] }
  assert.deepEqual(listedFlight(alone), [])
  assert.equal(listedFlight({ ...alone, inFlight: [{ ...row, resume: 'sid-old' }] }).length, 1)
  const two = { ...alone, inFlight: [row, { ...row, slug: 'beta' }] }
  assert.equal(listedFlight(two).length, 2)
})
