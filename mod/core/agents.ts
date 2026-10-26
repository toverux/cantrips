// The cantrips sub-agents at work and the deputy's mode: the runs a spawn starts, the statuses the
// engine's agent list gives them, and the rows the pane draws. Pure: the caller passes the clock.

import type { AgentRole, AgentRun, AgentStatus, DeputyMode, LoopState } from '../types'
import { formatDuration, isRunning, skillName } from './loop.ts'

const ENDED: readonly AgentStatus[] = ['completed', 'failed', 'killed']

/** The role a spawn's agent type names: the plugin's scoped definitions alone. */
export function agentRole(type: string, plugin: string): AgentRole | null {
  const name = skillName(type, plugin)
  if (name === type) return null
  if (name.startsWith('finder:')) return 'finder'
  return name === 'verifier' || name === 'arbiter' || name === 'deputy' ? name : null
}

function isEnded(run: AgentRun): boolean {
  return ENDED.includes(run.status)
}

/**
 * The state after a spawn: a new run, or a known id resumed, runs from now. A run joins the batch
 * of its group while one of it has not ended, else opens the next.
 */
export function spawnAgent(state: LoopState, id: string, role: AgentRole, now: number): LoopState {
  const restarted = { status: 'pending', runningSince: now, endedAt: null, isListed: true } as const
  if (state.agents.some(run => run.id === id)) {
    const agents = state.agents.map(run => (run.id === id ? { ...run, ...restarted } : run))
    return { ...state, agents }
  }
  const busy = state.agents.findLast(run => run.role === role && !isEnded(run))
  const batch = busy?.batch ?? Math.max(0, ...state.agents.map(run => run.batch)) + 1
  return { ...state, agents: [...state.agents, { id, role, batch, startedAt: now, ...restarted }] }
}

/**
 * The state after a read of the engine's agent list: each run takes its listed status, one the
 * list dropped reads completed and unlisted, and the first end seen is stamped. The same state
 * where nothing moved.
 */
export function withAgentList(
  state: LoopState,
  listed: readonly { id: string; status: AgentStatus }[],
  now: number,
): LoopState {
  let isChanged = false
  const agents = state.agents.map(run => {
    const held = listed.find(one => one.id === run.id)?.status
    const status = held ?? (isEnded(run) ? run.status : 'completed')
    const isListed = held !== undefined
    if (status === run.status && isListed === run.isListed) return run
    isChanged = true
    const moved = { ...run, status, isListed }
    return {
      ...moved,
      runningSince: isRunning(moved) ? (run.runningSince ?? now) : null,
      endedAt: isEnded(moved) ? (run.endedAt ?? now) : null,
    }
  })
  return isChanged ? { ...state, agents } : state
}

/** The state after the model reported the deputy's mode. */
export function withDeputy(state: LoopState, mode: DeputyMode): LoopState {
  return { ...state, deputy: mode }
}

/** One run of a batch: ended well, ended otherwise, or not ended. */
export type Pip = 'done' | 'failed' | 'live'

export type Batch = {
  /** A pip per run, the ended ones first, so the strip fills as the batch works. */
  pips: Pip[]
  done: number
  /** When its first run was spawned. */
  since: number
}

export type AgentsView = {
  /** The finders' latest batch, while one of it runs. */
  finders: Batch | null
  verifiers: Batch | null
  /** The latest arbiter while the engine lists it, since one it dropped cannot be shown. */
  arbiter: AgentRun | null
  deputy: AgentRun | null
}

const PIP_ORDER: readonly Pip[] = ['done', 'failed', 'live']

function pipOf(run: AgentRun): Pip {
  if (!isEnded(run)) return 'live'
  return run.status === 'completed' ? 'done' : 'failed'
}

function latestBatch(state: LoopState, role: AgentRole): Batch | null {
  const batch = state.agents.findLast(run => run.role === role)?.batch
  const runs = state.agents.filter(run => run.role === role && run.batch === batch)
  if (!runs.some(isRunning)) return null
  const pips = runs.map(pipOf).sort((a, b) => PIP_ORDER.indexOf(a) - PIP_ORDER.indexOf(b))
  const since = Math.min(...runs.map(run => run.startedAt))
  return { pips, done: runs.filter(isEnded).length, since }
}

export function agentsView(state: LoopState): AgentsView {
  const arbiter = state.agents.findLast(run => run.role === 'arbiter')
  return {
    finders: latestBatch(state, 'finder'),
    verifiers: latestBatch(state, 'verifier'),
    arbiter: arbiter?.isListed === true ? arbiter : null,
    deputy: state.agents.findLast(run => run.role === 'deputy') ?? null,
  }
}

export type AgentPhase = 'running' | 'on call' | 'done'

/**
 * Where a run stands and its time: elapsed while it runs, its duration once done, none on call.
 * On call is any status short of ended.
 */
export function agentLine(run: AgentRun, now: number): { phase: AgentPhase; time: string | null } {
  if (isRunning(run)) {
    return { phase: 'running', time: formatDuration(now - (run.runningSince ?? run.startedAt)) }
  }
  if (!isEnded(run)) return { phase: 'on call', time: null }
  return { phase: 'done', time: formatDuration((run.endedAt ?? now) - run.startedAt) }
}

const MANDATES: Record<Exclude<DeputyMode, 'off'>, string> = {
  deciding: 'deciding mode',
  advisor: 'advising mode',
}

export type DeputyLine = {
  /** Standing in for the user, answering or not; sent away by `off`; or never engaged. */
  stance: 'standing' | 'dismissed' | 'off'
  /** The mode while it stands, else the stance. */
  word: string
  activity: 'running' | 'idle' | 'done'
  /** Elapsed while it answers, its duration once done. */
  time: string | null
}

/**
 * The deputy's row, always drawn: its stance and mode, kept apart from what it does now, since an
 * engaged deputy idles between answers. It stands while the tool reports a mode short of off,
 * whatever its last run did, since an engaged deputy reads completed between its answers and a
 * fresh one answers after a killed one, and while a run of it has not ended.
 */
export function deputyLine(state: LoopState, run: AgentRun | null, now: number): DeputyLine {
  const line = run === null ? null : agentLine(run, now)
  const mode = state.deputy
  const isMandated = mode === 'deciding' || mode === 'advisor'
  const isStanding = isMandated || (line !== null && line.phase !== 'done')
  const stance = isStanding ? 'standing' : mode === 'off' ? 'dismissed' : 'off'
  const word = stance !== 'standing' ? stance : isMandated ? MANDATES[mode] : 'engaged'
  if (line?.phase === 'running') return { stance, word, activity: 'running', time: line.time }
  if (isStanding) return { stance, word, activity: 'idle', time: null }
  return { stance, word, activity: 'done', time: line?.time ?? null }
}
