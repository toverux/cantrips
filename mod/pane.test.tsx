// Mounted scenarios: the module loaded in the headless engine, the world beneath it answered by
// the test. The kit mocks the clock; the file system and the store are answered here, so the
// test reads back what the module stored.

import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const ROOT = '/repo'
const FEATURE = `${ROOT}/.scratch/loop-panel`
const TICKET_02 = `${FEATURE}/02-features.md`

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
}

const DIRS: Record<string, ReturnType<typeof entry>[]> = {
  [`${ROOT}/.scratch`]: [entry('loop-panel', 'dir', 0), entry('sync', 'dir', 0)],
  [`${ROOT}/.scratch/sync`]: [entry('upstream.md', 'file', 9)],
  [FEATURE]: [
    entry('spec.md', 'file', 5),
    entry('01-mod-skeleton.md', 'file', 6),
    entry('02-features.md', 'file', 7),
  ],
}

const PANE = {
  plugin: 'cantrips',
  component: 'Pane',
  requestId: 'cantrips',
  surface: 'terminal',
  props: {
    title: '🪄 cantrips',
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
function world(on: On, options: { root?: string; store?: Record<string, unknown> } = {}) {
  const calls = { opens: [] as string[], closes: [] as string[] }
  const store = new Map(Object.entries(options.store ?? {}))
  // The id the engine answers: a scenario moves it the way a clear or a resume does.
  const session = { id: 'sid-1' }
  mock.clock(on, { now: 1_000_000 })
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('classic.SessionStart', () => ({}))
  on('session.root', () => ({ value: options.root ?? ROOT }))
  on('session.id', () => ({ value: session.id }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: {} }))
  on('fs.exists', (_, e) => ({ value: e.path in FILES || e.path in DIRS }))
  on('fs.list', (_, e) => {
    const listed = DIRS[e.path]
    return listed === undefined ? { deny: 'ENOENT' } : { value: listed }
  })
  on('fs.read', (_, e) => {
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
        ? [{ id: 'cantrips', title: '🪄 cantrips', isShown: true, isFocused: false, isPlaced: true }]
        : [],
  }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { calls, store, session }
}

const start = ($: Engine) =>
  $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
const expand = ($: Engine, skill: string, text: string) =>
  $.skill.prompt({ skill, text, source: 'plugin', pluginName: 'cantrips' })

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
  await $.tool.call({ tool: 'Read', file_path: `${FEATURE}/01-mod-skeleton.md` })

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

test('an edit of a ticket re-reads the board within the turn and lights it', async ($, on) => {
  world(on)
  await start($)
  const pane = await $.ui.mount(PANE)
  expect((await pane.find({ type: 'Text', text: /^ 02$/ }))?.props.weight).toBe('regular')

  FILES[TICKET_02] = FILES[TICKET_02]!.replace('- [x] Both', '- [ ] Both')
  try {
    const edit = {
      tool: 'Edit',
      file_path: TICKET_02,
      old_string: '- [x]',
      new_string: '- [ ]',
    } as const
    await $.tool.call(edit)

    expect((await pane.find({ type: 'Text', text: /^ 02$/ }))?.props.weight).toBe('bold')
    expect((await pane.find({ type: 'Text', text: /^0\/1$/ }))).toBeDefined()
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
  expect((await band.find({ key: 'chip' }))?.text).toBe('🪄 cantrips · 2 tickets')
  await band.press({ key: 'chip' })
  expect(calls.opens).toEqual(['cantrips'])
  expect(store.get('session:sid-1')).toEqual({ isPaneClosed: false })
  await band.unmount()
})

test('/cantrips toggles the pane and records the close', async ($, on) => {
  const { calls, store } = world(on)
  await start($)

  const closed = await $.command.run(CANTRIPS_COMMAND)
  expect(closed.text).toContain('closed')
  expect(calls.closes).toEqual(['cantrips'])
  expect(store.get('session:sid-1')).toEqual({ isPaneClosed: true })

  const opened = await $.command.run(CANTRIPS_COMMAND)
  expect(opened.text).toContain('opened')
  expect(calls.opens).toEqual(['cantrips', 'cantrips'])
  expect(store.get('session:sid-1')).toEqual({ isPaneClosed: false })
})

test('a clear carries the record to the new id, and a resume keeps its own', async ($, on) => {
  const closedA = { 'session:sid-a': { isPaneClosed: true } }
  const { calls, store, session } = world(on, { store: closedA })
  await start($)
  await $.command.run(CANTRIPS_COMMAND)
  expect(store.get('session:sid-1')).toEqual({ isPaneClosed: true })

  session.id = 'sid-2'
  await $.classic.SessionStart({ source: 'clear', session_id: 'sid-2' })
  expect(store.get('session:sid-2')).toEqual({ isPaneClosed: true })
  expect(calls.opens).toEqual(['cantrips'])
  await $.command.run(CANTRIPS_COMMAND)
  expect(store.get('session:sid-2')).toEqual({ isPaneClosed: false })

  // Session A closed its pane in its own time; resuming it from here closes the one shown. The
  // engine still answers the old id inside the hook, so the world moves it after.
  await $.classic.SessionStart({ source: 'resume', session_id: 'sid-a' })
  session.id = 'sid-a'
  expect(store.get('session:sid-a')).toEqual({ isPaneClosed: true })
  expect(calls.closes).toEqual(['cantrips', 'cantrips'])
  expect(calls.opens).toEqual(['cantrips', 'cantrips'])
})

test('a repository outside the loop draws no chip and opens no pane', async ($, on) => {
  const { calls } = world(on, { root: '/elsewhere' })
  await start($)
  expect(calls.opens).toEqual([])

  const band = await $.ui.mount(BAND)
  expect(await band.find({ key: 'chip' })).toBeUndefined()
  await band.unmount()
})
