import { createAIClient, runAgent, type RuntimeTool } from '../ai/agent'
import { action as actionHelpers } from '../core/define'
import { Frecency } from '../core/frecency'
import { allowedInInput, isEditable, matchesHotkey, SequenceMatcher } from '../core/hotkeys'
import { matchItem, rank } from '../core/search'
import { defaultStorage, scopedStorage } from '../core/storage'
import type {
  Action,
  AIClient,
  AIMessage,
  AIOptions,
  AutoIndexOptions,
  ChatView,
  ConfirmOptions,
  Context,
  DetailView,
  Extension,
  FormView,
  GridView,
  Item,
  ListView,
  Preference,
  QikbarConfig,
  QikbarEvents,
  QikbarInstance,
  QikbarState,
  ScopedStorage,
  Source,
  StorageAdapter,
  ToastHandle,
  ToastOptions,
  Tool,
  View,
} from '../core/types'
import { h, renderIcon, renderKbd, uid } from './dom'
import { copyText, defaultNavigate } from './nav'
import { css } from './styles'
import { resolveThemeVars, cssVarName } from './themes'
import { ChatRenderer, DetailRenderer, FormRenderer, GridRenderer, ListRenderer, type ViewRenderer } from './views'

// ─── Internal types ─────────────────────────────────────────────────────────

export interface RootView {
  type: 'root'
  title?: string
  placeholder?: string
  actions?: Action[]
}
export type AnyView = View | RootView

export interface ExtRuntime {
  ext: Extension
  provided: Record<string, any>
  storage: ScopedStorage
  prefs(): Record<string, any>
  missing(): Preference[]
}

export type Row =
  | { kind: 'section'; key: string; title: string }
  | { kind: 'item'; key: string; item: Item; positions?: number[]; index: number }

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
  tools: { label: string; state: 'running' | 'done' | 'error' }[]
  error?: string
  streaming?: boolean
}

export interface Frame {
  id: number
  view: AnyView
  query: string
  selected: number
  selectedKey?: string
  rows: Row[]
  itemRows: Extract<Row, { kind: 'item' }>[]
  loading: number
  controller: AbortController
  queryController?: AbortController
  ext?: ExtRuntime
  args?: Record<string, string>
  scrollTop?: number
  /** Items loaded by a list/grid loader. */
  items?: Item[]
  sourceResults?: Map<string, Item[]>
  detail?: { text: string; done: boolean; error?: string }
  form?: { values: Record<string, any>; errors: Record<string, string> }
  chat?: { messages: AIMessage[]; turns: ChatTurn[]; controller?: AbortController }
  actionCache?: WeakMap<Item, Action[]>
  error?: string
  /** The user moved the selection since the last query change. */
  userMoved?: boolean
}

interface Dom {
  root: HTMLElement
  overlay: HTMLElement
  dialog: HTMLElement
  header: HTMLElement
  back: HTMLButtonElement
  crumb: HTMLElement
  searchIcon: HTMLElement
  input: HTMLInputElement
  args: HTMLElement
  title: HTMLElement
  hint: HTMLElement
  progress: HTMLElement
  body: HTMLElement
  footer: HTMLElement
  footerLeft: HTMLElement
  footerRight: HTMLElement
  layer: HTMLElement
  live: HTMLElement
}

interface PanelState {
  item: Item | undefined
  actions: Action[]
  filter: string
  selected: number
  el?: HTMLElement
  input?: HTMLInputElement
  list?: HTMLElement
}

const VIEW_TYPES = new Set(['list', 'grid', 'detail', 'form', 'chat'])
export const isView = (x: unknown): x is View => !!x && typeof x === 'object' && VIEW_TYPES.has((x as any).type)

const DEFAULT_LINKS = 'nav a[href], header a[href], aside a[href], [data-qikbar-index] a[href]'
const DEFAULT_ACTIONS_HOTKEY = 'mod+.'
const toolName = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)

let frameCounter = 0

// ─── The bar ────────────────────────────────────────────────────────────────

export class Bar implements QikbarInstance {
  config: QikbarConfig
  readonly instanceId = uid('qikbar')
  private storageAdapter: StorageAdapter
  readonly storage: ScopedStorage
  readonly frecency: Frecency
  private registrations = new Map<number, Item[]>()
  private regCounter = 0
  private sources = new Set<Source>()
  readonly sourceExt = new WeakMap<Source, ExtRuntime>()
  readonly itemExt = new WeakMap<Item, ExtRuntime>()
  private extensions = new Map<string, { rt: ExtRuntime; cleanup?: () => void; items: Item[] }>()
  private configExtensions: { ext: Extension; prefs?: Record<string, any>; uninstall: () => void }[] = []
  private configSources: (() => void)[] = []
  private ids = new WeakMap<Item, string>()
  private listeners = new Map<string, Set<(p: any) => void>>()
  stack: Frame[] = []
  private _open = false
  private rootCache: Item[] | null = null
  private routeItems: Item[] = []
  private autoItems: Item[] = []
  private shortcutItems: Item[] = []
  aiOptions?: AIOptions
  ai: AIClient | undefined
  dom?: Dom
  private renderer?: ViewRenderer
  panel?: PanelState
  private toastState?: ToastOptions & { id: number }
  private toastTimer?: ReturnType<typeof setTimeout>
  private toastId = 0
  private hud?: HTMLElement
  private confirmState?: ConfirmOptions & { resolve: (ok: boolean) => void }
  argMode?: { item: Item; action: Action; frame: Frame; values: Record<string, string> }
  private seq = new SequenceMatcher()
  private prevFocus: Element | null = null
  private teardown: (() => void)[] = []
  private appliedVars: string[] = []
  private scheduled = false
  private scrollLock?: { overflow: string; paddingRight: string }
  private closeTimer?: ReturnType<typeof setTimeout>
  private destroyed = false
  private styleEl?: HTMLStyleElement

  constructor(config: QikbarConfig = {}) {
    this.config = { ...config }
    this.storageAdapter = config.storage ?? defaultStorage()
    this.storage = scopedStorage(this.storageAdapter, config.namespace ?? 'qikbar')
    this.frecency = new Frecency(this.storage)
    this.applyConfig(config, true)
    if (typeof document === 'undefined') return
    this.listen(document, 'keydown', this.onGlobalKeyDown as EventListener, true)
    this.listen(document, 'click', this.onGlobalClick as EventListener, true)
    if (this.inlineTarget()) {
      // Inline bars are always open.
      const start = () => this.open({ focus: false })
      if (document.readyState === 'loading') this.listen(document, 'DOMContentLoaded', start)
      else start()
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  get isOpen() {
    return this._open
  }

  get query() {
    return this.top?.query ?? ''
  }

  get top(): Frame | undefined {
    return this.stack[this.stack.length - 1]
  }

  get isInline() {
    return !!this.config.inline
  }

  get aiName() {
    return this.aiOptions?.name ?? 'AI'
  }

  get actionsHotkey() {
    return this.config.actionsHotkey ?? DEFAULT_ACTIONS_HOTKEY
  }

  open(options: { query?: string; view?: View; focus?: boolean } = {}) {
    if (this.destroyed || typeof document === 'undefined') return
    this.mount()
    clearTimeout(this.closeTimer)
    const wasOpen = this._open
    if (!wasOpen) {
      this._open = true
      this.prevFocus = document.activeElement
      // Re-evaluate `when` conditions and page links on every open.
      this.rootCache = null
      this.autoIndex()
      this.resetToRoot()
      this.applyTheme()
      const dom = this.dom!
      dom.root.dataset.qbState = 'open'
      dom.overlay.hidden = this.isInline
      dom.dialog.hidden = false
      if (!this.isInline) this.lockScroll()
      this.emit('open', undefined)
      this.config.onOpen?.()
    }
    if (options.view) this.push(options.view)
    if (options.query != null) this.setQuery(options.query)
    this.flush()
    if (options.focus !== false) this.focusInput()
    this.emitChange()
  }

  close() {
    if (!this._open || !this.dom) return
    this.closePanel()
    this.confirmState?.resolve(false)
    this.confirmState = undefined
    this.argMode = undefined
    if (this.isInline) {
      this.resetToRoot()
      this.flush()
      ;(document.activeElement as HTMLElement | null)?.blur?.()
      this.emitChange()
      return
    }
    this._open = false
    const dom = this.dom
    dom.root.dataset.qbState = 'closing'
    const finish = () => {
      if (this._open) return
      dom.root.dataset.qbState = 'closed'
      dom.dialog.hidden = true
      dom.overlay.hidden = true
      this.renderer?.destroy()
      this.renderer = undefined
      dom.body.replaceChildren()
      for (const f of this.stack) this.destroyFrame(f)
      this.stack = []
    }
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) finish()
    else this.closeTimer = setTimeout(finish, 120)
    this.unlockScroll()
    const prev = this.prevFocus as HTMLElement | null
    if (prev && typeof prev.focus === 'function' && document.contains(prev)) prev.focus({ preventScroll: true })
    if (this.toastState) this.renderToast()
    this.emit('close', undefined)
    this.config.onClose?.()
    this.emitChange()
  }

  toggle() {
    if (this._open && !this.isInline) this.close()
    else this.open()
  }

  register(commands: Item | Item[]): () => void {
    const id = ++this.regCounter
    this.registrations.set(id, Array.isArray(commands) ? commands : [commands])
    this.invalidateRoot()
    return () => {
      this.registrations.delete(id)
      this.invalidateRoot()
    }
  }

  addSource(source: Source): () => void {
    this.sources.add(source)
    return () => {
      this.sources.delete(source)
      for (const f of this.stack) f.sourceResults?.delete(source.id)
      this.invalidate()
    }
  }

  use(ext: Extension, provided: Record<string, any> = {}): () => void {
    this.extensions.get(ext.name)?.cleanup?.()
    const storage = scopedStorage(this.storageAdapter, `${this.config.namespace ?? 'qikbar'}:ext:${ext.name}`)
    const rt: ExtRuntime = {
      ext,
      provided,
      storage,
      prefs: () => {
        const stored = storage.get<Record<string, any>>('preferences') ?? {}
        const out: Record<string, any> = {}
        for (const p of ext.preferences ?? []) if (p.default !== undefined) out[p.name] = p.default
        return { ...out, ...stored, ...provided }
      },
      missing: () => {
        const values = rt.prefs()
        return (ext.preferences ?? []).filter((p) => p.required && (values[p.name] === undefined || values[p.name] === ''))
      },
    }
    const items: Item[] = (ext.commands ?? []).map((cmd) => {
      const { name, ...rest } = cmd
      const item: Item = { section: ext.title, icon: ext.icon, ...rest, id: `${ext.name}.${name}` }
      this.itemExt.set(item, rt)
      return item
    })
    const removeSources = (ext.sources ?? []).map((s) => {
      this.sourceExt.set(s, rt)
      return this.addSource(s)
    })
    let setupCleanup: void | (() => void)
    try {
      setupCleanup = ext.setup?.({ bar: this, preferences: rt.prefs(), storage })
    } catch (err) {
      console.error(`[qikbar] extension "${ext.name}" setup failed`, err)
    }
    let disposed = false
    const entry = {
      rt,
      items,
      cleanup: () => {
        if (disposed) return
        disposed = true
        removeSources.forEach((r) => r())
        if (typeof setupCleanup === 'function') setupCleanup()
        if (this.extensions.get(ext.name) === entry) this.extensions.delete(ext.name)
        this.invalidateRoot()
      },
    }
    this.extensions.set(ext.name, entry)
    this.invalidateRoot()
    return entry.cleanup
  }

  configure(partial: Partial<QikbarConfig>) {
    const prev = this.config
    this.config = { ...this.config, ...partial }
    this.applyConfig(partial, false, prev)
    if (this.dom) {
      if ('theme' in partial || 'appearance' in partial) this.applyTheme()
      if ('classNames' in partial) this.applyClassNames()
      if ('dir' in partial) this.dom.root.dir = this.config.dir ?? ''
    }
    this.invalidateRoot()
  }

  push(view: View, ext?: ExtRuntime) {
    if (!this._open) {
      this.open()
      if (!this._open) return
    }
    const top = this.top
    if (top && this.renderer) top.scrollTop = this.renderer.scrollTop()
    const frame = this.createFrame(view, ext ?? top?.ext)
    this.stack.push(frame)
    this.closePanel()
    this.argMode = undefined
    this.startFrame(frame)
    this.flush()
    this.focusInput()
    this.emitChange()
  }

  pop() {
    if (this.stack.length <= 1) return
    const frame = this.stack.pop()!
    this.destroyFrame(frame)
    this.closePanel()
    this.argMode = undefined
    this.flush()
    this.focusInput()
    this.emitChange()
  }

  setQuery(query: string) {
    const frame = this.top
    if (!frame) return
    if (this.dom) this.dom.input.value = query
    this.onQueryChange(frame, query)
  }

  ask(prompt?: string) {
    if (!this.ai) {
      this.toast({ style: 'failure', title: 'AI is not configured', message: 'Pass `ai` to createQikbar().' })
      return
    }
    this.push({ type: 'chat', prompt: prompt?.trim() || undefined })
  }

  commands(): Item[] {
    return this.rootItems()
  }

  on<K extends keyof QikbarEvents>(event: K, handler: (payload: QikbarEvents[K]) => void): () => void {
    let set = this.listeners.get(event)
    if (!set) this.listeners.set(event, (set = new Set()))
    set.add(handler)
    return () => set!.delete(handler)
  }

  preload(): Promise<void> {
    return Promise.resolve()
  }

  destroy() {
    this.destroyed = true
    if (this._open && !this.isInline) this.unlockScroll()
    this._open = false
    for (const f of this.stack) this.destroyFrame(f)
    this.stack = []
    for (const e of this.extensions.values()) e.cleanup?.()
    for (const fn of this.teardown) fn()
    this.teardown = []
    this.dom?.root.remove()
    this.hud?.remove()
    this.dom = undefined
    this.listeners.clear()
  }

  // ─── Config ──────────────────────────────────────────────────────────────

  private applyConfig(partial: Partial<QikbarConfig>, initial: boolean, prev?: QikbarConfig) {
    if ('routes' in partial || initial) {
      this.routeItems = (this.config.routes ?? []).map((r) => ({
        id: `route:${r.path}`,
        title: r.title,
        subtitle: r.subtitle,
        icon: r.icon ?? 'arrow-right',
        keywords: [...(r.keywords ?? []), r.path],
        section: r.section ?? 'Navigation',
        href: r.path,
        shortcut: r.shortcut,
      }))
    }
    if ('sources' in partial || initial) {
      if (initial || prev?.sources !== this.config.sources) {
        for (const remove of this.configSources) remove()
        this.configSources = (this.config.sources ?? []).map((src) => this.addSource(src))
      }
    }
        if ('ai' in partial || initial) {
      const ai = this.config.ai
      this.aiOptions = !ai ? undefined : 'stream' in ai ? { provider: ai } : ai
      this.ai = this.aiOptions ? createAIClient(this.aiOptions.provider, this.aiOptions.system) : undefined
    }
    if ('extensions' in partial || initial) {
      const next = (this.config.extensions ?? []).map((e) => (Array.isArray(e) ? { ext: e[0], prefs: e[1] } : { ext: e, prefs: undefined }))
      const sameRef = !initial && prev?.extensions === this.config.extensions
      const sameContent =
        next.length === this.configExtensions.length &&
        next.every((n, i) => n.ext === this.configExtensions[i]!.ext && shallowEqual(n.prefs, this.configExtensions[i]!.prefs))
      if (!sameRef && !sameContent) {
        for (const e of this.configExtensions) e.uninstall()
        this.configExtensions = next.map((n) => ({ ...n, uninstall: this.use(n.ext, n.prefs) }))
      }
    }
  }

  private inlineTarget(): HTMLElement | null {
    const t = this.config.inline
    if (!t || typeof document === 'undefined') return null
    return typeof t === 'string' ? document.querySelector<HTMLElement>(t) : t
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  private emit<K extends keyof QikbarEvents>(event: K, payload: QikbarEvents[K]) {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(payload)
      } catch (err) {
        console.error(err)
      }
    })
  }

  private emitChange() {
    const state: QikbarState = { open: this._open, query: this.query, depth: this.stack.length, loading: !!this.top?.loading }
    this.emit('change', state)
  }

  private listen(target: EventTarget, type: string, fn: EventListener, capture = false) {
    target.addEventListener(type, fn, capture)
    this.teardown.push(() => target.removeEventListener(type, fn, capture))
  }

  // ─── Root items ──────────────────────────────────────────────────────────

  idOf(item: Item): string {
    return item.id ?? this.ids.get(item) ?? item.title
  }

  private invalidateRoot() {
    this.rootCache = null
    if (this._open) {
      for (const f of this.stack) if (f.view.type === 'root') this.computeRows(f)
      this.invalidate()
    }
  }

  rootItems(): Item[] {
    if (this.rootCache) return this.rootCache
    const out: Item[] = []
    const seen = new Set<string>()
    const add = (item: Item, prefix: string) => {
      try {
        if (item.when && !item.when()) return
      } catch {
        return
      }
      let id = item.id ?? `${prefix}:${item.section ?? ''}:${item.title}`
      while (seen.has(id)) id += '\''
      seen.add(id)
      this.ids.set(item, id)
      out.push(item)
    }
    for (const c of this.config.commands ?? []) add(c, 'cmd')
    for (const c of this.routeItems) add(c, 'route')
    for (const list of this.registrations.values()) for (const c of list) add(c, 'reg')
    for (const e of this.extensions.values()) for (const c of e.items) add(c, 'ext')
    for (const c of this.autoItems) add(c, 'auto')
    if (this.ai && this.aiOptions?.fallback !== false) {
      add(
        {
          id: 'qikbar.ask-ai',
          title: `Ask ${this.aiName}`,
          subtitle: 'Chat, or tell it what to do',
          icon: 'sparkles',
          section: 'AI',
          keywords: ['chat', 'assistant', 'ai', 'help'],
          searchOnly: true,
          view: { type: 'chat' },
        },
        'qb',
      )
    }
    this.rootCache = out
    this.shortcutItems = out.filter((i) => i.shortcut)
    return out
  }

  private autoIndex() {
    const opt = this.config.autoIndex
    if (!opt || typeof document === 'undefined') {
      if (this.autoItems.length) {
        this.autoItems = []
        this.rootCache = null
      }
      return
    }
    const o: AutoIndexOptions = opt === true ? {} : opt
    const items: Item[] = []
    const seen = new Set<string>()
    if (o.links !== false) {
      for (const a of document.querySelectorAll<HTMLAnchorElement>(o.links ?? DEFAULT_LINKS)) {
        if (a.closest('.qb-root') || a.closest('[data-qikbar-ignore]')) continue
        const raw = a.getAttribute('href') ?? ''
        // Skip in-page anchors (#section) but keep hash routes (#/settings).
        if (!raw || (raw.startsWith('#') && !raw.startsWith('#/')) || /^(javascript|mailto|tel):/i.test(raw)) continue
        const title = (a.getAttribute('aria-label') || a.textContent || a.title || '').replace(/\s+/g, ' ').trim().slice(0, 80)
        if (!title) continue
        const external = a.host !== location.host
        const href = external ? a.href : raw.startsWith('#') ? raw : a.pathname + a.search + a.hash
        if (seen.has(href)) continue
        seen.add(href)
        const sectionEl = a.closest<HTMLElement>('[data-qikbar-section],nav[aria-label],aside[aria-label]')
        items.push({
          id: `auto:${href}`,
          title,
          subtitle: external ? a.host : raw.startsWith('#') ? raw : a.pathname,
          section: sectionEl?.dataset.qikbarSection ?? sectionEl?.getAttribute('aria-label') ?? o.section ?? 'Pages',
          icon: external ? 'globe' : 'file',
          keywords: [href],
          ...(external ? { url: href } : { href }),
        })
      }
    }
    if (o.elements !== false) {
      for (const el of document.querySelectorAll<HTMLElement>('[data-qikbar]')) {
        if (el.closest('.qb-root')) continue
        const title = (el.dataset.qikbar || el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
        if (!title) continue
        items.push({
          id: `el:${el.id || title}`,
          title,
          subtitle: el.dataset.qikbarSubtitle,
          keywords: el.dataset.qikbarKeywords?.split(',').map((k) => k.trim()),
          section: el.dataset.qikbarSection ?? 'Actions',
          icon: el.dataset.qikbarIcon ?? 'zap',
          shortcut: el.dataset.qikbarShortcut,
          run: () => {
            el.click()
          },
        })
      }
    }
    this.autoItems = items
    this.rootCache = null
  }

  // ─── Frames ──────────────────────────────────────────────────────────────

  private createFrame(view: AnyView, ext?: ExtRuntime, args?: Record<string, string>): Frame {
    return {
      id: ++frameCounter,
      view,
      query: ('query' in view && typeof view.query === 'string' ? view.query : '') || '',
      selected: 0,
      rows: [],
      itemRows: [],
      loading: 0,
      controller: new AbortController(),
      ext,
      args,
    }
  }

  private resetToRoot() {
    for (const f of this.stack) this.destroyFrame(f)
    const root = this.createFrame({ type: 'root' })
    root.sourceResults = new Map()
    this.stack = [root]
    this.renderer?.destroy()
    this.renderer = undefined
    if (this.dom) this.dom.input.value = ''
    this.computeRows(root)
  }

  private destroyFrame(frame: Frame) {
    frame.controller.abort()
    frame.queryController?.abort()
    frame.chat?.controller?.abort()
    try {
      ;(frame.view as View).onClose?.()
    } catch (err) {
      console.error(err)
    }
  }

  /** Start async work for a freshly pushed frame. */
  private startFrame(frame: Frame) {
    const v = frame.view
    if (v.type === 'list' || v.type === 'grid') {
      if (typeof v.items === 'function') this.loadItems(frame, true)
      this.computeRows(frame)
    } else if (v.type === 'detail') {
      this.loadDetail(frame, v)
    } else if (v.type === 'form') {
      const values: Record<string, any> = {}
      for (const f of v.fields) values[f.name] = f.defaultValue ?? (f.type === 'checkbox' ? false : f.type === 'select' ? (f.options?.[0]?.value ?? '') : '')
      frame.form = { values, errors: {} }
    } else if (v.type === 'chat') {
      frame.chat = { messages: [], turns: [] }
      if (v.prompt) queueMicrotask(() => this.sendChat(frame, v.prompt!))
    }
  }

  private replaceFrame(frame: Frame, view: View) {
    const index = this.stack.indexOf(frame)
    if (index < 0) return
    const next = this.createFrame(view, frame.ext, frame.args)
    // Keep the search text when re-rendering the same kind of view.
    if (view.type === frame.view.type && !('query' in view && view.query != null)) next.query = frame.query
    if (frame === this.top && this.renderer) next.scrollTop = this.renderer.scrollTop()
    next.selectedKey = frame.itemRows[frame.selected]?.key
    next.userMoved = !!next.selectedKey
    this.destroyFrame(frame)
    this.stack[index] = next
    this.startFrame(next)
    this.invalidate()
  }

  // ─── Rows ────────────────────────────────────────────────────────────────

  computeRows(frame: Frame) {
    const v = frame.view
    let groups: { title: string; entries: { item: Item; positions?: number[] }[] }[]
    if (v.type === 'root') groups = this.rootGroups(frame)
    else if (v.type === 'list' || v.type === 'grid') groups = this.listGroups(frame, v)
    else groups = []

    const rows: Row[] = []
    const itemRows: Extract<Row, { kind: 'item' }>[] = []
    const keys = new Set<string>()
    for (const g of groups) {
      if (!g.entries.length) continue
      if (g.title) rows.push({ kind: 'section', key: `s:${g.title}`, title: g.title })
      for (const e of g.entries) {
        let key = v.type === 'root' ? this.idOf(e.item) : (e.item.id ?? `${g.title}:${e.item.title}`)
        while (keys.has(key)) key += '\''
        keys.add(key)
        const row = { kind: 'item' as const, key, item: e.item, positions: e.positions, index: itemRows.length }
        rows.push(row)
        itemRows.push(row)
      }
    }
    frame.rows = rows
    frame.itemRows = itemRows
    // Keep the top result selected while async results stream in, unless the user moved.
    if (!frame.userMoved) {
      frame.selectedKey = undefined
      frame.selected = 0
    }
    // Preserve selection by key when possible.
    if (frame.selectedKey) {
      const idx = itemRows.findIndex((r) => r.key === frame.selectedKey)
      frame.selected = idx >= 0 ? idx : Math.min(frame.selected, Math.max(0, itemRows.length - 1))
    } else frame.selected = Math.min(frame.selected, Math.max(0, itemRows.length - 1))
    frame.selectedKey = itemRows[frame.selected]?.key
  }

  private rootGroups(frame: Frame) {
    const q = frame.query.trim()
    const items = this.rootItems()
    const groups: { title: string; entries: { item: Item; positions?: number[] }[] }[] = []
    const bySection = new Map<string, { title: string; entries: { item: Item; positions?: number[] }[] }>()
    const group = (title: string) => {
      let g = bySection.get(title)
      if (!g) {
        g = { title, entries: [] }
        bySection.set(title, g)
        groups.push(g)
      }
      return g
    }

    if (!q) {
      const shown = new Set<Item>()
      const recentsLimit = this.config.recents === false ? 0 : typeof this.config.recents === 'number' ? this.config.recents : 4
      if (recentsLimit) {
        const byId = new Map(items.map((i) => [this.idOf(i), i]))
        for (const id of this.frecency.top(recentsLimit * 2)) {
          const item = byId.get(id)
          if (!item || item.searchOnly) continue
          group('Recent').entries.push({ item })
          shown.add(item)
          if (shown.size >= recentsLimit) break
        }
      }
      for (const item of items) {
        if (item.searchOnly || shown.has(item)) continue
        group(item.section ?? 'Commands').entries.push({ item })
      }
      return groups
    }

    const addSources = (position: 'top' | 'bottom') => {
      for (const source of this.sources) {
        if ((source.position ?? 'bottom') !== position) continue
        const results = frame.sourceResults?.get(source.id)
        if (!results?.length) continue
        const g = group(source.title ?? 'Results')
        const list = source.filter ? rank(results, q) : results.map((item) => ({ item, positions: matchItem(item, q)?.positions }))
        for (const r of list.slice(0, source.limit ?? 8)) g.entries.push({ item: r.item, positions: r.positions })
      }
    }
    addSources('top')
    const ranked = rank(items, q, { boost: (i) => this.frecency.score(this.idOf(i)) * 0.3, limit: 300 })
    for (const r of ranked) group(r.item.section ?? 'Commands').entries.push({ item: r.item, positions: r.positions })
    addSources('bottom')

    const fallbacks = (this.config.fallbacks ?? []).map((f, i) => {
      const item: Item = { ...f, id: `fallback:${i}`, title: f.title.replaceAll('{query}', q), subtitle: f.subtitle?.replaceAll('{query}', q) }
      return item
    })
    if (this.ai && this.aiOptions?.fallback !== false) {
      fallbacks.unshift({
        id: 'qikbar.ask-ai-fallback',
        title: `Ask ${this.aiName}`,
        subtitle: `“${q.length > 60 ? `${q.slice(0, 60)}…` : q}”`,
        icon: 'sparkles',
        accessories: [{ kbd: 'tab' }],
        noHistory: true,
        run: () => ({ type: 'chat', prompt: q }) satisfies ChatView,
      })
    }
    if (fallbacks.length) {
      const g = group(`Use “${q.length > 24 ? `${q.slice(0, 24)}…` : q}” with…`)
      for (const item of fallbacks) g.entries.push({ item })
    }
    return groups
  }

  private listGroups(frame: Frame, v: ListView | GridView) {
    const items = typeof v.items === 'function' ? (frame.items ?? []) : v.items
    const q = frame.query.trim()
    const filter = v.filter ?? typeof v.items !== 'function'
    const entries = filter && q ? rank(items, q).map((r) => ({ item: r.item, positions: r.positions })) : items.map((item) => ({ item }))
    const groups: { title: string; entries: { item: Item; positions?: number[] }[] }[] = []
    const bySection = new Map<string, (typeof groups)[number]>()
    for (const e of entries) {
      const title = e.item.section ?? ''
      let g = bySection.get(title)
      if (!g) {
        g = { title, entries: [] }
        bySection.set(title, g)
        groups.push(g)
      }
      g.entries.push(e)
    }
    return groups
  }

  // ─── Loading ─────────────────────────────────────────────────────────────

  private onQueryChange(frame: Frame, query: string) {
    if (frame.query === query) return
    frame.query = query
    const v = frame.view
    if (v.type === 'root' || v.type === 'list' || v.type === 'grid') {
      frame.selected = 0
      frame.selectedKey = undefined
      frame.userMoved = false
      if (v.type === 'root') this.searchSources(frame)
      else if (typeof v.items === 'function') this.loadItems(frame, false)
      this.computeRows(frame)
      this.renderer?.resetScroll?.()
    }
    this.invalidate()
    this.emitChange()
  }

  private searchSources(frame: Frame) {
    frame.queryController?.abort()
    const controller = new AbortController()
    frame.queryController = controller
    const q = frame.query.trim()
    const results = (frame.sourceResults ??= new Map<string, Item[]>())
    for (const source of this.sources) {
      const prev = results.get(source.id)
      if (q.length < (source.minQueryLength ?? 1)) {
        results.delete(source.id)
        continue
      }
      // Keep stale results that still match while new ones load.
      if (prev) results.set(source.id, prev.filter((item) => matchItem(item, q)))
      const run = async () => {
        if (controller.signal.aborted) return
        frame.loading++
        this.invalidate()
        try {
          const rt = this.sourceExt.get(source)
          const items = await source.search({ query: q, signal: controller.signal, ctx: this.makeContext(frame, { ext: rt, signal: controller.signal }) })
          if (controller.signal.aborted) return
          if (rt) for (const i of items) this.itemExt.set(i, rt)
          results.set(source.id, items)
        } catch (err) {
          if (!controller.signal.aborted) console.error(`[qikbar] source "${source.id}" failed`, err)
        } finally {
          frame.loading--
          if (!controller.signal.aborted && this.stack.includes(frame)) {
            this.computeRows(frame)
          }
          this.invalidate()
        }
      }
      const delay = source.debounce ?? 150
      const timer = setTimeout(run, delay)
      controller.signal.addEventListener('abort', () => clearTimeout(timer))
    }
  }

  private loadItems(frame: Frame, immediate: boolean) {
    const v = frame.view as ListView | GridView
    if (typeof v.items !== 'function') return
    const loader = v.items
    frame.queryController?.abort()
    const controller = new AbortController()
    frame.queryController = controller
    frame.controller.signal.addEventListener('abort', () => controller.abort())
    const run = async () => {
      if (controller.signal.aborted) return
      frame.loading++
      frame.error = undefined
      this.invalidate()
      try {
        const result = loader({ query: frame.query, signal: controller.signal, ctx: this.makeContext(frame, { signal: controller.signal }) })
        if (result && typeof (result as AsyncIterable<Item[]>)[Symbol.asyncIterator] === 'function') {
          for await (const batch of result as AsyncIterable<Item[]>) {
            if (controller.signal.aborted) return
            this.setItems(frame, batch)
          }
        } else {
          const items = await (result as Item[] | Promise<Item[]>)
          if (!controller.signal.aborted) this.setItems(frame, items)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          frame.error = err instanceof Error ? err.message : String(err)
          frame.items = []
          this.computeRows(frame)
        }
      } finally {
        frame.loading--
        this.invalidate()
      }
    }
    if (immediate) void run()
    else {
      const timer = setTimeout(run, v.debounce ?? 120)
      controller.signal.addEventListener('abort', () => clearTimeout(timer))
    }
  }

  private setItems(frame: Frame, items: Item[]) {
    frame.items = items
    if (frame.ext) for (const i of items) this.itemExt.set(i, frame.ext)
    this.computeRows(frame)
    this.invalidate()
  }

  private async loadDetail(frame: Frame, v: DetailView) {
    frame.detail = { text: '', done: false }
    frame.loading++
    try {
      let md = v.markdown
      if (typeof md === 'function') md = await md()
      if (typeof md === 'string') frame.detail.text = md
      else {
        for await (const chunk of md) {
          if (frame.controller.signal.aborted) return
          frame.detail.text += chunk
          this.invalidate()
        }
      }
    } catch (err) {
      if (!frame.controller.signal.aborted) frame.detail.error = err instanceof Error ? err.message : String(err)
    } finally {
      frame.detail.done = true
      frame.loading--
      this.invalidate()
    }
  }

  // ─── Context ─────────────────────────────────────────────────────────────

  makeContext(frame: Frame, extra: { ext?: ExtRuntime; args?: Record<string, string>; signal?: AbortSignal } = {}): Context {
    const ext = extra.ext ?? frame.ext
    const bar = this
    return {
      bar,
      get query() {
        return frame.query
      },
      signal: extra.signal ?? frame.controller.signal,
      preferences: ext ? ext.prefs() : {},
      arguments: extra.args ?? frame.args ?? {},
      storage: ext?.storage ?? this.storage,
      ai: this.ai,
      push: (view) => this.push(view, ext),
      pop: () => this.pop(),
      render: (view) => {
        if (this.stack.includes(frame)) this.replaceFrame(frame, view)
        else this.push(view, ext)
      },
      close: () => this.close(),
      navigate: (href, options) => this.navigate(href, options?.newTab ?? false),
      openUrl: (url) => {
        this.close()
        window.open(url, '_blank', 'noopener,noreferrer')
      },
      copy: (text) => copyText(text),
      toast: (options) => this.toast(options),
      confirm: (options) => this.confirm(options),
      setQuery: (q) => {
        if (frame === this.top) this.setQuery(q)
        else frame.query = q
      },
    }
  }

  navigate(href: string, newTab = false) {
    if (!this.isInline) this.close()
    const nav = this.config.navigate
    if (nav) return nav(href, { newTab })
    defaultNavigate(href, newTab)
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  actionsFor(item: Item | undefined, frame: Frame): Action[] {
    const builtIn = this.renderer?.frame === frame ? (this.renderer.viewActions?.() ?? []) : []
    const viewActions = [...((frame.view as View).actions ?? []), ...builtIn]
    if (!item) return viewActions
    frame.actionCache ??= new WeakMap()
    const cached = frame.actionCache.get(item)
    if (cached) return cached
    const acts: Action[] = []
    if (item.run) acts.push({ title: frame.view.type === 'root' ? 'Run Command' : 'Run', icon: 'corner-down-left', run: item.run })
    if (item.view) {
      const view = item.view
      acts.push({ title: 'Open', icon: 'chevron-right', run: (ctx) => (typeof view === 'function' ? view(ctx) : view) })
    }
    if (item.href) {
      const href = item.href
      acts.push(actionHelpers.navigate(href, { title: 'Open' }))
      acts.push(actionHelpers.navigateNewTab(href))
      acts.push(actionHelpers.copy(() => new URL(href, location.href).href, { title: 'Copy Link', icon: 'link', shortcut: 'mod+shift+c' }))
    }
    if (item.url) {
      acts.push(actionHelpers.open(item.url))
      acts.push(actionHelpers.copy(item.url, { title: 'Copy URL', icon: 'link', shortcut: 'mod+shift+c' }))
    }
    if (item.actions) acts.push(...item.actions)
    acts.push(...viewActions)
    const rt = this.itemExt.get(item)
    if (frame.view.type === 'root' && rt?.ext.preferences?.length) {
      acts.push({
        title: `Configure ${rt.ext.title}`,
        icon: 'settings',
        section: 'Extension',
        run: () => this.preferencesForm(rt),
      })
    }
    if (frame.view.type === 'root' && this.frecency.score(this.idOf(item)) > 0) {
      acts.push({
        title: 'Clear Recent History',
        icon: 'history',
        section: 'History',
        keepOpen: true,
        run: () => {
          this.frecency.clear()
          this.computeRows(frame)
          this.invalidate()
          return false
        },
      })
    }
    frame.actionCache.set(item, acts)
    return acts
  }

  selectedItem(frame = this.top): Item | undefined {
    if (!frame) return undefined
    return frame.itemRows[frame.selected]?.item
  }

  async runAction(frame: Frame, item: Item | undefined, act: Action, args?: Record<string, string>) {
    if (item?.arguments?.length && !args) {
      this.enterArgMode(frame, item, act)
      return
    }
    const rt = (item && this.itemExt.get(item)) ?? frame.ext
    if (item && rt && rt.missing().length) {
      this.push(this.preferencesForm(rt, () => this.runAction(frame, item, act, args)), rt)
      return
    }
    if (item && frame.view.type === 'root' && !item.noHistory) this.frecency.record(this.idOf(item))
    if (item) {
      this.config.onRun?.(item, act)
      this.emit('run', { item, action: act })
    }
    let handled = false
    const base = this.makeContext(frame, { ext: rt, args })
    const ctx: Context = Object.create(base, {
      push: { value: (v: View) => ((handled = true), base.push(v)) },
      render: { value: (v: View) => ((handled = true), base.render(v)) },
      pop: { value: () => ((handled = true), base.pop()) },
      close: { value: () => ((handled = true), base.close()) },
      navigate: { value: (href: string, o?: { newTab?: boolean }) => ((handled = true), base.navigate(href, o)) },
      openUrl: { value: (url: string) => ((handled = true), base.openUrl(url)) },
    })
    frame.loading++
    this.invalidate()
    try {
      const result = await act.run(ctx)
      if (isView(result)) this.push(result, rt)
      else if (result === false || act.keepOpen || handled) {
        // Stay open.
      } else this.close()
    } catch (err) {
      console.error(err)
      this.toast({ style: 'failure', title: 'Something went wrong', message: err instanceof Error ? err.message : String(err) })
    } finally {
      frame.loading--
      this.invalidate()
    }
  }

  runPrimary(frame = this.top, index = 0) {
    if (!frame) return
    const item = this.selectedItem(frame)
    const act = this.actionsFor(item, frame)[index]
    if (act) void this.runAction(frame, item, act)
  }

  preferencesForm(rt: ExtRuntime, then?: () => void): FormView {
    const values = rt.prefs()
    return {
      type: 'form',
      title: `Configure ${rt.ext.title}`,
      submitLabel: then ? 'Save and Continue' : 'Save',
      fields: (rt.ext.preferences ?? []).map((p) => ({
        name: p.name,
        label: p.title,
        description: p.description,
        type: p.type === 'text' ? 'text' : p.type,
        required: p.required,
        placeholder: p.placeholder,
        options: p.options,
        defaultValue: values[p.name] ?? p.default,
      })),
      onSubmit: (vals) => {
        const stored = rt.storage.get<Record<string, any>>('preferences') ?? {}
        rt.storage.set('preferences', { ...stored, ...vals })
        this.toast({ style: 'success', title: 'Preferences saved' })
        this.pop()
        then?.()
        return false
      },
    }
  }

  // ─── Arguments ───────────────────────────────────────────────────────────

  private enterArgMode(frame: Frame, item: Item, act: Action) {
    this.argMode = { item, action: act, frame, values: {} }
    this.closePanel()
    this.flush()
    ;(this.dom?.args.querySelector('input,select') as HTMLElement | null)?.focus()
  }

  private submitArgs() {
    const m = this.argMode
    if (!m || !this.dom) return
    const missing = (m.item.arguments ?? []).find((a) => a.required && !m.values[a.name]?.trim())
    if (missing) {
      ;(this.dom.args.querySelector(`[name="${CSS.escape(missing.name)}"]`) as HTMLElement | null)?.focus()
      return
    }
    this.argMode = undefined
    void this.runAction(m.frame, m.item, m.action, m.values)
    this.flush()
  }

  // ─── AI chat ─────────────────────────────────────────────────────────────

  sendChat(frame: Frame, text: string) {
    const chat = frame.chat
    if (!chat || !this.aiOptions || !text.trim()) return
    if (chat.controller && !chat.controller.signal.aborted) return
    const controller = new AbortController()
    frame.controller.signal.addEventListener('abort', () => controller.abort())
    chat.controller = controller
    chat.messages.push({ role: 'user', content: text })
    chat.turns.push({ role: 'user', text, tools: [] })
    const turn: ChatTurn = { role: 'assistant', text: '', tools: [], streaming: true }
    chat.turns.push(turn)
    if (frame === this.top && this.dom) {
      this.dom.input.value = ''
      frame.query = ''
    }
    frame.loading++
    this.invalidate()
    const view = frame.view as ChatView
    const useTools = view.tools !== false && this.aiOptions.tools !== false
    const run = async () => {
      try {
        for await (const ev of runAgent({
          provider: this.aiOptions!.provider,
          messages: chat.messages,
          system: view.system ?? this.systemPrompt(useTools),
          tools: useTools ? this.agentTools(frame) : [],
          maxSteps: this.aiOptions!.maxSteps ?? 6,
          signal: controller.signal,
        })) {
          if (ev.type === 'text') turn.text += ev.text
          else if (ev.type === 'message') chat.messages.push(ev.message)
          else if (ev.type === 'tool_start') {
            if (turn.text && !/\n\s*$/.test(turn.text)) turn.text += '\n\n'
            turn.tools.push({ label: ev.label, state: 'running' })
          } else if (ev.type === 'tool_end') {
            const t = turn.tools.find((x) => x.state === 'running')
            if (t) t.state = ev.ok ? 'done' : 'error'
          } else if (ev.type === 'error') turn.error = ev.error
          this.invalidate()
        }
      } catch (err) {
        if (!controller.signal.aborted) turn.error = err instanceof Error ? err.message : String(err)
      } finally {
        turn.streaming = false
        for (const t of turn.tools) if (t.state === 'running') t.state = 'error'
        frame.loading--
        chat.controller = undefined
        this.invalidate()
      }
    }
    void run()
  }

  stopChat(frame: Frame): boolean {
    const c = frame.chat?.controller
    if (c && !c.signal.aborted) {
      c.abort()
      return true
    }
    return false
  }

  private systemPrompt(withTools: boolean): string {
    const lines = [
      `You are ${this.aiName}, the assistant built into this web app's command bar.`,
      'Answer concisely in Markdown. Prefer short paragraphs and lists.',
    ]
    if (typeof document !== 'undefined') lines.push(`The user is on the page "${document.title}" (${location.pathname}).`)
    if (withTools) {
      const items = this.rootItems().filter((i) => !i.id?.startsWith('qikbar.'))
      lines.push(
        '',
        'You can act inside the app:',
        '- Call `run` with an item id to open a page or run a command when the user asks you to go somewhere or do something.',
        '- Call `search` to find commands, pages and records that are not listed below.',
        'Only call tools when the user wants something done or found in the app; otherwise just answer. After acting, confirm briefly what you did.',
        '',
        'Available items (id | title | section):',
        ...items.slice(0, 80).map((i) => `${this.idOf(i)} | ${i.title}${i.subtitle ? ` — ${i.subtitle}` : ''} | ${i.section ?? 'Commands'}`),
      )
      if (items.length > 80) lines.push(`…and ${items.length - 80} more (use search).`)
    }
    if (this.aiOptions?.system) lines.push('', this.aiOptions.system)
    return lines.join('\n')
  }

  private agentTools(chatFrame: Frame): RuntimeTool[] {
    const found = new Map<string, Item>()
    const lookup = (id: string) => found.get(id) ?? this.rootItems().find((i) => this.idOf(i) === id)
    const tools: RuntimeTool[] = [
      {
        definition: {
          name: 'search',
          description: "Search the app's commands, pages and records (including results from connected data sources). Returns matching items with ids you can pass to `run`.",
          parameters: { type: 'object', properties: { query: { type: 'string', description: 'What to look for' } }, required: ['query'] },
        },
        label: (a) => `Searching “${String(a.query ?? '')}”`,
        run: async (args, signal) => {
          const q = String(args.query ?? '')
          const local = rank(this.rootItems(), q, { limit: 10 }).map((r) => r.item)
          const remote = await Promise.all(
            [...this.sources].map(async (s) => {
              if (q.length < (s.minQueryLength ?? 1)) return []
              try {
                const rt = this.sourceExt.get(s)
                const items = await withTimeout(s.search({ query: q, signal, ctx: this.makeContext(chatFrame, { ext: rt, signal }) }), 6000)
                if (rt) for (const i of items) this.itemExt.set(i, rt)
                return items.slice(0, s.limit ?? 8).map((i) => ({ item: i, section: s.title ?? s.id }))
              } catch {
                return []
              }
            }),
          )
          const all = [...local.map((item) => ({ item, section: item.section ?? 'Commands' })), ...remote.flat()]
          if (!all.length) return 'No results.'
          return all.map(({ item, section }, n) => {
            const id = item.id && !found.has(item.id) ? item.id : `${section}#${n}`
            found.set(id, item)
            return { id, title: item.title, subtitle: item.subtitle, section, description: item.description, href: item.href ?? item.url }
          })
        },
      },
      {
        definition: {
          name: 'run',
          description: 'Open or run an item (page, command or record) by id. Use ids from the system prompt or from `search`.',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              arguments: { type: 'object', description: 'Values for the command arguments, if it has any.', additionalProperties: { type: 'string' } },
            },
            required: ['id'],
          },
        },
        label: (a) => {
          const item = lookup(String(a.id ?? ''))
          return item ? `Opening ${item.title}` : `Running ${String(a.id ?? '')}`
        },
        run: async (args) => {
          const item = lookup(String(args.id ?? ''))
          if (!item) throw new Error(`No item with id "${String(args.id)}". Use search first.`)
          const rt = this.itemExt.get(item)
          if (rt?.missing().length) throw new Error(`${rt.ext.title} needs to be configured first. Ask the user to open it from the command bar.`)
          const act = this.actionsFor(item, this.stack[0] ?? chatFrame)[0]
          if (!act) throw new Error('This item has no action.')
          if (act.style === 'destructive' && !(await this.confirm({ title: `${act.title}?`, message: item.title, destructive: true, confirmLabel: act.title })))
            return 'The user cancelled.'
          if (item.href) {
            const nav = this.config.navigate
            if (nav) nav(item.href, { newTab: false })
            else defaultNavigate(item.href, false)
            this.frecency.record(this.idOf(item))
            return `Navigated to ${item.href}.`
          }
          if (item.url) {
            window.open(item.url, '_blank', 'noopener,noreferrer')
            return `Opened ${item.url} in a new tab.`
          }
          const strArgs = Object.fromEntries(Object.entries((args.arguments as Record<string, unknown>) ?? {}).map(([k, v]) => [k, String(v)]))
          const ctx = Object.create(this.makeContext(chatFrame, { ext: rt, args: strArgs }), {
            close: { value: () => {} },
          }) as Context
          const result = await act.run(ctx)
          this.frecency.record(this.idOf(item))
          if (isView(result)) {
            this.push(result, rt)
            return `Opened the "${item.title}" view for the user.`
          }
          return `Ran "${item.title}".`
        },
      },
    ]
    if (this.aiOptions?.pageContext !== false && typeof document !== 'undefined') {
      tools.push({
        definition: {
          name: 'read_page',
          description: 'Read the visible text of the page the user is currently on. Use it when the user asks about "this page" or its content.',
          parameters: { type: 'object', properties: {} },
        },
        label: () => 'Reading this page',
        run: async () => {
          const main = document.querySelector('main, [role=main], article') ?? document.body
          const text = (main as HTMLElement).innerText.replace(/\n{3,}/g, '\n\n').trim()
          return `# ${document.title}\nURL: ${location.href}\n\n${text.slice(0, 20000)}`
        },
      })
    }
    const addTools = (list: Tool[], rt: ExtRuntime | undefined, prefix: string) => {
      for (const tool of list) {
        tools.push({
          definition: {
            name: toolName(prefix ? `${prefix}__${tool.name}` : tool.name),
            description: tool.description,
            parameters: tool.parameters ?? { type: 'object', properties: {} },
          },
          label: () => tool.description.split(/[.\n]/)[0]!.slice(0, 60),
          run: async (args) => {
            if (tool.confirm) {
              const msg = typeof tool.confirm === 'function' ? tool.confirm(args) : `Allow ${this.aiName} to ${tool.name}?`
              if (!(await this.confirm({ title: msg, confirmLabel: 'Allow' }))) return 'The user declined.'
            }
            return tool.run(args, this.makeContext(chatFrame, { ext: rt }))
          },
        })
      }
    }
    addTools(this.config.tools ?? [], undefined, '')
    for (const e of this.extensions.values()) addTools(e.rt.ext.tools ?? [], e.rt, e.rt.ext.name)
    return tools
  }

  // ─── Toasts & confirm ────────────────────────────────────────────────────

  toast(options: ToastOptions | string): ToastHandle {
    const opts: ToastOptions = typeof options === 'string' ? { title: options } : options
    const id = ++this.toastId
    const schedule = () => {
      clearTimeout(this.toastTimer)
      const s = this.toastState
      if (!s) return
      const duration = s.duration ?? (s.style === 'loading' ? 0 : 2600)
      if (duration > 0) this.toastTimer = setTimeout(() => hide(), duration)
    }
    const hide = () => {
      if (this.toastState?.id !== id) return
      this.toastState = undefined
      this.renderToast()
    }
    this.toastState = { ...opts, id }
    schedule()
    this.renderToast()
    return {
      update: (p) => {
        if (this.toastState?.id !== id) return
        this.toastState = { ...this.toastState, ...p }
        schedule()
        this.renderToast()
      },
      hide,
    }
  }

  confirm(options: ConfirmOptions | string): Promise<boolean> {
    const opts: ConfirmOptions = typeof options === 'string' ? { title: options } : options
    if (!this._open || !this.dom) {
      return Promise.resolve(typeof window !== 'undefined' ? window.confirm(opts.message ? `${opts.title}\n\n${opts.message}` : opts.title) : false)
    }
    this.confirmState?.resolve(false)
    return new Promise((resolve) => {
      this.confirmState = {
        ...opts,
        resolve: (ok) => {
          this.confirmState = undefined
          this.renderLayer()
          this.focusInput()
          resolve(ok)
        },
      }
      this.renderLayer()
    })
  }

  // ─── Keyboard ────────────────────────────────────────────────────────────

  private onGlobalKeyDown = (e: KeyboardEvent) => {
    if (this.destroyed || e.defaultPrevented || e.isComposing) return
    const hotkeys = this.config.hotkey === false ? [] : ([] as string[]).concat(this.config.hotkey ?? 'mod+k')
    const inField = isEditable(e.target)
    if (hotkeys.some((hk) => matchesHotkey(e, hk) && (!inField || allowedInInput(hk)))) {
      e.preventDefault()
      e.stopPropagation()
      if (this.isInline) {
        this.open()
        this.focusInput()
      } else this.toggle()
      return
    }
    if (this._open && !this.isInline) return
    if (this.isInline && this.dom?.root.contains(e.target as Node)) return
    if (this.config.shortcuts === false) return
    this.rootItems()
    if (!this.shortcutItems.length) return
    const candidates = this.shortcutItems.map((i) => i.shortcut!).filter((s) => !inField || allowedInInput(s))
    const matched = this.seq.feed(e, candidates)
    if (!matched.length) return
    const item = this.shortcutItems.find((i) => i.shortcut === matched[0])
    if (!item) return
    e.preventDefault()
    const frame = this.createFrame({ type: 'root' })
    const act = this.actionsFor(item, frame)[0]
    if (act) void this.runAction(frame, item, act)
  }

  private onGlobalClick = (e: MouseEvent) => {
    const trigger = (e.target as Element | null)?.closest?.('[data-qikbar-open]')
    if (!trigger || this.destroyed) return
    const target = trigger.getAttribute('data-qikbar-open')
    if (target ? target !== this.instanceId && target !== this.config.namespace : this.isInline) return
    e.preventDefault()
    this.open({ query: trigger.getAttribute('data-qikbar-query') ?? undefined })
  }

  private onDialogKeyDown = (e: KeyboardEvent) => {
    // Keys typed in the bar belong to the bar: don't trigger the host app's shortcuts.
    e.stopPropagation()
    if (e.isComposing || e.keyCode === 229) return
    const frame = this.top
    if (!frame) return

    if (this.confirmState) {
      if (e.key === 'Escape') {
        e.preventDefault()
        this.confirmState.resolve(false)
      } else if (e.key === 'Tab') {
        const buttons = [...(this.dom?.layer.querySelectorAll('button') ?? [])] as HTMLElement[]
        const i = buttons.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
      }
      e.stopPropagation()
      return
    }

    if (this.panel) {
      if (this.onPanelKey(e)) {
        e.preventDefault()
        e.stopPropagation()
      }
      return
    }

    if (this.argMode) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        this.argMode = undefined
        this.flush()
        this.focusInput()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        this.submitArgs()
        return
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.escape()
      return
    }

    if (matchesHotkey(e, this.actionsHotkey)) {
      e.preventDefault()
      this.openPanel()
      return
    }

    if (this.renderer?.onKey(e)) {
      e.preventDefault()
      return
    }

    // Action shortcuts.
    const actions = this.actionsFor(this.selectedItem(frame), frame)
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && frame.view.type !== 'form') {
      const second = actions[1]
      if (second && !second.shortcut) {
        e.preventDefault()
        void this.runAction(frame, this.selectedItem(frame), second)
        return
      }
    }
    for (const act of actions) {
      if (act.shortcut && matchesHotkey(e, act.shortcut)) {
        e.preventDefault()
        void this.runAction(frame, this.selectedItem(frame), act)
        return
      }
    }

    if (e.key === 'Backspace' && this.stack.length > 1 && e.target === this.dom?.input && !this.dom.input.value && !e.repeat) {
      e.preventDefault()
      this.pop()
    }
  }

  escape() {
    const frame = this.top
    if (!frame) return
    if (frame.chat && this.stopChat(frame)) return
    if (this.stack.length > 1) return this.pop()
    if (frame.query) return this.setQuery('')
    this.close()
  }

  // ─── Action panel ────────────────────────────────────────────────────────

  openPanel() {
    const frame = this.top
    if (!frame || !this.dom) return
    if (this.panel) return this.closePanel()
    const item = this.selectedItem(frame)
    const actions = this.actionsFor(item, frame)
    if (!actions.length) return
    this.panel = { item, actions, filter: '', selected: 0 }
    this.renderPanel()
  }

  closePanel() {
    if (!this.panel) return
    this.panel.el?.remove()
    this.panel = undefined
    this.focusInput()
  }

  private panelActions(): Action[] {
    const p = this.panel!
    return p.filter ? rank(p.actions as unknown as Item[], p.filter).map((r) => r.item as unknown as Action) : p.actions
  }

  private onPanelKey(e: KeyboardEvent): boolean {
    const p = this.panel!
    const list = this.panelActions()
    if (e.key === 'Escape' || matchesHotkey(e, this.actionsHotkey)) {
      this.closePanel()
      return true
    }
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
      p.selected = (p.selected + 1) % Math.max(1, list.length)
      this.renderPanel()
      return true
    }
    if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      p.selected = (p.selected - 1 + list.length) % Math.max(1, list.length)
      this.renderPanel()
      return true
    }
    if (e.key === 'Enter') {
      const act = list[p.selected]
      if (act) this.runFromPanel(act)
      return true
    }
    for (const act of p.actions) {
      if (act.shortcut && matchesHotkey(e, act.shortcut)) {
        this.runFromPanel(act)
        return true
      }
    }
    return false
  }

  private runFromPanel(act: Action) {
    const item = this.panel?.item
    const frame = this.top!
    this.closePanel()
    void this.runAction(frame, item, act)
  }

  private renderPanel() {
    const p = this.panel
    const dom = this.dom
    if (!p || !dom) return
    if (!p.el) {
      p.list = h('div', { class: 'qb-actions-list', role: 'listbox', id: `${this.instanceId}-actions` })
      p.input = h('input', {
        class: 'qb-actions-input',
        placeholder: 'Search for actions…',
        'aria-label': 'Search actions',
        autocomplete: 'off',
        spellcheck: 'false',
        onInput: () => {
          p.filter = p.input!.value
          p.selected = 0
          this.renderPanel()
        },
      })
      p.el = h(
        'div',
        { class: this.cls('qb-actions', 'actions'), role: 'dialog', 'aria-label': 'Actions' },
        h('div', { class: 'qb-actions-title' }, p.item?.title ?? 'Actions'),
        p.list,
        p.input,
      )
      p.el.addEventListener('pointerdown', (e) => {
        if (e.target !== p.input) e.preventDefault()
      })
      dom.dialog.append(p.el)
      p.input.focus()
    }
    const list = this.panelActions()
    p.selected = Math.min(p.selected, Math.max(0, list.length - 1))
    const children: HTMLElement[] = []
    let section: string | undefined
    list.forEach((act, i) => {
      if (!p.filter && act.section && act.section !== section) children.push(h('div', { class: 'qb-section' }, act.section))
      section = act.section
      const shortcut = act.shortcut ?? (i === 0 && !p.filter ? 'enter' : i === 1 && !p.filter ? 'mod+enter' : undefined)
      const el = h(
        'div',
        {
          class: 'qb-action',
          role: 'option',
          id: `${this.instanceId}-action-${i}`,
          'aria-selected': i === p.selected ? 'true' : 'false',
          'data-style': act.style ?? 'default',
          onClick: () => this.runFromPanel(act),
          onPointermove: () => {
            if (p.selected !== i) {
              p.selected = i
              this.renderPanel()
            }
          },
        },
        renderIcon(act.icon ?? 'dot', 15),
        h('span', { class: 'qb-action-title' }, act.title),
        shortcut ? renderKbd(shortcut) : null,
      )
      children.push(el)
    })
    if (!list.length) children.push(h('div', { class: 'qb-empty-desc', style: 'padding:10px 8px' }, 'No matching actions'))
    p.list!.replaceChildren(...children)
    p.input!.setAttribute('aria-activedescendant', `${this.instanceId}-action-${p.selected}`)
    p.list!.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' })
  }

  // ─── DOM ─────────────────────────────────────────────────────────────────

  cls(base: string, slot: keyof NonNullable<QikbarConfig['classNames']>): string {
    const extra = this.config.classNames?.[slot]
    return extra ? `${base} ${extra}` : base
  }

  private injectStyles() {
    if (this.config.unstyled || typeof document === 'undefined') return
    const existing = document.getElementById('qikbar-styles') as HTMLStyleElement | null
    if (existing) return
    const style = document.createElement('style')
    style.id = 'qikbar-styles'
    if (this.config.nonce) style.nonce = this.config.nonce
    style.textContent = css
    document.head.append(style)
    this.styleEl = style
  }

  private mount() {
    if (this.dom || typeof document === 'undefined') return
    this.injectStyles()
    const id = this.instanceId
    const input = h('input', {
      class: this.cls('qb-input', 'input'),
      type: 'text',
      role: 'combobox',
      autocomplete: 'off',
      autocorrect: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      enterkeyhint: 'go',
      'aria-autocomplete': 'list',
      'aria-expanded': 'true',
      'aria-controls': `${id}-list`,
      'aria-label': 'Search',
    })
    input.addEventListener('input', () => {
      const frame = this.top
      if (frame) this.onQueryChange(frame, input.value)
    })
    const back = h('button', { class: 'qb-back', type: 'button', 'aria-label': 'Back', title: 'Back', html: '' })
    back.append(renderIcon('arrow-left', 15)!)
    back.addEventListener('click', () => this.pop())
    const hint = h('button', { class: 'qb-hint', type: 'button' })
    hint.addEventListener('click', () => this.ask(this.top?.query))
    const progress = h('div', { class: 'qb-progress', 'aria-hidden': 'true' })
    const header = h(
      'div',
      { class: this.cls('qb-header', 'header') },
      back,
      h('div', { class: 'qb-crumb' }),
      h('span', { class: 'qb-header-icon' }, renderIcon('search', 18)),
      input,
      h('div', { class: 'qb-args', style: 'display:contents' }),
      h('div', { class: 'qb-title' }),
      hint,
      progress,
    )
    const body = h('div', { class: 'qb-body' })
    const footerLeft = h('div', { class: 'qb-footer-left', 'aria-live': 'polite' })
    const footerRight = h('div', { class: 'qb-footer-right' })
    const footer = h('div', { class: this.cls('qb-footer', 'footer') }, footerLeft, footerRight)
    const layer = h('div', { style: 'display:contents' })
    const dialog = h(
      'div',
      { class: this.cls('qb-dialog', 'dialog'), role: 'dialog', 'aria-modal': this.isInline ? 'false' : 'true', 'aria-label': 'Command bar', tabindex: '-1', hidden: true },
      header,
      body,
      footer,
      layer,
    )
    const overlay = h('div', { class: this.cls('qb-overlay', 'overlay'), hidden: true })
    overlay.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.close()
    })
    const live = h('div', { class: 'qb-sr-only', 'aria-live': 'polite' })
    const root = h('div', { class: this.cls('qb-root', 'root'), 'data-qb-state': 'closed', id }, overlay, dialog, live)
    if (this.config.dir) root.dir = this.config.dir
    dialog.addEventListener('keydown', this.onDialogKeyDown)
    dialog.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest?.('[data-qb-copy]')
      if (btn) {
        const code = btn.closest('.qb-code')?.querySelector('code')?.textContent ?? ''
        void copyText(code).then((ok) => {
          btn.textContent = ok ? 'Copied' : 'Failed'
          setTimeout(() => (btn.textContent = 'Copy'), 1200)
        })
      }
      if (this.panel && !(e.target as Element).closest?.('.qb-actions') && !(e.target as Element).closest?.('.qb-footer-btn')) this.closePanel()
    })
    const inline = this.inlineTarget()
    if (inline) {
      root.dataset.qbInline = ''
      inline.append(root)
    } else (this.config.container ?? document.body).append(root)

    this.dom = {
      root,
      overlay,
      dialog,
      header,
      back,
      crumb: header.querySelector('.qb-crumb')!,
      searchIcon: header.querySelector('.qb-header-icon')!,
      input,
      args: header.querySelector('.qb-args')!,
      title: header.querySelector('.qb-title')!,
      hint,
      progress,
      body,
      footer,
      footerLeft,
      footerRight,
      layer,
      live,
    }
    this.applyTheme()
    this.watchAppearance()
    // Keep focus inside the modal.
    this.listen(document, 'focusin', ((e: FocusEvent) => {
      if (this._open && !this.isInline && this.dom && !this.dom.root.contains(e.target as Node)) this.focusInput()
    }) as EventListener)
  }

  private applyClassNames() {
    const d = this.dom
    if (!d) return
    d.root.className = this.cls('qb-root', 'root')
    d.overlay.className = this.cls('qb-overlay', 'overlay')
    d.dialog.className = this.cls('qb-dialog', 'dialog')
    d.header.className = this.cls('qb-header', 'header')
    d.input.className = this.cls('qb-input', 'input')
    d.footer.className = this.cls('qb-footer', 'footer')
    if (this.renderer) {
      this.renderer.destroy()
      this.renderer = undefined
      this.flush()
    }
  }

  private resolveAppearance(): 'light' | 'dark' {
    const a = this.config.appearance ?? 'auto'
    if (typeof a === 'function') return a()
    if (a !== 'auto') return a
    const html = document.documentElement
    const body = document.body
    const darkAttr = (el: HTMLElement | null) =>
      !!el && (el.classList.contains('dark') || el.dataset.theme === 'dark' || el.dataset.mode === 'dark' || el.dataset.colorScheme === 'dark' || el.dataset.bsTheme === 'dark')
    const lightAttr = (el: HTMLElement | null) =>
      !!el && (el.classList.contains('light') || el.dataset.theme === 'light' || el.dataset.mode === 'light' || el.dataset.colorScheme === 'light' || el.dataset.bsTheme === 'light')
    if (darkAttr(html) || darkAttr(body)) return 'dark'
    if (lightAttr(html) || lightAttr(body)) return 'light'
    const scheme = html.style.colorScheme || getComputedStyle(html).colorScheme
    if (scheme === 'dark') return 'dark'
    if (scheme === 'light') return 'light'
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  applyTheme() {
    const root = this.dom?.root
    if (!root) return
    const { vars, appearance } = resolveThemeVars(this.config.theme, this.resolveAppearance())
    root.dataset.qbAppearance = appearance
    const preset = typeof this.config.theme === 'string' ? this.config.theme : this.config.theme?.preset
    if (preset) root.dataset.qbTheme = preset
    else delete root.dataset.qbTheme
    for (const name of this.appliedVars) root.style.removeProperty(name)
    this.appliedVars = []
    for (const [k, v] of Object.entries(vars)) {
      if (v == null || v === '') continue
      const name = cssVarName(k)
      root.style.setProperty(name, v)
      this.appliedVars.push(name)
    }
  }

  private watchAppearance() {
    if (typeof MutationObserver === 'undefined') return
    const update = () => {
      if (this.dom && (this.config.appearance ?? 'auto') === 'auto') this.applyTheme()
    }
    const mo = new MutationObserver(update)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-mode', 'data-color-scheme', 'data-bs-theme', 'style'] })
    if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-mode'] })
    this.teardown.push(() => mo.disconnect())
    if (typeof matchMedia !== 'undefined') {
      const mq = matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener?.('change', update)
      this.teardown.push(() => mq.removeEventListener?.('change', update))
    }
  }

  private lockScroll() {
    const html = document.documentElement
    const scrollbar = window.innerWidth - html.clientWidth
    this.scrollLock = { overflow: html.style.overflow, paddingRight: html.style.paddingRight }
    html.style.overflow = 'hidden'
    if (scrollbar > 0) html.style.paddingRight = `${scrollbar}px`
  }

  private unlockScroll() {
    if (!this.scrollLock) return
    const html = document.documentElement
    html.style.overflow = this.scrollLock.overflow
    html.style.paddingRight = this.scrollLock.paddingRight
    this.scrollLock = undefined
  }

  focusInput() {
    if (!this.dom || !this._open) return
    const target = this.renderer?.focusTarget?.() ?? (this.dom.input.hidden ? this.dom.dialog : this.dom.input)
    if (document.activeElement !== target) target.focus({ preventScroll: true })
  }

  // ─── Rendering ───────────────────────────────────────────────────────────

  invalidate() {
    if (this.scheduled || !this.dom) return
    this.scheduled = true
    queueMicrotask(() => {
      this.scheduled = false
      this.flush()
    })
  }

  flush() {
    const dom = this.dom
    const frame = this.top
    if (!dom || !frame || (!this._open && !this.isInline)) return
    if (!this.renderer || this.renderer.frame !== frame) {
      this.renderer?.destroy()
      this.renderer = this.createRenderer(frame)
      dom.body.replaceChildren(this.renderer.el)
      this.renderer.update()
      if (frame.scrollTop) this.renderer.restoreScroll(frame.scrollTop)
      if (frame.selected > 0) this.renderer.ensureVisible?.()
    } else this.renderer.update()
    this.renderHeader(frame)
    this.renderFooter(frame)
    this.renderLayer()
    if (this.panel) this.renderPanel()
  }

  private createRenderer(frame: Frame): ViewRenderer {
    switch (frame.view.type) {
      case 'grid':
        return new GridRenderer(this, frame)
      case 'detail':
        return new DetailRenderer(this, frame)
      case 'form':
        return new FormRenderer(this, frame)
      case 'chat':
        return new ChatRenderer(this, frame)
      default:
        return new ListRenderer(this, frame)
    }
  }

  private renderHeader(frame: Frame) {
    const dom = this.dom!
    const v = frame.view
    const depth = this.stack.length
    const hasInput = this.renderer?.hasInput ?? true
    dom.back.hidden = depth <= 1
    const crumbTitle = depth > 1 ? ((v as View).title ?? (v.type === 'chat' ? this.aiName : undefined)) : undefined
    dom.crumb.hidden = !crumbTitle || !hasInput
    if (crumbTitle && hasInput) {
      dom.crumb.replaceChildren(...[renderIcon(frame.ext?.ext.icon, 13), h('span', null, crumbTitle)].filter(Boolean) as Node[])
    }
    dom.searchIcon.hidden = depth > 1 || !!this.argMode

    // Argument mode replaces the input with argument fields.
    if (this.argMode) {
      const m = this.argMode
      dom.input.hidden = true
      dom.title.hidden = true
      if (dom.args.dataset.for !== this.idOf(m.item)) {
        dom.args.dataset.for = this.idOf(m.item)
        const fields = (m.item.arguments ?? []).map((a) => {
          if (a.type === 'dropdown') {
            const sel = h(
              'select',
              { class: 'qb-arg', name: a.name, 'aria-label': a.placeholder ?? a.name },
              ...(a.options ?? []).map((o) => h('option', { value: o.value }, o.title)),
            )
            m.values[a.name] = sel.value
            sel.addEventListener('change', () => (m.values[a.name] = sel.value))
            return sel
          }
          const inp = h('input', {
            class: 'qb-arg',
            name: a.name,
            type: a.type === 'password' ? 'password' : 'text',
            placeholder: `${a.placeholder ?? a.name}${a.required ? '' : ' (optional)'}`,
            'aria-label': a.placeholder ?? a.name,
            autocomplete: 'off',
            spellcheck: 'false',
          })
          inp.addEventListener('input', () => (m.values[a.name] = inp.value))
          return inp
        })
        dom.args.replaceChildren(h('span', { class: 'qb-arg-cmd' }, renderIcon(m.item.icon, 16), m.item.title), ...fields)
      }
      dom.args.hidden = false
    } else {
      dom.args.hidden = true
      delete dom.args.dataset.for
      dom.args.replaceChildren()
      dom.input.hidden = !hasInput
      dom.title.hidden = hasInput
      if (!hasInput) dom.title.textContent = (v as View).title ?? ''
      const placeholder =
        this.renderer?.placeholder?.() ?? (v as View).placeholder ?? (v.type === 'root' ? (this.config.placeholder ?? 'Search for commands, pages and more…') : 'Search…')
      if (dom.input.placeholder !== placeholder) dom.input.placeholder = placeholder
      if (dom.input.value !== frame.query) dom.input.value = frame.query
    }

    const selected = frame.itemRows[frame.selected]
    if (selected && (v.type === 'root' || v.type === 'list' || v.type === 'grid')) dom.input.setAttribute('aria-activedescendant', `${this.instanceId}-opt-${selected.key.replace(/[^\w-]/g, '_')}`)
    else dom.input.removeAttribute('aria-activedescendant')

    // AI hint.
    const showHint = !!this.ai && v.type === 'root' && !this.argMode && this.aiOptions?.fallback !== false
    dom.hint.hidden = !showHint
    if (showHint && !dom.hint.childElementCount) dom.hint.append(h('span', null, `Ask ${this.aiName}`), renderKbd('tab'))

    if (frame.loading > 0) dom.progress.dataset.active = ''
    else delete dom.progress.dataset.active
  }

  private renderFooter(frame: Frame) {
    const dom = this.dom!
    if (!this.toastState || !this._open) this.renderFooterLeft(frame)
    else this.renderToast()
    const right: Node[] = []
    const custom = this.renderer?.footerPrimary?.()
    const actions = this.actionsFor(this.selectedItem(frame), frame)
    const primary = custom ?? (actions[0] ? { title: actions[0].title, hotkey: 'enter', run: () => this.runPrimary(frame) } : undefined)
    if (this.argMode) {
      right.push(this.footerButton(`Run ${this.argMode.item.title}`, 'enter', () => this.submitArgs(), true))
    } else if (primary) {
      right.push(this.footerButton(primary.title, primary.hotkey, primary.run, true))
    }
    if (actions.length > (custom ? 0 : 1) && !this.argMode) {
      right.push(h('span', { class: 'qb-footer-sep' }), this.footerButton('Actions', this.actionsHotkey, () => this.openPanel()))
    }
    dom.footerRight.replaceChildren(...right)
  }

  private renderFooterLeft(frame: Frame) {
    const dom = this.dom!
    const v = frame.view
    const left: Node[] = []
    if (this.stack.length > 1 && (v as View).title) {
      const icon = renderIcon(frame.ext?.ext.icon ?? 'layers', 14)
      if (icon) left.push(icon)
      left.push(h('span', null, (v as View).title!))
    } else if (this.config.footer) left.push(h('span', null, this.config.footer))
    else if (this.config.branding) {
      const a = h('a', { class: 'qb-brand', href: 'https://qikbar.com', target: '_blank', rel: 'noopener' }, renderIcon('command', 13), 'qikbar')
      left.push(a)
    }
    dom.footerLeft.replaceChildren(...left)
  }

  private footerButton(title: string, hotkey: string, run: () => void, primary = false) {
    const btn = h('button', { class: `qb-footer-btn${primary ? ' qb-primary' : ''}`, type: 'button' }, h('span', null, title), renderKbd(hotkey))
    btn.addEventListener('pointerdown', (e) => e.preventDefault())
    btn.addEventListener('click', run)
    return btn
  }

  private renderToast() {
    const t = this.toastState
    const iconFor = (style?: string) => (style === 'success' ? 'check-circle' : style === 'failure' ? 'x-circle' : style === 'loading' ? 'loader' : 'info')
    const build = (cls: string) => {
      const icon = renderIcon(iconFor(t!.style), 14)!
      if (t!.style === 'loading') icon.classList.add('qb-spin')
      return h(
        'div',
        { class: this.cls(cls, 'toast'), 'data-style': t!.style ?? 'info', role: 'status' },
        icon,
        h('span', { class: 'qb-toast-title' }, t!.title),
        t!.message ? h('span', { class: 'qb-toast-msg' }, t!.message) : null,
      )
    }
    if (this._open && this.dom) {
      this.hud?.remove()
      this.hud = undefined
      if (t) this.dom.footerLeft.replaceChildren(build('qb-toast'))
      else if (this.top) this.renderFooterLeft(this.top)
      return
    }
    if (typeof document === 'undefined') return
    this.mount()
    this.hud?.remove()
    this.hud = undefined
    if (!t || !this.dom) return
    this.applyTheme()
    this.hud = build('qb-hud')
    this.dom.root.append(this.hud)
  }

  private renderLayer() {
    const dom = this.dom
    if (!dom) return
    const c = this.confirmState
    if (!c) {
      dom.layer.replaceChildren()
      return
    }
    if (dom.layer.firstChild) return
    const cancel = h('button', { class: 'qb-btn', type: 'button' }, c.cancelLabel ?? 'Cancel')
    const ok = h('button', { class: `qb-btn ${c.destructive ? 'qb-btn-danger' : 'qb-btn-primary'}`, type: 'button' }, c.confirmLabel ?? 'Confirm', renderKbd('enter'))
    cancel.addEventListener('click', () => c.resolve(false))
    ok.addEventListener('click', () => c.resolve(true))
    ok.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        c.resolve(true)
      }
    })
    dom.layer.append(
      h(
        'div',
        { class: 'qb-confirm-layer' },
        h(
          'div',
          { class: 'qb-confirm', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': c.title },
          h('div', { class: 'qb-confirm-title' }, c.title),
          c.message ? h('div', { class: 'qb-confirm-msg' }, c.message) : null,
          h('div', { class: 'qb-confirm-buttons' }, cancel, ok),
        ),
      ),
    )
    ok.focus()
  }

  announce(text: string) {
    if (this.dom) this.dom.live.textContent = text
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function shallowEqual(a?: Record<string, any>, b?: Record<string, any>) {
  if (a === b) return true
  if (!a || !b) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => a[k] === b[k])
}

async function withTimeout<T>(p: Promise<T> | T, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([Promise.resolve(p), new Promise<T>((_, reject) => (timer = setTimeout(() => reject(new Error('timeout')), ms)))])
  } finally {
    clearTimeout(timer)
  }
}
