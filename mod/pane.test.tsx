// Mounted scenarios: the module loaded in the headless engine, the world beneath it answered by
// the test. The kit mocks the clock; the file system and the store are answered here, so the
// test reads back what the module stored.

import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { AgentStatus, On } from 'claude-code'

const ROOT = '/repo'
const FEATURE = `${ROOT}/.scratch/loop-panel`
const TICKET_02 = `${FEATURE}/02-features.md`
const OLDER = `${ROOT}/.scratch/older`

const entry = (name: string, kind: 'file' | 'dir', mtimeMs: number) => ({
  name,
  kind,
  size: 0,
  mtimeMs,
  isLink: false,
})

const FILES: Record<string, string> = {
  [`${ROOT}/docs/agents/cantrips-loop.md`]: '# The cantrips loop in this repo\n',
  [`${FEATURE}/spec.md`]: [
    '# The loop panel',
    '',
    '## Comments',
    '',
    '- 2026-10-21 — the user asked for a reserved row.',
    '',
    '### 2026-10-22 — the deputy objected',
    '',
    'An empty row reads as nothing waits.',
    '',
  ].join('\n'),
  [`${FEATURE}/01-mod-skeleton.md`]: [
    '# 01 — The mod skeleton',
    '',
    '**Blocked by:** None — can start immediately.',
    '',
    '- [x] The pane opens at start.',
    '- [ ] The chip shows alone in a narrow terminal.',
    '',
  ].join('\n'),
  [`${FEATURE}/02-features.md`]: [
    '# 02 — Features in flight',
    '',
    'Status: resolved',
    '',
    '**Blocked by:** 01 — The mod skeleton.',
    '',
    '- [x] Both features are listed.',
    '',
  ].join('\n'),
  [`${OLDER}/spec.md`]: '# An older feature\n',
}

const DIRS: Record<string, ReturnType<typeof entry>[]> = {
  [`${ROOT}/.scratch`]: [
    entry('loop-panel', 'dir', 0),
    entry('older', 'dir', 0),
    entry('sync', 'dir', 0),
  ],
  [`${ROOT}/.scratch/sync`]: [entry('upstream.md', 'file', 9)],
  [FEATURE]: [
    entry('spec.md', 'file', 5),
    entry('01-mod-skeleton.md', 'file', 6),
    entry('02-features.md', 'file', 7),
  ],
  [OLDER]: [entry('spec.md', 'file', 1)],
}

const PANE = {
  plugin: 'cantrips',
  component: 'Pane',
  requestId: 'cantrips',
  surface: 'terminal',
  props: {
    title: 'cantrips',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const BAND = {
  plugin: 'cantrips',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 5,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 4 },
    view: {},
  },
} as const

const CANTRIPS_COMMAND = {
  command: 'cantrips',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 160 },
} as const

/** The engine beneath the plugin: each hook here stands for it. */
function world(
  on: On,
  options: {
    root?: string
    store?: Record<string, unknown>
    isCommandRefused?: boolean
    isViewRefused?: boolean
  } = {},
) {
  const calls = {
    opens: [] as string[],
    closes: [] as string[],
    commands: [] as string[],
    fills: [] as string[],
    tools: [] as string[],
    views: [] as string[],
    lists: 0,
  }
  // The engine's agent list: a scenario sets each agent's status the way its loop moves.
  const agents = new Map<string, AgentStatus>()
  const store = new Map(Object.entries(options.store ?? {}))
  // The paths whose listing or read fails, and the store keys whose write fails: a scenario adds
  // one the way an error would.
  const refused = new Set<string>()
  // The id the engine answers: a scenario moves it the way a clear or a resume does.
  const session = { id: 'sid-1' }
  const clock = mock.clock(on, { now: 1_000_000 })
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    if (refused.has(e.key)) return { deny: 'EIO' }
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('classic.SessionStart', () => ({}))
  on('turn.complete', () => ({ text: '' }))
  on('command.run', (_, e) => {
    calls.commands.push(`/${e.command} ${e.args}`)
    if (options.isCommandRefused === true) throw new Error('not now')
    return {}
  })
  on('prompt.fill', (_, e) => {
    calls.fills.push(e.text)
    return { isFilled: true }
  })
  on('session.root', () => ({ value: options.root ?? ROOT }))
  on('session.id', () => ({ value: session.id }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => {
    calls.tools.push(e.name)
    return { value: { tool: `mcp__cantrips__${e.name}` } }
  })
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: {} }))
  on('fs.exists', (_, e) => ({ value: e.path in FILES || e.path in DIRS }))
  on('fs.list', (_, e) => {
    if (refused.has(e.path)) return { deny: 'EIO' }
    const listed = DIRS[e.path]
    return listed === undefined ? { deny: 'ENOENT' } : { value: listed }
  })
  on('fs.read', (_, e) => {
    if (refused.has(e.path)) return { deny: 'EACCES' }
    const text = FILES[e.path]
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('ui.open', (_, e) => {
    calls.opens.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_, e) => {
    calls.closes.push(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value:
      calls.opens.length > calls.closes.length
        ? [{ id: 'cantrips', title: 'cantrips', isShown: true, isFocused: false, isPlaced: true }]
        : [],
  }))
  on('agent.spawn', (_, e) => {
    const agentId = `${e.subagentType.split(':').at(-1)}-${agents.size + 1}`
    agents.set(agentId, 'running')
    return { agentId, model: 'claude-haiku-5-5' }
  })
  on('agent.list', () => {
    calls.lists++
    return { value: [...agents].map(([id, status]) => ({ id, status, type: '', description: '' })) }
  })
  on('ui.view', (_, e) => {
    calls.views.push(e.agentId ?? 'main')
    return { value: options.isViewRefused === true ? { deny: 'not from a press' } : {} }
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { calls, store, session, clock, refused, agents }
}

const start = ($: Engine) =>
  $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
const expand = ($: Engine, skill: string, text: string) =>
  $.skill.prompt({ skill, text, source: 'plugin', pluginName: 'cantrips' })
// The kit's input types know the built-in tools alone.
const select = ($: Engine, input: { feature?: string; ticket?: string; deputy?: string }) =>
  $.tool.call({ tool: 'mcp__cantrips__loop', ...input } as never)
const completeTurn = ($: Engine) =>
  $.turn.complete({
    answer: '',
    durationMs: 0,
    isAborted: false,
    turnId: 'turn-1',
    reason: 'answer',
  })

const spawn = ($: Engine, subagentType: string) =>
  $.agent.spawn({
    tool_use_id: 'tu-1',
    prompt: 'Hunt.',
    description: 'hunt',
    subagentType,
    provider: { plugin: 'cantrips', tier: 'user' },
  } as never)
const startTurn = ($: Engine) => $.turn.start({ text: 'Go.', turnId: 'turn-1' })

const REPO = 'repo:/repo'
const record = (
  session: string,
  stage: string,
  touchedAt: number,
  trail = [stage],
  ticket: string | null = null,
) => ({ session, stage, trail, ticket, touchedAt })

test('the pane and the chip after a replayed skill expansion', async ($, on) => {
  const { calls } = world(on)
  await start($)
  expect(calls.opens).toEqual(['cantrips'])

  await expand($, 'cantrips:spec', 'Write the spec.')
  await expand($, 'cantrips:implement', 'Implement it.')
  // A bare /simplify that resolves to the built-in leaves the rail unchanged.
  await $.skill.prompt({ skill: 'simplify', text: 'Simplify it.', source: 'built-in' })
  // A plugin skill outside the eight stages is the activity under the rail.
  await expand($, 'cantrips:deputy', 'Stand in.')
  await select($, { feature: 'loop-panel', ticket: '01-mod-skeleton.md' })

  const pane = await $.ui.mount(PANE)
  expect((await pane.find({ type: 'Text', text: /✓ spec/ }))?.text).toBe('✓ spec')
  expect((await pane.find({ type: 'Text', text: /● implement/ }))?.text).toBe('● implement')
  const simplify = await pane.find({ type: 'Text', text: /○ simplify/ })
  expect(simplify?.props.strikethrough).toBeUndefined()
  expect((await pane.find({ type: 'Text', text: /deputy/ }))?.text).toBe('▸ /deputy running')
  // The ticket files prove /tickets ran, in whatever session; /grilling left no trace and was
  // skipped.
  expect((await pane.find({ type: 'Text', text: /✓ tickets/ }))?.text).toBe('✓ tickets')
  expect((await pane.find({ type: 'Text', text: /○ grilling/ }))?.props.strikethrough).toBe(true)
  const spec = await pane.find({ type: 'Text', text: /annotations/ })
  expect(spec?.text).toBe('spec ✓ · 2 annotations')
  expect((await pane.find({ type: 'Text', text: /^▶$/ }))).toBeDefined()
  expect((await pane.find({ type: 'Text', text: /^ 01$/ }))?.props.weight).toBe('bold')
  const title01 = await pane.find({ type: 'Text', text: /The mod skeleton/ })
  expect(title01?.props).toMatchObject({ weight: 'bold', strikethrough: false })
  // Resolved: the whole row dim, the title alone struck.
  const number02 = await pane.find({ type: 'Text', text: /^ 02$/ })
  expect(number02?.props).toMatchObject({ dimColor: true, weight: 'regular' })
  const title02 = await pane.find({ type: 'Text', text: /Features in flight/ })
  expect(title02?.props).toMatchObject({ dimColor: true, strikethrough: true })
  expect((await pane.find({ type: 'Text', text: /^1\/1$/ }))).toBeDefined()
  // A resolved ticket shows its tick in place of its blockers.
  expect((await pane.find({ type: 'Text', text: /^⛔01$/ }))).toBeUndefined()
  expect((await pane.find({ type: 'Text', text: /^✓$/ }))).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /not wired yet/ })).toBeDefined()
  await pane.unmount()

  const band = await $.ui.mount(BAND)
  expect((await band.find({ key: 'chip' }))?.text).toBe('🪄 implement · 01/2')
  await band.unmount()
})

test('an edit under the feature in view re-reads the board and lights nothing', async ($, on) => {
  world(on)
  await start($)
  const pane = await $.ui.mount(PANE)
  await $.tool.call({ tool: 'Read', file_path: TICKET_02 })
  expect(await pane.find({ type: 'Text', text: /annotations/ })).toBeUndefined()
  await select($, { feature: 'loop-panel' })

  FILES[TICKET_02] = FILES[TICKET_02]!.replace('- [x] Both', '- [ ] Both')
  try {
    const edit = {
      tool: 'Edit',
      file_path: TICKET_02,
      old_string: '- [x]',
      new_string: '- [ ]',
    } as const
    await $.tool.call(edit)

    expect((await pane.find({ type: 'Text', text: /^ 02$/ }))?.props.weight).toBe('regular')
    expect((await pane.find({ type: 'Text', text: /^0\/1$/ }))).toBeDefined()
    expect((await pane.find({ type: 'Text', text: /^▶$/ }))).toBeUndefined()
  } finally {
    FILES[TICKET_02] = FILES[TICKET_02]!.replace('- [ ] Both', '- [x] Both')
    await pane.unmount()
  }
})

test('a closed pane stays closed at start, and the chip reopens it', async ($, on) => {
  const { calls, store } = world(on, { store: { 'session:sid-1': { isPaneClosed: true } } })
  await start($)
  expect(calls.opens).toEqual([])

  const band = await $.ui.mount(BAND)
  expect((await band.find({ key: 'chip' }))?.text).toBe('🪄 cantrips')
  await band.press({ key: 'chip' })
  expect(calls.opens).toEqual(['cantrips'])
  expect(store.get('session:sid-1')).toMatchObject({ isPaneClosed: false })
  await band.unmount()
})

test('/cantrips toggles the pane and records the close', async ($, on) => {
  const { calls, store } = world(on)
  await start($)

  const closed = await $.command.run(CANTRIPS_COMMAND)
  expect(closed.text).toContain('closed')
  expect(calls.closes).toEqual(['cantrips'])
  expect(store.get('session:sid-1')).toMatchObject({ isPaneClosed: true })

  const opened = await $.command.run(CANTRIPS_COMMAND)
  expect(opened.text).toContain('opened')
  expect(calls.opens).toEqual(['cantrips', 'cantrips'])
  expect(store.get('session:sid-1')).toMatchObject({ isPaneClosed: false })
})

test('a clear carries the record to the new id, and a resume keeps its own', async ($, on) => {
  const closedA = { 'session:sid-a': { isPaneClosed: true } }
  const { calls, store, session } = world(on, { store: closedA })
  await start($)
  await $.command.run(CANTRIPS_COMMAND)
  expect(store.get('session:sid-1')).toMatchObject({ isPaneClosed: true })

  session.id = 'sid-2'
  await $.classic.SessionStart({ source: 'clear', session_id: 'sid-2' })
  expect(store.get('session:sid-2')).toMatchObject({ isPaneClosed: true })
  expect(calls.opens).toEqual(['cantrips'])
  await $.command.run(CANTRIPS_COMMAND)
  expect(store.get('session:sid-2')).toMatchObject({ isPaneClosed: false })

  // Session A closed its pane in its own time; resuming it from here closes the one shown. The
  // engine still answers the old id inside the hook, so the world moves it after.
  await $.classic.SessionStart({ source: 'resume', session_id: 'sid-a' })
  session.id = 'sid-a'
  expect(store.get('session:sid-a')).toMatchObject({ isPaneClosed: true })
  expect(calls.closes).toEqual(['cantrips', 'cantrips'])
  expect(calls.opens).toEqual(['cantrips', 'cantrips'])
})

test('a repository outside the loop has no chip, no pane and no tool', async ($, on) => {
  const { calls } = world(on, { root: '/elsewhere' })
  await start($)
  await completeTurn($)
  expect(calls.opens).toEqual([])
  expect(calls.tools).toEqual([])

  const band = await $.ui.mount(BAND)
  expect(await band.find({ key: 'chip' })).toBeUndefined()
  await band.unmount()
})

test('the features in flight list at start, Resume offered for another session', async ($, on) => {
  world(on, {
    store: {
      [REPO]: {
        'loop-panel': record('sid-other', 'implement', 940_000),
        older: record('sid-old', 'spec', 400_000),
      },
    },
  })
  await start($)
  const pane = await $.ui.mount(PANE)
  expect(await pane.find({ type: 'Text', text: /^In flight$/ })).toBeDefined()
  const loopRow = 'implement · 1m ago · spec ✓ · 2 tickets'
  expect((await pane.find({ type: 'Text', text: /^implement · / }))?.text).toBe(loopRow)
  expect((await pane.find({ type: 'Text', text: /^spec · / }))?.text).toBe(
    'spec · 10m ago · spec ✓ · no tickets',
  )
  expect(await pane.find({ key: 'resume:older' })).toBeDefined()
  expect(await pane.find({ key: 'resume:loop-panel' })).toBeDefined()

  // Selected in this session, the feature's row loses its Resume at the turn's end.
  await select($, { feature: 'loop-panel' })
  await completeTurn($)
  expect(await pane.find({ key: 'resume:loop-panel' })).toBeUndefined()
  expect(await pane.find({ key: 'resume:older' })).toBeDefined()
  await pane.unmount()
})

test('a Resume press queues the resume command with the recorded id', async ($, on) => {
  const { calls } = world(on, { store: { [REPO]: { older: record('sid-old', 'spec', 400_000) } } })
  await start($)
  const pane = await $.ui.mount(PANE)
  await pane.press({ key: 'resume:older' })
  expect(calls.commands).toEqual(['/resume sid-old'])
  expect(calls.fills).toEqual([])
  await pane.unmount()
})

test('a Resume press brings back the feature of its row', async ($, on) => {
  // Both rows name one session, which last selected the other feature.
  const { session } = world(on, {
    store: {
      [REPO]: {
        'loop-panel': record('sid-old', 'implement', 400_000),
        older: record('sid-old', 'spec', 900_000),
      },
    },
  })
  await start($)
  const pane = await $.ui.mount(PANE)
  await pane.press({ key: 'resume:loop-panel' })
  await $.classic.SessionStart({ source: 'resume', session_id: 'sid-old' })
  session.id = 'sid-old'
  expect((await pane.find({ type: 'Text', text: /annotations/ }))?.text).toBe(
    'spec ✓ · 2 annotations',
  )
  await pane.unmount()
})

test('a Resume press whose stamp fails still queues the resume', async ($, on) => {
  const { calls, refused } = world(on, {
    store: { [REPO]: { older: record('sid-old', 'spec', 400_000) } },
  })
  await start($)
  const pane = await $.ui.mount(PANE)
  refused.add(REPO)
  await pane.press({ key: 'resume:older' })
  expect(calls.commands).toEqual(['/resume sid-old'])
  await pane.unmount()
})

test('one annotation reads in the singular', async ($, on) => {
  const spec = `${OLDER}/spec.md`
  const held = FILES[spec] ?? ''
  FILES[spec] = '# An older feature\n\n## Comments\n\n- 2026-10-26 — one note.\n'
  try {
    world(on)
    await start($)
    const pane = await $.ui.mount(PANE)
    await select($, { feature: 'older' })
    expect((await pane.find({ type: 'Text', text: /annotation/ }))?.text).toBe(
      'spec ✓ · 1 annotation',
    )
    await pane.unmount()
  } finally {
    FILES[spec] = held
  }
})

test('a rejected resume fills the prompt and the row says so', async ($, on) => {
  const { calls } = world(on, {
    store: { [REPO]: { older: record('sid-old', 'spec', 400_000) } },
    isCommandRefused: true,
  })
  await start($)
  const pane = await $.ui.mount(PANE)
  await pane.press({ key: 'resume:older' })
  expect(calls.fills).toEqual(['/resume sid-old'])
  const note = await pane.find({ type: 'Text', text: /Resume refused/ })
  expect(note?.text).toContain('the prompt holds /resume sid-old')
  await pane.unmount()
})

test('stages entered before the first call join its feature\'s trail', async ($, on) => {
  const { store } = world(on)
  await start($)
  await expand($, 'cantrips:grilling', 'Grill me.')
  await expand($, 'cantrips:spec', 'Write the spec.')
  await select($, { feature: 'older' })
  // The rail reads a trail as a set: the file-proven stages lead it.
  const held = store.get(REPO) as Record<string, { session: string; trail: string[] }>
  expect(held.older?.session).toBe('sid-1')
  expect(held.older?.trail.toSorted()).toEqual(['grilling', 'spec'])
  // A stage change once the feature is selected rewrites its record.
  await expand($, 'cantrips:tickets', 'Break it down.')
  const after = store.get(REPO) as Record<string, { stage: string; trail: string[] }>
  expect(after.older?.stage).toBe('tickets')
  expect(after.older?.trail.toSorted()).toEqual(['grilling', 'spec', 'tickets'])
  expect(Object.keys(after)).toEqual(['older'])
})

test('a fresh session shows no feature, the resumed one its feature and ticket', async ($, on) => {
  const trail = ['grilling', 'spec', 'tickets', 'implement']
  const stored = record('sid-old', 'implement', 900_000, trail, '01-mod-skeleton.md')
  const { session } = world(on, { store: { [REPO]: { 'loop-panel': stored } } })
  await start($)
  const pane = await $.ui.mount(PANE)
  expect(await pane.find({ type: 'Text', text: /annotations/ })).toBeUndefined()
  expect((await pane.find({ type: 'Text', text: /^implement · / }))?.text).toBe(
    'implement · 1m ago · spec ✓ · 01/2',
  )
  await pane.press({ key: 'resume:loop-panel' })

  await $.classic.SessionStart({ source: 'resume', session_id: 'sid-old' })
  session.id = 'sid-old'
  expect((await pane.find({ type: 'Text', text: /annotations/ }))?.text).toBe(
    'spec ✓ · 2 annotations',
  )
  expect((await pane.find({ type: 'Text', text: /✓ grilling/ }))?.text).toBe('✓ grilling')
  expect((await pane.find({ type: 'Text', text: /^ 01$/ }))?.props.weight).toBe('bold')
  await pane.unmount()
})

test('a stored ticket since resolved is neither lit nor on the row', async ($, on) => {
  const stored = record('sid-old', 'implement', 900_000, ['implement'], '02-features.md')
  world(on, { store: { [REPO]: { 'loop-panel': stored } } })
  await start($)
  const pane = await $.ui.mount(PANE)
  expect((await pane.find({ type: 'Text', text: /^implement · / }))?.text).toBe(
    'implement · 1m ago · spec ✓ · 2 tickets',
  )
  await $.classic.SessionStart({ source: 'resume', session_id: 'sid-old' })
  expect((await pane.find({ type: 'Text', text: /annotations/ }))).toBeDefined()
  expect((await pane.find({ type: 'Text', text: /^▶$/ }))).toBeUndefined()
  await pane.unmount()
})

test('a call lights and records; a later read lights nothing', async ($, on) => {
  const { calls, store } = world(on)
  await start($)
  await completeTurn($)
  expect(calls.tools).toEqual(['loop'])
  const answer = await select($, { feature: 'loop-panel', ticket: '01-mod-skeleton.md' })
  expect(answer.result).toBe('')
  expect(store.get(REPO)).toMatchObject({
    'loop-panel': { session: 'sid-1', ticket: '01-mod-skeleton.md' },
  })

  await $.tool.call({ tool: 'Read', file_path: TICKET_02 })
  const band = await $.ui.mount(BAND)
  expect((await band.find({ key: 'chip' }))?.text).toBe('🪄 cantrips · 01/2')
  await band.unmount()
})

test('a call naming a missing feature or ticket errs and changes nothing', async ($, on) => {
  const { store } = world(on)
  await start($)
  const noFeature = await select($, { feature: 'nowhere' })
  expect(noFeature.deny).toContain('.scratch/nowhere/ holds no spec and no ticket')
  const noTicket = await select($, { feature: 'loop-panel', ticket: '09-gone.md' })
  expect(noTicket.deny).toContain('01-mod-skeleton.md, 02-features.md')
  expect(store.has(REPO)).toBe(false)
  const band = await $.ui.mount(BAND)
  expect((await band.find({ key: 'chip' }))?.text).toBe('🪄 cantrips')
  await band.unmount()
})

test('a listing that fails prunes no record', async ($, on) => {
  const kept = { 'loop-panel': record('sid-0', 'implement', 900_000) }
  const { store, refused } = world(on, { store: { [REPO]: kept } })
  await start($)
  refused.add(FEATURE)
  await completeTurn($)
  expect(store.get(REPO)).toEqual(kept)
  refused.add(`${ROOT}/.scratch`)
  await completeTurn($)
  expect(store.get(REPO)).toEqual(kept)
})

test('an unreadable feature file still registers the tool', async ($, on) => {
  const { calls, refused } = world(on, {
    store: { [REPO]: { 'loop-panel': record('sid-1', 'implement', 900_000) } },
  })
  refused.add(`${FEATURE}/spec.md`)
  await start($)
  expect(calls.tools).toEqual(['loop'])
})

test('a scratch folder deleted whole drops its records', async ($, on) => {
  const { store } = world(on, {
    root: '/elsewhere',
    store: { 'repo:/elsewhere': { gone: record('sid-0', 'commit', 900_000) } },
  })
  await start($)
  expect(store.get('repo:/elsewhere')).toEqual({})
})

test('a session start drops the records of gone features and stale sessions', async ($, on) => {
  const day = 24 * 60 * 60 * 1000
  const { store, clock } = world(on, {
    store: {
      [REPO]: { older: record('sid-old', 'spec', 400_000), gone: record('sid-old', 'spec', 1) },
      'session:sid-stale': { isPaneClosed: true, at: 1 },
      'session:sid-fresh': { isPaneClosed: true, at: 2 * day },
    },
  })
  await clock.advance(8 * day)
  await start($)
  expect(Object.keys(store.get(REPO) as object)).toEqual(['older'])
  expect(store.has('session:sid-stale')).toBe(false)
  expect(store.has('session:sid-fresh')).toBe(true)
})

test('a gate run shows its finders and verifiers moving, and the arbiter sticky', async ($, on) => {
  const { agents, clock } = world(on)
  await start($)
  await expand($, 'cantrips:review-gate', 'Gate it.')
  await startTurn($)
  const finder1 = await spawn($, 'cantrips:finder:diff-scan')
  await spawn($, 'cantrips:finder:cross-file')
  // A role pasted into a general-purpose dispatch is not recognized.
  await spawn($, 'general-purpose')
  const pane = await $.ui.mount(PANE)
  expect((await pane.find({ type: 'Text', text: /^\d+\/\d+$/ }))?.text).toBe('0/2')

  agents.set(finder1.agentId!, 'completed')
  await spawn($, 'cantrips:verifier')
  expect((await pane.find({ type: 'Text', text: /^1\/2$/ }))?.text).toBe('1/2')
  expect((await pane.find({ type: 'Text', text: /^0\/1$/ }))?.text).toBe('0/1')
  const band = await $.ui.mount(BAND)
  expect((await band.find({ key: 'chip' }))?.text).toBe('🪄 review-gate · 2 running')
  await band.unmount()

  for (const id of agents.keys()) agents.set(id, 'completed')
  const arbiter = await spawn($, 'cantrips:arbiter')
  expect(await pane.find({ type: 'Text', text: /^\d+\/\d+$/ })).toBeUndefined()
  expect((await pane.find({ key: `view:${arbiter.agentId}` }))?.text).toMatch(
    /^arbiter +● running$/,
  )
  expect(await pane.find({ type: 'Text', text: '0s' })).toBeDefined()
  await clock.advance(70_000)
  agents.set(arbiter.agentId!, 'completed')
  await completeTurn($)
  expect((await pane.find({ key: `view:${arbiter.agentId}` }))?.text).toMatch(/^arbiter +✓ done$/)
  expect(await pane.find({ type: 'Text', text: '1m' })).toBeDefined()
  await pane.unmount()
})

test('a view press shows the agent, the way back returns, a refusal says why', async ($, on) => {
  const { calls } = world(on)
  await start($)
  const arbiter = await spawn($, 'cantrips:arbiter')
  const pane = await $.ui.mount(PANE)
  await pane.press({ key: `view:${arbiter.agentId}` })
  expect(calls.views).toEqual([arbiter.agentId])
  expect(await pane.find({ type: 'Text', text: '▌' })).toBeUndefined()
  await pane.unmount()

  const viewed = await $.ui.mount({
    ...PANE,
    props: { ...PANE.props, view: { agentId: arbiter.agentId } },
  })
  // The row of the agent in view carries a bar in its margin.
  expect(await viewed.find({ type: 'Text', text: '▌' })).toBeDefined()
  await viewed.press({ key: 'view:main' })
  expect(calls.views).toEqual([arbiter.agentId, 'main'])
  expect(await viewed.find({ type: 'Text', text: /View refused/ })).toBeUndefined()
  await viewed.unmount()
})

test('a refused view shows the engine\'s reason', async ($, on) => {
  world(on, { isViewRefused: true })
  await start($)
  const deputy = await spawn($, 'cantrips:deputy')
  const pane = await $.ui.mount(PANE)
  await pane.press({ key: `view:${deputy.agentId}` })
  expect((await pane.find({ type: 'Text', text: /View refused/ }))?.text).toBe(
    'View refused: not from a press',
  )
  // The next prompt's turn takes the note away.
  await startTurn($)
  expect(await pane.find({ type: 'Text', text: /View refused/ })).toBeUndefined()
  await pane.unmount()
})

test('an arbiter the engine no longer lists leaves; a deputy stays, unpressable', async ($, on) => {
  const { agents } = world(on)
  await start($)
  const arbiter = await spawn($, 'cantrips:arbiter')
  const deputy = await spawn($, 'cantrips:deputy')
  await select($, { deputy: 'deciding' })
  agents.delete(arbiter.agentId!)
  agents.delete(deputy.agentId!)
  await completeTurn($)
  const pane = await $.ui.mount(PANE)
  expect(await pane.find({ type: 'Text', text: /^arbiter / })).toBeUndefined()
  expect(await pane.find({ key: `view:${arbiter.agentId}` })).toBeUndefined()
  expect(await pane.find({ key: `view:${deputy.agentId}` })).toBeUndefined()
  expect((await pane.find({ type: 'Text', text: /^deputy / }))?.text).toMatch(
    /^deputy +◆ deciding mode$/,
  )
  await pane.unmount()
})

test('the deputy row words stance and activity apart, off again after a clear', async ($, on) => {
  const { agents, clock, session } = world(on)
  await start($)
  const pane = await $.ui.mount(PANE)
  // The row is always there, off until a deputy is engaged.
  expect((await pane.find({ type: 'Text', text: /^deputy / }))?.text).toMatch(/^deputy +off$/)
  await expand($, 'cantrips:deputy', 'Advise me.')
  // The mode comes from the tool alone.
  expect((await pane.find({ type: 'Text', text: /^deputy / }))?.text).toMatch(/^deputy +off$/)
  expect((await select($, { deputy: 'advisor' })).result).toBe('')
  expect((await pane.find({ type: 'Text', text: /^deputy / }))?.text).toMatch(
    /^deputy +◆ advising mode$/,
  )
  expect(await pane.find({ type: 'Text', text: 'idle' })).toBeDefined()

  const deputy = await spawn($, 'cantrips:deputy')
  await clock.advance(10_000)
  // Answering, the mark lights and the time with it.
  expect((await pane.find({ key: `view:${deputy.agentId}` }))?.text).toMatch(
    /^deputy +● advising mode$/,
  )
  expect((await pane.find({ type: 'Text', text: '10s' }))?.props).toMatchObject({
    color: '#88C0D0',
  })
  agents.set(deputy.agentId!, 'completed')
  await completeTurn($)
  expect((await pane.find({ key: `view:${deputy.agentId}` }))?.text).toMatch(
    /^deputy +◆ advising mode$/,
  )
  expect(await pane.find({ type: 'Text', text: 'idle' })).toBeDefined()
  await select($, { deputy: 'off' })
  expect((await pane.find({ key: `view:${deputy.agentId}` }))?.text).toMatch(
    /^deputy +✓ dismissed$/,
  )
  expect(await pane.find({ type: 'Text', text: 'idle' })).toBeUndefined()

  session.id = 'sid-2'
  await $.classic.SessionStart({ source: 'clear', session_id: 'sid-2' })
  expect((await pane.find({ type: 'Text', text: /^deputy / }))?.text).toMatch(/^deputy +off$/)
  expect(await pane.find({ key: `view:${deputy.agentId}` })).toBeUndefined()
  await pane.unmount()
})

test('the timer reads the list only while a turn or an agent runs', async ($, on) => {
  const { agents, calls, clock } = world(on)
  await start($)
  await startTurn($)
  const finder = await spawn($, 'cantrips:finder:low')
  await completeTurn($)
  const held = calls.lists
  await clock.advance(10_000)
  expect(calls.lists).toBe(held + 1)

  agents.set(finder.agentId!, 'completed')
  await clock.advance(10_000)
  const after = calls.lists
  await clock.advance(60_000)
  expect(calls.lists).toBe(after)
})
