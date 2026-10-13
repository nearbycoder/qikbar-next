import { afterEach, describe, expect, it, vi } from 'vitest'
import { action, list } from '../src/core/define'
import { es, fr } from '../src/locales'
import type { Item, QikbarEvent, SemanticOptions } from '../src/core/types'
import { setup, settle, tick } from './helpers'

let current: ReturnType<typeof setup> | undefined
afterEach(() => {
  current?.bar.destroy()
  current = undefined
})
const make = (...args: Parameters<typeof setup>) => (current = setup(...args))
const actionTitles = () => [...document.querySelectorAll('.qb-action .qb-action-title')].map((e) => e.textContent)
const openPanel = (t: ReturnType<typeof setup>) => t.press('.', { ctrlKey: true })
const pointer = (type: string, target: Element, init: PointerEventInit = {}) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', clientX: 10, clientY: 10, ...init }))

// ─── Labels ─────────────────────────────────────────────────────────────────

describe('labels', () => {
  it('translates the UI with a locale', async () => {
    const t = make({ labels: es, commands: [{ title: 'Documento', run: () => {} }], routes: [{ path: '/a', title: 'Ajustes' }] })
    t.bar.open()
    await settle()
    expect(t.input().placeholder).toBe(es.placeholder)
    expect(t.sections()).toContain(es.navigation)
    expect(t.$('.qb-footer-btn.qb-primary')?.textContent).toContain(es.runCommand)
    await t.type('zzzz')
    expect(t.$('.qb-empty-title')?.textContent).toBe(es.noResults)
    expect(t.$('.qb-empty-desc')?.textContent).toBe(es.nothingMatches.replace('{query}', 'zzzz'))
  })

  it('translates built-in action helpers but keeps custom titles', async () => {
    const t = make({
      labels: fr,
      commands: [
        {
          title: 'Doc',
          actions: [action.copy('x'), action.copy('y', { title: 'Copy the thing' }), action.navigateNewTab('/b')],
        },
      ],
    })
    t.bar.open()
    await settle()
    await openPanel(t)
    expect(actionTitles().slice(0, 3)).toEqual([fr.copyToClipboard, 'Copy the thing', fr.openInNewTab])
  })

  it('accepts partial overrides and fills placeholders', async () => {
    const t = make({ labels: { askAi: 'Ask {ai} 🤖', placeholder: 'Find anything' }, ai: { provider: { id: 'x', async *stream() {} }, name: 'Robo' } })
    t.bar.open()
    await settle()
    expect(t.input().placeholder).toBe('Find anything')
    expect(t.$('.qb-hint')?.textContent).toContain('Ask Robo 🤖')
  })

  it('updates labels at runtime', async () => {
    const t = make({ commands: [{ title: 'A' }] })
    t.bar.open()
    await settle()
    t.bar.configure({ labels: { placeholder: 'Neu' } })
    await settle()
    expect(t.input().placeholder).toBe('Neu')
  })
})

// ─── Events ─────────────────────────────────────────────────────────────────

describe('usage events', () => {
  it('reports open, run and close', async () => {
    const events: QikbarEvent[] = []
    const t = make({ onEvent: (e) => events.push(e), commands: [{ id: 'hello', title: 'Hello', section: 'Demo', run: () => {} }] })
    t.bar.open()
    await settle()
    await t.press('Enter')
    await tick()
    expect(events.map((e) => e.type)).toEqual(['open', 'run', 'close'])
    expect(events[1]).toEqual({ type: 'run', item: { id: 'hello', title: 'Hello', section: 'Demo' }, action: 'Run Command', via: 'keyboard' })
  })

  it('reports clicks and panel runs with how they happened', async () => {
    const events: QikbarEvent[] = []
    const t = make({ onEvent: (e) => events.push(e), commands: [{ title: 'A', run: () => false }, { title: 'B', run: () => false }] })
    t.bar.open()
    await settle()
    t.$$('.qb-item')[1]!.click()
    await settle()
    await openPanel(t)
    await t.press('Enter')
    await tick()
    const runs = events.filter((e) => e.type === 'run') as Extract<QikbarEvent, { type: 'run' }>[]
    expect(runs.map((r) => r.via)).toEqual(['click', 'panel'])
  })

  it('reports searches and searches with no results once typing stops', async () => {
    const events: QikbarEvent[] = []
    const t = make({ commands: [{ title: 'Billing' }] })
    t.bar.on('event', (e) => events.push(e))
    t.bar.open()
    await t.type('bil')
    await t.type('bill')
    await tick(900)
    await t.type('nothing here')
    await tick(900)
    const searches = events.filter((e) => e.type === 'search' || e.type === 'no_results')
    expect(searches).toEqual([
      { type: 'search', query: 'bill', results: 1, view: 'root' },
      { type: 'search', query: 'nothing here', results: 0, view: 'root' },
      { type: 'no_results', query: 'nothing here', view: 'root' },
    ])
  })

  it('reports errors thrown by commands', async () => {
    const onEvent = vi.fn()
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const t = make({ onEvent, commands: [{ title: 'Boom', run: () => Promise.reject(new Error('nope')) }] })
    t.bar.open()
    await settle()
    await t.press('Enter')
    await tick(5)
    expect(onEvent).toHaveBeenCalledWith({ type: 'error', message: 'nope' })
    err.mockRestore()
  })
})

// ─── Pins & aliases ─────────────────────────────────────────────────────────

describe('pins', () => {
  const commands: Item[] = [
    { id: 'a', title: 'Alpha', section: 'One' },
    { id: 'b', title: 'Beta', section: 'One' },
    { id: 'c', title: 'Gamma', section: 'Two' },
  ]

  it('pins from the action panel and shows pinned items first', async () => {
    const events: QikbarEvent[] = []
    const t = make({ commands, onEvent: (e) => events.push(e) })
    t.bar.open()
    await settle()
    await t.press('ArrowDown')
    await t.press('ArrowDown')
    expect(t.selected()).toBe('Gamma')
    await openPanel(t)
    const titles = actionTitles()
    const pinIndex = titles.indexOf('Pin to Top')
    expect(pinIndex).toBeGreaterThan(-1)
    for (let i = 0; i < pinIndex; i++) await t.press('ArrowDown')
    await t.press('Enter')
    await tick()
    await settle()
    expect(t.bar.isOpen).toBe(true)
    expect(t.sections()[0]).toBe('Pinned')
    expect(t.titles()).toEqual(['Gamma', 'Alpha', 'Beta'])
    expect(t.$('.qb-item .qb-pin')).not.toBeNull()
    expect(t.bar.pins()).toEqual(['c'])
    expect(events).toContainEqual({ type: 'pin', item: { id: 'c', title: 'Gamma', section: 'Two' } })
  })

  it('unpins and offers Unpin for pinned items', async () => {
    const t = make({ commands })
    t.bar.pin('b')
    t.bar.open()
    await settle()
    expect(t.titles()[0]).toBe('Beta')
    await openPanel(t)
    expect(actionTitles()).toContain('Unpin')
    await t.press('p', { ctrlKey: true, shiftKey: true, code: 'KeyP' } as KeyboardEventInit)
    await settle()
    expect(t.bar.pins()).toEqual([])
    expect(t.sections()).not.toContain('Pinned')
  })

  it('persists pins in storage and boosts them in search', async () => {
    const t = make({ commands: [{ id: 'x', title: 'Settings' }, { id: 'y', title: 'Set status' }] })
    t.bar.pin('y')
    t.bar.open()
    await t.type('set')
    expect(t.titles()[0]).toBe('Set status')
    expect(JSON.parse(localStorageLike(t)['qikbar:pins'] ?? '[]')).toEqual(['y'])
  })

  it('can be turned off', async () => {
    const t = make({ commands, personalize: false })
    t.bar.pin('a')
    t.bar.open()
    await settle()
    expect(t.sections()).not.toContain('Pinned')
    await openPanel(t)
    expect(actionTitles()).not.toContain('Pin to Top')
  })
})

function localStorageLike(t: ReturnType<typeof setup>): Record<string, string> {
  const out: Record<string, string> = {}
  const s = (t.bar as any).storageAdapter
  for (const key of ['qikbar:pins', 'qikbar:aliases']) {
    const v = s.getItem(key)
    if (v != null) out[key] = v
  }
  return out
}

describe('aliases', () => {
  const commands: Item[] = [
    { id: 'billing', title: 'Billing v2', section: 'Projects', run: () => {} },
    { id: 'bv', title: 'Brand voice', section: 'Docs' },
  ]

  it('jumps to an item when its alias is typed', async () => {
    const t = make({ commands })
    t.bar.setAlias('billing', ' BV2 ')
    expect(t.bar.aliases()).toEqual({ bv2: 'billing' })
    t.bar.open()
    await settle()
    expect(t.$('.qb-alias')?.textContent).toBe('bv2')
    await t.type('bv2')
    expect(t.titles()[0]).toBe('Billing v2')
    expect(t.selected()).toBe('Billing v2')
  })

  it('sets an alias with a form and rejects one already in use', async () => {
    const t = make({ commands })
    t.bar.setAlias('bv', 'docs')
    t.bar.open()
    await settle()
    await openPanel(t)
    const idx = actionTitles().indexOf('Set Alias…')
    for (let i = 0; i < idx; i++) await t.press('ArrowDown')
    await t.press('Enter')
    await tick()
    await settle()
    const field = t.$<HTMLInputElement>('.qb-field-input')!
    expect(field).not.toBeNull()
    field.value = 'docs'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await t.press('Enter', { metaKey: true, ctrlKey: true }, field)
    await settle()
    expect(t.$('.qb-field-error')?.textContent).toBe('“docs” is already used by Brand voice')
    field.value = 'b2'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await t.press('Enter', { ctrlKey: true }, field)
    await tick()
    await settle()
    expect(t.bar.aliases()).toEqual({ docs: 'bv', b2: 'billing' })
    expect(t.$('.qb-toast-title')?.textContent).toBe('Alias “b2” saved')
  })

  it('removes an alias', async () => {
    const t = make({ commands })
    t.bar.setAlias('billing', 'bb')
    t.bar.open()
    await settle()
    await openPanel(t)
    expect(actionTitles()).toContain('Edit Alias…')
    const idx = actionTitles().indexOf('Remove Alias')
    for (let i = 0; i < idx; i++) await t.press('ArrowDown')
    await t.press('Enter')
    await tick()
    await settle()
    expect(t.bar.aliases()).toEqual({})
    expect(t.$('.qb-alias')).toBeNull()
  })
})

// ─── Undo toasts ────────────────────────────────────────────────────────────

describe('toast actions', () => {
  it('shows Undo and runs it on click', async () => {
    const undo = vi.fn()
    const events: QikbarEvent[] = []
    const t = make({
      onEvent: (e) => events.push(e),
      commands: [{ title: 'Archive', run: (ctx) => (ctx.toast({ title: 'Archived', undo }), false) }],
    })
    t.bar.open()
    await settle()
    await t.press('Enter')
    await tick()
    await settle()
    const button = t.$('.qb-toast .qb-toast-action')!
    expect(button.textContent).toContain('Undo')
    button.click()
    await tick()
    expect(undo).toHaveBeenCalledOnce()
    expect(t.$('.qb-toast')).toBeNull()
    expect(events).toContainEqual({ type: 'undo', title: 'Archived' })
  })

  it('binds mod+z while the toast is visible, unless the user is editing text', async () => {
    const undo = vi.fn()
    const t = make({ commands: [{ title: 'Archive', run: (ctx) => (ctx.toast({ title: 'Archived', undo }), false) }] })
    t.bar.open()
    await settle()
    await t.press('Enter')
    await tick()
    await t.type('hello')
    await t.press('z', { ctrlKey: true, code: 'KeyZ' } as KeyboardEventInit)
    expect(undo).not.toHaveBeenCalled()
    await t.type('')
    await t.press('z', { ctrlKey: true, code: 'KeyZ' } as KeyboardEventInit)
    await tick()
    expect(undo).toHaveBeenCalledOnce()
  })

  it('works as a floating HUD after the bar closes', async () => {
    const undo = vi.fn()
    const t = make({ commands: [{ title: 'Delete', run: (ctx) => void ctx.toast({ title: 'Deleted', undo }) }] })
    t.bar.open()
    await settle()
    await t.press('Enter')
    await tick()
    await settle()
    expect(t.bar.isOpen).toBe(false)
    expect(t.$('.qb-hud[data-action] .qb-toast-action')).not.toBeNull()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true }))
    await tick()
    expect(undo).toHaveBeenCalledOnce()
    expect(t.$('.qb-hud')).toBeNull()
  })

  it('supports custom actions', async () => {
    const run = vi.fn()
    const t = make()
    t.bar.toast({ title: 'Saved', action: { title: 'View', run } })
    await settle()
    t.$<HTMLButtonElement>('.qb-hud .qb-toast-action')!.click()
    await tick()
    expect(run).toHaveBeenCalledOnce()
  })
})

// ─── Multi-select ───────────────────────────────────────────────────────────

describe('multi-select', () => {
  const people = ['Ada', 'Grace', 'Linus', 'Margaret'].map((title) => ({ id: title.toLowerCase(), title }))

  function multiList(runMany = vi.fn(), single = vi.fn()) {
    return list({
      title: 'People',
      multiSelect: true,
      items: people.map((p) => ({
        ...p,
        actions: [
          { title: 'Assign', run: single, runMany: (items: Item[], ctx: any) => runMany(items.map((i) => i.title), ctx.selection.length) },
          { title: 'Profile', run: () => {} },
        ],
      })),
    })
  }

  it('marks with Shift+arrows and runs bulk actions on Enter', async () => {
    const runMany = vi.fn()
    const events: QikbarEvent[] = []
    const t = make({ onEvent: (e) => events.push(e) })
    t.bar.open({ view: multiList(runMany) })
    await settle()
    expect(t.$$('.qb-check').length).toBe(4)
    await t.press('ArrowDown', { shiftKey: true })
    await t.press('ArrowDown', { shiftKey: true })
    expect(t.$$('.qb-item[data-marked]').length).toBe(3)
    expect(t.$('.qb-footer-left')?.textContent).toContain('3 selected')
    expect(t.$('.qb-footer-btn.qb-primary')?.textContent).toContain('Assign')
    await t.press('Enter')
    await tick()
    expect(runMany).toHaveBeenCalledWith(['Ada', 'Grace', 'Linus'], 3)
    expect(events.find((e) => e.type === 'run')).toMatchObject({ action: 'Assign', count: 3 })
  })

  it('toggles with mod+click and ranges with shift+click', async () => {
    const t = make()
    t.bar.open({ view: multiList() })
    await settle()
    const rows = () => t.$$('.qb-item')
    rows()[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    await settle()
    rows()[2]!.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    await settle()
    expect(t.$$('.qb-item[data-marked] .qb-item-title').map((e) => e.textContent)).toEqual(['Ada', 'Grace', 'Linus'])
    rows()[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    await settle()
    expect(t.$$('.qb-item[data-marked] .qb-item-title').map((e) => e.textContent)).toEqual(['Ada', 'Linus'])
  })

  it('offers only bulk actions plus select all / clear in the panel', async () => {
    const t = make()
    t.bar.open({ view: multiList() })
    await settle()
    await openPanel(t)
    expect(actionTitles()).toContain('Select')
    await t.press('Escape')
    await t.press('ArrowDown', { shiftKey: true })
    await openPanel(t)
    expect(t.$('.qb-actions-title')?.textContent).toBe('2 selected')
    expect(actionTitles()).toEqual(['Assign', 'Select All', 'Clear Selection'])
    await t.press('ArrowDown')
    await t.press('Enter')
    await tick()
    await settle()
    expect(t.$$('.qb-item[data-marked]').length).toBe(4)
  })

  it('clears the selection with Escape before leaving the view', async () => {
    const t = make()
    t.bar.open({ view: multiList() })
    await settle()
    await t.press('ArrowDown', { shiftKey: true })
    await t.press('Escape')
    expect(t.$$('.qb-item[data-marked]').length).toBe(0)
    expect(t.bar.top?.view.type).toBe('list')
  })

  it('has no checkboxes or marks without multiSelect', async () => {
    const t = make()
    t.bar.open({ view: list({ items: people }) })
    await settle()
    await t.press('ArrowDown', { shiftKey: true })
    expect(t.$$('.qb-check').length).toBe(0)
    expect(t.$$('.qb-item[data-marked]').length).toBe(0)
  })
})

// ─── Touch ──────────────────────────────────────────────────────────────────

describe('touch', () => {
  it('flags the root and opens actions with a long press', async () => {
    const t = make({ touch: true, commands: [{ title: 'Doc', run: () => {} }] })
    t.bar.open()
    await settle()
    expect(t.$('.qb-root')?.hasAttribute('data-qb-touch')).toBe(true)
    const row = t.$('.qb-item')!
    pointer('pointerdown', row)
    await tick(550)
    await settle()
    expect(t.$('.qb-actions')).not.toBeNull()
    // The click that follows the release must not run the command or close the panel.
    pointer('pointerup', row)
    row.click()
    await settle()
    expect(t.bar.isOpen).toBe(true)
    expect(t.$('.qb-actions')).not.toBeNull()
    // The next tap behaves normally again.
    await t.press('Escape')
    expect(t.$('.qb-actions')).toBeNull()
  })

  it('cancels the long press when the finger moves (scrolling)', async () => {
    const t = make({ touch: true, commands: [{ title: 'Doc', run: () => {} }] })
    t.bar.open()
    await settle()
    const row = t.$('.qb-item')!
    pointer('pointerdown', row)
    pointer('pointermove', row, { clientX: 10, clientY: 60 })
    await tick(550)
    expect(t.$('.qb-actions')).toBeNull()
  })

  it('opens actions on right-click (desktop)', async () => {
    const t = make({ commands: [{ title: 'Doc', run: () => {} }, { title: 'Other', run: () => {} }] })
    t.bar.open()
    await settle()
    t.$$('.qb-item')[1]!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    await settle()
    expect(t.$('.qb-actions-title')?.textContent).toBe('Other')
  })

  it('can be switched off and on at runtime', async () => {
    const t = make({ touch: false })
    t.bar.open()
    await settle()
    expect(t.$('.qb-root')?.hasAttribute('data-qb-touch')).toBe(false)
    t.bar.configure({ touch: true })
    expect(t.$('.qb-root')?.hasAttribute('data-qb-touch')).toBe(true)
  })
})

// ─── Semantic search ────────────────────────────────────────────────────────

/** A toy embedder: one dimension per concept. */
const CONCEPTS: [string, RegExp][] = [
  ['money', /billing|invoice|plan|subscription|pay|cancel|downgrade|price/i],
  ['people', /team|invite|member|colleague|people/i],
  ['look', /theme|dark|appearance|color/i],
]
const toyEmbed: SemanticOptions['embed'] = vi.fn(async (texts: string[]) => texts.map((t) => CONCEPTS.map(([, re]) => (re.test(t) ? 1 : 0.02))))

describe('semantic search', () => {
  const commands: Item[] = [
    { id: 'down', title: 'Downgrade subscription', section: 'Account' },
    { id: 'inv', title: 'Invite teammate', section: 'Team' },
    { id: 'theme', title: 'Toggle theme', section: 'Look' },
  ]

  it('adds related results that fuzzy search misses', async () => {
    const t = make({ commands, semantic: { embed: toyEmbed, debounce: 0 } })
    t.bar.open()
    await t.type('cancel my plan')
    await tick(20)
    await settle()
    expect(t.sections()).toContain('Related')
    expect(t.titles()).toContain('Downgrade subscription')
    expect(t.titles()).not.toContain('Invite teammate')
  })

  it('does not repeat fuzzy matches and respects the threshold', async () => {
    const t = make({ commands, semantic: { embed: toyEmbed, debounce: 0, threshold: 0.99 } })
    t.bar.open()
    await t.type('colleague')
    await tick(20)
    await settle()
    expect(t.titles().filter((x) => x === 'Invite teammate').length).toBe(1)
  })

  it('embeds each item once and skips short queries', async () => {
    const embed = vi.fn(toyEmbed)
    const t = make({ commands, semantic: { embed, debounce: 0 } })
    t.bar.open()
    await t.type('ab')
    await tick(20)
    expect(embed).not.toHaveBeenCalled()
    await t.type('dark mode')
    await tick(20)
    await t.type('dark look')
    await tick(20)
    const itemBatches = embed.mock.calls.filter((c) => c[0].length > 1)
    expect(itemBatches.length).toBe(1)
    expect(itemBatches[0]![0].length).toBe(3)
  })

  it('keeps working when the embedder fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const t = make({ commands, semantic: { embed: async () => Promise.reject(new Error('offline')), debounce: 0 } })
    t.bar.open()
    await t.type('invite')
    await tick(20)
    await settle()
    expect(t.titles()).toEqual(['Invite teammate'])
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})
