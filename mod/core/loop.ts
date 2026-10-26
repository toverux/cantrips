// The loop state and the words drawn from it: the stage and trail a skill expansion sets, the
// rail's stops and the band chip. Pure: no engine, no clock of its own.

import type { LoopState, Stage } from '../types'

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
  title: null,
  activity: null,
  feature: null,
  inFlight: [],
  resumeNote: null,
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

/** A count and its noun, in the singular at one. */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** The band chip's words: the stage, then the lit ticket over the ticket count. */
export function chipText(state: LoopState): string {
  const parts = [state.stage ?? 'cantrips']
  const feature = state.feature
  if (feature !== null && feature.tickets.length > 0) {
    const lit = feature.tickets.find(ticket => ticket.file === feature.litTicket)
    const count = feature.tickets.length
    parts.push(lit === undefined ? plural(count, 'ticket') : `${lit.number}/${count}`)
  }
  return parts.join(' · ')
}
