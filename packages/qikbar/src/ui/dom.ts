import { formatHotkey } from '../core/hotkeys.js'
import type { Accessory, Color, Icon } from '../core/types.js'
import { iconSvg } from './icons.js'

type Child = Node | string | number | null | undefined | false
type Props = Record<string, unknown> & { class?: string; style?: string | Record<string, string> }

/** Tiny hyperscript helper. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (props) {
    for (const key in props) {
      const value = props[key]
      if (value == null || value === false) continue
      if (key === 'class') el.className = value as string
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value)
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value as EventListener)
      else if (key === 'html') el.innerHTML = value as string
      else if (key in el && typeof value !== 'string') (el as any)[key] = value
      else el.setAttribute(key, value === true ? '' : String(value))
    }
  }
  append(el, children)
  return el
}

function append(el: Element, children: (Child | Child[])[]) {
  for (const child of children) {
    if (Array.isArray(child)) append(el, child)
    else if (child != null && child !== false) el.append(child instanceof Node ? child : String(child))
  }
}

const URL_RE = /^(https?:|\/|\.\.?\/|data:image\/|blob:)/

export function renderIcon(icon: Icon | undefined, size = 16): HTMLElement | null {
  if (icon == null || icon === '') return null
  const wrap = h('span', { class: 'qb-icon', 'aria-hidden': 'true' })
  if (typeof icon === 'function') {
    wrap.append(icon())
  } else if (typeof Node !== 'undefined' && icon instanceof Node) {
    wrap.append(icon.cloneNode(true))
  } else if (typeof icon === 'object' && 'url' in icon) {
    wrap.append(h('img', { src: icon.url, alt: icon.alt ?? '', loading: 'lazy', decoding: 'async', draggable: 'false' }))
  } else if (typeof icon === 'object' && 'color' in icon) {
    wrap.classList.add('qb-icon-tinted')
    wrap.style.setProperty('--qb-tint', colorValue(icon.color))
    const inner = renderIcon(icon.icon ?? 'dot', size)
    if (inner) wrap.append(...inner.childNodes)
  } else if (typeof icon === 'string') {
    const svg = iconSvg(icon, size)
    if (svg) wrap.innerHTML = svg
    else if (icon.trimStart().startsWith('<svg')) wrap.innerHTML = icon
    else if (URL_RE.test(icon)) wrap.append(h('img', { src: icon, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }))
    else {
      wrap.classList.add('qb-icon-text')
      wrap.textContent = icon
    }
  }
  return wrap
}

export function renderKbd(hotkey: string, className = 'qb-kbd'): HTMLElement {
  const wrap = h('span', { class: 'qb-kbds', 'aria-label': hotkey })
  formatHotkey(hotkey).forEach((combo, i) => {
    if (i > 0) wrap.append(h('span', { class: 'qb-kbd-then' }, 'then'))
    for (const key of combo) wrap.append(h('kbd', { class: className }, key))
  })
  return wrap
}

/** Render `text` with matched characters wrapped in `<mark>`. */
export function highlight(text: string, positions: number[] | undefined): DocumentFragment | string {
  if (!positions || positions.length === 0) return text
  const frag = document.createDocumentFragment()
  let last = 0
  let i = 0
  while (i < positions.length) {
    const start = positions[i]!
    let end = start
    while (i + 1 < positions.length && positions[i + 1] === end + 1) {
      i++
      end++
    }
    if (start > last) frag.append(text.slice(last, start))
    frag.append(h('mark', { class: 'qb-match' }, text.slice(start, end + 1)))
    last = end + 1
    i++
  }
  if (last < text.length) frag.append(text.slice(last))
  return frag
}

const NAMED_COLORS: Record<string, string> = {
  default: 'var(--qb-fg-muted)',
  gray: 'var(--qb-fg-subtle)',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#a855f7',
  pink: '#ec4899',
}

export function colorValue(color: Color | undefined): string {
  if (!color) return NAMED_COLORS.default!
  return NAMED_COLORS[color] ?? color
}

export function renderTag(tag: string | { value: string; color?: Color }): HTMLElement {
  const value = typeof tag === 'string' ? tag : tag.value
  const color = typeof tag === 'string' ? undefined : tag.color
  const el = h('span', { class: 'qb-tag' }, value)
  if (color) el.style.setProperty('--qb-tint', colorValue(color))
  return el
}

const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' }) : null

export function relativeTime(date: Date | number | string): string {
  const d = new Date(date)
  const diff = (d.getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (!rtf) return d.toLocaleDateString()
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month')
  return rtf.format(Math.round(diff / (86400 * 365)), 'year')
}

export function renderAccessory(acc: Accessory): HTMLElement {
  const el = h('span', { class: 'qb-accessory', title: acc.tooltip })
  const icon = renderIcon(acc.icon, 14)
  if (icon) el.append(icon)
  if (acc.tag) el.append(renderTag(acc.tag))
  if (acc.text) el.append(h('span', null, acc.text))
  if (acc.date != null) el.append(h('time', { datetime: new Date(acc.date).toISOString() }, relativeTime(acc.date)))
  if (acc.kbd) el.append(renderKbd(acc.kbd))
  return el
}

let idCounter = 0
export function uid(prefix = 'qb'): string {
  return `${prefix}-${(++idCounter).toString(36)}`
}
