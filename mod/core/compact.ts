// The keep list a compaction carries: the loop state as pointers the summarizer copies, and the
// chat-only things it asks the summary to keep. Pure: it takes the state.

import type { GateView, LoopState } from '../types'
import { SCRATCH, SPEC_FILE } from './feature.ts'
import { modeFlag, resumeCommand } from './gate.ts'

const LEAD =
  'Copy these cantrips loop lines into the summary verbatim, keeping paths, not file contents:'
const ASK =
  "Also keep from the chat: the user's intent for this diff, in their words; each decision on" +
  " the spec, a ticket or a finding, with the finding's id and the reason; what was tried and" +
  ' ruled out on this ticket; the questions still open to the user.'

/** The keep list for the state; null while no feature is selected. */
export function keepList(state: LoopState): string | null {
  const feature = state.feature
  if (feature === null) return null
  const paths = [feature.hasSpec ? SPEC_FILE : null, feature.litTicket]
    .filter(file => file !== null)
    .map(file => `${SCRATCH}/${feature.slug}/${file}`)
  const stage = state.stage === null ? '' : ` at /${state.stage}`
  const where = paths.length > 0 ? `; ${paths.join(', ')}` : ''
  const lines = [LEAD, `- ${feature.slug}${stage}${where}`]
  if (state.gate !== null) lines.push(`- ${gateLine(state.gate)}`)
  if (state.deputy !== null && state.deputy !== 'off') lines.push(`- Deputy: ${state.deputy}`)
  return [...lines, ASK].join('\n')
}

/** The run: its command, target, round, phase and parked findings, then a stopped run's way out. */
function gateLine(gate: GateView): string {
  const command = ['/review-gate', gate.level, modeFlag(gate)].filter(part => part !== null)
  const parts = [`${command.join(' ')} on ${gate.target}`]
  // While reviewing, the round under way, as the pane's headline counts it.
  if (gate.mode === 'loop') parts.push(`round ${gate.round + (gate.phase === 'reviewing' ? 1 : 0)}`)
  const parked = gate.forYou.map(one => `F${one.id} (${one.summary})`).join(', ')
  if (gate.phase === 'waiting') parts.push(`waiting on the user${parked ? ` for ${parked}` : ''}`)
  else parts.push(parked ? `${gate.phase}, parked for the user: ${parked}` : gate.phase)
  // Named once the run stopped, as the status line does: a --loop start before then wipes the run
  // or restarts its round.
  const isStopped = gate.mode === 'loop' && gate.phase === 'stopped'
  return `${parts.join(', ')}${isStopped ? `; then ${resumeCommand(gate)}` : ''}`
}

/** The keep list after the instructions typed with the compaction, or alone. */
export function withKeepList(instructions: string | undefined, list: string): string {
  const typed = instructions?.trim() ?? ''
  return typed === '' ? list : `${typed}\n\n${list}`
}
