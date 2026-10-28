// The loop state and the words drawn from it, under node --test.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  INITIAL,
  chipText,
  formatDuration,
  isStruck,
  plural,
  railStops,
  reduceSkill,
  skillName,
  withFileTrail,
} from '../../mod/core/loop.ts'
import type { FeatureView, Stage, Ticket } from '../../mod/types/index.d.ts'

const ticket = (over: Partial<Ticket>): Ticket => ({
  file: '01-a.md',
  number: '01',
  title: 'A',
  blockedBy: [],
  isResolved: false,
  criteriaDone: 0,
  criteriaTotal: 0,
  ...over,
})

const feature: FeatureView = {
  slug: 'f',
  hasSpec: true,
  annotations: 0,
  tickets: [ticket({}), ticket({ file: '02-b.md', number: '02', title: 'B' })],
  litTicket: '02-b.md',
}

test('skillName drops the plugin prefix and nothing else', () => {
  assert.equal(skillName('cantrips:implement', 'cantrips'), 'implement')
  assert.equal(skillName('implement', 'cantrips'), 'implement')
  assert.equal(skillName('other:implement', 'cantrips'), 'other:implement')
})

test('a stage lights the rail, joins the trail and starts its clock', () => {
  const afterSpec = reduceSkill(INITIAL, 'cantrips:spec', 'cantrips', 100)
  const afterImplement = reduceSkill(afterSpec, 'cantrips:implement', 'cantrips', 200)
  assert.equal(afterImplement.stage, 'implement')
  assert.equal(afterImplement.stageSince, 200)
  assert.deepEqual(afterImplement.trail, ['spec', 'implement'])
  assert.equal(afterImplement.sawSkill, true)
  const again = reduceSkill(afterImplement, 'cantrips:implement', 'cantrips', 300)
  assert.equal(again.stageSince, 300)
  assert.deepEqual(again.trail, ['spec', 'implement'])
})

test('a skill outside the eight stages is the activity and leaves the rail', () => {
  const implementing = reduceSkill(INITIAL, 'cantrips:implement', 'cantrips', 100)
  const state = reduceSkill(implementing, 'cantrips:deputy', 'cantrips', 200)
  assert.equal(state.stage, 'implement')
  assert.equal(state.stageSince, 100)
  assert.equal(state.activity, 'deputy')
  assert.deepEqual(state.trail, ['implement'])
})

test('railStops tells the current, visited, skipped and coming stages apart', () => {
  const afterSpec = reduceSkill(INITIAL, 'cantrips:spec', 'cantrips', 1)
  const state = reduceSkill(afterSpec, 'cantrips:tickets', 'cantrips', 2)
  const stops = railStops(state)
  assert.equal(stops.length, 8)
  const stop = (stage: string) => stops.find(one => one.stage === stage)
  assert.deepEqual(stop('grilling'), {
    stage: 'grilling',
    isCurrent: false,
    isVisited: false,
    isSkipped: true,
  })
  assert.deepEqual(stop('spec'), {
    stage: 'spec',
    isCurrent: false,
    isVisited: true,
    isSkipped: false,
  })
  assert.deepEqual(stop('tickets'), {
    stage: 'tickets',
    isCurrent: true,
    isVisited: false,
    isSkipped: false,
  })
  assert.deepEqual(stop('commit'), {
    stage: 'commit',
    isCurrent: false,
    isVisited: false,
    isSkipped: false,
  })
  assert.equal(railStops(INITIAL).some(one => one.isSkipped), false)
})

test('railStops leaves a stage after the current one coming, though a past run visited it', () => {
  const trail: Stage[] = ['spec', 'tickets', 'implement', 'simplify', 'review-gate', 'commit']
  const visited = (stage: Stage | null) =>
    railStops({ ...INITIAL, stage, trail })
      .filter(one => one.isVisited)
      .map(one => one.stage)
  assert.deepEqual(visited('simplify'), ['spec', 'tickets', 'implement'])
  assert.deepEqual(visited(null), trail)
})

test('isStruck spares the lit ticket while its work is still under review', () => {
  const resolved = {
    ...feature,
    tickets: [ticket({ isResolved: true }), ticket({ file: '02-b.md', isResolved: true })],
  }
  const at = (stage: Stage | null) => ({ ...INITIAL, stage, feature: resolved })
  const [other, lit] = resolved.tickets as [Ticket, Ticket]
  for (const stage of ['implement', 'simplify', 'review-gate'] as const) {
    assert.equal(isStruck(at(stage), lit), false)
    assert.equal(isStruck(at(stage), other), true)
  }
  assert.equal(isStruck(at('commit'), lit), true)
  assert.equal(isStruck(at(null), lit), true)
  assert.equal(isStruck(at('simplify'), ticket({ file: '02-b.md' })), false)
})

test('withFileTrail seeds spec and tickets from the files, ahead of what the session saw', () => {
  const seen = reduceSkill(INITIAL, 'cantrips:implement', 'cantrips', 1)
  assert.deepEqual(withFileTrail({ ...seen, feature }).trail, ['spec', 'tickets', 'implement'])
  const noTickets = { ...feature, tickets: [] }
  assert.deepEqual(withFileTrail({ ...seen, feature: noTickets }).trail, ['spec', 'implement'])
  const noFiles = { ...noTickets, hasSpec: false }
  assert.deepEqual(withFileTrail({ ...seen, feature: noFiles }).trail, ['implement'])
  assert.equal(withFileTrail(seen), seen)
  const seeded = withFileTrail({ ...INITIAL, feature })
  assert.equal(withFileTrail(seeded), seeded)
})

test('formatDuration rounds down to the unit that fits', () => {
  assert.equal(formatDuration(0), '0s')
  assert.equal(formatDuration(59_999), '59s')
  assert.equal(formatDuration(60_000), '1m')
  assert.equal(formatDuration(3_900_000), '1h05m')
  assert.equal(formatDuration(-5), '0s')
})

test('chipText carries the stage and the lit ticket over the count', () => {
  assert.equal(chipText(INITIAL), 'cantrips')
  assert.equal(chipText({ ...INITIAL, stage: 'implement', feature }), 'implement · 02/2')
  const unlit = { ...feature, litTicket: null }
  assert.equal(chipText({ ...INITIAL, feature: unlit }), 'cantrips · 2 tickets')
  const one = { ...unlit, tickets: unlit.tickets.slice(0, 1) }
  assert.equal(chipText({ ...INITIAL, feature: one }), 'cantrips · 1 ticket')
  assert.equal(plural(0, 'annotation'), '0 annotations')
  const noTickets = { ...feature, tickets: [] }
  assert.equal(chipText({ ...INITIAL, stage: 'spec', feature: noTickets }), 'spec')
})
