// The loop tool: what the model reads of it, and what a call names. Pure: it takes the call's
// input and the feature's tickets.

import type { DeputyMode, Ticket } from '../types'
import { SCRATCH } from './feature.ts'

const MODES: readonly DeputyMode[] = ['off', 'deciding', 'advisor']

export const LOOP_TOOL = {
  name: 'loop',
  description: [
    'Tells the cantrips loop panel, shown beside the chat, which feature and ticket you work on.',
    `Call it when you take up a feature folder under \`${SCRATCH}/\`: writing or revising its`,
    'spec, breaking it into tickets, or implementing, reviewing or committing its work; and again',
    'each time you take up one of its tickets. A file you only consult for reference is not taken',
    "up. `feature` is the folder's name; `ticket` is the ticket's file name, left out to keep the",
    'one last taken up. When `/deputy` engages a deputy, switches its mode or dismisses it, call',
    'it with `deputy` alone, the mode now in force: `deciding`, `advisor` or `off`.',
    'Answers at once.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      feature: { type: 'string', description: `The feature folder's name under ${SCRATCH}/.` },
      ticket: { type: 'string', description: "The ticket's file name, such as 03-slug.md." },
      deputy: {
        type: 'string',
        enum: MODES,
        description: "The deputy's mode once `/deputy` ran.",
      },
    },
  },
  isDeferred: false,
} as const

/** A field as the call gives it, an empty one absent, since a model fills an unused field so. */
function present(value: unknown): unknown {
  return value === '' || value === null ? undefined : value
}

/** The last segment of a name the model may have given as a path. */
function baseName(given: string): string {
  return given.split(/[\\/]/).filter(part => part !== '').at(-1) ?? ''
}

/**
 * What a call selects: the feature it names, else the one in view, and the ticket it names; the
 * deputy mode it reports, which alone selects no feature. An error the model reads where the
 * input names no feature and none is in view.
 */
export function readCall(
  input: Record<string, unknown>,
  inView: string | null,
): { slug: string | null; ticket: string | null; deputy: DeputyMode | null } | { error: string } {
  const [feature, ticket, deputy] = [input.feature, input.ticket, input.deputy].map(present)
  if (feature !== undefined && typeof feature !== 'string') {
    return { error: '`feature` is a string.' }
  }
  if (ticket !== undefined && typeof ticket !== 'string') return { error: '`ticket` is a string.' }
  const mode = MODES.find(one => one === deputy) ?? null
  if (deputy !== undefined && mode === null) return { error: `\`deputy\` is ${MODES.join(', ')}.` }
  if (mode !== null && feature === undefined && ticket === undefined) {
    return { slug: null, ticket: null, deputy: mode }
  }
  const slug = feature === undefined ? inView : baseName(feature)
  if (slug === null || slug === '') return { error: 'Name the feature folder in `feature`.' }
  return { slug, ticket: ticket === undefined ? null : baseName(ticket), deputy: mode }
}

/** The ticket a call names, by its file name or its number. */
export function findTicket(tickets: readonly Ticket[], given: string): Ticket | undefined {
  return tickets.find(ticket => ticket.file === given || ticket.number === given)
}
