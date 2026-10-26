// The loop panel's state contract: the values the module keeps in `$.state`, declared under the
// plugin's name, and the types the pure core and the module share.

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
  /** The ticket file the session touched last, when it is one of the tickets. */
  litTicket: string | null
}

export type LoopState = {
  /** The session's project root, once read. */
  root: string | null
  /** Whether the root holds the loop config or a feature folder. */
  isLoopRepo: boolean
  /** Whether one of the plugin's skills expanded in this session. */
  sawSkill: boolean
  stage: Stage | null
  /** When the current stage began, in `$.clock.now()` milliseconds. */
  stageSince: number | null
  /** The stages visited, in the order first entered. */
  trail: Stage[]
  /** A plugin skill outside the eight stages, while its turn runs. */
  activity: string | null
  feature: FeatureView | null
}

declare module 'claude-code' {
  interface PluginState {
    cantrips: { loop: Shaped<LoopState> }
  }
}
