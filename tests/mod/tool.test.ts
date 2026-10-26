// The loop tool's input, under node --test.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseTicket } from '../../mod/core/feature.ts'
import { findTicket, readCall } from '../../mod/core/tool.ts'

test('readCall takes the feature and the ticket, from a name or a path', () => {
  assert.deepEqual(readCall({ feature: 'alpha', ticket: '03-x.md' }, null), {
    slug: 'alpha',
    ticket: '03-x.md',
    deputy: null,
  })
  const paths = { feature: '.scratch/alpha/', ticket: '.scratch/alpha/03-x.md' }
  assert.deepEqual(readCall(paths, null), { slug: 'alpha', ticket: '03-x.md', deputy: null })
  assert.deepEqual(readCall({ feature: 'alpha' }, 'beta'), {
    slug: 'alpha',
    ticket: null,
    deputy: null,
  })
})

test('readCall falls back on the feature in view, and errs with none', () => {
  assert.deepEqual(readCall({ ticket: '03' }, 'beta'), {
    slug: 'beta',
    ticket: '03',
    deputy: null,
  })
  assert.ok('error' in readCall({ ticket: '03' }, null))
  assert.ok('error' in readCall({}, null))
  assert.ok('error' in readCall({ feature: 3 }, 'beta'))
  assert.ok('error' in readCall({ feature: 'alpha', ticket: ['03'] }, null))
})

test('readCall takes the deputy mode alone, selecting no feature, or beside one', () => {
  assert.deepEqual(readCall({ deputy: 'advisor' }, 'beta'), {
    slug: null,
    ticket: null,
    deputy: 'advisor',
  })
  assert.deepEqual(readCall({ deputy: 'off' }, null), { slug: null, ticket: null, deputy: 'off' })
  assert.deepEqual(readCall({ feature: 'alpha', deputy: 'deciding' }, null), {
    slug: 'alpha',
    ticket: null,
    deputy: 'deciding',
  })
  assert.ok('error' in readCall({ deputy: 'on' }, 'beta'))
  // An empty field, as a model fills an unused one, is no field.
  for (const empty of ['', null]) {
    assert.deepEqual(readCall({ feature: 'alpha', ticket: empty, deputy: empty }, null), {
      slug: 'alpha',
      ticket: null,
      deputy: null,
    })
    assert.deepEqual(readCall({ feature: empty, deputy: 'advisor' }, 'beta'), {
      slug: null,
      ticket: null,
      deputy: 'advisor',
    })
  }
  assert.ok('error' in readCall({ deputy: 'off', ticket: '03' }, null))
})

test('findTicket matches a file name or a number', () => {
  const tickets = [parseTicket('03-x.md', '# 03 — X\n'), parseTicket('04-y.md', '# 04 — Y\n')]
  assert.equal(findTicket(tickets, '04-y.md')?.number, '04')
  assert.equal(findTicket(tickets, '03')?.file, '03-x.md')
  assert.equal(findTicket(tickets, '05'), undefined)
})
