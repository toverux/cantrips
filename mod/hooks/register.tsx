// The loop panel: a pane with the loop rail, the feature's ticket board, the features in flight
// and a reserved row, a band chip that opens it, and the loop tool through which the model
// selects the feature and the ticket. Reach: it reads files, listens to events, draws, acts on
// the session only in answer to a press or to name it after the feature, and writes only its own
// store; every hook but the Pane render, which returns its tree, and the command and the tool,
// which answer their own runs and calls, passes its event on, a guard that trips too.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallInput } from 'claude-code'

import type { FeatureView, FlightRow, LoopState } from '../types'
import {
  LOOP_CONFIG,
  SCRATCH,
  buildFeatureView,
  featurePathOf,
  isFeatureFile,
  isFeatureFolder,
  parseTicket,
} from '../core/feature.ts'
import type { Entry, ListedFolder } from '../core/feature.ts'
import {
  featureRecord,
  flightRows,
  flightText,
  listedFlight,
  isSessionKey,
  pruneRecords,
  recordedFeature,
  repoKey,
  selectFeature,
  sessionKey,
  staleSessions,
} from '../core/flight.ts'
import type { Records, SessionRecord } from '../core/flight.ts'
import {
  INITIAL,
  chipText,
  formatDuration,
  plural,
  railStops,
  reduceSkill,
  withFileTrail,
} from '../core/loop.ts'
import { LOOP_TOOL, findTicket, readCall } from '../core/tool.ts'

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
// A pattern, since the hook filter's types admit the built-in tools' names alone.
const TOOL = new RegExp(`^mcp__cantrips__${LOOP_TOOL.name}$`)

// Change the tag when LoopState's fields change: an earlier version's value outlives a reload
// and is then declined.
const loop = atom({ plugin: 'cantrips', key: 'loop' } as const, INITIAL, { shape: 'loop-3' })

export const register: Register = on => {
  let tick: { cancel: () => void } | null = null
  // The id the session record is kept under: a clear or a fork mints a new one while the pane's
  // state carries on, so the record follows it.
  let sessionId: string | null = null
  let hasTool = false

  on('session.start', async ($, e, next) => {
    sessionId = await $.session.id()
    await $.command.register({ name: 'cantrips', description: 'Toggle the cantrips loop pane' })
    hasTool = await refresh($, { session: sessionId }, hasTool)
    await applyPaneRecord($, sessionId)
    // Last, so a failed prune costs the prune alone.
    await pruneSessions($)
    return next(e)
  }).catch(($, e, next) => next(e))

  // `session.start` does not fire again after a clear, a resume or a fork, and those reset the
  // session state; the classic hook carries the source. A clear or a fork mints a new id with no
  // record of its own, so the record follows; a resumed session keeps the record it made. The
  // session's name, which a clear keeps, rides in on every source.
  on('classic.SessionStart', async ($, e, next) => {
    const title = e.session_title ?? null
    if (e.source === 'clear' || e.source === 'resume' || e.source === 'fork') {
      const previous = sessionId
      sessionId = e.session_id
      const isMinted = e.source !== 'resume' && previous !== null && previous !== e.session_id
      if (isMinted) await carrySession($, previous, e.session_id)
      hasTool = await refresh($, { session: e.session_id, title }, hasTool)
      await applyPaneRecord($, e.session_id)
    } else {
      await update($, loop, state => ({ ...state, title }))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // The one place a name the user gave shows: an unnamed session's prompt carries none.
  on('classic.UserPromptSubmit', async ($, e, next) => {
    const title = e.session_title ?? null
    const state = await read($, loop)
    if (state.title !== title) await update($, loop, held => ({ ...held, title }))
    return next(e)
  }).catch(($, e, next) => next(e))

  on('skill.prompt', async ($, e, next) => {
    if (e.pluginName === $.plugin.name) {
      const now = await $.clock.now()
      const state = await update($, loop, held => reduceSkill(held, e.skill, $.plugin.name, now))
      await recordTouch($, state, now)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: TOOL }, async ($, e) => {
    if (e.agentId !== undefined) {
      return { deny: 'Only the main agent selects the feature and the ticket.' }
    }
    return select($, e as unknown as Record<string, unknown>)
  }).catch(() => ({ deny: 'The cantrips panel could not take the selection; it is unchanged.' }))

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined) await rereadBoard($, touchedPath(e))
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
      hasTool = await refresh($, { activity: null }, hasTool)
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
    const { Box, Button, Text } = $.ui.resolve(e)
    const state = await read($, loop)
    const now = await $.clock.now()
    const feature = state.feature
    const flight = listedFlight(state)
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
                {feature.hasSpec
                  ? `spec ✓ · ${plural(feature.annotations, 'annotation')}`
                  : 'no spec'}
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
        {flight.length > 0 && (
          <Box flexDirection="column">
            <Text dimColor>In flight</Text>
            {flight.map(row => (
              <Box flexDirection="column">
                <Box columnGap={1}>
                  <Box flexShrink={0}>
                    <Text color={row.slug === feature?.slug ? NORD.frostBlue : undefined}>
                      {row.slug}
                    </Text>
                  </Box>
                  <Box flexGrow={1} flexShrink={1}>
                    <Text wrap="truncate-end" dimColor>
                      {flightText(row, now)}
                    </Text>
                  </Box>
                  {row.resume !== null && (
                    <Button key={`resume:${row.slug}`} onPress={() => resumeSession($, row)}>
                      Resume
                    </Button>
                  )}
                </Box>
                {state.resumeNote?.slug === row.slug && (
                  <Text color={NORD.auroraPurple}>{state.resumeNote.text}</Text>
                )}
              </Box>
            ))}
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
 * Rebuilds, and registers the tool the first time the root runs the loop, so a repository that
 * never does carries no description on its requests; a turn's end that finds the first feature
 * registers it for the next prompt. Answers whether the tool is registered.
 */
async function refresh(
  $: EngineInterface,
  patch: Partial<LoopState>,
  hasTool: boolean,
): Promise<boolean> {
  const isLoopRepo = await rebuild($, patch)
  if (isLoopRepo && !hasTool) await $.tool.register(LOOP_TOOL)
  return hasTool || isLoopRepo
}

/**
 * Re-reads the root: whether it runs the loop, the feature the session selected where that folder
 * still is, else the one whose record names the session, as a resumed session's does, and the
 * features in flight. The patch rides into the same write. Answers whether the root runs the loop.
 */
async function rebuild($: EngineInterface, patch: Partial<LoopState> = {}): Promise<boolean> {
  const root = await $.session.root()
  const hasConfig = await $.fs.exists(`${root}/${LOOP_CONFIG}`)
  // A scratch folder deleted whole lists as empty; one that fails to list proves nothing gone.
  const scratch = `${root}/${SCRATCH}`
  const listed = (await $.fs.exists(scratch)) ? await $.fs.list(scratch).catch(() => null) : []
  const folders: ListedFolder[] = []
  const unread: string[] = []
  for (const en of listed ?? []) {
    if (en.kind !== 'dir') continue
    const entries = await $.fs.list(`${scratch}/${en.name}`).catch(() => null)
    if (entries === null) unread.push(en.name)
    else if (isFeatureFolder(entries)) folders.push({ slug: en.name, entries })
  }
  // Records of gone features leave the store.
  const held = await readRecords($, root)
  const kept = [...folders.map(folder => folder.slug), ...unread]
  const records = listed === null ? held : pruneRecords(held, kept)
  if (records !== held) await $.store.set(repoKey(root), records)
  const flight = await Promise.all(
    folders.map(async folder => ({
      ...folder,
      stored: await readTicket($, root, folder, records[folder.slug]?.ticket ?? null),
    })),
  )
  const prior = await read($, loop)
  const slug = prior.touched ?? recordedFeature(records, patch.session ?? prior.session)
  const chosen = folders.find(folder => folder.slug === slug)
  const lit = prior.feature?.slug === slug ? prior.feature.litTicket : null
  const view =
    chosen === undefined ? null : await readFeature($, root, chosen.slug, chosen.entries, lit)
  const isLoopRepo = hasConfig || folders.length > 0
  await update($, loop, state => {
    const held = { ...state, ...patch, root, isLoopRepo, feature: view }
    const inFlight = flightRows(flight, records, held.session)
    const selected =
      view === null || held.touched === view.slug
        ? held
        : selectFeature(held, view, null, records[view.slug])
    return withFileTrail({ ...selected, inFlight })
  })
  return isLoopRepo
}

/** A folder's ticket file, parsed; null where none is named or the folder lacks it. */
async function readTicket(
  $: EngineInterface,
  root: string,
  folder: ListedFolder,
  file: string | null,
) {
  if (file === null || !folder.entries.some(en => en.name === file)) return null
  const text = await $.fs.read(`${root}/${SCRATCH}/${folder.slug}/${file}`).catch(() => null)
  return text === null ? null : parseTicket(file, text)
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
      .map(async en => {
        // An unreadable file reads as empty, so the rebuild and the tool it registers go on.
        const text = await $.fs.read(`${dir}/${en.name}`).catch(() => '')
        return { name: en.name, text }
      }),
  )
  return buildFeatureView(slug, files, litTicket)
}

/** The feature view of a folder, listed first. */
async function loadFeature(
  $: EngineInterface,
  root: string,
  slug: string,
  litTicket: string | null,
): Promise<FeatureView | null> {
  const entries = await listOr($, `${root}/${SCRATCH}/${slug}`)
  return readFeature($, root, slug, entries, litTicket)
}

/**
 * Serves a call of the loop tool: selects the feature and the ticket it names, records them and,
 * for the session's first feature, names the session; a name the folder lacks changes nothing
 * and answers why.
 */
async function select(
  $: EngineInterface,
  input: Record<string, unknown>,
): Promise<{ result: '' } | { deny: string }> {
  const state = await read($, loop)
  const root = state.root ?? (await $.session.root())
  const call = readCall(input, state.feature?.slug ?? null)
  if ('error' in call) return { deny: call.error }
  const view = await loadFeature($, root, call.slug, null)
  if (view === null) {
    const where = `${SCRATCH}/${call.slug}/`
    return { deny: `${where} holds no spec and no ticket; call again once it does.` }
  }
  const ticket = call.ticket === null ? null : findTicket(view.tickets, call.ticket)
  if (ticket === undefined) {
    const files = view.tickets.map(one => one.file).join(', ') || 'none'
    return { deny: `${SCRATCH}/${call.slug}/ has no ticket ${call.ticket}; its tickets: ${files}.` }
  }
  const stored = (await readRecords($, root))[call.slug]
  const selected = await update($, loop, held =>
    withFileTrail(selectFeature({ ...held, isLoopRepo: true }, view, ticket?.file ?? null, stored)),
  )
  await recordTouch($, selected, await $.clock.now())
  if (state.touched !== call.slug) await nameSession($, selected)
  return { result: '' }
}

/** Re-reads the board where a file tool's call touched the feature in view; selects nothing. */
async function rereadBoard($: EngineInterface, path: string | null): Promise<void> {
  if (path === null) return
  const { root, feature } = await read($, loop)
  if (root === null || feature === null || featurePathOf(root, path)?.slug !== feature.slug) return
  const view = await loadFeature($, root, feature.slug, feature.litTicket)
  await update($, loop, held => withFileTrail({ ...held, feature: view }))
}

/** The repository's feature records. */
async function readRecords($: EngineInterface, root: string): Promise<Records> {
  return ((await $.store.get(repoKey(root))) ?? {}) as Records
}

/** The session's record. */
async function readSession($: EngineInterface, id: string): Promise<SessionRecord> {
  return ((await $.store.get(sessionKey(id))) ?? {}) as SessionRecord
}

/**
 * Writes the selected feature's record: this session, its stage, trail and ticket, and the time.
 */
async function recordTouch($: EngineInterface, state: LoopState, now: number): Promise<void> {
  if (state.session === null || state.root === null || state.touched === null) return
  const records = await readRecords($, state.root)
  const record = featureRecord(state.session, state, records[state.touched], now)
  await $.store.set(repoKey(state.root), { ...records, [state.touched]: record })
}

/** Makes the feature's record the latest of its session's. */
async function stampRecord($: EngineInterface, slug: string): Promise<void> {
  const root = await $.session.root()
  const records = await readRecords($, root)
  const record = records[slug]
  if (record === undefined) return
  const stamped = { ...record, touchedAt: await $.clock.now() }
  await $.store.set(repoKey(root), { ...records, [slug]: stamped })
}

/**
 * Names the session after the feature it selected first, once: the record settles it through a
 * clear or a resume, and a name the user gave stands. The rename is queued from a timer, outside
 * the tool call the turn waits on, and runs once the session is idle.
 */
async function nameSession($: EngineInterface, state: LoopState): Promise<void> {
  const { session, touched } = state
  if (session === null || touched === null) return
  const held = await readSession($, session)
  if (held.isRenamed === true) return
  await updateSession($, session, { isRenamed: true })
  if (state.title !== null) return
  $.clock.after(0, () => {
    void $.command.run({ command: 'rename', args: touched }).catch(() => undefined)
  })
}

/**
 * Queues `/resume <id>` from the press; where the call rejects, fills the prompt with that command
 * instead and says so on the row. The row's record is stamped first, so the resumed session, which
 * restores the feature it selected last, brings back this one.
 */
async function resumeSession($: EngineInterface, row: FlightRow): Promise<void> {
  if (row.resume === null) return
  // A stamp that fails costs which feature comes back, never the resume.
  await stampRecord($, row.slug).catch(() => undefined)
  try {
    await $.command.run({ command: 'resume', args: row.resume })
  } catch (error) {
    const command = `/resume ${row.resume}`
    const filled = await $.prompt.fill({ text: command }).catch(() => null)
    const reason = error instanceof Error ? error.message : String(error)
    const text =
      filled?.isFilled === true
        ? `Resume refused (${reason}); the prompt holds ${command}.`
        : `Resume refused (${reason}); type ${command}.`
    await update($, loop, state => ({ ...state, resumeNote: { slug: row.slug, text } }))
  }
}

/** Drops the session records last written past the TTL. */
async function pruneSessions($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const keys = (await $.store.keys()).filter(isSessionKey)
  const entries = await Promise.all(
    keys.map(async key => [key, await $.store.get(key)] as [string, unknown]),
  )
  for (const key of staleSessions(entries, now)) await $.store.delete(key)
}

/** Merges the patch into the session's record and stamps the write. */
async function updateSession(
  $: EngineInterface,
  id: string,
  patch: SessionRecord,
): Promise<void> {
  const held = await readSession($, id)
  await $.store.set(sessionKey(id), { ...held, ...patch, at: await $.clock.now() })
}

/** Copies the session record to the id a clear or a fork minted. */
async function carrySession($: EngineInterface, from: string, to: string): Promise<void> {
  const held = await $.store.get(sessionKey(from))
  if (held !== undefined) await updateSession($, to, held as SessionRecord)
}

async function rememberPane($: EngineInterface, isClosed: boolean): Promise<void> {
  await updateSession($, await $.session.id(), { isPaneClosed: isClosed })
}

/**
 * Opens the pane in a loop repository, or closes the one shown, as the session's record says: a
 * resumed session may find the pane of the one it replaces still up. The id comes from the
 * caller, since inside a resume's hook the engine still answers the id of the session left.
 */
async function applyPaneRecord($: EngineInterface, id: string): Promise<void> {
  const state = await read($, loop)
  if (!state.isLoopRepo) return
  const held = await readSession($, id)
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
