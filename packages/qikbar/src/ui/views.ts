import type { Action, ChatView, DetailView, FormField, FormView, GridView, Item, ListView } from '../core/types.js'
import type { Bar, Frame, Row } from './bar.js'
import { copyText } from './nav.js'
import { h, highlight, renderAccessory, renderIcon, renderKbd, renderTag } from './dom.js'

export interface ViewRenderer {
  readonly frame: Frame
  readonly el: HTMLElement
  /** Whether the header search input is shown. */
  readonly hasInput: boolean
  update(): void
  /** Return true if the key was handled. */
  onKey(e: KeyboardEvent): boolean
  destroy(): void
  scrollTop(): number
  restoreScroll(top: number): void
  resetScroll?(): void
  ensureVisible?(): void
  focusTarget?(): HTMLElement | null
  placeholder?(): string | undefined
  footerPrimary?(): { title: string; hotkey: string; run: () => void } | undefined
  viewActions?(): Action[]
  /** Re-render every row (labels, pins or marks changed). */
  refresh?(): void
}

const LONG_PRESS_MS = 480

const VIRTUAL_THRESHOLD = 150
const OVERSCAN = 10

const optionId = (bar: Bar, key: string) => `${bar.instanceId}-opt-${key.replace(/[^\w-]/g, '_')}`

function px(value: string, fallback: number): number {
  const n = parseFloat(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const detailCache = new WeakMap<Item, Promise<string> | string>()

// ─── List ───────────────────────────────────────────────────────────────────

export class ListRenderer implements ViewRenderer {
  readonly el: HTMLElement
  readonly hasInput = true
  protected scroller: HTMLElement
  protected inner: HTMLElement
  protected emptyEl: HTMLElement
  protected detailEl?: HTMLElement
  protected cache = new Map<string, { el: HTMLElement; sig: unknown }>()
  protected renderedKeys: string[] = []
  protected selectedEl?: HTMLElement
  protected virtual = false
  protected offsets: number[] = []
  protected rowHeight = 42
  protected sectionHeight = 30
  private rafId = 0
  private detailFor?: Item
  private press?: { timer: ReturnType<typeof setTimeout>; x: number; y: number; fired: boolean }

  constructor(
    protected bar: Bar,
    readonly frame: Frame,
  ) {
    this.inner = h('div', { class: 'qb-list-inner' })
    this.scroller = h(
      'div',
      { class: `${bar.cls('qb-scroll qb-list', 'list')}`, role: 'listbox', id: `${bar.instanceId}-list`, 'aria-label': bar.t('results'), tabindex: '-1' },
      this.inner,
    )
    this.emptyEl = h('div', { class: 'qb-empty', hidden: true })
    const showDetail = frame.view.type === 'list' && (frame.view as ListView).detail
    if (showDetail) {
      this.detailEl = h('div', { class: bar.cls('qb-detail qb-md', 'detail') })
      this.el = h('div', { class: 'qb-split', style: 'display:flex;flex:1;min-width:0;position:relative' }, this.scroller, this.detailEl, this.emptyEl)
    } else {
      this.el = h('div', { style: 'display:flex;flex:1;min-width:0;position:relative' }, this.scroller, this.emptyEl)
    }
    this.scroller.addEventListener('pointermove', this.onPointerMove)
    this.scroller.addEventListener('click', this.onClick)
    this.scroller.addEventListener('pointerdown', this.onPointerDown)
    this.scroller.addEventListener('pointerup', this.cancelPress)
    this.scroller.addEventListener('pointercancel', this.cancelPress)
    this.scroller.addEventListener('contextmenu', this.onContextMenu)
    this.scroller.addEventListener('scroll', this.onScroll, { passive: true })
  }

  protected measure() {
    const cs = getComputedStyle(this.bar.dom!.root)
    this.rowHeight = px(cs.getPropertyValue('--qb-row-height'), 42)
    this.sectionHeight = px(cs.getPropertyValue('--qb-section-height'), 30)
    // Touch mode enforces a minimum tap target (see styles).
    if (this.bar.isTouch) this.rowHeight = Math.max(this.rowHeight, 48)
  }

  refresh() {
    this.cache.clear()
    this.inner.replaceChildren()
    this.renderedKeys = []
    this.selectedEl = undefined
    this.update()
  }

  update() {
    const rows = this.frame.rows
    const wasVirtual = this.virtual
    this.virtual = rows.length > VIRTUAL_THRESHOLD
    if (this.virtual) {
      if (!wasVirtual) this.measure()
      let y = 0
      this.offsets = rows.map((r) => {
        const top = y
        y += r.kind === 'section' ? this.sectionHeight : this.rowHeight
        return top
      })
      this.inner.style.height = `${y}px`
      this.renderWindow()
    } else {
      if (wasVirtual) {
        this.inner.style.height = ''
        for (const { el } of this.cache.values()) el.style.cssText = ''
      }
      const keys = rows.map((r) => r.key)
      const els = rows.map((r) => this.rowEl(r))
      if (!sameKeys(keys, this.renderedKeys) || els.some((el, i) => this.inner.children[i] !== el)) {
        this.inner.replaceChildren(...els)
        this.renderedKeys = keys
      }
      this.prune(new Set(keys))
    }
    this.updateSelection()
    this.updateEmpty()
    this.updateDetail()
  }

  protected prune(keep: Set<string>) {
    if (this.cache.size < 400) return
    for (const key of this.cache.keys()) if (!keep.has(key)) this.cache.delete(key)
  }

  private renderWindow() {
    const rows = this.frame.rows
    const top = this.scroller.scrollTop
    const height = this.scroller.clientHeight || 400
    let start = bisect(this.offsets, top) - OVERSCAN
    start = Math.max(0, start)
    let end = bisect(this.offsets, top + height) + OVERSCAN
    end = Math.min(rows.length, end + 1)
    const els: HTMLElement[] = []
    const keys: string[] = []
    for (let i = start; i < end; i++) {
      const row = rows[i]!
      const el = this.rowEl(row)
      el.style.position = 'absolute'
      el.style.top = `${this.offsets[i]}px`
      el.style.left = '0'
      el.style.right = '0'
      els.push(el)
      keys.push(row.key)
    }
    if (!sameKeys(keys, this.renderedKeys)) {
      this.inner.replaceChildren(...els)
      this.renderedKeys = keys
    }
    this.updateSelection()
  }

  private onScroll = () => {
    if (!this.virtual || this.rafId) return
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0
      this.renderWindow()
    })
  }

  protected rowSig(row: Row): unknown {
    if (row.kind === 'section') return row.title
    let sig = `${row.index}|${row.positions?.join(',') ?? ''}`
    if (this.frame.view.type === 'root' && this.bar.personalize) {
      const id = this.bar.idOf(row.item)
      sig += `|${this.bar.aliasOf(id) ?? ''}|${this.bar.pins().includes(id) ? 'p' : ''}`
    }
    return sig
  }

  protected rowEl(row: Row): HTMLElement {
    const sig = this.rowSig(row)
    const cached = this.cache.get(row.key)
    if (cached && cached.sig === sig && (row.kind === 'section' || (cached.el as any).__item === row.item)) return cached.el
    const el = row.kind === 'section' ? this.sectionEl(row.title) : this.itemEl(row)
    if (row.kind === 'item') (el as any).__item = row.item
    this.cache.set(row.key, { el, sig })
    return el
  }

  protected sectionEl(title: string): HTMLElement {
    return h('div', { class: this.bar.cls('qb-section', 'section'), role: 'presentation' }, title)
  }

  protected itemEl(row: Extract<Row, { kind: 'item' }>): HTMLElement {
    const { item } = row
    const isRoot = this.frame.view.type === 'root'
    const right: (HTMLElement | null)[] = []
    if (isRoot && this.bar.personalize) {
      const id = this.bar.idOf(item)
      const alias = this.bar.aliasOf(id)
      if (alias) right.push(h('span', { class: 'qb-alias', title: this.bar.t('alias') }, alias))
      if (this.bar.pins().includes(id)) right.push(h('span', { class: 'qb-pin', title: this.bar.t('pinned') }, renderIcon('pin', 13)))
    }
    if (item.accessories?.length) right.push(h('span', { class: 'qb-item-accessories' }, ...item.accessories.map(renderAccessory)))
    else if (item.shortcut) right.push(h('span', { class: 'qb-item-accessories' }, renderKbd(item.shortcut)))
    if (isRoot && !item.accessories?.length && !item.shortcut) right.push(h('span', { class: 'qb-item-kind' }, this.kindOf(item)))
    return h(
      'div',
      {
        class: this.bar.cls('qb-item', 'item'),
        role: 'option',
        id: optionId(this.bar, row.key),
        'aria-selected': 'false',
        'data-index': String(row.index),
      },
      this.bar.isMulti(this.frame) ? h('span', { class: 'qb-check', 'aria-hidden': 'true' }, renderIcon('check', 12)) : null,
      h('span', { class: 'qb-item-icon' }, renderIcon(item.icon ?? (isRoot ? 'command' : undefined), 16)),
      h(
        'span',
        { class: 'qb-item-text' },
        h('span', { class: 'qb-item-title' }, highlight(item.title, row.positions)),
        item.subtitle ? h('span', { class: 'qb-item-subtitle' }, item.subtitle) : null,
      ),
      ...right,
    )
  }

  private kindOf(item: Item): string {
    if (this.bar.itemExt.get(item)) return this.bar.t('kindCommand')
    if (item.href) return this.bar.t('kindPage')
    if (item.url) return this.bar.t('kindLink')
    return this.bar.t('kindCommand')
  }

  protected updateSelection() {
    const row = this.frame.itemRows[this.frame.selected]
    const el = row ? this.cache.get(row.key)?.el : undefined
    if (this.selectedEl && this.selectedEl !== el) this.selectedEl.setAttribute('aria-selected', 'false')
    if (el) el.setAttribute('aria-selected', 'true')
    this.selectedEl = el
    if (this.bar.isMulti(this.frame)) {
      for (const r of this.frame.itemRows) {
        const rowEl = this.cache.get(r.key)?.el
        if (!rowEl) continue
        const marked = this.bar.isMarked(this.frame, r.key)
        if (marked) rowEl.dataset.marked = ''
        else delete rowEl.dataset.marked
        rowEl.setAttribute('aria-checked', marked ? 'true' : 'false')
      }
    }
  }

  protected updateEmpty() {
    const f = this.frame
    const empty = f.itemRows.length === 0
    this.scroller.hidden = empty && !this.detailEl
    if (!empty || (f.loading > 0 && !f.error)) {
      this.emptyEl.hidden = true
      return
    }
    const view = f.view as ListView
    let icon = 'search'
    let title = this.bar.t('noResults')
    let desc: Node | string | null = f.query ? this.bar.t('nothingMatches', { query: f.query }) : null
    if (f.error) {
      icon = 'alert'
      title = this.bar.t('loadFailed')
      desc = f.error
    } else if (view.emptyView) {
      icon = (view.emptyView.icon as string) ?? icon
      title = view.emptyView.title
      desc = view.emptyView.description ?? null
    } else if (f.view.type === 'root' && !f.query) {
      title = this.bar.t('startTyping')
      desc = null
    }
    this.emptyEl.replaceChildren(
      renderIcon(icon, 28) ?? '',
      h('div', { class: 'qb-empty-title' }, title),
      desc ? h('div', { class: 'qb-empty-desc' }, desc) : '',
    )
    this.emptyEl.hidden = false
  }

  protected updateDetail() {
    const pane = this.detailEl
    if (!pane) return
    const item = this.bar.selectedItem(this.frame)
    if (item === this.detailFor) return
    this.detailFor = item
    if (!item?.detail) {
      pane.innerHTML = item?.description ? this.bar.md(item.description) : ''
      return
    }
    let value = detailCache.get(item)
    if (value === undefined) {
      const d = item.detail
      value = typeof d === 'function' ? Promise.resolve(d()) : d
      detailCache.set(item, value)
    }
    if (typeof value === 'string') pane.innerHTML = this.bar.md(value)
    else {
      pane.innerHTML = ''
      value.then(
        (md) => {
          detailCache.set(item, md)
          if (this.detailFor === item) pane.innerHTML = this.bar.md(md)
        },
        (err) => {
          if (this.detailFor === item) pane.textContent = String(err?.message ?? err)
        },
      )
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    const p = this.press
    if (p && !p.fired && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) this.cancelPress()
    if (e.pointerType !== 'mouse') return
    const el = (e.target as Element).closest?.('[data-index]') as HTMLElement | null
    if (!el) return
    const index = Number(el.dataset.index)
    if (index !== this.frame.selected) this.select(index, false)
  }

  private onClick = (e: MouseEvent) => {
    const el = (e.target as Element).closest?.('[data-index]') as HTMLElement | null
    if (!el) return
    if (this.press?.fired) {
      // The long-press already opened the actions; don't let this click run the row or close the panel.
      this.press = undefined
      e.stopPropagation()
      return
    }
    const index = Number(el.dataset.index)
    this.select(index, false)
    const item = this.frame.itemRows[index]?.item
    if (item && this.bar.isMulti(this.frame)) {
      if (e.shiftKey) return this.bar.markRange(this.frame, item)
      if (e.metaKey || e.ctrlKey) return this.bar.toggleMark(this.frame, item)
      if (this.frame.marked?.size) return this.bar.toggleMark(this.frame, item)
    }
    this.bar.runPrimary(this.frame, e.metaKey || e.ctrlKey ? 1 : 0, 'click')
  }

  /** Keep focus in the search box; on touch, a long press opens the actions. */
  private onPointerDown = (e: PointerEvent) => {
    e.preventDefault()
    this.cancelPress()
    if (e.pointerType === 'mouse') return
    const el = (e.target as Element).closest?.('[data-index]') as HTMLElement | null
    if (!el) return
    const index = Number(el.dataset.index)
    const press = {
      x: e.clientX,
      y: e.clientY,
      fired: false,
      timer: setTimeout(() => {
        press.fired = true
        this.select(index, false)
        this.bar.openPanel()
        navigator.vibrate?.(8)
      }, LONG_PRESS_MS),
    }
    this.press = press
  }

  private cancelPress = (e?: Event) => {
    const p = this.press
    if (!p) return
    clearTimeout(p.timer)
    // Keep the "fired" flag until the click that follows the release.
    if (!p.fired || e?.type === 'pointercancel') this.press = undefined
  }

  private onContextMenu = (e: MouseEvent) => {
    const el = (e.target as Element).closest?.('[data-index]') as HTMLElement | null
    if (!el) return
    e.preventDefault()
    if (this.press?.fired || this.bar.panel) return
    this.select(Number(el.dataset.index), false)
    this.bar.openPanel()
  }

  select(index: number, scroll = true) {
    const n = this.frame.itemRows.length
    if (!n) return
    this.frame.selected = ((index % n) + n) % n
    this.frame.selectedKey = this.frame.itemRows[this.frame.selected]!.key
    this.frame.userMoved = true
    if (scroll) this.ensureVisible()
    this.updateSelection()
    this.bar.invalidate()
  }

  move(delta: number) {
    const n = this.frame.itemRows.length
    if (!n) return
    const next = this.frame.selected + delta
    // Wrap for single steps; clamp for page jumps.
    this.select(Math.abs(delta) === 1 ? next : Math.max(0, Math.min(n - 1, next)))
  }

  ensureVisible() {
    const f = this.frame
    const row = f.itemRows[f.selected]
    if (!row) return
    const rowIndex = f.rows.indexOf(row)
    const prev = f.rows[rowIndex - 1]
    let top: number
    let bottom: number
    if (this.virtual) {
      top = this.offsets[rowIndex]!
      bottom = top + this.rowHeight
      if (prev?.kind === 'section') top = this.offsets[rowIndex - 1]!
    } else {
      const el = this.cache.get(row.key)?.el
      if (!el) return
      top = el.offsetTop
      bottom = top + el.offsetHeight
      if (prev?.kind === 'section') {
        const sec = this.cache.get(prev.key)?.el
        if (sec) top = sec.offsetTop
      }
    }
    const pad = 8
    const s = this.scroller
    if (f.selected === 0) s.scrollTop = 0
    else if (top < s.scrollTop + pad) s.scrollTop = top - pad
    else if (bottom > s.scrollTop + s.clientHeight - pad) s.scrollTop = bottom - s.clientHeight + pad
    if (this.virtual) this.renderWindow()
  }

  onKey(e: KeyboardEvent): boolean {
    const k = e.key
    const mod = e.metaKey || e.ctrlKey
    if ((k === 'ArrowDown' || k === 'ArrowUp') && e.shiftKey && !mod && this.bar.isMulti(this.frame)) {
      const current = this.frame.itemRows[this.frame.selected]?.item
      if (current) this.bar.toggleMark(this.frame, current, true)
      this.move(k === 'ArrowDown' ? 1 : -1)
      const next = this.frame.itemRows[this.frame.selected]?.item
      if (next) this.bar.toggleMark(this.frame, next, true)
      return true
    }
    if (k === 'ArrowDown' && mod) return this.select(this.frame.itemRows.length - 1), true
    if (k === 'ArrowUp' && mod) return this.select(0), true
    const emacs = e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey
    if (k === 'ArrowDown' || (emacs && (k === 'n' || k === 'j'))) return this.move(1), true
    if (k === 'ArrowUp' || (emacs && k === 'p')) return this.move(-1), true
    if (k === 'PageDown') return this.move(8), true
    if (k === 'PageUp') return this.move(-8), true
    if (k === 'Enter' && !mod && !e.altKey) {
      this.bar.runPrimary(this.frame)
      return true
    }
    if (k === 'Tab' && !e.shiftKey && !mod && !e.altKey) {
      const item = this.bar.selectedItem(this.frame)
      if (item?.arguments?.length) {
        const act = this.bar.actionsFor(item, this.frame)[0]
        if (act) void this.bar.runAction(this.frame, item, act)
        return true
      }
      if (this.frame.view.type === 'root' && this.bar.ai) {
        this.bar.ask(this.frame.query)
        return true
      }
      return true
    }
    return false
  }

  scrollTop() {
    return this.scroller.scrollTop
  }

  restoreScroll(top: number) {
    this.scroller.scrollTop = top
    if (this.virtual) this.renderWindow()
  }

  resetScroll() {
    this.scroller.scrollTop = 0
  }

  destroy() {
    cancelAnimationFrame(this.rafId)
    if (this.press) clearTimeout(this.press.timer)
  }
}

function sameKeys(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** Index of the last offset <= y. */
function bisect(offsets: number[], y: number): number {
  let lo = 0
  let hi = offsets.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (offsets[mid]! <= y) lo = mid
    else hi = mid - 1
  }
  return lo
}

// ─── Grid ───────────────────────────────────────────────────────────────────

export class GridRenderer extends ListRenderer {
  constructor(bar: Bar, frame: Frame) {
    super(bar, frame)
    const v = frame.view as GridView
    this.scroller.className = bar.cls('qb-scroll qb-grid', 'grid')
    this.scroller.style.setProperty('--qb-columns', String(v.columns ?? 5))
    if (v.aspectRatio) this.scroller.style.setProperty('--qb-aspect', v.aspectRatio)
    if (v.fit) this.scroller.style.setProperty('--qb-fit', v.fit)
    this.inner.style.display = 'contents'
  }

  override update() {
    // Grids are not virtualized; cap rendering for huge result sets.
    const rows = this.frame.rows.slice(0, 600)
    const keys = rows.map((r) => r.key)
    const els = rows.map((r) => this.rowEl(r))
    if (!sameKeys(keys, this.renderedKeys)) {
      this.inner.replaceChildren(...els)
      this.renderedKeys = keys
    }
    this.updateSelection()
    this.updateEmpty()
  }

  protected override itemEl(row: Extract<Row, { kind: 'item' }>): HTMLElement {
    const { item } = row
    const media = h('div', { class: 'qb-cell-media' })
    if (item.image) media.append(h('img', { src: item.image, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }))
    else {
      const icon = renderIcon(item.icon, 28)
      if (icon) media.append(icon)
    }
    return h(
      'div',
      { class: this.bar.cls('qb-cell', 'item'), role: 'option', id: optionId(this.bar, row.key), 'aria-selected': 'false', 'data-index': String(row.index), title: item.title },
      this.bar.isMulti(this.frame) ? h('span', { class: 'qb-check', 'aria-hidden': 'true' }, renderIcon('check', 12)) : null,
      media,
      h('div', { class: 'qb-cell-title' }, highlight(item.title, row.positions)),
      item.subtitle ? h('div', { class: 'qb-cell-subtitle' }, item.subtitle) : null,
    )
  }

  override ensureVisible() {
    const row = this.frame.itemRows[this.frame.selected]
    const el = row && this.cache.get(row.key)?.el
    el?.scrollIntoView({ block: 'nearest' })
  }

  override onKey(e: KeyboardEvent): boolean {
    const cols = (this.frame.view as GridView).columns ?? 5
    if (e.key === 'ArrowRight' && !e.metaKey && !e.ctrlKey) return this.move(1), true
    if (e.key === 'ArrowLeft' && !e.metaKey && !e.ctrlKey) return this.move(-1), true
    if (e.key === 'ArrowDown' && !e.metaKey && !e.ctrlKey) return this.step(cols), true
    if (e.key === 'ArrowUp' && !e.metaKey && !e.ctrlKey) return this.step(-cols), true
    return super.onKey(e)
  }

  private step(delta: number) {
    const n = this.frame.itemRows.length
    const next = this.frame.selected + delta
    if (next >= 0 && next < n) this.select(next)
  }
}

// ─── Detail ─────────────────────────────────────────────────────────────────

export class DetailRenderer implements ViewRenderer {
  readonly el: HTMLElement
  readonly hasInput = false
  private body: HTMLElement
  private rendered = ''
  private raf = 0

  constructor(
    private bar: Bar,
    readonly frame: Frame,
  ) {
    const v = frame.view as DetailView
    this.body = h('div', { class: bar.cls('qb-detail qb-md', 'detail'), tabindex: '-1' })
    const children: HTMLElement[] = [this.body]
    if (v.metadata?.length) {
      children.push(
        h(
          'div',
          { class: 'qb-meta' },
          ...v.metadata.map((m) =>
            h(
              'div',
              null,
              h('div', { class: 'qb-meta-label' }, m.label),
              h(
                'div',
                { class: 'qb-meta-value' },
                renderIcon(m.icon, 14),
                m.tag ? renderTag(m.tag) : null,
                m.href ? h('a', { href: m.href, target: /^https?:/.test(m.href) ? '_blank' : null, rel: 'noopener' }, m.value ?? m.href) : (m.value ?? null),
              ),
            ),
          ),
        ),
      )
    }
    this.el = h('div', { style: 'display:flex;flex:1;min-width:0' }, ...children)
  }

  update() {
    if (this.raf) return
    this.raf = requestAnimationFrame(() => {
      this.raf = 0
      this.render()
    })
  }

  private render() {
    const d = this.frame.detail
    if (!d) return
    const key = `${d.text.length}|${d.done}|${d.error ?? ''}`
    if (key === this.rendered) return
    this.rendered = key
    const stick = this.body.scrollTop + this.body.clientHeight >= this.body.scrollHeight - 24
    let html = this.bar.md(d.text)
    if (!d.done) html += '<span class="qb-caret"></span>'
    if (d.error) html += `<p class="qb-msg-error">${d.error.replace(/</g, '&lt;')}</p>`
    this.body.innerHTML = html
    if (stick && !d.done) this.body.scrollTop = this.body.scrollHeight
  }

  onKey(e: KeyboardEvent): boolean {
    if (e.key === 'ArrowDown') return (this.body.scrollTop += 40), true
    if (e.key === 'ArrowUp') return (this.body.scrollTop -= 40), true
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      this.bar.runPrimary(this.frame)
      return true
    }
    return false
  }

  viewActions(): Action[] {
    const d = this.frame.detail
    return [
      {
        title: this.bar.t('copyContent'),
        icon: 'copy',
        shortcut: 'mod+shift+c',
        keepOpen: true,
        run: async (ctx) => {
          const ok = await ctx.copy(d?.text ?? '')
          ctx.toast({ title: ok ? this.bar.t('copied') : this.bar.t('copyFailed'), style: ok ? 'success' : 'failure' })
          return false as const
        },
      },
    ]
  }

  focusTarget() {
    return this.body
  }
  scrollTop() {
    return this.body.scrollTop
  }
  restoreScroll(top: number) {
    this.body.scrollTop = top
  }
  destroy() {
    cancelAnimationFrame(this.raf)
  }
}

// ─── Form ───────────────────────────────────────────────────────────────────

export class FormRenderer implements ViewRenderer {
  readonly el: HTMLElement
  readonly hasInput = false
  private inputs = new Map<string, HTMLElement>()
  private errors = new Map<string, HTMLElement>()

  constructor(
    private bar: Bar,
    readonly frame: Frame,
  ) {
    const v = frame.view as FormView
    const children: HTMLElement[] = []
    for (const field of v.fields) {
      const id = `${bar.instanceId}-f-${field.name}`
      const label = h('label', { class: 'qb-form-label', for: id, 'data-required': field.required ? '' : null }, field.type === 'checkbox' ? '' : (field.label ?? field.name))
      const control = this.control(field, id)
      const error = h('div', { class: 'qb-field-error', hidden: true, id: `${id}-err` })
      this.errors.set(field.name, error)
      children.push(label, h('div', { class: 'qb-field' }, control, field.description ? h('div', { class: 'qb-field-desc' }, field.description) : null, error))
    }
    this.el = h('form', { class: bar.cls('qb-form', 'form'), novalidate: true }, ...children)
    this.el.addEventListener('submit', (e) => {
      e.preventDefault()
      this.submit()
    })
  }

  private control(field: FormField, id: string): HTMLElement {
    const values = this.frame.form!.values
    const set = (value: unknown) => {
      values[field.name] = value
      if (this.frame.form!.errors[field.name]) {
        delete this.frame.form!.errors[field.name]
        this.showErrors()
      }
    }
    let el: HTMLElement
    if (field.type === 'checkbox') {
      const input = h('input', { type: 'checkbox', id, checked: !!values[field.name] })
      input.addEventListener('change', () => set(input.checked))
      this.inputs.set(field.name, input)
      return h('label', { class: 'qb-field-check' }, input, h('span', null, field.label ?? field.name))
    }
    if (field.type === 'select') {
      const select = h('select', { class: 'qb-field-input', id }, ...(field.options ?? []).map((o) => h('option', { value: o.value }, o.title)))
      select.value = String(values[field.name] ?? '')
      select.addEventListener('change', () => set(select.value))
      el = select
    } else if (field.type === 'textarea') {
      const ta = h('textarea', { class: 'qb-field-input', id, placeholder: field.placeholder ?? '', rows: 4 })
      ta.value = String(values[field.name] ?? '')
      ta.addEventListener('input', () => set(ta.value))
      el = ta
    } else {
      const input = h('input', {
        class: 'qb-field-input',
        id,
        type: field.type ?? 'text',
        placeholder: field.placeholder ?? '',
        autocomplete: field.type === 'password' ? 'off' : 'on',
        spellcheck: 'false',
      })
      input.value = String(values[field.name] ?? '')
      input.addEventListener('input', () => set(field.type === 'number' ? (input.value === '' ? '' : Number(input.value)) : input.value))
      el = input
    }
    el.setAttribute('aria-describedby', `${id}-err`)
    this.inputs.set(field.name, el)
    return el
  }

  private showErrors() {
    const errs = this.frame.form!.errors
    for (const [name, el] of this.errors) {
      const msg = errs[name]
      el.hidden = !msg
      el.textContent = msg ?? ''
      this.inputs.get(name)?.setAttribute('aria-invalid', msg ? 'true' : 'false')
    }
  }

  submit() {
    const v = this.frame.view as FormView
    const form = this.frame.form!
    form.errors = {}
    for (const f of v.fields) {
      const value = form.values[f.name]
      if (f.required && (value === '' || value == null || value === false)) form.errors[f.name] = this.bar.t('fieldRequired', { field: f.label ?? f.name })
      else {
        const msg = f.validate?.(value, form.values)
        if (msg) form.errors[f.name] = msg
      }
    }
    this.showErrors()
    const first = Object.keys(form.errors)[0]
    if (first) {
      this.inputs.get(first)?.focus()
      return
    }
    void this.bar.runAction(this.frame, undefined, {
      title: v.submitLabel ?? this.bar.t('submit'),
      run: (ctx) => v.onSubmit({ ...form.values }, ctx),
    })
  }

  update() {}

  onKey(e: KeyboardEvent): boolean {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      this.submit()
      return true
    }
    const t = e.target as HTMLElement
    if (e.key === 'Enter' && t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'checkbox') {
      this.submit()
      return true
    }
    return false
  }

  footerPrimary() {
    const v = this.frame.view as FormView
    return { title: v.submitLabel ?? this.bar.t('submit'), hotkey: 'mod+enter', run: () => this.submit() }
  }

  focusTarget() {
    if (this.el.contains(document.activeElement)) return document.activeElement as HTMLElement
    return (this.el.querySelector('input,textarea,select') as HTMLElement | null) ?? this.el
  }
  scrollTop() {
    return this.el.scrollTop
  }
  restoreScroll(top: number) {
    this.el.scrollTop = top
  }
  destroy() {}
}

// ─── Chat ───────────────────────────────────────────────────────────────────

export class ChatRenderer implements ViewRenderer {
  readonly el: HTMLElement
  readonly hasInput = true
  private turnEls: { el: HTMLElement; sig: string }[] = []
  private emptyEl?: HTMLElement
  private raf = 0

  constructor(
    private bar: Bar,
    readonly frame: Frame,
  ) {
    this.el = h('div', { class: bar.cls('qb-chat', 'chat'), role: 'log', 'aria-live': 'polite', tabindex: '-1' })
  }

  update() {
    if (this.raf) return
    this.raf = requestAnimationFrame(() => {
      this.raf = 0
      this.render()
    })
  }

  private render() {
    const turns = this.frame.chat?.turns ?? []
    if (!turns.length) {
      if (!this.emptyEl) {
        this.emptyEl = this.empty()
        this.el.replaceChildren(this.emptyEl)
      }
      return
    }
    if (this.emptyEl) {
      this.emptyEl.remove()
      this.emptyEl = undefined
    }
    const stick = this.el.scrollTop + this.el.clientHeight >= this.el.scrollHeight - 40
    turns.forEach((turn, i) => {
      const sig = `${turn.text.length}|${turn.streaming}|${turn.error ?? ''}|${turn.tools.map((t) => t.state).join()}`
      const existing = this.turnEls[i]
      if (existing && existing.sig === sig) return
      let el: HTMLElement
      if (turn.role === 'user') el = h('div', { class: 'qb-msg-user' }, turn.text)
      else {
        const head = h('div', { class: 'qb-msg-head' }, renderIcon('sparkles', 13), this.bar.aiName)
        const tools = turn.tools.length
          ? h(
              'div',
              { class: 'qb-tools' },
              ...turn.tools.map((t) => {
                const icon = renderIcon(t.state === 'running' ? 'loader' : t.state === 'done' ? 'check' : 'x', 12)!
                if (t.state === 'running') icon.classList.add('qb-spin')
                return h('span', { class: 'qb-tool', 'data-state': t.state }, icon, t.label)
              }),
            )
          : null
        const md = h('div', { class: 'qb-md' })
        let html = this.bar.md(turn.text)
        if (turn.streaming) html += turn.text || !turn.tools.length ? '<span class="qb-caret"></span>' : ''
        md.innerHTML = html
        el = h('div', { class: 'qb-msg-ai' }, head, tools, md, turn.error ? h('div', { class: 'qb-msg-error' }, turn.error) : null)
      }
      if (existing) existing.el.replaceWith(el)
      else this.el.append(el)
      this.turnEls[i] = { el, sig }
    })
    if (stick) this.el.scrollTop = this.el.scrollHeight
  }

  private empty(): HTMLElement {
    const suggestions = this.bar.aiOptions?.suggestions ?? []
    const defaults = suggestions.length ? suggestions : this.bar.t('chatSuggestions').split('|')
    return h(
      'div',
      { class: 'qb-chat-empty' },
      renderIcon('sparkles', 26),
      h('div', { class: 'qb-empty-title' }, this.bar.t('askAnything')),
      h('div', { class: 'qb-empty-desc' }, this.bar.t('chatHint')),
      h(
        'div',
        { class: 'qb-suggestions' },
        ...defaults.map((s) => {
          const b = h('button', { class: 'qb-suggestion', type: 'button' }, s)
          b.addEventListener('click', () => this.bar.sendChat(this.frame, s))
          return b
        }),
      ),
    )
  }

  private lastAnswer(): string {
    const turns = this.frame.chat?.turns ?? []
    for (let i = turns.length - 1; i >= 0; i--) if (turns[i]!.role === 'assistant' && turns[i]!.text) return turns[i]!.text
    return ''
  }

  onKey(e: KeyboardEvent): boolean {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const q = this.frame.query.trim()
      if (q) this.bar.sendChat(this.frame, q)
      return true
    }
    if (e.key === 'ArrowUp' && !this.frame.query) return (this.el.scrollTop -= 60), true
    if (e.key === 'ArrowDown' && !this.frame.query) return (this.el.scrollTop += 60), true
    return false
  }

  placeholder() {
    const turns = this.frame.chat?.turns.length ?? 0
    return turns ? this.bar.t('followUp') : this.bar.t('askAnythingPlaceholder')
  }

  footerPrimary() {
    const streaming = !!this.frame.chat?.controller
    if (streaming) return { title: this.bar.t('stop'), hotkey: 'escape', run: () => void this.bar.stopChat(this.frame) }
    return { title: this.bar.t('send'), hotkey: 'enter', run: () => this.bar.sendChat(this.frame, this.frame.query) }
  }

  viewActions(): Action[] {
    const view = this.frame.view as ChatView
    return [
      {
        title: this.bar.t('copyAnswer'),
        icon: 'copy',
        shortcut: 'mod+shift+c',
        keepOpen: true,
        run: async (ctx) => {
          const ok = await copyText(this.lastAnswer())
          ctx.toast({ title: ok ? this.bar.t('copiedAnswer') : this.bar.t('nothingToCopy'), style: ok ? 'success' : 'failure' })
          return false as const
        },
      },
      {
        title: this.bar.t('newChat'),
        icon: 'plus',
        shortcut: 'mod+shift+o',
        run: (ctx) => {
          ctx.render({ ...view, type: 'chat', prompt: undefined })
          return false
        },
      },
    ]
  }

  scrollTop() {
    return this.el.scrollTop
  }
  restoreScroll(top: number) {
    this.el.scrollTop = top
  }
  destroy() {
    cancelAnimationFrame(this.raf)
  }
}
