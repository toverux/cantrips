// The feature section's reading of a feature folder, under node --test.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildFeatureView,
  countAnnotations,
  featurePathOf,
  isFeatureFolder,
  newestMtime,
  parseTicket,
} from '../../mod/core/feature.ts'

test('countAnnotations counts dated lines under the comments heading only', () => {
  const spec = [
    '# A spec',
    '',
    '- 2026-10-01 not an annotation: above the heading',
    '',
    '## Comments',
    '',
    '- 2026-10-21 — a bullet',
    '* **2026-10-22** — a bold bullet',
    '### 2026-10-23 — a sub-heading',
    'a continuation line, undated',
    '',
    '## Appendix',
    '',
    '- 2026-10-24 under another heading',
  ].join('\n')
  assert.equal(countAnnotations(spec), 3)
  assert.equal(countAnnotations('# No comments\n'), 0)
})

test('parseTicket reads number, title, blockers, resolution and criteria', () => {
  const ticket = parseTicket(
    '02-features.md',
    [
      '# 02 — Features in flight: the list',
      '',
      'Status: resolved',
      '',
      '**Blocked by:** 01 — The mod skeleton, and 03.',
      '',
      '- [x] one',
      '- [ ] two',
      '- [X] three',
      '  - not a box',
    ].join('\n'),
  )
  assert.deepEqual(ticket, {
    file: '02-features.md',
    number: '02',
    title: 'Features in flight: the list',
    blockedBy: ['01', '03'],
    isResolved: true,
    criteriaDone: 2,
    criteriaTotal: 3,
  })
})

test('parseTicket drops the number prefix the /tickets template writes', () => {
  assert.equal(parseTicket('03-x.md', '# 03: X\n').title, 'X')
})

test('parseTicket reads "None" as no blocker and a missing status as unresolved', () => {
  const ticket = parseTicket(
    '01-mod-skeleton.md',
    '# 01 — The mod skeleton\n\n**Blocked by:** None — can start immediately.\n',
  )
  assert.deepEqual(ticket.blockedBy, [])
  assert.equal(ticket.isResolved, false)
  assert.equal(ticket.criteriaTotal, 0)
})

test('featurePathOf names the feature and the file right inside it', () => {
  assert.deepEqual(featurePathOf('/repo', '/repo/.scratch/loop-panel/01-x.md'), {
    slug: 'loop-panel',
    file: '01-x.md',
  })
  assert.deepEqual(featurePathOf('/repo/', '/repo/.scratch/loop-panel/notes/deep.md'), {
    slug: 'loop-panel',
    file: null,
  })
  assert.equal(featurePathOf('/repo', '/repo/.scratch'), null)
  assert.equal(featurePathOf('/repo', '/repo/docs/spec.md'), null)
  assert.equal(featurePathOf('/repo', '/other/.scratch/loop-panel/spec.md'), null)
  assert.deepEqual(featurePathOf('C:\\repo', 'C:\\repo\\.scratch\\f\\spec.md'), {
    slug: 'f',
    file: 'spec.md',
  })
})

test('isFeatureFolder and newestMtime read a listing', () => {
  const entries = [
    { name: 'spec.md', kind: 'file', mtimeMs: 5 },
    { name: 'notes', kind: 'dir', mtimeMs: 0 },
  ] as const
  assert.equal(isFeatureFolder(entries), true)
  assert.equal(isFeatureFolder([{ name: 'readme.md', kind: 'file', mtimeMs: 9 }]), false)
  assert.equal(isFeatureFolder([{ name: '03-x.md', kind: 'file', mtimeMs: 1 }]), true)
  assert.equal(newestMtime(entries), 5)
  assert.equal(newestMtime([]), 0)
})

test('buildFeatureView sorts the tickets and lights only a ticket it holds', () => {
  const files = [
    { name: '02-b.md', text: '# 02 — B\n' },
    { name: 'spec.md', text: '## Comments\n- 2026-10-21 x\n' },
    { name: '01-a.md', text: '# 01 — A\n- [ ] c\n' },
  ]
  const view = buildFeatureView('f', files, '01-a.md')
  assert.equal(view.hasSpec, true)
  assert.equal(view.annotations, 1)
  assert.deepEqual(view.tickets.map(ticket => ticket.number), ['01', '02'])
  assert.equal(view.litTicket, '01-a.md')
  assert.equal(buildFeatureView('f', files, 'spec.md').litTicket, null)
  assert.equal(buildFeatureView('f', files.slice(0, 1), null).hasSpec, false)
})

test('parseTicket reads the blocker numbers from the label line alone', () => {
  const blockers = (line: string) =>
    parseTicket('03-x.md', `# 03 — X\n\n**Blocked by:** ${line}\n`).blockedBy
  assert.deepEqual(blockers('Tickets 01 and 02, then [04 — D](04-d.md).'), ['01', '02', '04'])
  // A label alone on its line names no blocker, whatever the next line holds.
  const alone = parseTicket('03-x.md', '# 03 — X\n\n**Blocked by:**\n\n- [ ] Handles 10 rows\n')
  assert.deepEqual(alone.blockedBy, [])
  // What the ticket blocks, sharing the line, names no blocker.
  assert.deepEqual(blockers('02 — The server. **Blocks:** 06 — The reference.'), ['02'])
  assert.deepEqual(blockers('**Blocks:** 06 — The reference.'), [])
  assert.deepEqual(blockers('None — can start. **Blocks:** 02, and 07.'), [])
})

test('buildFeatureView keeps the blockers that name an unresolved ticket of the folder', () => {
  const files = [
    { name: '01-a.md', text: '# 01 — A\n\nStatus: resolved\n' },
    {
      name: '02-b.md',
      text: '# 02 — B\n\n**Blocked by:** Tickets 01 and 05 — Panes, 144 columns.\n',
    },
    { name: '05-e.md', text: '# 05 — E\n\n**Blocked by:** 02 — B, which feeds 05.\n' },
  ]
  const [, second, third] = buildFeatureView('f', files, null).tickets
  // 01 is resolved, 144 is no ticket of the folder, 05 blocks.
  assert.deepEqual(second?.blockedBy, ['05'])
  // A ticket never blocks itself.
  assert.deepEqual(third?.blockedBy, ['02'])
})
