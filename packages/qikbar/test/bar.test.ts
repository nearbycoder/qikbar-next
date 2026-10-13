import { afterEach, describe, expect, it, vi } from 'vitest'
import { list, detail, form } from '../src/core/define'
import type { Extension } from '../src/core/types'
import { setup, settle, tick } from './helpers'

let current: ReturnType<typeof setup> | undefined
afterEach(() => {
  current?.bar.destroy()
  current = undefined
})
const make = (...args: Parameters<typeof setup>) => (current = setup(...args))

describe('bar', () => {
  it('opens with the hotkey and closes with escape', async () => {
    const t = make({ commands: [{ title: 'Hello' }] })
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, metaKey: false, bubbles: true }))
    // isMac is false in happy-dom, so mod = ctrl
    await settle()
    expect(t.bar.isOpen).toBe(true)
    expect(document.activeElement).toBe(t.input())
    await t.press('Escape')
    expect(t.bar.isOpen).toBe(false)
  })

  it('groups commands into sections and filters as you type', async () => {
    const t = make({
      commands: [
        { title: 'Create project', section: 'Projects' },
        { title: 'Invite teammate', section: 'Team' },
      ],
      routes: [{ path: '/settings', title: 'Settings' }],
    })
    t.bar.open()
    await settle()
    expect(t.sections()).toEqual(['Projects', 'Team', 'Navigation'])
    expect(t.titles()).toEqual(['Create project', 'Invite teammate', 'Settings'])
    await t.type('inv')
    expect(t.titles()).toEqual(['Invite teammate'])
    expect(t.$('.qb-match')?.textContent).toBe('Inv')
  })

  it('runs the selected command with Enter and closes', async () => {
    const run = vi.fn()
    const t = make({ commands: [{ title: 'First' }, { title: 'Second', run }] })
    t.bar.open()
    await settle()
    await t.press('ArrowDown')
    expect(t.selected()).toBe('Second')
    await t.press('Enter')
    await tick()
    expect(run).toHaveBeenCalledOnce()
    expect(t.bar.isOpen).toBe(false)
  })

  it('wraps selection and supports ctrl+n / ctrl+p', async () => {
    const t = make({ commands: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] })
    t.bar.open()
    await settle()
    await t.press('ArrowUp')
    expect(t.selected()).toBe('C')
    await t.press('n', { ctrlKey: true })
    expect(t.selected()).toBe('A')
  })

  it('navigates with the router for href items', async () => {
    const navigate = vi.fn()
    const t = make({ routes: [{ path: '/billing', title: 'Billing' }], navigate })
    t.bar.open()
    await t.type('bill')
    await t.press('Enter')
    await tick()
    expect(navigate).toHaveBeenCalledWith('/billing', { newTab: false })
  })

  it('pushes list views with async loaders and pops with escape', async () => {
    const loader = vi.fn(async ({ query }: { query: string }) => [{ title: `Result for ${query || 'nothing'}` }])
    const t = make({
      commands: [{ title: 'Search issues', view: list({ title: 'Issues', items: loader, debounce: 0 }) }],
    })
    t.bar.open()
    await settle()
    await t.press('Enter')
    await tick(5)
    await settle()
    expect(t.titles()).toEqual(['Result for nothing'])
    expect(t.$('.qb-crumb')?.textContent).toBe('Issues')
    await t.type('bug')
    await tick(5)
    await settle()
    expect(t.titles()).toEqual(['Result for bug'])
    await t.press('Escape')
    expect(t.bar.isOpen).toBe(true)
    expect(t.titles()).toEqual(['Search issues'])
  })

  it('shows dynamic sources at the root', async () => {
    const t = make({
      sources: undefined,
      commands: [{ title: 'Projects overview' }],
    })
    t.bar.addSource({ id: 'projects', title: 'Projects', debounce: 0, search: async ({ query }) => [{ title: `Project ${query}` }] })
    t.bar.open()
    await t.type('acme')
    await tick(5)
    await settle()
    expect(t.sections()).toContain('Projects')
    expect(t.titles()).toContain('Project acme')
  })

  it('opens the action panel and runs a secondary action', async () => {
    const second = vi.fn()
    const t = make({
      commands: [{ title: 'Doc', run: () => {}, actions: [{ title: 'Share', run: second, shortcut: 'mod+s' }] }],
    })
    t.bar.open()
    await settle()
    expect(t.$('.qb-footer-btn.qb-primary')?.textContent).toContain('Run Command')
    await t.press('.', { ctrlKey: true })
    expect(t.$$('.qb-action .qb-action-title').map((e) => e.textContent)).toEqual(['Run Command', 'Share', 'Pin to Top', 'Set Alias…'])
    await t.press('ArrowDown')
    await t.press('Enter')
    await tick()
    expect(second).toHaveBeenCalledOnce()
  })

  it('runs action shortcuts directly', async () => {
    const share = vi.fn()
    const t = make({ commands: [{ title: 'Doc', run: () => {}, actions: [{ title: 'Share', run: share, shortcut: 'mod+s' }] }] })
    t.bar.open()
    await settle()
    await t.press('s', { ctrlKey: true, code: 'KeyS' } as KeyboardEventInit)
    await tick()
    expect(share).toHaveBeenCalledOnce()
  })

  it('asks for arguments inline', async () => {
    const run = vi.fn()
    const t = make({ commands: [{ title: 'Translate', arguments: [{ name: 'lang', placeholder: 'Language', required: true }], run: (ctx) => run(ctx.arguments) }] })
    t.bar.open()
    await settle()
    await t.press('Enter')
    const arg = t.$<HTMLInputElement>('.qb-arg')!
    expect(arg).toBeTruthy()
    expect(document.activeElement).toBe(arg)
    arg.value = 'French'
    arg.dispatchEvent(new Event('input', { bubbles: true }))
    await t.press('Enter', {}, arg)
    await tick()
    expect(run).toHaveBeenCalledWith({ lang: 'French' })
  })

  it('renders detail views with streaming markdown', async () => {
    async function* stream() {
      yield '# Hello'
      await tick(2)
      yield '\n\nworld'
    }
    const t = make({ commands: [{ title: 'Read', view: detail({ title: 'Doc', markdown: stream() }) }] })
    t.bar.open()
    await settle()
    await t.press('Enter')
    await tick(10)
    await settle()
    expect(t.$('.qb-detail h1')?.textContent).toBe('Hello')
    expect(t.$('.qb-detail')?.textContent).toContain('world')
    expect(t.$<HTMLInputElement>('.qb-input')!.hidden).toBe(true)
  })

  it('validates and submits forms', async () => {
    const onSubmit = vi.fn()
    const t = make({
      commands: [
        {
          title: 'New issue',
          view: form({ title: 'New issue', fields: [{ name: 'title', label: 'Title', required: true }], onSubmit }),
        },
      ],
    })
    t.bar.open()
    await settle()
    await t.press('Enter')
    await settle()
    const input = t.$<HTMLInputElement>('.qb-field-input')!
    expect(document.activeElement).toBe(input)
    await t.press('Enter', { ctrlKey: true }, input)
    expect(t.$('.qb-field-error')?.textContent).toBe('Title is required')
    expect(onSubmit).not.toHaveBeenCalled()
    input.value = 'Broken button'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await t.press('Enter', { ctrlKey: true }, input)
    await tick()
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Broken button' }, expect.anything())
  })

  it('remembers recently used commands', async () => {
    const t = make({ commands: [{ title: 'Alpha', run: () => {} }, { title: 'Beta', run: () => {} }] })
    t.bar.open()
    await t.type('beta')
    await t.press('Enter')
    await tick()
    t.bar.open()
    await settle()
    expect(t.sections()[0]).toBe('Recent')
    expect(t.titles()[0]).toBe('Beta')
  })

  it('supports register() for contextual commands', async () => {
    const t = make()
    const off = t.bar.register([{ title: 'Page action' }])
    t.bar.open()
    await settle()
    expect(t.titles()).toEqual(['Page action'])
    off()
    await settle()
    expect(t.titles()).toEqual([])
  })

  it('collects missing extension preferences before running', async () => {
    const run = vi.fn()
    const ext: Extension = {
      name: 'demo',
      title: 'Demo',
      preferences: [{ name: 'token', title: 'Token', type: 'password', required: true }],
      commands: [{ name: 'go', title: 'Demo command', run: (ctx) => run(ctx.preferences.token) }],
    }
    const t = make({ extensions: [ext] })
    t.bar.open()
    await t.type('demo')
    await t.press('Enter')
    await settle()
    expect(t.$('.qb-title')?.textContent).toBe('Configure Demo')
    const input = t.$<HTMLInputElement>('.qb-field-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await t.press('Enter', {}, input)
    await tick()
    await settle()
    expect(run).toHaveBeenCalledWith('secret')
  })

  it('runs global item shortcuts while closed', async () => {
    const run = vi.fn()
    const t = make({ commands: [{ title: 'Dark mode', shortcut: 'g d', run }] })
    expect(t.bar.isOpen).toBe(false)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', code: 'KeyG', bubbles: true }))
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', bubbles: true }))
    await tick()
    expect(run).toHaveBeenCalledOnce()
  })

  it('auto-indexes page links and data-qikbar elements', async () => {
    const t = make({ autoIndex: true })
    document.body.insertAdjacentHTML('afterbegin', '<nav aria-label="Main"><a href="/docs">Docs</a><a href="/pricing">Pricing</a></nav><button data-qikbar="Sign out">x</button>')
    t.bar.open()
    await settle()
    expect(t.titles()).toEqual(['Docs', 'Pricing', 'Sign out'])
    expect(t.sections()).toEqual(['Main', 'Actions'])
  })

  it('applies theme presets and appearance', async () => {
    const t = make({ theme: 'dracula' })
    t.bar.open()
    await settle()
    const root = t.$('.qb-root')!
    expect(root.dataset.qbAppearance).toBe('dark')
    expect(root.style.getPropertyValue('--qb-accent')).toBe('#bd93f9')
    t.bar.configure({ theme: { vars: { accent: 'hotpink' } }, appearance: 'light' })
    expect(root.dataset.qbAppearance).toBe('light')
    expect(root.style.getPropertyValue('--qb-accent')).toBe('hotpink')
  })

  it('shows toasts in the footer and as a HUD when closed', async () => {
    const t = make({ commands: [{ title: 'x' }] })
    t.bar.open()
    await settle()
    t.bar.toast({ title: 'Saved', style: 'success' })
    expect(t.$('.qb-footer .qb-toast-title')?.textContent).toBe('Saved')
    t.bar.close()
    t.bar.toast('Hello')
    expect(t.$('.qb-hud')?.textContent).toContain('Hello')
  })

  it('virtualizes long lists', async () => {
    const items = Array.from({ length: 5000 }, (_, i) => ({ title: `Item ${i}` }))
    const t = make({ commands: [{ title: 'Big list', view: list({ title: 'Big', items }) }] })
    t.bar.open()
    await settle()
    await t.press('Enter')
    await settle()
    expect(t.$$('.qb-item').length).toBeLessThan(100)
    await t.press('ArrowDown', { ctrlKey: true })
    expect(t.selected()).toBe('Item 4999')
    await t.type('item 42')
    expect(t.titles()[0]).toBe('Item 42')
  })
})

describe('config sources', () => {
  it('uses sources passed in config', async () => {
    const t = make({ sources: [{ id: 's', title: 'Docs', debounce: 0, search: ({ query }) => [{ title: `Doc ${query}` }] }] })
    t.bar.open()
    await t.type('intro')
    await tick(5)
    await settle()
    expect(t.titles()).toContain('Doc intro')
  })
})

describe('hotkeys in inputs', () => {
  it('ignores single-key hotkeys while typing', async () => {
    const t = make({ hotkey: ['mod+k', '/'] })
    const field = document.createElement('input')
    document.body.append(field)
    field.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))
    await settle()
    expect(t.bar.isOpen).toBe(false)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))
    await settle()
    expect(t.bar.isOpen).toBe(true)
    t.input().dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))
    await settle()
    expect(t.bar.isOpen).toBe(true)
  })
})

describe('extensions lifecycle', () => {
  it('keeps extension context for views opened while closed, and uninstalls safely', async () => {
    const seen: string[] = []
    const ext: Extension = {
      name: 'ctx',
      title: 'Ctx',
      preferences: [{ name: 'token', title: 'Token', type: 'text', default: 'abc' }],
      commands: [
        {
          name: 'open',
          title: 'Open ctx view',
          shortcut: 'mod+shift+y',
          run: () => list({ items: async ({ ctx }) => (seen.push(ctx.preferences.token), [{ title: 'x' }]) }),
        },
      ],
    }
    const t = make()
    const first = t.bar.use(ext)
    const second = t.bar.use(ext)
    first()
    first()
    expect(t.bar.commands().map((c) => c.title)).toEqual(['Open ctx view'])
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', code: 'KeyY', ctrlKey: true, shiftKey: true, bubbles: true }))
    await tick(5)
    await settle()
    expect(t.bar.isOpen).toBe(true)
    expect(seen).toEqual(['abc'])
    second()
    expect(t.bar.commands()).toEqual([])
  })
})
