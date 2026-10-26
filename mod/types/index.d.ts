// The loop panel's state contract: the values the module keeps in `$.state`, declared under the
// plugin's name, and the types the pure core and the module share.

import type { AgentStatus } from 'claude-code'

export type Stage =
  | 'grilling'
  | 'spec'
  | 'tickets'
  | 'implement'
  | 'simplify'
  | 'review-gate'
  | 'commit'
  | 'compound'

export type Ticket = {
  /** The file name, `NN-<slug>.md`. */
  file: string
  /** The `NN` the file name opens with. */
  number: string
  /** The heading, its `NN —` prefix dropped. */
  title: string
  /**
   * The ticket numbers the "Blocked by" prose names; the feature view keeps those of the folder's
   * unresolved tickets.
   */
  blockedBy: string[]
  /** Whether a `Status: resolved` line stands under the title. */
  isResolved: boolean
  criteriaDone: number
  criteriaTotal: number
}

export type FeatureView = {
  slug: string
  hasSpec: boolean
  /** Dated lines under the spec's comments heading. */
  annotations: number
  tickets: Ticket[]
  /** The ticket file the session selected last, when it is one of the tickets. */
  litTicket: string | null
}

/** What the store keeps per repository root and feature slug. */
export type FeatureRecord = {
  /** The session that last worked on the feature. */
  session: string
  /** The stage the feature reached. */
  stage: Stage | null
  trail: Stage[]
  /** The ticket file the session selected last; absent from a record written before it was kept. */
  ticket?: string | null
  /** When the session last selected the feature or changed its stage, in epoch milliseconds. */
  touchedAt: number
}

/** One feature in flight, as the session-start list draws it. */
export type FlightRow = {
  slug: string
  stage: Stage | null
  /** The later of the store's last touch and the folder's newest file; 0 with neither. */
  touchedAt: number
  hasSpec: boolean
  tickets: number
  /** The stored ticket's number, while its file stands unresolved. */
  ticket: string | null
  /** The session a Resume press reopens; null where none is known or it is this one. */
  resume: string | null
}

/** Where an agent's loop stands, as the engine's agent list says. */
export type { AgentStatus }

/** A cantrips sub-agent, known by its scoped plugin name on spawn. */
export type AgentRole = 'finder' | 'verifier' | 'arbiter' | 'deputy'

/** One cantrips sub-agent of the session, from its spawn on. */
export type AgentRun = {
  /** The id the engine's agent list gives it. */
  id: string
  role: AgentRole
  /** The spawns of a group made while one of it had not ended share a batch. */
  batch: number
  /** The list's status at its last read; a run the list dropped is `completed`. */
  status: AgentStatus
  /** When its spawn was seen, in `$.clock.now()` milliseconds. */
  startedAt: number
  /** When it last began running; null while it does not run. */
  runningSince: number | null
  /** When it was first seen ended; null while it has not. */
  endedAt: number | null
  /** Whether the engine's agent list still holds it, which a view of it needs. */
  isListed: boolean
}

/** The deputy's mode, as the model reports it through the loop tool. */
export type DeputyMode = 'off' | 'deciding' | 'advisor'

export type LoopState = {
  /** The session's id, as the store keys it. */
  session: string | null
  /** The session's project root, once read. */
  root: string | null
  /** Whether the root holds the loop config or a feature folder. */
  isLoopRepo: boolean
  /** Whether one of the plugin's skills expanded in this session. */
  sawSkill: boolean
  stage: Stage | null
  /** When the current stage began, in `$.clock.now()` milliseconds. */
  stageSince: number | null
  /** The stages visited for the feature in view, in the order first entered. */
  trail: Stage[]
  /** The stages entered before the session selected a feature, which join the first it selects. */
  pending: Stage[]
  /** The feature folder the session selected last, through the loop tool or its record. */
  touched: string | null
  /** A plugin skill outside the eight stages, while its turn runs. */
  activity: string | null
  feature: FeatureView | null
  /** Every feature in flight under the scratch folder, the last touched first. */
  inFlight: FlightRow[]
  /** What a rejected Resume press did instead, on its feature's row. */
  resumeNote: { slug: string; text: string } | null
  /** The cantrips sub-agents of the session, in spawn order. */
  agents: AgentRun[]
  /** The deputy's mode as the model last reported it; null before a report. */
  deputy: DeputyMode | null
  /** Why the engine refused to show an agent's conversation, on that agent's row. */
  viewNote: { id: string; text: string } | null
}

declare module 'claude-code' {
  interface PluginState {
    cantrips: { loop: Shaped<LoopState> }
  }
}
