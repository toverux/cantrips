// The cantrips sub-agents at work and the deputy's mode, under node --test.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  agentLine,
  agentRole,
  agentsView,
  deputyLine,
  spawnAgent,
  withAgentList,
  withDeputy,
} from '../../mod/core/agents.ts'
import { INITIAL, chipText, reduceSkill, runningCount } from '../../mod/core/loop.ts'
import type { AgentStatus, LoopState } from '../../mod/types/index.d.ts'

const listed = (...pairs: [string, AgentStatus][]) => pairs.map(([id, status]) => ({ id, status }))

test('agentRole knows the plugin roles by their scoped names alone', () => {
  assert.equal(agentRole('cantrips:finder:diff-scan', 'cantrips'), 'finder')
  assert.equal(agentRole('cantrips:finder:low', 'cantrips'), 'finder')
  assert.equal(agentRole('cantrips:verifier', 'cantrips'), 'verifier')
  assert.equal(agentRole('cantrips:arbiter', 'cantrips'), 'arbiter')
  assert.equal(agentRole('cantrips:deputy', 'cantrips'), 'deputy')
  // A role pasted into a general-purpose dispatch is not one.
  assert.equal(agentRole('general-purpose', 'cantrips'), null)
  assert.equal(agentRole('deputy', 'cantrips'), null)
  assert.equal(agentRole('other:deputy', 'cantrips'), null)
  assert.equal(agentRole('cantrips:unknown', 'cantrips'), null)
})

test('a spawn runs at once; the list moves it to done and stamps its end', () => {
  let state = spawnAgent(INITIAL, 'a1', 'arbiter', 1_000)
  assert.equal(runningCount(state), 1)
  assert.deepEqual(agentLine(state.agents[0]!, 13_000), { phase: 'running', time: '12s' })

  state = withAgentList(state, listed(['a1', 'running']), 2_000)
  assert.equal(state.agents[0]!.runningSince, 1_000)
  state = withAgentList(state, listed(['a1', 'completed']), 61_000)
  assert.equal(runningCount(state), 0)
  assert.deepEqual(agentLine(state.agents[0]!, 999_000), { phase: 'done', time: '1m' })
  // A later list keeps the first end it saw.
  state = withAgentList(state, listed(['a1', 'completed']), 900_000)
  assert.equal(state.agents[0]!.endedAt, 61_000)
})

test('an agent waiting on its own background work is still at work', () => {
  let state = spawnAgent(INITIAL, 'f1', 'finder', 0)
  state = withAgentList(state, listed(['f1', 'waiting']), 3_000)
  assert.equal(runningCount(state), 1)
  assert.deepEqual(agentsView(state).finders?.pips, ['live'])
  assert.deepEqual(agentLine(state.agents[0]!, 9_000), { phase: 'running', time: '9s' })
})

test('a list that changes nothing answers the same state', () => {
  const state = spawnAgent(INITIAL, 'a1', 'finder', 0)
  assert.equal(withAgentList(state, listed(['a1', 'pending']), 5), state)
})

test('an agent the list dropped is done and unlisted; a resume lists it again', () => {
  let state = spawnAgent(INITIAL, 'f1', 'finder', 0)
  assert.equal(state.agents[0]!.isListed, true)
  state = withAgentList(state, [], 4_000)
  assert.equal(state.agents[0]!.status, 'completed')
  assert.equal(state.agents[0]!.endedAt, 4_000)
  assert.equal(state.agents[0]!.isListed, false)
  // A completed run the list then drops changes too.
  let deputy = spawnAgent(INITIAL, 'd1', 'deputy', 0)
  deputy = withAgentList(deputy, listed(['d1', 'completed']), 1_000)
  deputy = withAgentList(deputy, [], 2_000)
  assert.equal(deputy.agents[0]!.isListed, false)
  assert.equal(spawnAgent(deputy, 'd1', 'deputy', 3_000).agents[0]!.isListed, true)
})

test('on call is any status short of ended; a completed deputy stands while a mode holds', () => {
  let state = spawnAgent(INITIAL, 'd1', 'deputy', 0)
  state = withAgentList(state, listed(['d1', 'idle']), 10_000)
  assert.deepEqual(agentLine(state.agents[0]!, 20_000), { phase: 'on call', time: null })
  assert.equal(runningCount(state), 0)

  state = withAgentList(state, listed(['d1', 'completed']), 30_000)
  assert.equal(agentLine(state.agents[0]!, 40_000).phase, 'done')
  assert.equal(deputyLine(withDeputy(state, 'deciding'), state.agents[0]!, 40_000).activity, 'idle')
  // A killed run ends no mandate: the next question dispatches a fresh deputy.
  state = withDeputy(withAgentList(state, listed(['d1', 'killed']), 50_000), 'deciding')
  assert.deepEqual(deputyLine(state, state.agents[0]!, 60_000), {
    stance: 'standing',
    word: 'deciding mode',
    activity: 'idle',
    time: null,
  })
})

test('a resumed run under a known id runs again, its first start kept', () => {
  let state = spawnAgent(INITIAL, 'd1', 'deputy', 0)
  state = withAgentList(state, listed(['d1', 'completed']), 10_000)
  state = spawnAgent(state, 'd1', 'deputy', 20_000)
  assert.equal(state.agents.length, 1)
  assert.deepEqual(agentLine(state.agents[0]!, 25_000), { phase: 'running', time: '5s' })
  assert.equal(state.agents[0]!.startedAt, 0)
})

test('the groups show their latest batch, ended runs first, and only while one of it runs', () => {
  let state = spawnAgent(INITIAL, 'f1', 'finder', 2)
  state = spawnAgent(state, 'f2', 'finder', 3)
  state = spawnAgent(state, 'f3', 'finder', 4)
  state = spawnAgent(state, 'v1', 'verifier', 4)
  const moved = listed(['f1', 'running'], ['f2', 'failed'], ['f3', 'completed'], ['v1', 'running'])
  state = withAgentList(state, moved, 5)
  assert.deepEqual(agentsView(state).finders, {
    pips: ['done', 'failed', 'live'],
    done: 2,
    since: 2,
  })
  assert.deepEqual(agentsView(state).verifiers, { pips: ['live'], done: 0, since: 4 })

  const ended = listed(['f1', 'completed'], ['f2', 'failed'], ['f3', 'completed'])
  state = withAgentList(state, ended, 9)
  assert.equal(agentsView(state).finders, null)
  // A spawn after the group fell idle opens a batch of its own.
  state = spawnAgent(state, 'f4', 'finder', 10)
  assert.deepEqual(agentsView(state).finders, { pips: ['live'], done: 0, since: 10 })
})

test('the arbiter and the deputy are their latest runs, the arbiter while it is listed', () => {
  let state = spawnAgent(INITIAL, 'a1', 'arbiter', 0)
  state = spawnAgent(state, 'd1', 'deputy', 0)
  state = withAgentList(state, listed(['a1', 'completed'], ['d1', 'completed']), 5)
  state = spawnAgent(state, 'a2', 'arbiter', 9)
  const view = agentsView(state)
  assert.equal(view.arbiter?.id, 'a2')
  assert.equal(view.deputy?.id, 'd1')
  // The engine dropped both: the arbiter goes, the deputy stays.
  const dropped = agentsView(withAgentList(state, [], 20))
  assert.equal(dropped.arbiter, null)
  assert.equal(dropped.deputy?.id, 'd1')
})

test('the deputy line words its stance and mode apart from what the deputy is doing', () => {
  const off = { stance: 'off', word: 'off', activity: 'done', time: null }
  assert.deepEqual(deputyLine(INITIAL, null, 0), off)
  // Standing once the mode is reported, no run yet.
  const engaged = withDeputy(INITIAL, 'deciding')
  assert.deepEqual(deputyLine(engaged, null, 0), {
    stance: 'standing',
    word: 'deciding mode',
    activity: 'idle',
    time: null,
  })
  let state = spawnAgent(engaged, 'd1', 'deputy', 1_000)
  assert.deepEqual(deputyLine(state, state.agents[0]!, 13_000), {
    stance: 'standing',
    word: 'deciding mode',
    activity: 'running',
    time: '12s',
  })
  // A completed deputy between answers stands by.
  state = withAgentList(withDeputy(state, 'advisor'), listed(['d1', 'completed']), 20_000)
  assert.deepEqual(deputyLine(state, state.agents[0]!, 30_000), {
    stance: 'standing',
    word: 'advising mode',
    activity: 'idle',
    time: null,
  })
  const dismissed = withDeputy(state, 'off')
  assert.deepEqual(deputyLine(dismissed, dismissed.agents[0]!, 90_000), {
    stance: 'dismissed',
    word: 'dismissed',
    activity: 'done',
    time: '19s',
  })
  assert.equal(deputyLine(withDeputy(engaged, 'off'), null, 0).time, null)
  // A deputy named for one question reads engaged while it runs, a dismissed one's included, and
  // leaves the row as it was once it ends.
  const answering = { stance: 'standing', word: 'engaged', activity: 'running', time: '3s' }
  let named = spawnAgent(INITIAL, 'd2', 'deputy', 0)
  assert.deepEqual(deputyLine(named, named.agents[0]!, 3_000), answering)
  const after = spawnAgent(dismissed, 'd3', 'deputy', 90_000)
  assert.deepEqual(deputyLine(after, after.agents.at(-1)!, 93_000), answering)
  named = withAgentList(named, listed(['d2', 'completed']), 5_000)
  assert.deepEqual(deputyLine(named, named.agents[0]!, 9_000), { ...off, time: '5s' })
})

test('a /deputy the tool never reports leaves the row off', () => {
  // `/deputy` then `/deputy off`, where no loop tool reports either mode.
  let state = reduceSkill(INITIAL, 'cantrips:deputy', 'cantrips', 0)
  state = reduceSkill(state, 'cantrips:deputy', 'cantrips', 1)
  assert.equal(deputyLine(state, null, 2).word, 'off')
})

test('the chip counts the running agents', () => {
  let state: LoopState = { ...INITIAL, stage: 'review-gate' }
  assert.equal(chipText(state), 'review-gate')
  state = spawnAgent(spawnAgent(state, 'f1', 'finder', 0), 'f2', 'finder', 0)
  state = spawnAgent(state, 'd1', 'deputy', 0)
  state = withAgentList(state, listed(['f1', 'running'], ['f2', 'running'], ['d1', 'idle']), 1)
  assert.equal(chipText(state), 'review-gate · 2 running')
})
