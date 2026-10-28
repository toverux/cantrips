// The loop state and the words drawn from it: the stage and trail a skill expansion sets, the
// rail's stops and the band chip. Pure: no engine, no clock of its own.

import type { AgentRun, LoopState, Stage, Ticket } from '../types'
import { gateChip } from './gate.ts'

export const STAGES: readonly Stage[] = [
  'grilling',
  'spec',
  'tickets',
  'implement',
  'simplify',
  'review-gate',
  'commit',
  'compound',
]

export const INITIAL: LoopState = {
  session: null,
  root: null,
  isLoopRepo: false,
  sawSkill: false,
  stage: null,
  stageSince: null,
  trail: [],
  pending: [],
  touched: null,
  activity: null,
  feature: null,
  inFlight: [],
  resumeNote: null,
  agents: [],
  deputy: null,
  viewNote: null,
  gatePath: null,
  gate: null,
}

function isStage(name: string): name is Stage {
  return (STAGES as readonly string[]).includes(name)
}

/** The skill's own name: `cantrips:implement` under the plugin `cantrips` is `implement`. */
export function skillName(skill: string, plugin: string): string {
  const prefix = `${plugin}:`
  return skill.startsWith(prefix) ? skill.slice(prefix.length) : skill
}

/**
 * The state after one of the plugin's skills expanded: a stage lights the rail and joins the
 * trail, and the pending stages while no feature is selected, its clock starting now; any other
 * skill is the current activity.
 */
export function reduceSkill(
  state: LoopState,
  skill: string,
  plugin: string,
  now: number,
): LoopState {
  const name = skillName(skill, plugin)
  if (!isStage(name)) return { ...state, sawSkill: true, activity: name }
  const trail = state.trail.includes(name) ? state.trail : [...state.trail, name]
  const isHeld = state.touched !== null || state.pending.includes(name)
  const pending = isHeld ? state.pending : [...state.pending, name]
  return { ...state, sawSkill: true, stage: name, stageSince: now, trail, pending }
}

/**
 * The trail with what the feature's files prove: a spec means `/spec` ran, tickets mean
 * `/tickets` ran, whichever session ran them. Seeded stages go first, in loop order.
 */
export function withFileTrail(state: LoopState): LoopState {
  const feature = state.feature
  if (feature === null) return state
  const proven: Stage[] = []
  if (feature.hasSpec) proven.push('spec')
  if (feature.tickets.length > 0) proven.push('tickets')
  const trail = [...proven, ...state.trail.filter(stage => !proven.includes(stage))]
  const isSame =
    trail.length === state.trail.length && trail.every((stage, i) => stage === state.trail[i])
  return isSame ? state : { ...state, trail }
}

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
}

export type RailStop = { stage: Stage; isCurrent: boolean; isVisited: boolean; isSkipped: boolean }

/**
 * The eight stops in loop order: the current one, the ones visited, the ones skipped (before the
 * current one and never visited), and the ones still to come.
 */
export function railStops(state: LoopState): RailStop[] {
  const current = state.stage === null ? -1 : STAGES.indexOf(state.stage)
  return STAGES.map((stage, index) => {
    const isVisited = state.stage !== stage && state.trail.includes(stage)
    const isSkipped = index < current && !isVisited
    return { stage, isCurrent: state.stage === stage, isVisited, isSkipped }
  })
}

// The stages the lit ticket's work is still checked in once `/implement` resolved it.
const REVIEW_TAIL: readonly Stage[] = ['implement', 'simplify', 'review-gate']

/** Whether a ticket's title is struck: resolved, unless it is the lit one still under review. */
export function isStruck(state: LoopState, ticket: Ticket): boolean {
  if (!ticket.isResolved) return false
  const isLit = ticket.file === state.feature?.litTicket
  return !(isLit && state.stage !== null && REVIEW_TAIL.includes(state.stage))
}

/** A count and its noun, in the singular at one. */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * Running, as the chip counts it: a spawn not yet started is about to run, and one waiting on its
 * own background work is still at it.
 */
export function isRunning(run: AgentRun): boolean {
  return run.status === 'running' || run.status === 'pending' || run.status === 'waiting'
}

export function runningCount(state: LoopState): number {
  return state.agents.filter(isRunning).length
}

/**
 * The band chip's words: the stage, then the lit ticket over the ticket count, then the gate's
 * word while a run is in view, then the running agents.
 */
export function chipText(state: LoopState): string {
  const parts = [state.stage ?? 'cantrips']
  const feature = state.feature
  if (feature !== null && feature.tickets.length > 0) {
    const lit = feature.tickets.find(ticket => ticket.file === feature.litTicket)
    const count = feature.tickets.length
    parts.push(lit === undefined ? plural(count, 'ticket') : `${lit.number}/${count}`)
  }
  const gate = state.gate === null ? null : gateChip(state.gate)
  if (gate !== null) parts.push(gate)
  const running = runningCount(state)
  if (running > 0) parts.push(`${running} running`)
  return parts.join(' · ')
}
