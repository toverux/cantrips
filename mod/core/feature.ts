// The feature section's reading of a feature folder: which folders are features, which file a
// touched path names, and what a spec and a ticket say. Pure: it takes file texts and listings.

import type { FeatureView, Ticket } from '../types'

/** One entry of a folder listing, as `$.fs.list` spells it. */
export type Entry = { name: string; kind: 'file' | 'dir' | 'other'; mtimeMs: number }

/** A folder under the scratch directory, with its listing. */
export type ListedFolder = { slug: string; entries: readonly Entry[] }

export const SCRATCH = '.scratch'
export const SPEC_FILE = 'spec.md'
export const LOOP_CONFIG = 'docs/agents/cantrips-loop.md'

const TICKET_FILE = /^(\d{2,})-.+\.md$/
const COMMENTS_HEADING = /^##\s+comments\s*$/i
const LEVEL_TWO_HEADING = /^##\s/
const DATED_LINE = /^(?:[-*]\s+|#{3,6}\s+)?\**\d{4}-\d{2}-\d{2}/
const CHECKBOX = /^\s*[-*]\s+\[([ xX])\]/
const TITLE = /^#\s+(.+?)\s*$/m
const NUMBER_PREFIX = /^\d{2,}\s*[—–-]+\s*/
const BLOCKED_BY = /^\*\*Blocked by:\*\*[ \t]*(.*?)[ \t]*(?:\*\*Blocks:\*\*|$)/m
const TICKET_NUMBER = /\b(\d{2,3})\b/g
const RESOLVED = /^Status:\s*resolved\b/im

export function isTicketFile(name: string): boolean {
  return TICKET_FILE.test(name)
}

/** The files a feature is read from: its spec and its tickets. */
export function isFeatureFile(name: string): boolean {
  return name === SPEC_FILE || isTicketFile(name)
}

/** A folder is a feature when it holds a spec or a ticket. */
export function isFeatureFolder(entries: readonly Entry[]): boolean {
  return entries.some(en => en.kind === 'file' && isFeatureFile(en.name))
}

/** The newest file time of a listing; 0 with no file. */
export function newestMtime(entries: readonly Entry[]): number {
  return entries.reduce(
    (newest, en) => (en.kind === 'file' ? Math.max(newest, en.mtimeMs) : newest),
    0,
  )
}

/**
 * The feature a path under the root's scratch folder belongs to: its slug and, for a file right
 * inside the folder, that file's name; null for a path anywhere else.
 */
export function featurePathOf(
  root: string,
  path: string,
): { slug: string; file: string | null } | null {
  const prefix = `${root.replace(/[\\/]+$/, '').replace(/\\/g, '/')}/${SCRATCH}/`
  const normal = path.replace(/\\/g, '/')
  if (!normal.startsWith(prefix)) return null
  const parts = normal.slice(prefix.length).split('/').filter(part => part !== '')
  const slug = parts[0]
  if (slug === undefined) return null
  return { slug, file: parts.length === 2 ? (parts[1] ?? null) : null }
}

/** Dated lines under the comments heading: a bullet or a sub-heading opening with an ISO date. */
export function countAnnotations(spec: string): number {
  let count = 0
  let isUnderComments = false
  for (const line of spec.split('\n')) {
    if (COMMENTS_HEADING.test(line)) {
      isUnderComments = true
      continue
    }
    if (isUnderComments && LEVEL_TWO_HEADING.test(line)) isUnderComments = false
    if (isUnderComments && DATED_LINE.test(line)) count += 1
  }
  return count
}

export function parseTicket(file: string, text: string): Ticket {
  const number = TICKET_FILE.exec(file)?.[1] ?? file
  const title = (TITLE.exec(text)?.[1] ?? file).replace(NUMBER_PREFIX, '')
  const prose = BLOCKED_BY.exec(text)?.[1] ?? ''
  const numbers = [...prose.matchAll(TICKET_NUMBER)].map(hit => hit[1] ?? '')
  const blockedBy = /^none\b/i.test(prose) ? [] : [...new Set(numbers)]
  let criteriaDone = 0
  let criteriaTotal = 0
  for (const line of text.split('\n')) {
    const box = CHECKBOX.exec(line)
    if (box === null) continue
    criteriaTotal += 1
    if (box[1] !== ' ') criteriaDone += 1
  }
  const isResolved = RESOLVED.test(text)
  return { file, number, title, blockedBy, isResolved, criteriaDone, criteriaTotal }
}

/**
 * The feature view of a folder's spec and tickets. A ticket's blockers are the numbers its prose
 * names among the folder's unresolved tickets, its own excepted. The lit ticket only where it is
 * a ticket of the folder.
 */
export function buildFeatureView(
  slug: string,
  files: readonly { name: string; text: string }[],
  litTicket: string | null,
): FeatureView {
  const spec = files.find(file => file.name === SPEC_FILE)
  const parsed = files
    .filter(file => isTicketFile(file.name))
    .map(file => parseTicket(file.name, file.text))
    .sort((a, b) => a.file.localeCompare(b.file))
  const blocking = new Set(parsed.filter(ticket => !ticket.isResolved).map(ticket => ticket.number))
  const tickets = parsed.map(ticket => ({
    ...ticket,
    blockedBy: ticket.blockedBy.filter(number => blocking.has(number) && number !== ticket.number),
  }))
  return {
    slug,
    hasSpec: spec !== undefined,
    annotations: spec === undefined ? 0 : countAnnotations(spec.text),
    tickets,
    litTicket: tickets.some(ticket => ticket.file === litTicket) ? litTicket : null,
  }
}
