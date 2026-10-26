// The loop panel: a pane with the loop rail, the feature's ticket board and a reserved row, and a
// band chip that opens it. Reach: it reads files, listens to events, draws, and writes only its
// own store; every hook but the Pane render, which returns its tree, and the command, which
// answers its own run, passes its event on, a guard that trips too.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallInput } from 'claude-code'

import type { FeatureView, LoopState } from '../types'
import {
  LOOP_CONFIG,
  SCRATCH,
  buildFeatureView,
  featurePathOf,
  isFeatureFile,
  isFeatureFolder,
  isTicketFile,
  newestMtime,
} from '../core/feature.ts'
import type { Entry } from '../core/feature.ts'
import {
  INITIAL,
  chipText,
  formatDuration,
  railStops,
  reduceSkill,
  withFileTrail,
} from '../core/loop.ts'

const PANE = 'cantrips'
const TITLE = '🪄 cantrips'
// Nord (https://www.nordtheme.com); what each shade means is the style guide in AGENTS.md.
const NORD = {
  frostCyan: '#88C0D0',
  frostBlue: '#81A1C1',
  auroraGreen: '#A3BE8C',
  auroraOrange: '#D08770',
  auroraPurple: '#B48EAD',
}
const TICK_MS = 10_000

// Change the tag when LoopState's fields change: an earlier version's value outlives a reload
// and is then declined.
const loop = atom({ plugin: 'cantrips', key: 'loop' } as const, INITIAL, { shape: 'loop-1' })

type SessionRecord = { isPaneClosed?: boolean }

export const register: Register = on => {
  let tick: { cancel: () => void } | null = null
  // The id the session record is kept under: a clear or a fork mints a new one while the pane's
  // state carries on, so the record follows it.
  let sessionId: string | null = null

  on('session.start', async ($, e, next) => {
    sessionId = await $.session.id()
    await $.command.register({ name: 'cantrips', description: 'Toggle the cantrips loop pane' })
    await rebuild($)
    await applyPaneRecord($, sessionId)
    return next(e)
  }).catch(($, e, next) => next(e))

  // `session.start` does not fire again after a clear, a resume or a fork, and those reset the
  // session state; the classic hook carries the source. A clear or a fork mints a new id with no
  // record of its own, so the record follows; a resumed session keeps the record it made.
  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'clear' || e.source === 'resume' || e.source === 'fork') {
      const previous = sessionId
      sessionId = e.session_id
      const isMinted = e.source !== 'resume' && previous !== null && previous !== e.session_id
      if (isMinted) await carrySession($, previous, e.session_id)
      await rebuild($)
      await applyPaneRecord($, e.session_id)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('skill.prompt', async ($, e, next) => {
    if (e.pluginName === $.plugin.name) {
      const now = await $.clock.now()
      await update($, loop, state => reduceSkill(state, e.skill, $.plugin.name, now))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined) await noticePath($, touchedPath(e))
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.start', ($, e, next) => {
    if (e.agentId === undefined && tick === null) {
      tick = $.clock.every(TICK_MS, () => $.ui.invalidate('ui.render'))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      tick?.cancel()
      tick = null
      await rebuild($, { activity: null })
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin.kind === 'person') await rememberPane($, true)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'cantrips' }, async $ => {
    const pane = (await $.ui.panes()).find(one => one.id === PANE)
    if (pane?.isPlaced === true) {
      // The record first: a reload's `session.start` landing during the close reads it.
      await rememberPane($, true)
      await $.ui.close({ id: PANE })
      return { text: 'cantrips pane closed; /cantrips reopens it.' }
    }
    const opened = await openPane($)
    if (opened.isPlaced) return { text: 'cantrips pane opened.' }
    return { text: `cantrips pane waits: ${opened.reason}` }
  }).catch(() => ({ text: 'cantrips: the pane could not be toggled.' }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const state = await read($, loop)
    if (e.props.hasSurvey || !(state.isLoopRepo || state.sawSkill)) return next(e)
    const { Box, Button } = $.ui.resolve(e)
    const rest = await next(e)

    return (
      <Box gap={1}>
        <Button key="chip" plain hotkey="c" onPress={() => openPane($)}>
          🪄 {chipText(state)}
        </Button>
        {rest}
      </Box>
    )
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const state = await read($, loop)
    const now = await $.clock.now()
    const feature = state.feature
    // The trailer's columns line up across rows: the count to its widest, the status to the
    // longest blocker list (the icon is two cells wide).
    const tickets = feature?.tickets ?? []
    const countWidth = Math.max(
      0,
      ...tickets.map(t => `${t.criteriaDone}/${t.criteriaTotal}`.length),
    )
    const statusWidth = Math.max(
      1,
      ...tickets.map(t => (t.blockedBy.length > 0 ? 2 + t.blockedBy.join(',').length : 0)),
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Box flexWrap="wrap" columnGap={1}>
            {railStops(state).map(stop =>
              stop.isCurrent ? (
                <Box columnGap={1}>
                  <Text color={NORD.frostCyan} weight="bold">
                    ● {stop.stage}
                  </Text>
                  {state.stageSince !== null && (
                    <Text dimColor>{formatDuration(now - state.stageSince)}</Text>
                  )}
                </Box>
              ) : stop.isVisited ? (
                <Text color={NORD.auroraGreen}>✓ {stop.stage}</Text>
              ) : stop.isSkipped ? (
                <Text dimColor strikethrough>
                  ○ {stop.stage}
                </Text>
              ) : (
                <Text dimColor>○ {stop.stage}</Text>
              ),
            )}
          </Box>
          {state.activity !== null && (
            <Text color={NORD.frostCyan}>
              ▸ /{state.activity} <Text dimColor>running</Text>
            </Text>
          )}
        </Box>
        {feature !== null && (
          <Box flexDirection="column">
            <Box columnGap={1}>
              <Text color={NORD.frostBlue} weight="bold">
                {feature.slug}
              </Text>
              <Text dimColor>
                {feature.hasSpec ? `spec ✓ · ${feature.annotations} annotations` : 'no spec'}
              </Text>
            </Box>
            {feature.tickets.map(ticket => {
              const isLit = ticket.file === feature.litTicket
              const weight = isLit ? 'bold' : 'regular'
              return (
                <Box columnGap={1}>
                  <Box flexShrink={0}>
                    <Text color={NORD.frostCyan}>{isLit ? '▶' : ' '}</Text>
                    <Text weight={weight} dimColor={ticket.isResolved}>
                      {' '}
                      {ticket.number}
                    </Text>
                  </Box>
                  <Box flexGrow={1} flexShrink={1}>
                    <Text
                      wrap="truncate-end"
                      weight={weight}
                      dimColor={ticket.isResolved}
                      strikethrough={ticket.isResolved}
                    >
                      {ticket.title}
                    </Text>
                  </Box>
                  <Box flexShrink={0} columnGap={1}>
                    <Box width={countWidth} justifyContent="flex-end">
                      <Text dimColor>
                        {ticket.criteriaDone}/{ticket.criteriaTotal}
                      </Text>
                    </Box>
                    <Box width={statusWidth}>
                      {ticket.isResolved ? (
                        <Text color={NORD.auroraGreen}>✓</Text>
                      ) : ticket.blockedBy.length > 0 ? (
                        <Text color={NORD.auroraOrange}>⛔{ticket.blockedBy.join(',')}</Text>
                      ) : (
                        <Text> </Text>
                      )}
                    </Box>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
        <Box columnGap={1}>
          <Text color={NORD.auroraPurple} weight="bold">
            Needs you
          </Text>
          <Text dimColor>· not wired yet</Text>
        </Box>
      </Box>
    )
  }).catch(($, e, next) => next(e))
}

/** The path a file tool's call touched. */
function touchedPath(e: ToolCallInput): string | null {
  switch (e.tool) {
    case 'Read':
    case 'Edit':
    case 'Write':
      return e.file_path
    case 'NotebookEdit':
      return e.notebook_path
    default:
      return null
  }
}

async function listOr($: EngineInterface, path: string) {
  return $.fs.list(path).catch(() => [])
}

/**
 * Re-reads the root: whether it runs the loop, and the feature the session works on, the one it
 * held where that folder still is, else the newest. The patch rides into the same write.
 */
async function rebuild($: EngineInterface, patch: Partial<LoopState> = {}): Promise<void> {
  const root = await $.session.root()
  const hasConfig = await $.fs.exists(`${root}/${LOOP_CONFIG}`)
  const folders: { slug: string; entries: readonly Entry[]; newest: number }[] = []
  for (const en of await listOr($, `${root}/${SCRATCH}`)) {
    if (en.kind !== 'dir') continue
    const entries = await listOr($, `${root}/${SCRATCH}/${en.name}`)
    if (!isFeatureFolder(entries)) continue
    folders.push({ slug: en.name, entries, newest: newestMtime(entries) })
  }
  const prior = await read($, loop)
  const chosen =
    folders.find(folder => folder.slug === prior.feature?.slug) ??
    folders.sort((a, b) => b.newest - a.newest)[0] ??
    null
  const feature =
    chosen === null
      ? null
      : await readFeature($, root, chosen.slug, chosen.entries, prior.feature?.litTicket ?? null)
  const isLoopRepo = hasConfig || folders.length > 0
  await update($, loop, state => withFileTrail({ ...state, ...patch, root, isLoopRepo, feature }))
}

/** The feature view of a listed folder; null where the listing holds no spec and no ticket. */
async function readFeature(
  $: EngineInterface,
  root: string,
  slug: string,
  entries: readonly Entry[],
  litTicket: string | null,
): Promise<FeatureView | null> {
  if (!isFeatureFolder(entries)) return null
  const dir = `${root}/${SCRATCH}/${slug}`
  const files = await Promise.all(
    entries
      .filter(en => en.kind === 'file' && isFeatureFile(en.name))
      .map(async en => ({ name: en.name, text: await $.fs.read(`${dir}/${en.name}`) })),
  )
  return buildFeatureView(slug, files, litTicket)
}

/** A touched path under a feature folder makes that feature the session's and lights its ticket. */
async function noticePath($: EngineInterface, path: string | null): Promise<void> {
  if (path === null) return
  const state = await read($, loop)
  if (state.root === null) return
  const hit = featurePathOf(state.root, path)
  if (hit === null) return
  let litTicket: string | null = null
  if (hit.file !== null && isTicketFile(hit.file)) litTicket = hit.file
  else if (state.feature?.slug === hit.slug) litTicket = state.feature.litTicket
  const entries = await listOr($, `${state.root}/${SCRATCH}/${hit.slug}`)
  const feature = await readFeature($, state.root, hit.slug, entries, litTicket)
  if (feature === null) return
  await update($, loop, held => withFileTrail({ ...held, isLoopRepo: true, feature }))
}

function sessionKey(id: string): string {
  return `session:${id}`
}

/** Copies the session record to the id a clear or a fork minted. */
async function carrySession($: EngineInterface, from: string, to: string): Promise<void> {
  const held = await $.store.get(sessionKey(from))
  if (held !== undefined) await $.store.set(sessionKey(to), held)
}

async function rememberPane($: EngineInterface, isClosed: boolean): Promise<void> {
  const record: SessionRecord = { isPaneClosed: isClosed }
  await $.store.set(sessionKey(await $.session.id()), record)
}

/**
 * Opens the pane in a loop repository, or closes the one shown, as the session's record says: a
 * resumed session may find the pane of the one it replaces still up. The id comes from the
 * caller, since inside a resume's hook the engine still answers the id of the session left.
 */
async function applyPaneRecord($: EngineInterface, id: string): Promise<void> {
  const state = await read($, loop)
  if (!state.isLoopRepo) return
  const held = ((await $.store.get(sessionKey(id))) ?? {}) as SessionRecord
  const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE)
  if (held.isPaneClosed === true) {
    if (isOpen) await $.ui.close({ id: PANE })
  } else if (!isOpen) {
    await $.ui.open({ id: PANE, title: TITLE })
  }
}

/** Opens the pane at the person's ask, which also lifts a close recorded for the session. */
async function openPane($: EngineInterface) {
  await rememberPane($, false)
  return $.ui.open({ id: PANE, title: TITLE })
}
