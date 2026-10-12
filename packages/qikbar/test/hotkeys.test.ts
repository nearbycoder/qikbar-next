import { describe, expect, it } from 'vitest'
import { formatHotkey, matchesHotkey, parseHotkey, SequenceMatcher } from '../src/core/hotkeys'

const key = (k: string, o: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent('keydown', { key: k, code: /^[a-z]$/i.test(k) ? `Key${k.toUpperCase()}` : undefined, ...o })

describe('hotkeys', () => {
  it('parses modifiers', () => {
    const [c] = parseHotkey('ctrl+shift+p')
    expect(c).toMatchObject({ key: 'p', ctrl: true, shift: true, alt: false, meta: false })
  })

  it('matches events', () => {
    expect(matchesHotkey(key('p', { ctrlKey: true, shiftKey: true }), 'ctrl+shift+p')).toBe(true)
    expect(matchesHotkey(key('p', { ctrlKey: true }), 'ctrl+shift+p')).toBe(false)
    expect(matchesHotkey(key('Enter'), 'enter')).toBe(true)
    expect(matchesHotkey(key('Escape'), 'esc')).toBe(true)
  })

  it('matches sequences', () => {
    const seq = new SequenceMatcher()
    expect(seq.feed(key('g'), ['g s'])).toEqual([])
    expect(seq.feed(key('s'), ['g s'])).toEqual(['g s'])
  })

  it('formats for display', () => {
    const f = formatHotkey('ctrl+enter')
    expect(f[0]!.length).toBe(2)
  })
})
