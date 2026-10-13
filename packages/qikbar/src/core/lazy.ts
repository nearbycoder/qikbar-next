/**
 * A tiny shell that implements the full Qikbar API, listens for the hotkey and
 * loads the UI chunk when the browser is idle (or immediately on first use).
 * Calls made before the UI loads are queued and replayed in order.
 */

import type { Bar } from '../ui/bar.js'
import { allowedInInput, isEditable, matchesHotkey } from './hotkeys.js'
import type { AIClient, Extension, Item, QikbarConfig, QikbarEvents, QikbarInstance, Source, ToastHandle, ToastOptions, View } from './types.js'

type Loader = () => Promise<{ Bar: typeof Bar }>

const hasModelContext = () => !!((document as any).modelContext ?? (navigator as any).modelContext)

export class LazyQikbar implements QikbarInstance {
  private bar?: Bar
  private loading?: Promise<Bar>
  private queue: ((bar: Bar) => void)[] = []
  private config: QikbarConfig
  private teardown: (() => void)[] = []
  private destroyed = false
  private removeLauncher?: () => void

  constructor(
    config: QikbarConfig,
    private loader: Loader,
  ) {
    this.config = { ...config }
    if (typeof document === 'undefined') return
    if (config.inline) {
      void this.load()
      return
    }
    this.updateLauncher()
    // Agents may call tools at any time, so WebMCP needs the UI loaded now (only if the browser supports it).
    if (config.webmcp && hasModelContext()) void this.load()
    const onKey = (e: KeyboardEvent) => {
      const hotkeys = this.config.hotkey === false ? [] : ([] as string[]).concat(this.config.hotkey ?? 'mod+k')
      const inField = isEditable(e.target)
      if (!this.bar && hotkeys.some((hk) => matchesHotkey(e, hk) && (!inField || allowedInInput(hk)))) {
        e.preventDefault()
        this.open()
      }
    }
    const onClick = (e: MouseEvent) => {
      const trigger = (e.target as Element | null)?.closest?.('[data-qikbar-open]')
      if (!trigger || this.bar) return
      const target = trigger.getAttribute('data-qikbar-open')
      if (target && target !== this.config.namespace) return
      e.preventDefault()
      this.open({ query: trigger.getAttribute('data-qikbar-query') ?? undefined })
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('click', onClick, true)
    this.teardown.push(() => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('click', onClick, true)
    })
    // Warm up when the browser is idle so the first open is instant.
    const idle = (globalThis as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined
    if (idle) idle(() => void this.load(), { timeout: 2500 })
    else setTimeout(() => void this.load(), 1200)
  }

  private launcherToken = 0

  /** The launcher is loaded on demand, so apps without one don't ship it. */
  private updateLauncher() {
    this.removeLauncher?.()
    this.removeLauncher = undefined
    const token = ++this.launcherToken
    if (!this.config.launcher || this.config.inline || this.destroyed) return
    void import('./launcher.js').then(({ mountLauncher, resolveLauncher }) => {
      const opts = resolveLauncher(this.config.launcher)
      if (!opts || token !== this.launcherToken || this.destroyed) return
      const label = this.config.labels?.openCommandBar ?? 'Open command bar'
      const mount = () => {
        if (this.destroyed || token !== this.launcherToken) return
        this.removeLauncher = mountLauncher(opts, label, () => this.open(), this.config.nonce)
      }
      if (document.body) mount()
      else document.addEventListener('DOMContentLoaded', mount, { once: true })
    })
  }

  /** Resolves once the launcher (if any) is on the page. Mostly for tests. */
  launcherReady(): Promise<void> {
    return import('./launcher.js').then(() => new Promise((r) => setTimeout(r)))
  }

  /** Read a stored value before the UI loads (same keys as the bar's storage). */
  private stored<T>(key: string): T | undefined {
    try {
      const adapter = this.config.storage ?? globalThis.localStorage
      const raw = adapter.getItem(`${this.config.namespace ?? 'qikbar'}:${key}`)
      return raw == null ? undefined : (JSON.parse(raw) as T)
    } catch {
      return undefined
    }
  }

  /** Load the UI now. Resolves when ready. */
  preload(): Promise<void> {
    return this.load().then(() => undefined)
  }

  private load(): Promise<Bar> {
    this.loading ??= this.loader().then(({ Bar }) => {
      if (this.destroyed) throw new Error('destroyed')
      for (const fn of this.teardown) fn()
      this.teardown = []
      const bar = new Bar(this.config)
      this.bar = bar
      const queue = this.queue
      this.queue = []
      for (const fn of queue) fn(bar)
      return bar
    })
    this.loading.catch((err) => {
      if (!this.destroyed) console.error('[qikbar] failed to load UI', err)
    })
    return this.loading
  }

  private run(fn: (bar: Bar) => void) {
    if (this.bar) fn(this.bar)
    else {
      this.queue.push(fn)
      void this.load()
    }
  }

  /** Queue a call that returns a disposer; the disposer works before and after loading. */
  private disposable(fn: (bar: Bar) => () => void): () => void {
    if (this.bar) return fn(this.bar)
    let dispose: (() => void) | undefined
    let cancelled = false
    this.queue.push((bar) => {
      if (!cancelled) dispose = fn(bar)
    })
    return () => {
      cancelled = true
      dispose?.()
    }
  }

  get isOpen() {
    return this.bar?.isOpen ?? false
  }
  get query() {
    return this.bar?.query ?? ''
  }
  get ai(): AIClient | undefined {
    return this.bar?.ai
  }

  open(options?: { query?: string; view?: View }) {
    this.run((b) => b.open(options))
  }
  close() {
    this.bar?.close()
  }
  toggle() {
    if (this.bar) this.bar.toggle()
    else this.open()
  }
  register(commands: Item | Item[]) {
    return this.disposable((b) => b.register(commands))
  }
  addSource(source: Source) {
    return this.disposable((b) => b.addSource(source))
  }
  use(extension: Extension, preferences?: Record<string, any>) {
    return this.disposable((b) => b.use(extension, preferences))
  }
  configure(config: Partial<QikbarConfig>) {
    this.config = { ...this.config, ...config }
    if (this.bar) this.bar.configure(config)
    if ('launcher' in config || 'labels' in config) this.updateLauncher()
    if (config.webmcp && !this.bar && hasModelContext()) void this.load()
  }
  push(view: View) {
    this.run((b) => b.push(view))
  }
  pop() {
    this.bar?.pop()
  }
  setQuery(query: string) {
    this.run((b) => b.setQuery(query))
  }
  ask(prompt?: string) {
    this.run((b) => b.ask(prompt))
  }
  toast(options: ToastOptions | string): ToastHandle {
    if (this.bar) return this.bar.toast(options)
    let handle: ToastHandle | undefined
    const pending: ((h: ToastHandle) => void)[] = []
    this.run((b) => {
      handle = b.toast(options)
      for (const p of pending) p(handle)
    })
    return {
      update: (o) => (handle ? handle.update(o) : pending.push((h) => h.update(o))),
      hide: () => (handle ? handle.hide() : pending.push((h) => h.hide())),
    }
  }
  commands(): Item[] {
    return this.bar?.commands() ?? []
  }
  pins(): string[] {
    return this.bar?.pins() ?? this.stored<string[]>('pins') ?? []
  }
  pin(id: string, pinned?: boolean) {
    this.run((b) => b.pin(id, pinned))
  }
  aliases(): Record<string, string> {
    return this.bar?.aliases() ?? this.stored<Record<string, string>>('aliases') ?? {}
  }
  setAlias(id: string, alias: string | null) {
    this.run((b) => b.setAlias(id, alias))
  }
  on<K extends keyof QikbarEvents>(event: K, handler: (payload: QikbarEvents[K]) => void) {
    return this.disposable((b) => b.on(event, handler))
  }
  destroy() {
    this.destroyed = true
    this.launcherToken++
    this.removeLauncher?.()
    this.removeLauncher = undefined
    for (const fn of this.teardown) fn()
    this.teardown = []
    this.queue = []
    this.bar?.destroy()
  }
}
