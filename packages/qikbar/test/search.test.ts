import { describe, expect, it } from 'vitest'
import { fuzzyMatch, matchItem, normalize, rank } from '../src/core/search'

describe('fuzzyMatch', () => {
  it('matches subsequences and returns positions', () => {
    const m = fuzzyMatch('gs', 'Git Status')
    expect(m).not.toBeNull()
    expect(m!.positions).toEqual([0, 4])
  })

  it('returns null when characters are missing', () => {
    expect(fuzzyMatch('xyz', 'Settings')).toBeNull()
  })

  it('scores exact > prefix > word boundary > scattered', () => {
    const exact = fuzzyMatch('settings', 'Settings')!.score
    const prefix = fuzzyMatch('set', 'Settings')!.score
    const boundary = fuzzyMatch('set', 'Account Settings')!.score
    const scattered = fuzzyMatch('set', 'Sales report total')!.score
    expect(exact).toBe(1)
    expect(prefix).toBeGreaterThan(boundary)
    expect(boundary).toBeGreaterThan(scattered)
  })

  it('prefers word starts for acronyms', () => {
    const m = fuzzyMatch('gs', 'Settings › Git Status')!
    expect(m.positions).toEqual([11, 15])
  })

  it('handles camelCase', () => {
    const m = fuzzyMatch('ga', 'getAccount')!
    expect(m.positions).toEqual([0, 3])
  })

  it('ignores diacritics', () => {
    expect(fuzzyMatch(normalize('cafe'), 'Café')).not.toBeNull()
  })
})

describe('rank', () => {
  const items = [
    { title: 'Sales report' },
    { title: 'Settings' },
    { title: 'Account settings', keywords: ['profile'] },
    { title: 'Git Status' },
    { title: 'New invoice', subtitle: 'Billing' },
  ]

  it('orders by relevance', () => {
    const r = rank(items, 'set').map((x) => x.item.title)
    expect(r[0]).toBe('Settings')
    expect(r).toContain('Account settings')
  })

  it('matches keywords and subtitles', () => {
    expect(rank(items, 'profile')[0]!.item.title).toBe('Account settings')
    expect(rank(items, 'billing')[0]!.item.title).toBe('New invoice')
  })

  it('supports multi-word queries in any order', () => {
    expect(rank(items, 'settings account')[0]!.item.title).toBe('Account settings')
  })

  it('applies boosts', () => {
    const r = rank(items, 's', { boost: (i) => (i.title === 'Git Status' ? 1 : 0) })
    expect(r[0]!.item.title).toBe('Git Status')
  })

  it('returns everything for an empty query', () => {
    expect(rank(items, '').length).toBe(items.length)
  })

  it('is fast on large lists', () => {
    const many = Array.from({ length: 20000 }, (_, i) => ({ title: `Project ${i} ${['alpha', 'beta', 'gamma', 'delta'][i % 4]} dashboard`, keywords: ['team', `id-${i}`] }))
    const start = performance.now()
    const r = rank(many, 'gam dash', { limit: 50 })
    const ms = performance.now() - start
    expect(r.length).toBe(50)
    expect(ms).toBeLessThan(400)
  })
})

describe('matchItem', () => {
  it('returns title positions for highlighting', () => {
    expect(matchItem({ title: 'Open Billing' }, 'bil')!.positions).toEqual([5, 6, 7])
  })
})
