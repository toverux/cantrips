// The `/review-gate` run: the state file's path a start call prints, the view its content gives,
// and the words drawn from it. Pure: it takes commands, outputs and file text. The script records
// the run's phase and its stops, so nothing here reads the loop's order.

import type { GateCounts, GatePhase, GateView } from '../types'

// The line the script's agent lines open under, which a start call's `state:` line follows.
const DELIMITER = '── agent ──'
const PHASES: readonly GatePhase[] = ['reviewing', 'fixing', 'waiting', 'green', 'stopped', 'done']
const VERDICTS = ['confirmed', 'plausible'] as const
const DONE = ['fixed', 'no_change_needed', 'routed']

/** The parked findings the section and the status line name before they count the rest. */
export const FOR_YOU_NAMED = 5

/** Whether a shell command runs the gate's findings script. */
export function isGateCall(command: string): boolean {
  return /(^|[\s/\\"'])findings\.ts\b/.test(command)
}

/** The state file's path a start call printed; null for any other call or an output without it. */
export function startPath(command: string, output: string): string | null {
  if (!/findings\.ts["']?\s+start\b/.test(command)) return null
  const agent = output.split(new RegExp(`${DELIMITER}\\r?\\n`)).slice(1).join('\n')
  return /^state: (.+\.json)\r?$/m.exec(agent)?.[1] ?? null
}

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIds(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(id => typeof id === 'number')
}

type Finding = {
  id: number
  held: boolean
  verdict: 'confirmed' | 'plausible' | 'unverified'
  summary: string
  outcome: string | null
  isWorth: boolean
  isDeclined: boolean
  with: number[]
}

/** A finding as far as the pane reads it; null where it lacks such a field. */
function readFinding(raw: unknown): Finding | null {
  if (!isObject(raw) || typeof raw.id !== 'number' || typeof raw.held !== 'boolean') return null
  if (typeof raw.summary !== 'string') return null
  const verdict = raw.verdict === null ? 'unverified' : VERDICTS.find(one => one === raw.verdict)
  if (verdict === undefined) return null
  if (raw.with !== undefined && !isIds(raw.with)) return null
  return {
    id: raw.id,
    held: raw.held,
    verdict,
    summary: raw.summary,
    outcome: typeof raw.outcome === 'string' ? raw.outcome : null,
    isWorth: raw.kind === 'worth',
    isDeclined: raw.ruling === 'decline',
    with: raw.with ?? [],
  }
}

/**
 * The parked findings that wait, a reverted batch's members riding under its item: the user's, and
 * under `--fsd` the questions of worth the arbiter rules until a stop hands them back.
 */
function openParked(
  findings: readonly Finding[],
  isArbiters: boolean,
): { forYou: Finding[]; forArbiter: Finding[] } {
  const members = new Set(findings.flatMap(one => one.with))
  const open = findings.filter(one => one.outcome === 'parked' && !members.has(one.id))
  const isArbiter = (one: Finding) => isArbiters && one.isWorth
  return { forYou: open.filter(one => !isArbiter(one)), forArbiter: open.filter(isArbiter) }
}

/**
 * The findings by where they stand, each once: the parked counted as `forYou` lists them, and the
 * arbiter's as open work.
 */
function countFindings(
  findings: readonly Finding[],
  queue: readonly number[],
  parked: { forYou: readonly Finding[]; forArbiter: readonly Finding[] },
): GateCounts {
  const queued = new Set(queue)
  const counts: GateCounts = {
    done: 0,
    skipped: 0,
    declined: 0,
    forYou: parked.forYou.length,
    queued: 0,
    open: parked.forArbiter.length,
    held: 0,
  }
  for (const one of findings) {
    if (one.outcome !== null && DONE.includes(one.outcome)) counts.done++
    else if (one.outcome === 'skipped') counts[one.isDeclined ? 'declined' : 'skipped']++
    else if (one.outcome === 'parked') continue
    else if (one.held) counts.held++
    else if (queued.has(one.id)) counts.queued++
    else counts.open++
  }
  return counts
}

/**
 * The stop a state file records; undefined where it is neither null nor a condition and its
 * trip.
 */
function readStop(raw: unknown): GateView['stop'] | undefined {
  if (raw === null) return null
  if (!isObject(raw) || typeof raw.condition !== 'string' || typeof raw.tripped !== 'string') {
    return undefined
  }
  return { condition: raw.condition, tripped: raw.tripped }
}

/** The run a state file holds; null where the text is no run or lacks a field the pane reads. */
export function parseGate(text: string): GateView | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObject(raw)) return null
  const { level, mode, target, phase, autonomous, findings, refuted, queue, rounds } = raw
  if (typeof level !== 'string' || typeof mode !== 'string' || typeof target !== 'string') {
    return null
  }
  const known = PHASES.find(one => one === phase)
  if (known === undefined || typeof autonomous !== 'boolean') return null
  if (!Array.isArray(findings) || !Array.isArray(refuted) || !Array.isArray(rounds)) return null
  if (!isIds(queue)) return null
  const stop = readStop(raw.stop)
  if (stop === undefined) return null
  const all: Finding[] = []
  for (const one of findings) {
    const read = readFinding(one)
    if (read === null) return null
    all.push(read)
  }
  const parked = openParked(all, autonomous && known !== 'stopped')
  const count = (verdict: Finding['verdict']) => all.filter(one => one.verdict === verdict).length
  return {
    level,
    mode,
    isAutonomous: autonomous,
    target,
    phase: known,
    round: rounds.length,
    counts: countFindings(all, queue, parked),
    verdicts: {
      confirmed: count('confirmed'),
      plausible: count('plausible'),
      unverified: count('unverified'),
      refuted: refuted.length,
    },
    queue,
    forYou: parked.forYou.map(({ id, summary }) => ({ id, summary })),
    stop,
  }
}

/** The section's first words: what the run does, and its round under `--loop`. */
export function headline(gate: GateView): string {
  const isLoop = gate.mode === 'loop'
  const round = isLoop ? ` · round ${gate.round}` : ''
  switch (gate.phase) {
    case 'reviewing':
      return isLoop ? `reviewing round ${gate.round + 1}` : 'reviewing'
    case 'fixing':
      return `fixing${round}`
    case 'waiting':
      return `waiting on you${round}`
    case 'green':
      return `green · ${gate.round} round${gate.round === 1 ? '' : 's'}`
    case 'stopped':
      return `stopped${round}`
    case 'done':
      return gate.mode === 'fix' && gate.counts.done > 0 ? 'fixed' : 'reported'
  }
}

/** The run's level, the flag it was given, where it was given one, and its target. */
export function metaLine(gate: GateView): string {
  return [gate.level, modeFlag(gate), gate.target].filter(part => part !== null).join(' · ')
}

/** The flag the run was launched with; null for a report. */
export function modeFlag(gate: GateView): string | null {
  return gate.mode === 'loop' ? loopFlag(gate) : gate.mode === 'fix' ? '--fix' : null
}

/** The verdicts as counts, a zero left out, each kept whole where the line wraps. */
export function verdictParts(gate: GateView): string[] {
  const { confirmed, plausible, unverified, refuted } = gate.verdicts
  const parts: [string, number][] = [
    ['confirmed', confirmed],
    ['plausible', plausible],
    ['not verified', unverified],
    ['refuted', refuted],
  ]
  return parts.filter(([, n]) => n > 0).map(([word, n]) => `${word} ${n}`)
}

export type BarKind = 'done' | 'skipped' | 'forYou' | 'queued' | 'open' | 'declined'

/**
 * The bar's segments over `width` cells, in proportion to the counts, done first and the arbiter's
 * declines last, past what the run still works on: a state with any finding keeps a cell, the
 * cells it costs taken from the widest segments. Held findings stay off the bar.
 */
export function barCells(counts: GateCounts, width: number): { kind: BarKind; cells: number }[] {
  const shares: [BarKind, number][] = [
    ['done', counts.done],
    ['skipped', counts.skipped],
    ['forYou', counts.forYou],
    ['queued', counts.queued],
    ['open', counts.open],
    ['declined', counts.declined],
  ]
  const present = shares.filter(([, n]) => n > 0)
  const total = present.reduce((sum, [, n]) => sum + n, 0)
  if (total === 0 || width < present.length) return []
  const exact = present.map(([, n]) => (n * width) / total)
  const cells = exact.map(share => Math.max(1, Math.floor(share)))
  // Largest remainders take the cells left; the widest segments give back what a floor of one cost.
  const byRemainder = exact.map((_, i) => i).sort((a, b) => (exact[b]! % 1) - (exact[a]! % 1))
  let left = width - cells.reduce((sum, n) => sum + n, 0)
  for (let i = 0; left > 0; i = (i + 1) % cells.length, left--) cells[byRemainder[i]!]!++
  while (left < 0) {
    const widest = cells.indexOf(Math.max(...cells))
    cells[widest]!--
    left++
  }
  return present.map(([kind], i) => ({ kind, cells: cells[i]! }))
}

/** The ids that fit in `width` columns, the rest counted after them. */
export function fitIds(ids: readonly number[], width: number): string {
  for (let shown = ids.length; shown > 0; shown--) {
    const rest = ids.length - shown
    const line = [...ids.slice(0, shown).map(id => `F${id}`), ...(rest > 0 ? [`+${rest}`] : [])]
    if (line.join(' ').length <= width) return line.join(' ')
  }
  return ids.length > 0 ? `+${ids.length}` : ''
}

/** The stop the script recorded, in words; a condition it adds later reads as given. */
export function stopText(gate: GateView): string | null {
  const stop = gate.stop
  if (stop === null) return null
  switch (stop.condition) {
    case 'fix_not_taking':
      return `Fixes didn't hold for ${stop.tripped}.`
    case 'fourth_novel_round':
      return `Rounds ${stop.tripped} each found new issues.`
    case 'asked_twice':
      return `${stop.tripped} came back after your answer.`
    default:
      return `${stop.condition}: ${stop.tripped}.`
  }
}

/** The flag a `--loop` run was given: `--fsd` where the user handed it over. */
function loopFlag(gate: GateView): string {
  return gate.isAutonomous ? '--fsd' : '--loop'
}

/** The command that continues a --loop run short of green. */
export function resumeCommand(gate: GateView): string {
  return `/review-gate ${loopFlag(gate)}`
}

/** The words that lead a stopped run's way out up to its command. */
export const WAY_OUT_LEAD = "Settle what's for you, then"

/** What continues a stopped run. */
export function wayOut(gate: GateView): string {
  return `${WAY_OUT_LEAD} ${resumeCommand(gate)}.`
}

/**
 * The status line: a run that stopped, or one that waits on the user, until the script records
 * another phase; else none. A stop tripped in a run still at work may lapse, so it stays off.
 */
export function gateStatus(gate: GateView | null): string | undefined {
  if (gate?.phase === 'stopped') {
    return ['review gate stopped.', stopText(gate), wayOut(gate)].filter(Boolean).join(' ')
  }
  if (gate?.phase === 'waiting' && gate.forYou.length > 0) {
    const ids = gate.forYou.map(one => `F${one.id}`)
    const rest = ids.length - FOR_YOU_NAMED
    const shown = ids.slice(0, FOR_YOU_NAMED).join(', ')
    const named = rest > 0 ? `${shown} and ${rest} more` : shown
    return `review gate waits on you: ${named} parked.`
  }
  return undefined
}

/** The chip's word on the gate: the one fact that matters most, or none. */
export function gateChip(gate: GateView): string | null {
  const { forYou, queued, open } = gate.counts
  if (gate.phase === 'stopped') return 'gate stopped'
  if (forYou > 0) return `${forYou} for you`
  if (gate.phase === 'green') return 'gate green'
  if (queued > 0) return `${queued} queued`
  if (open > 0) return `${open} open`
  return null
}
