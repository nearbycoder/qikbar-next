import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { createRoot, createSignal } from 'solid-js'
import '../src/element/index'
import type { QikbarElement } from '../src/element/index'
import { Qikbar as VueQikbar, useCommands as useVueCommands, useQikbar as useVueQikbar } from '../src/vue/index'
import { commands as svelteCommands, qikbar as svelteQikbar, qikbarStore } from '../src/svelte/index'
import { createQikbar as createSolidQikbar, useCommands as useSolidCommands, useQikbar as useSolidQikbar } from '../src/solid/index'
import type { QikbarInstance, QikbarState } from '../src/core/types'
import { memoryStorage } from '../src/core/storage'
import { settle, tick } from './helpers'

afterEach(() => {
  document.body.innerHTML = ''
})

const titles = () => [...document.querySelectorAll('.qb-item .qb-item-title')].map((e) => e.textContent)
const ready = async (bar: QikbarInstance | null | undefined) => {
  await bar?.preload()
  await settle()
}

// ─── Web component ──────────────────────────────────────────────────────────

describe('<qik-bar>', () => {
  it('builds commands from <qik-command> children and fires run events', async () => {
    document.body.innerHTML = `
      <qik-bar placeholder="Search Acme…">
        <qik-command href="/settings" section="Navigation" icon="settings" keywords="prefs, config">Settings</qik-command>
        <qik-command id="theme" subtitle="Light or dark">Toggle theme</qik-command>
      </qik-bar>`
    const el = document.querySelector('qik-bar') as QikbarElement
    el.config = { storage: memoryStorage(), navigate: vi.fn() }
    const run = vi.fn()
    document.getElementById('theme')!.addEventListener('run', run)
    const opened = vi.fn()
    el.addEventListener('qikbar-open', opened)
    el.open()
    await ready(el.bar)
    expect((document.querySelector('.qb-input') as HTMLInputElement).placeholder).toBe('Search Acme…')
    expect(titles()).toEqual(['Settings', 'Toggle theme'])
    expect(opened).toHaveBeenCalledOnce()
    const cmd = el.bar!.commands().find((c) => c.title === 'Settings')!
    expect(cmd).toMatchObject({ href: '/settings', section: 'Navigation', icon: 'settings', keywords: ['prefs', 'config'] })
    ;[...document.querySelectorAll<HTMLElement>('.qb-item')][1]!.click()
    await tick()
    expect(run).toHaveBeenCalledOnce()
  })

  it('updates when children and attributes change', async () => {
    document.body.innerHTML = `<qik-bar><qik-command>One</qik-command></qik-bar>`
    const el = document.querySelector('qik-bar') as QikbarElement
    el.open()
    await ready(el.bar)
    const cmd = document.createElement('qik-command')
    cmd.textContent = 'Two'
    el.append(cmd)
    await tick()
    await settle()
    expect(el.bar!.commands().map((c) => c.title)).toEqual(['One', 'Two'])
    el.setAttribute('placeholder', 'Find it')
    await settle()
    expect((document.querySelector('.qb-input') as HTMLInputElement).placeholder).toBe('Find it')
  })

  it('renders inline and cleans up when removed', async () => {
    document.body.innerHTML = `<qik-bar inline><qik-command>Inline one</qik-command></qik-bar>`
    const el = document.querySelector('qik-bar') as QikbarElement
    await ready(el.bar)
    expect(el.querySelector('[data-qikbar-mount] .qb-root')).not.toBeNull()
    expect(titles()).toEqual(['Inline one'])
    el.remove()
    expect(document.querySelector('.qb-root')).toBeNull()
  })

  it('reads boolean and list attributes', async () => {
    document.body.innerHTML = `<qik-bar hotkey="mod+k, mod+p" launcher="touch" touch="false" theme="nord"></qik-bar>`
    const el = document.querySelector('qik-bar') as QikbarElement
    expect((el as any).attrConfig()).toEqual({ hotkey: ['mod+k', 'mod+p'], launcher: 'touch', touch: false, theme: 'nord' })
    await (el.bar as any).launcherReady()
    expect(document.querySelector('.qb-launcher[data-touch-only]')).not.toBeNull()
  })
})

// ─── Vue ────────────────────────────────────────────────────────────────────

describe('vue', () => {
  it('mounts, registers commands from children and tracks state', async () => {
    let bar: QikbarInstance | undefined
    let state: { value: QikbarState } | undefined
    const show = ref(true)
    const Page = defineComponent({
      setup() {
        useVueCommands([{ title: 'Archive project' }])
        return () => null
      },
    })
    const Probe = defineComponent({
      setup() {
        const q = useVueQikbar()
        state = q.state
        return () => null
      },
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp({
      render: () =>
        h(VueQikbar, { config: { storage: memoryStorage(), commands: [{ title: 'Home' }] }, onReady: (b: QikbarInstance) => (bar = b) }, () => [
          show.value ? h(Page) : null,
          h(Probe),
        ]),
    })
    app.mount(host)
    await nextTick()
    bar!.open()
    await ready(bar)
    expect(titles()).toEqual(['Home', 'Archive project'])
    expect(state!.value.open).toBe(true)
    show.value = false
    await nextTick()
    await settle()
    expect(titles()).toEqual(['Home'])
    app.unmount()
    expect(document.querySelector('.qb-root')).toBeNull()
  })

  it('applies config changes and re-registers getter commands', async () => {
    let bar: QikbarInstance | undefined
    const placeholder = ref('First')
    const count = ref(1)
    const Page = defineComponent({
      setup() {
        useVueCommands(() => Array.from({ length: count.value }, (_, i) => ({ title: `Item ${i + 1}` })))
        return () => null
      },
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp({
      render: () => h(VueQikbar, { config: { storage: memoryStorage(), placeholder: placeholder.value }, onReady: (b: QikbarInstance) => (bar = b) }, () => h(Page)),
    })
    app.mount(host)
    await nextTick()
    bar!.open()
    await ready(bar)
    placeholder.value = 'Second'
    count.value = 3
    await nextTick()
    await settle()
    expect((document.querySelector('.qb-input') as HTMLInputElement).placeholder).toBe('Second')
    expect(titles()).toEqual(['Item 1', 'Item 2', 'Item 3'])
    app.unmount()
  })

  it('renders inline', async () => {
    let bar: QikbarInstance | undefined
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp({ render: () => h(VueQikbar, { inline: true, config: { storage: memoryStorage(), commands: [{ title: 'Inline' }] }, onReady: (b: QikbarInstance) => (bar = b) }) })
    app.mount(host)
    await nextTick()
    await ready(bar)
    expect(host.querySelector('.qikbar-inline .qb-root')).not.toBeNull()
    app.unmount()
  })
})

// ─── Svelte ─────────────────────────────────────────────────────────────────

describe('svelte', () => {
  it('exposes state as a store and bound methods', async () => {
    const bar = qikbarStore({ storage: memoryStorage(), commands: [{ title: 'Svelte cmd' }] })
    const states: QikbarState[] = []
    const unsub = bar.subscribe((s) => states.push(s))
    expect(states[0]).toEqual({ open: false, query: '', depth: 0, loading: false })
    const { open, destroy, register } = bar
    const off = register([{ title: 'Extra' }])
    open()
    await ready(bar.instance)
    expect(states.at(-1)!.open).toBe(true)
    expect(titles()).toEqual(['Svelte cmd', 'Extra'])
    off()
    await settle()
    expect(titles()).toEqual(['Svelte cmd'])
    unsub()
    destroy()
    expect(document.querySelector('.qb-root')).toBeNull()
  })

  it('renders an inline bar with the action and updates it', async () => {
    const node = document.createElement('div')
    document.body.append(node)
    const action = svelteQikbar(node, { storage: memoryStorage(), placeholder: 'One', commands: [{ title: 'A' }] })
    await tick(30)
    await settle()
    expect(node.querySelector('.qb-root')).not.toBeNull()
    action.update({ storage: memoryStorage(), placeholder: 'Two', commands: [{ title: 'A' }] })
    await settle()
    expect((node.querySelector('.qb-input') as HTMLInputElement).placeholder).toBe('Two')
    action.destroy()
    expect(node.querySelector('.qb-root')).toBeNull()
  })

  it('registers commands with the commands action', async () => {
    const bar = qikbarStore({ storage: memoryStorage() })
    const node = document.createElement('section')
    const action = svelteCommands(node, { bar, commands: [{ title: 'Page cmd' }] })
    await bar.preload()
    expect(bar.commands().map((c) => c.title)).toEqual(['Page cmd'])
    action.update({ bar, commands: [{ title: 'Changed' }] })
    expect(bar.commands().map((c) => c.title)).toEqual(['Changed'])
    action.destroy()
    expect(bar.commands()).toEqual([])
    bar.destroy()
  })
})

// ─── Solid ──────────────────────────────────────────────────────────────────

describe('solid', () => {
  it('owns the bar, tracks state and registers commands reactively', async () => {
    const [count, setCount] = createSignal(1)
    const [placeholder, setPlaceholder] = createSignal('One')
    let bar!: QikbarInstance
    let state!: () => QikbarState
    const dispose = createRoot((dispose) => {
      bar = createSolidQikbar(() => ({ storage: memoryStorage(), placeholder: placeholder() }))
      state = useSolidQikbar().state
      useSolidCommands(() => Array.from({ length: count() }, (_, i) => ({ title: `S${i + 1}` })))
      return dispose
    })
    bar.open()
    await ready(bar)
    expect(titles()).toEqual(['S1'])
    expect(state().open).toBe(true)
    setCount(2)
    setPlaceholder('Two')
    await settle()
    expect(titles()).toEqual(['S1', 'S2'])
    expect((document.querySelector('.qb-input') as HTMLInputElement).placeholder).toBe('Two')
    dispose()
    expect(document.querySelector('.qb-root')).toBeNull()
  })
})
