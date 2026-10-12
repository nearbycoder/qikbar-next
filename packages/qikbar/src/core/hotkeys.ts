/**
 * Keyboard shortcut parsing, matching and formatting.
 *
 * Syntax: modifiers joined with `+`, e.g. `"mod+k"`, `"shift+mod+p"`, `"alt+enter"`.
 * `mod` is ⌘ on Apple platforms and Ctrl elsewhere.
 * Sequences are space separated: `"g s"` means press G, then S.
 */

export const isMac: boolean =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/i.test((navigator as any).userAgentData?.platform ?? navigator.platform ?? navigator.userAgent)

export interface KeyCombo {
  key: string
  meta: boolean
  ctrl: boolean
  alt: boolean
  shift: boolean
}

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  space: ' ',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  del: 'delete',
  plus: '+',
}

const cache = new Map<string, KeyCombo[]>()

/** Parse `"mod+shift+k"` or a sequence `"g s"` into combos. */
export function parseHotkey(hotkey: string): KeyCombo[] {
  let combos = cache.get(hotkey)
  if (combos) return combos
  combos = hotkey
    .trim()
    .split(/\s+/)
    .map((part) => {
      const keys = part.toLowerCase().split('+')
      // "mod++" → trailing plus key
      if (part.endsWith('++')) keys.splice(keys.length - 2, 2, '+')
      const combo: KeyCombo = { key: '', meta: false, ctrl: false, alt: false, shift: false }
      for (const k of keys) {
        if (k === 'mod') isMac ? (combo.meta = true) : (combo.ctrl = true)
        else if (k === 'cmd' || k === 'meta' || k === 'command') combo.meta = true
        else if (k === 'ctrl' || k === 'control') combo.ctrl = true
        else if (k === 'alt' || k === 'option' || k === 'opt') combo.alt = true
        else if (k === 'shift') combo.shift = true
        else combo.key = KEY_ALIASES[k] ?? k
      }
      return combo
    })
  cache.set(hotkey, combos)
  return combos
}

function eventKey(event: KeyboardEvent): string {
  // Use the physical key for letters/digits so alt/shift combos still match.
  const code = event.code
  if (code?.startsWith('Key')) return code.slice(3).toLowerCase()
  if (code?.startsWith('Digit')) return code.slice(5)
  return (event.key ?? '').toLowerCase()
}

/** Does a keyboard event match a single combo? */
export function matchesCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  if (event.metaKey !== combo.meta || event.ctrlKey !== combo.ctrl || event.altKey !== combo.alt) return false
  const key = eventKey(event)
  // Shift is implied for symbols like "?" — only enforce it for letters/named keys when specified.
  if (combo.shift !== event.shiftKey && !(combo.key.length === 1 && !/[a-z0-9]/.test(combo.key))) return false
  return key === combo.key || (event.key ?? '').toLowerCase() === combo.key
}

/** Matches a single-combo hotkey (sequences never match here). */
export function matchesHotkey(event: KeyboardEvent, hotkey: string): boolean {
  const combos = parseHotkey(hotkey)
  return combos.length === 1 && matchesCombo(event, combos[0]!)
}

const MAC_SYMBOLS: Record<string, string> = {
  meta: '⌘',
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧',
  enter: '↵',
  escape: 'esc',
  backspace: '⌫',
  delete: '⌦',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  tab: '⇥',
  ' ': 'Space',
}

const PC_NAMES: Record<string, string> = {
  meta: 'Win',
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  enter: '↵',
  escape: 'Esc',
  backspace: '⌫',
  delete: 'Del',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  tab: 'Tab',
  ' ': 'Space',
}

/** Format a hotkey as an array of key labels for display, e.g. `["⌘", "K"]`. */
export function formatHotkey(hotkey: string): string[][] {
  return parseHotkey(hotkey).map((combo) => {
    const names = isMac ? MAC_SYMBOLS : PC_NAMES
    const out: string[] = []
    if (isMac) {
      if (combo.ctrl) out.push(names.ctrl!)
      if (combo.alt) out.push(names.alt!)
      if (combo.shift) out.push(names.shift!)
      if (combo.meta) out.push(names.meta!)
    } else {
      if (combo.ctrl) out.push(names.ctrl!)
      if (combo.meta) out.push(names.meta!)
      if (combo.alt) out.push(names.alt!)
      if (combo.shift) out.push(names.shift!)
    }
    out.push(names[combo.key] ?? (combo.key.length === 1 ? combo.key.toUpperCase() : capitalize(combo.key)))
    return out
  })
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** True if the event target is a text field (where single-key shortcuts must not fire). */
export function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * Tracks multi-key sequences ("g s") across keydown events.
 */
export class SequenceMatcher {
  private buffer: KeyboardEvent[] = []
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(private timeout = 900) {}

  /** Feed an event; returns the hotkeys (from `hotkeys`) that completed. */
  feed(event: KeyboardEvent, hotkeys: string[]): string[] {
    if (['Shift', 'Meta', 'Control', 'Alt'].includes(event.key)) return []
    this.buffer.push(event)
    if (this.buffer.length > 4) this.buffer.shift()
    clearTimeout(this.timer)
    this.timer = setTimeout(() => (this.buffer = []), this.timeout)
    const matched: string[] = []
    for (const hotkey of hotkeys) {
      const combos = parseHotkey(hotkey)
      if (combos.length > this.buffer.length) continue
      const tail = this.buffer.slice(-combos.length)
      if (combos.every((c, i) => matchesCombo(tail[i]!, c))) matched.push(hotkey)
    }
    if (matched.length) this.buffer = []
    return matched
  }

  reset() {
    this.buffer = []
    clearTimeout(this.timer)
  }
}

/** Whether a hotkey may fire while focus is in a text field (it must use a modifier). */
export function allowedInInput(hotkey: string): boolean {
  const combos = parseHotkey(hotkey)
  return combos.length === 1 && (combos[0]!.meta || combos[0]!.ctrl || combos[0]!.alt)
}
