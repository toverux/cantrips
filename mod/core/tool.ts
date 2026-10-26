// The loop tool: what the model reads of it, and what a call names. Pure: it takes the call's
// input and the feature's tickets.

import type { Ticket } from '../types'
import { SCRATCH } from './feature.ts'

export const LOOP_TOOL = {
  name: 'loop',
  description: [
    'Tells the cantrips loop panel, shown beside the chat, which feature and ticket you work on.',
    `Call it when you take up a feature folder under \`${SCRATCH}/\`: writing or revising its`,
    'spec, breaking it into tickets, or implementing, reviewing or committing its work; and again',
    'each time you take up one of its tickets. A file you only consult for reference is not taken',
    "up. `feature` is the folder's name; `ticket` is the ticket's file name, left out to keep the",
    'one last taken up. Answers at once.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      feature: { type: 'string', description: `The feature folder's name under ${SCRATCH}/.` },
      ticket: { type: 'string', description: "The ticket's file name, such as 03-slug.md." },
    },
  },
  isDeferred: false,
} as const

/** The last segment of a name the model may have given as a path. */
function baseName(given: string): string {
  return given.split(/[\\/]/).filter(part => part !== '').at(-1) ?? ''
}

/**
 * What a call selects: the feature it names, else the one in view, and the ticket it names; an
 * error the model reads where the input names neither feature nor one in view.
 */
export function readCall(
  input: Record<string, unknown>,
  inView: string | null,
): { slug: string; ticket: string | null } | { error: string } {
  const { feature, ticket } = input
  if (feature !== undefined && typeof feature !== 'string') {
    return { error: '`feature` is a string.' }
  }
  if (ticket !== undefined && typeof ticket !== 'string') return { error: '`ticket` is a string.' }
  const slug = feature === undefined ? inView : baseName(feature)
  if (slug === null || slug === '') return { error: 'Name the feature folder in `feature`.' }
  return { slug, ticket: ticket === undefined || ticket === '' ? null : baseName(ticket) }
}

/** The ticket a call names, by its file name or its number. */
export function findTicket(tickets: readonly Ticket[], given: string): Ticket | undefined {
  return tickets.find(ticket => ticket.file === given || ticket.number === given)
}
