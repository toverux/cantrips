// The feature the session selected and the features in flight: what a call of the loop tool
// selects, the record a call or a stage change writes, the entries a session start prunes, and
// the rows and words of the session-start list. Pure: it takes listings, records and the time.

import type { FeatureRecord, FeatureView, FlightRow, LoopState, Stage, Ticket } from '../types'
import { SPEC_FILE, isTicketFile, newestMtime } from './feature.ts'
import type { ListedFolder } from './feature.ts'
import { formatDuration, plural } from './loop.ts'

/** A repository's feature records, by slug. */
export type Records = Record<string, FeatureRecord>

export type SessionRecord = {
  isPaneClosed?: boolean
  /** When the record was last written, in epoch milliseconds. */
  at?: number
}

const SESSION_PREFIX = 'session:'
const DAY_MS = 24 * 60 * 60 * 1000
/**
 * How long a session record outlives its last write: the gate script's prune of its state files.
 */
export const SESSION_TTL_MS = 7 * DAY_MS

export function isSessionKey(key: string): boolean {
  return key.startsWith(SESSION_PREFIX)
}

export function sessionKey(id: string): string {
  return `${SESSION_PREFIX}${id}`
}

export function repoKey(root: string): string {
  return `repo:${root}`
}

/** The trails joined, each stage once, in the order first met. */
function joinTrails(...trails: readonly (readonly Stage[])[]): Stage[] {
  return [...new Set(trails.flat())]
}

/**
 * The state once the session selected `slug`: a feature it had not selected takes the store's
 * trail, joined by the pending stages where it is the session's first; the same one is unchanged.
 */
export function touchFeature(
  state: LoopState,
  slug: string,
  stored: FeatureRecord | undefined,
): LoopState {
  if (state.touched === slug) return state
  const pending = state.touched === null ? state.pending : []
  return { ...state, touched: slug, pending: [], trail: joinTrails(stored?.trail ?? [], pending) }
}

/** The ticket file while it is one of the tickets and stands unresolved; else null. */
export function liveTicket(file: string | null, tickets: readonly Ticket[]): string | null {
  return tickets.some(ticket => ticket.file === file && !ticket.isResolved) ? file : null
}

/**
 * The state once the session selected the feature of `view`: the ticket named lit, else the
 * stored one while it stands unresolved.
 */
export function selectFeature(
  state: LoopState,
  view: FeatureView,
  ticket: string | null,
  stored: FeatureRecord | undefined,
): LoopState {
  const litTicket = ticket ?? liveTicket(stored?.ticket ?? null, view.tickets)
  return touchFeature({ ...state, feature: { ...view, litTicket } }, view.slug, stored)
}

/** The feature whose record names the session, the last touched where several do; null for none. */
export function recordedFeature(records: Records, session: string | null): string | null {
  const named = Object.entries(records)
    .filter(([, record]) => record.session === session)
    .sort(([, a], [, b]) => b.touchedAt - a.touchedAt)
  return named[0]?.[0] ?? null
}

/** The record a call or a stage change writes for the feature the session selected. */
export function featureRecord(
  session: string,
  state: LoopState,
  stored: FeatureRecord | undefined,
  now: number,
): FeatureRecord {
  const ticket =
    state.feature?.slug === state.touched ? state.feature.litTicket : (stored?.ticket ?? null)
  // The session's stage where the feature ran it; a feature switched to keeps its own.
  const isRun = state.stage !== null && state.trail.includes(state.stage)
  return {
    session,
    stage: isRun ? state.stage : (stored?.stage ?? null),
    trail: state.trail,
    ticket,
    touchedAt: now,
  }
}

/** The records whose folder still holds a feature; the same object where none is gone. */
export function pruneRecords(records: Records, slugs: readonly string[]): Records {
  const kept = Object.entries(records).filter(([slug]) => slugs.includes(slug))
  return kept.length === Object.keys(records).length ? records : Object.fromEntries(kept)
}

/** The keys of the session records last written past the TTL, or never stamped. */
export function staleSessions(entries: readonly [string, unknown][], now: number): string[] {
  return entries
    .filter(([key, value]) => {
      if (!isSessionKey(key)) return false
      const at = (value as SessionRecord | undefined)?.at ?? 0
      return now - at > SESSION_TTL_MS
    })
    .map(([key]) => key)
}

/**
 * The features in flight, the last touched first: the stage the store recorded, else the one the
 * files prove, the stored ticket while it stands unresolved, and a Resume for a recorded session
 * other than this one.
 */
export function flightRows(
  folders: readonly (ListedFolder & { stored: Ticket | null })[],
  records: Records,
  session: string | null,
): FlightRow[] {
  return folders
    .map(({ slug, entries, stored }) => {
      const record = records[slug]
      const files = entries.filter(en => en.kind === 'file')
      const hasSpec = files.some(en => en.name === SPEC_FILE)
      const tickets = files.filter(en => isTicketFile(en.name)).length
      const proven: Stage | null = tickets > 0 ? 'tickets' : hasSpec ? 'spec' : null
      return {
        slug,
        stage: record?.stage ?? proven,
        touchedAt: Math.max(record?.touchedAt ?? 0, newestMtime(entries)),
        hasSpec,
        tickets,
        ticket: stored?.isResolved === false ? stored.number : null,
        resume: record !== undefined && record.session !== session ? record.session : null,
      }
    })
    .sort((a, b) => b.touchedAt - a.touchedAt)
}

/** The rows to list; none where the list would only repeat the feature in view. */
export function listedFlight(state: LoopState): FlightRow[] {
  const isNews = state.inFlight.some(
    row => row.slug !== state.feature?.slug || row.resume !== null,
  )
  return isNews ? state.inFlight : []
}

export function formatAge(ms: number): string {
  const days = Math.floor(ms / DAY_MS)
  return days > 0 ? `${days}d ago` : `${formatDuration(ms)} ago`
}

/**
 * The words after a row's slug: its stage, its last touch, its spec and its tickets, the stored
 * one over the count as the chip words it.
 */
export function flightText(row: FlightRow, now: number): string {
  const parts: string[] = []
  if (row.stage !== null) parts.push(row.stage)
  if (row.touchedAt > 0) parts.push(formatAge(now - row.touchedAt))
  parts.push(row.hasSpec ? 'spec ✓' : 'no spec')
  if (row.ticket !== null) parts.push(`${row.ticket}/${row.tickets}`)
  else if (row.tickets === 0) parts.push('no tickets')
  else parts.push(plural(row.tickets, 'ticket'))
  return parts.join(' · ')
}
