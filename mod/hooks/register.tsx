// The loop panel: a pane with the loop rail, the feature's ticket board, the features in flight,
// the gate run, the cantrips sub-agents at work, the deputy's mode and a reserved row, a band chip
// that opens it, a status line while the gate run stops or waits on the user, and the loop tool
// through which the model selects the feature and the ticket and reports the deputy's mode, and a
// keep list every compaction carries.
// Reach: it reads files, listens to events, draws, acts on the session only in answer to a press
// but for the keep list it adds to a compaction's instructions, and writes only its own store;
// every hook but the Pane render, which returns its tree, and the command and the tool, which
// answer their own runs and calls, passes its event on, a guard that trips too.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallInput } from 'claude-code'

import type { FeatureView, FlightRow, GatePhase, GateView, LoopState } from '../types'
import type { AgentPhase, DeputyLine, Pip } from '../core/agents.ts'
import {
  agentLine,
  agentRole,
  agentsView,
  deputyLine,
  spawnAgent,
  withAgentList,
  withDeputy,
} from '../core/agents.ts'
import { keepList, withKeepList } from '../core/compact.ts'
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
  barCells,
  FOR_YOU_NAMED,
  fitIds,
  gateStatus,
  headline,
  isGateCall,
  metaLine,
  parseGate,
  startPath,
  stopText,
  resumeCommand,
  WAY_OUT_LEAD,
  verdictParts,
} from '../core/gate.ts'
import type { BarKind } from '../core/gate.ts'
import {
  INITIAL,
  chipText,
  formatDuration,
  isStruck,
  plural,
  railStops,
  reduceSkill,
  runningCount,
  withFileTrail,
} from '../core/loop.ts'
import { LOOP_TOOL, findTicket, readCall } from '../core/tool.ts'

const PANE = 'cantrips'
const TITLE = 'cantrips'
// Nord (https://www.nordtheme.com); what each shade means is the style guide in mod/CLAUDE.md.
const NORD = {
  frostCyan: '#88C0D0',
  frostBlue: '#81A1C1',
  auroraGreen: '#A3BE8C',
  auroraOrange: '#D08770',
  auroraPurple: '#B48EAD',
  auroraYellow: '#EBCB8B',
}
// The gate's headline by phase: live work cyan, what waits on the user purple, done green, a stop
// orange.
const PHASE_MARKS: Record<GatePhase, [string, string]> = {
  reviewing: ['●', NORD.frostCyan],
  fixing: ['●', NORD.frostCyan],
  waiting: ['◆', NORD.auroraPurple],
  green: ['✓', NORD.auroraGreen],
  done: ['✓', NORD.auroraGreen],
  stopped: ['⛔', NORD.auroraOrange],
}
// The bar's shades, which its legend's marks take: the skipped and declined segments dim, the open
// one plain.
const BAR_SHADES: Record<BarKind, { color?: string; isDim?: boolean }> = {
  done: { color: NORD.auroraGreen },
  skipped: { isDim: true },
  forYou: { color: NORD.auroraPurple },
  queued: { color: NORD.frostCyan },
  open: {},
  declined: { isDim: true },
}
const TICK_MS = 10_000
// The agent rows' name column, `verifiers` wide.
const ROLE_WIDTH = 10
// A pattern, since the hook filter's types admit the built-in tools' names alone.
const TOOL = new RegExp(`^mcp__cantrips__${LOOP_TOOL.name}$`)

// What a clear, a resume or a fork resets: the conversation it starts may hold agents and a deputy
// the module never saw.
const UNSEEN_AGENTS = { agents: [], deputy: null, viewNote: null }

// Change the tag when LoopState's fields change: an earlier version's value outlives a reload
// and is then declined.
const loop = atom({ plugin: 'cantrips', key: 'loop' } as const, INITIAL, { shape: 'loop-8' })

export const register: Register = on => {
  const live: Live = { tick: null, isTurnRunning: false }
  // The id the session record is kept under: a clear or a fork mints a new one while the pane's
  // state carries on, so the record follows it.
  let sessionId: string | null = null
  let hasTool = false

  on('session.start', async ($, e, next) => {
    sessionId = await $.session.id()
    await $.command.register({ name: 'cantrips', description: 'Toggle the cantrips loop pane' })
    hasTool = await refresh($, { session: sessionId }, hasTool)
    // A reload keeps the path in the session state; a session opened anew finds it in its record.
    const known = (await read($, loop)).gatePath
    await readGate($, known ?? (await readSession($, sessionId)).gate ?? null)
    await applyPaneRecord($, sessionId)
    // Last, so a failed prune costs the prune alone.
    await pruneSessions($)
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
      hasTool = await refresh($, { session: e.session_id, ...UNSEEN_AGENTS }, hasTool)
      // A resumed session's run is under its own id; a clear or a fork starts with none.
      const resumed = e.source === 'resume' ? await readSession($, e.session_id) : {}
      await readGate($, resumed.gate ?? null)
      await applyPaneRecord($, e.session_id)
    }
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
    if (e.tool === 'Bash' && e.agentId === undefined && isGateCall(e.command)) {
      await rereadGate($, e.command, ran.text)
    }
    return ran
  }).catch(($, e, next) => next(e))

  // An auto-compaction takes no argument, so the keep list rides the event, after what was typed.
  on('session.compact', async ($, e, next) => {
    const list = e.agentId === undefined ? keepList(await read($, loop)) : null
    return next(list === null ? e : { ...e, instructions: withKeepList(e.instructions, list) })
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    const role = agentRole(e.subagentType, $.plugin.name)
    const id = spawned.agentId
    if (role !== null && id !== undefined) {
      const now = await $.clock.now()
      await update($, loop, state => spawnAgent(state, id, role, now))
      await refreshAgents($, live)
    }
    return spawned
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      live.isTurnRunning = true
      // A refused view's reason answers one press; the next prompt moves on from it.
      await update($, loop, state =>
        state.viewNote === null ? state : { ...state, viewNote: null },
      )
    }
    await refreshAgents($, live)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) {
      live.isTurnRunning = false
      hasTool = await refresh($, { activity: null }, hasTool)
    }
    await refreshAgents($, live)
    return done
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
    const agents = agentsView(state)
    const viewing = e.props.view.agentId
    const deputy = deputyLine(state, agents.deputy, now)
    // The deputy's row is always drawn, for its stance.
    const rows = [
      {
        role: 'deputy',
        run: agents.deputy,
        mark: deputyMark(Text, deputy),
        right:
          deputy.activity === 'idle' ? (
            <Text dimColor>idle</Text>
          ) : (
            runTime(Text, deputy.activity === 'running', deputy.time)
          ),
      },
    ]
    if (agents.arbiter !== null) {
      const ruling = agentLine(agents.arbiter, now)
      rows.unshift({
        role: 'arbiter',
        run: agents.arbiter,
        mark: phaseMark(Text, ruling.phase),
        right: runTime(Text, ruling.phase === 'running', ruling.time),
      })
    }
    const groups = [
      ['finders', agents.finders],
      ['verifiers', agents.verifiers],
    ] as const
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
      <Box flexDirection="column" gap={1} paddingRight={1}>
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
              const isDim = ticket.isResolved && !isLit
              const isTitleStruck = isStruck(state, ticket)
              return (
                <Box columnGap={1}>
                  <Box flexShrink={0}>
                    <Text color={NORD.frostCyan}>{isLit ? '▶' : ' '}</Text>
                    <Text weight={weight} dimColor={isDim}>
                      {' '}
                      {ticket.number}
                    </Text>
                  </Box>
                  <Box flexGrow={1} flexShrink={1}>
                    <Text
                      wrap="truncate-end"
                      weight={weight}
                      dimColor={isDim}
                      strikethrough={isTitleStruck}
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
                      {isTitleStruck ? (
                        <Text color={NORD.auroraGreen}>✓</Text>
                      ) : ticket.isResolved ? (
                        <Text color={NORD.frostCyan}>◐</Text>
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
        {state.gate !== null && gateSection(Text, Box, state.gate, e.props.bodyColumns)}
        <Box flexDirection="column">
          <Box columnGap={1}>
            <Box flexGrow={1}>
              <Text dimColor>Agents</Text>
            </Box>
            {viewing !== undefined && (
              <Button key="view:main" plain onPress={() => showAgent($, null)}>
                <Text color={NORD.frostCyan}>◀ main</Text>
              </Button>
            )}
          </Box>
          {state.viewNote?.id === 'main' && <Text dimColor>{state.viewNote.text}</Text>}
          {groups.map(
            ([label, batch]) =>
              batch !== null && (
                <Box columnGap={1}>
                  <Text> {label.padEnd(ROLE_WIDTH)}</Text>
                  <Box flexGrow={1} flexShrink={1} columnGap={1}>
                    <Text wrap="truncate-end">{batch.pips.map(pip => pipMark(Text, pip))}</Text>
                    <Box flexShrink={0}>
                      <Text dimColor>
                        {batch.done}/{batch.pips.length}
                      </Text>
                    </Box>
                  </Box>
                  <Text color={NORD.frostCyan}>{formatDuration(now - batch.since)}</Text>
                </Box>
              ),
          )}
          {rows.map(({ role, run, mark, right }) => (
            <Box flexDirection="column">
              <Box>
                <Text color={NORD.frostCyan}>{run !== null && run.id === viewing ? '▌' : ' '}</Text>
                {run?.isListed === true ? (
                  <Button key={`view:${run.id}`} plain onPress={() => showAgent($, run.id)}>
                    {role.padEnd(ROLE_WIDTH)} {mark}
                  </Button>
                ) : (
                  // The engine refuses to show an agent it no longer lists.
                  <Text>
                    {role.padEnd(ROLE_WIDTH)} {mark}
                  </Text>
                )}
                <Box flexGrow={1} justifyContent="flex-end" paddingLeft={1}>
                  {right}
                </Box>
              </Box>
              {run !== null && state.viewNote?.id === run.id && (
                <Box paddingLeft={1}>
                  <Text dimColor>{state.viewNote.text}</Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>
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

type Resolved = ReturnType<EngineInterface['ui']['resolve']>

/** A batch run's pip: ticked once done, crossed once failed or killed, lit while not ended. */
function pipMark(Text: Resolved['Text'], pip: Pip) {
  if (pip === 'done') return <Text color={NORD.auroraGreen}>✓</Text>
  if (pip === 'failed') return <Text color={NORD.auroraOrange}>✗</Text>
  return <Text color={NORD.frostCyan}>●</Text>
}

/** The gate's headline, marked and colored by the phase the script recorded. */
function gateHeadline(Text: Resolved['Text'], gate: GateView) {
  const [mark, color] = PHASE_MARKS[gate.phase]
  return (
    <Text color={color} weight="bold">
      {mark} {headline(gate)}
    </Text>
  )
}

/**
 * The gate run: its headline and meta line, a stop, the bar and its legend, the parked findings,
 * the queue and the verdicts, at one height whatever the count of findings.
 */
function gateSection(
  Text: Resolved['Text'],
  Box: Resolved['Box'],
  gate: GateView,
  bodyColumns: number,
) {
  // The gate's rows sit one column in, inside the pane's right padding.
  const width = Math.max(10, bodyColumns - 2)
  // A report-only run fixes nothing, so its bar would never move.
  const bar = gate.mode === 'report' ? [] : barCells(gate.counts, width)
  const stop = stopText(gate)
  const verdicts = verdictParts(gate)
  const queued = `${gate.counts.queued} queued`
  return (
    <Box flexDirection="column">
      <Box columnGap={1}>
        <Text dimColor>Gate</Text>
        {gateHeadline(Text, gate)}
      </Box>
      <Text wrap="truncate-end" dimColor>
        {' '}
        {metaLine(gate)}
      </Text>
      {stop !== null && (
        <Box paddingLeft={1} flexDirection="column">
          {gate.phase === 'stopped' ? (
            <Box flexDirection="column">
              <Text wrap="wrap" color={NORD.auroraOrange}>
                {stop}
              </Text>
              {/* The command stays whole where the sentence wraps. */}
              <Box flexWrap="wrap" columnGap={1}>
                <Text>{WAY_OUT_LEAD}</Text>
                <Text>{resumeCommand(gate)}.</Text>
              </Box>
            </Box>
          ) : (
            // A stop tripped in a run still at work may lapse before it closes.
            <Text wrap="wrap" color={NORD.auroraOrange} dimColor>
              Stop tripped: {stop}
            </Text>
          )}
        </Box>
      )}
      {bar.length > 0 && (
        <Text>
          {' '}
          {bar.map(({ kind, cells }) => barSegment(Text, kind, cells))}
        </Text>
      )}
      <Box paddingLeft={1} flexWrap="wrap" columnGap={2}>
        {countTokens(Text, [
          ['✓', gate.counts.done, 'done', 'done'],
          ['⊘', gate.counts.skipped, 'skipped', 'skipped'],
          ['○', gate.counts.open, 'open', 'open'],
        ])}
      </Box>
      {gate.counts.forYou > 0 && (
        // The parked count heads its findings, by name up to the cap: the bar's purple legend.
        <Box flexDirection="column">
          <Text>
            {' '}
            <Text color={BAR_SHADES.forYou.color}>◆</Text> {gate.counts.forYou} for you
          </Text>
          {gate.forYou.slice(0, FOR_YOU_NAMED).map(one => (
            <Box columnGap={1} paddingLeft={3}>
              <Box flexShrink={0}>
                <Text color={BAR_SHADES.forYou.color}>F{one.id}</Text>
              </Box>
              <Box flexGrow={1} flexShrink={1}>
                <Text wrap="truncate-end">{one.summary}</Text>
              </Box>
            </Box>
          ))}
          {gate.forYou.length > FOR_YOU_NAMED && (
            <Text dimColor>
              {'   '}+{gate.forYou.length - FOR_YOU_NAMED} more
            </Text>
          )}
        </Box>
      )}
      {gate.counts.queued > 0 && (
        // The queued count with its ids, the batch in flight first: the bar's cyan legend.
        <Text wrap="truncate-end">
          {' '}
          <Text color={BAR_SHADES.queued.color}>●</Text> {queued}{' '}
          <Text color={BAR_SHADES.queued.color}>
            {fitIds(gate.queue, width - queued.length - 3)}
          </Text>
        </Text>
      )}
      <Box paddingLeft={1} flexWrap="wrap" columnGap={2}>
        {countTokens(Text, [['⊘', gate.counts.declined, 'declined', 'declined']])}
        {gate.counts.held > 0 && <Text dimColor>+{gate.counts.held} held</Text>}
      </Box>
      {verdicts.length > 0 && (
        <Box paddingLeft={1} flexWrap="wrap" columnGap={2}>
          {verdicts.map(part => (
            <Text dimColor>{part}</Text>
          ))}
        </Box>
      )}
    </Box>
  )
}

/** One segment of the gate's bar. */
function barSegment(Text: Resolved['Text'], kind: BarKind, cells: number) {
  const { color, isDim } = BAR_SHADES[kind]
  return (
    <Text color={color} dimColor={isDim}>
      {'━'.repeat(cells)}
    </Text>
  )
}

/**
 * A row of the bar's legend: each count with its mark and word, a zero left out. The parked and
 * the queued counts head their own lines, with the findings they name, and the declines come last.
 */
function countTokens(Text: Resolved['Text'], tokens: [string, number, string, BarKind][]) {
  return tokens
    .filter(([, n]) => n > 0)
    .map(([mark, n, word, kind]) => (
      <Text>
        <Text color={BAR_SHADES[kind].color} dimColor={BAR_SHADES[kind].isDim}>
          {mark}
        </Text>{' '}
        {n} {word}
      </Text>
    ))
}

/** The arbiter's phase. */
function phaseMark(Text: Resolved['Text'], phase: AgentPhase) {
  if (phase === 'running') return <Text color={NORD.frostCyan}>● running</Text>
  if (phase === 'on call') return <Text color={NORD.auroraYellow}>◆ on call</Text>
  return <Text color={NORD.auroraGreen}>✓ done</Text>
}

/** The deputy's mark: what it does now, the word its mode or stance. */
function deputyMark(Text: Resolved['Text'], line: DeputyLine) {
  if (line.activity === 'running') return <Text color={NORD.frostCyan}>● {line.word}</Text>
  if (line.stance === 'standing') return <Text color={NORD.auroraYellow}>◆ {line.word}</Text>
  if (line.stance === 'dismissed') return <Text color={NORD.auroraGreen}>✓ {line.word}</Text>
  return <Text dimColor>{line.word}</Text>
}

/** A row's time: cyan while its agent works, dim once it is done. */
function runTime(Text: Resolved['Text'], isWorking: boolean, time: string | null) {
  if (isWorking) return <Text color={NORD.frostCyan}>{time}</Text>
  return time !== null && <Text dimColor>{time}</Text>
}

/**
 * Shows the agent's conversation in the main view, or the main one for null: the view call comes
 * first, since the engine honours it only in direct answer to the press. A refusal shows its
 * reason.
 */
async function showAgent($: EngineInterface, id: string | null): Promise<void> {
  const shown = await $.ui.view(id === null ? {} : { agentId: id })
  const note =
    shown.deny === undefined ? null : { id: id ?? 'main', text: `View refused: ${shown.deny}` }
  await update($, loop, state => ({ ...state, viewNote: note }))
}

/** The timer, and whether a main turn runs: what the timer's life hangs on. */
type Live = { tick: { cancel: () => void } | null; isTurnRunning: boolean }

/**
 * Reads the engine's agent list into the runs, then keeps the timer running only while a turn or
 * a listed agent runs; each tick reads the list again, since an agent that ends outside a turn
 * fires nothing the module hears.
 */
async function refreshAgents($: EngineInterface, live: Live): Promise<void> {
  let state = await read($, loop)
  if (state.agents.length > 0) {
    const listed = await $.agent.list()
    const now = await $.clock.now()
    state = await update($, loop, held => withAgentList(held, listed, now))
  }
  const isLive = live.isTurnRunning || runningCount(state) > 0
  if (isLive && live.tick === null) {
    live.tick = $.clock.every(TICK_MS, () => {
      $.ui.invalidate('ui.render')
      void refreshAgents($, live).catch(() => undefined)
    })
  } else if (!isLive && live.tick !== null) {
    live.tick.cancel()
    live.tick = null
  }
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
 * Serves a call of the loop tool: selects the feature and the ticket it names and records them,
 * and takes the deputy mode it reports; a name the folder lacks changes nothing and answers why.
 */
async function select(
  $: EngineInterface,
  input: Record<string, unknown>,
): Promise<{ result: '' } | { deny: string }> {
  const state = await read($, loop)
  const root = state.root ?? (await $.session.root())
  const call = readCall(input, state.feature?.slug ?? null)
  if ('error' in call) return { deny: call.error }
  const mode = call.deputy
  if (call.slug === null) {
    if (mode !== null) await update($, loop, held => withDeputy(held, mode))
    return { result: '' }
  }
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
  const selected = await update($, loop, held => {
    const reported = mode === null ? held : withDeputy(held, mode)
    const chosen = selectFeature(
      { ...reported, isLoopRepo: true },
      view,
      ticket?.file ?? null,
      stored,
    )
    return withFileTrail(chosen)
  })
  await recordTouch($, selected, await $.clock.now())
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

/**
 * Reads the gate's state file into the section and the status line, which holds the stop the file
 * records and is cleared otherwise; a null path, a gone file or one lacking a field the pane reads
 * leaves both empty.
 */
async function readGate($: EngineInterface, path: string | null): Promise<void> {
  const text = path === null ? null : await $.fs.read(path).catch(() => null)
  const gate = text === null ? null : parseGate(text)
  await update($, loop, state => ({ ...state, gatePath: path, gate }))
  $.ui.status(gateStatus(gate))
}

/**
 * Once a call of the findings script returns: takes the path a start call printed, kept in the
 * session's record for a resume, then re-reads the run from the path known.
 */
async function rereadGate(
  $: EngineInterface,
  command: string,
  output: string | undefined,
): Promise<void> {
  const started = startPath(command, output ?? '')
  const { session, gatePath } = await read($, loop)
  if (started !== null && session !== null) await updateSession($, session, { gate: started })
  const path = started ?? gatePath
  if (path !== null) await readGate($, path)
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

/**
 * Copies the session record to the id a clear or a fork minted, but for the gate's path: the
 * script keys a run on the session id, so the new one starts with none.
 */
async function carrySession($: EngineInterface, from: string, to: string): Promise<void> {
  const held = await $.store.get(sessionKey(from))
  if (held === undefined) return
  const { gate: _, ...kept } = held as SessionRecord
  await updateSession($, to, kept)
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
