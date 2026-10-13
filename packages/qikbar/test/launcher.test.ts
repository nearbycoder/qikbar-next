import { afterEach, describe, expect, it } from 'vitest'
import { LazyQikbar } from '../src/core/lazy'
import { memoryStorage } from '../src/core/storage'
import { de, en, localeFor, locales } from '../src/locales'
import { settle } from './helpers'

let bar: LazyQikbar | undefined
afterEach(() => {
  bar?.destroy()
  bar = undefined
  document.body.innerHTML = ''
  document.getElementById('qikbar-launcher-styles')?.remove()
})

const make = (config: ConstructorParameters<typeof LazyQikbar>[0]) =>
  (bar = new LazyQikbar({ storage: memoryStorage(), ...config }, () => import('../src/ui/bar')))

describe('launcher', () => {
  it('shows a button that opens the bar before the UI loads', async () => {
    const b = make({ launcher: true })
    await b.launcherReady()
    const button = document.querySelector<HTMLButtonElement>('.qb-launcher')!
    expect(button).not.toBeNull()
    expect(button.getAttribute('aria-label')).toBe('Open command bar')
    expect(document.getElementById('qikbar-launcher-styles')).not.toBeNull()
    button.click()
    await b.preload()
    await settle()
    expect(b.isOpen).toBe(true)
  })

  it('supports position, label, touch-only and translated labels', async () => {
    await make({ launcher: { position: 'bottom-left', touchOnly: true, offset: 12 }, labels: de }).launcherReady()
    const button = document.querySelector<HTMLButtonElement>('.qb-launcher')!
    expect(button.dataset.position).toBe('bottom-left')
    expect(button.hasAttribute('data-touch-only')).toBe(true)
    expect(button.style.getPropertyValue('--qb-launcher-offset')).toBe('12px')
    expect(button.getAttribute('aria-label')).toBe(de.openCommandBar)
  })

  it('"touch" is shorthand for touch-only', async () => {
    await make({ launcher: 'touch' }).launcherReady()
    expect(document.querySelector('.qb-launcher')?.hasAttribute('data-touch-only')).toBe(true)
  })

  it('can be added and removed with configure() and goes away on destroy', async () => {
    const b = make({})
    expect(document.querySelector('.qb-launcher')).toBeNull()
    b.configure({ launcher: true })
    await b.launcherReady()
    expect(document.querySelectorAll('.qb-launcher').length).toBe(1)
    b.configure({ launcher: false })
    expect(document.querySelector('.qb-launcher')).toBeNull()
    // Toggling quickly never leaves a stray button behind.
    b.configure({ launcher: true })
    b.configure({ launcher: { position: 'bottom-left' } })
    await b.launcherReady()
    expect(document.querySelectorAll('.qb-launcher').length).toBe(1)
    b.destroy()
    expect(document.querySelector('.qb-launcher')).toBeNull()
  })

  it('is never shown for inline bars', async () => {
    document.body.innerHTML = '<div id="x"></div>'
    await make({ inline: '#x', launcher: true }).launcherReady()
    expect(document.querySelector('.qb-launcher')).toBeNull()
  })
})

describe('lazy shell personalization', () => {
  it('reads pins and aliases before the UI loads and applies changes after', async () => {
    const storage = memoryStorage()
    storage.setItem('qikbar:pins', JSON.stringify(['a']))
    storage.setItem('qikbar:aliases', JSON.stringify({ x: 'a' }))
    const b = (bar = new LazyQikbar({ storage, commands: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }] }, () => import('../src/ui/bar')))
    expect(b.pins()).toEqual(['a'])
    expect(b.aliases()).toEqual({ x: 'a' })
    b.pin('b')
    b.setAlias('b', 'y')
    await b.preload()
    expect(b.pins()).toEqual(['b', 'a'])
    expect(b.aliases()).toEqual({ x: 'a', y: 'b' })
  })
})

describe('lazy shell and WebMCP', () => {
  it('loads the UI right away only when the browser supports WebMCP', async () => {
    let loads = 0
    const loader = () => {
      loads++
      return import('../src/ui/bar')
    }
    bar = new LazyQikbar({ storage: memoryStorage(), webmcp: true }, loader)
    await new Promise((r) => setTimeout(r, 20))
    expect(loads).toBe(0)
    bar.destroy()
    const registered: string[] = []
    ;(document as any).modelContext = { registerTool: (t: { name: string }) => registered.push(t.name) }
    try {
      bar = new LazyQikbar({ storage: memoryStorage(), webmcp: true }, loader)
      await bar.preload()
      expect(loads).toBe(1)
      expect(registered).toContain('qikbar_search')
    } finally {
      delete (document as any).modelContext
    }
  })
})

describe('locales', () => {
  it('every locale translates every label', () => {
    const keys = Object.keys(en).sort()
    for (const [code, labels] of Object.entries(locales)) {
      expect(Object.keys(labels).sort(), code).toEqual(keys)
      for (const key of keys) {
        const value = labels[key as keyof typeof labels]
        expect(value, `${code}.${key}`).toBeTruthy()
        // Placeholders must survive translation.
        const wanted = (en[key as keyof typeof en].match(/\{\w+\}/g) ?? []).sort()
        expect((value.match(/\{\w+\}/g) ?? []).sort(), `${code}.${key}`).toEqual(wanted)
      }
      expect(labels.chatSuggestions.split('|').length, code).toBe(2)
    }
  })

  it('picks a locale from a language tag', () => {
    expect(localeFor('de-AT')).toBe(de)
    expect(localeFor('pt_BR')).toBe(locales.pt)
    expect(localeFor('xx')).toBe(en)
    expect(localeFor(undefined)).toBe(en)
  })
})
