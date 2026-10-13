'use client'

import { createContext, createElement, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DependencyList, type ReactNode } from 'react'
import { createQikbar } from '../index.js'
import { formatHotkey, isMac } from '../core/hotkeys.js'
import type { Command, Extension, Navigate, QikbarConfig, QikbarInstance, QikbarState, Source } from '../core/types.js'

const QikbarContext = createContext<QikbarInstance | null>(null)

// The most recently mounted instance, so hooks work even outside <Qikbar>.
let current: QikbarInstance | null = null
const waiters = new Set<(bar: QikbarInstance) => void>()

function setCurrent(bar: QikbarInstance | null) {
  current = bar
  if (bar) for (const w of waiters) w(bar)
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const FUNCTION_KEYS = ['navigate', 'onOpen', 'onClose', 'onRun', 'onEvent'] as const

export interface QikbarProps extends Omit<QikbarConfig, 'inline'> {
  children?: ReactNode
  /** Render the bar inline (always open) where this component is placed. */
  inline?: boolean
  className?: string
  style?: CSSProperties
  /** Receive the instance once created. */
  onReady?: (bar: QikbarInstance) => void
}

/**
 * Mounts a command bar. Put it once near the root of your app.
 *
 * ```tsx
 * <Qikbar routes={routes} navigate={(href) => router.push(href)} />
 * ```
 */
export function Qikbar({ children, inline, className, style, onReady, ...config }: QikbarProps) {
  const [bar, setBar] = useState<QikbarInstance | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const latest = useRef(config)
  latest.current = config
  const applied = useRef<Partial<QikbarConfig>>({})

  // Stable wrappers so changing callbacks doesn't reconfigure the bar.
  const stable = useRef({
    navigate: ((href, opts) => latest.current.navigate?.(href, opts)) as Navigate,
    onOpen: () => latest.current.onOpen?.(),
    onClose: () => latest.current.onClose?.(),
    onRun: ((item, action) => latest.current.onRun?.(item, action)) as NonNullable<QikbarConfig['onRun']>,
    onEvent: ((event) => latest.current.onEvent?.(event)) as NonNullable<QikbarConfig['onEvent']>,
  }).current

  const resolve = (c: Partial<QikbarConfig>) => {
    const out: Partial<QikbarConfig> = { ...c }
    for (const key of FUNCTION_KEYS) if (c[key]) (out as any)[key] = stable[key]
    return out
  }

  useIsoLayoutEffect(() => {
    const initial = resolve(latest.current)
    applied.current = initial
    const instance = createQikbar({ ...initial, inline: inline ? (containerRef.current ?? undefined) : undefined })
    setBar(instance)
    setCurrent(instance)
    onReady?.(instance)
    return () => {
      instance.destroy()
      if (current === instance) setCurrent(null)
    }
  }, [inline])

  // Push changed props into the running instance.
  useEffect(() => {
    if (!bar) return
    const next = resolve(config)
    const changed: Partial<QikbarConfig> = {}
    let dirty = false
    const keys = new Set([...Object.keys(next), ...Object.keys(applied.current)]) as Set<keyof QikbarConfig>
    for (const key of keys) {
      if (!Object.is(next[key], applied.current[key])) {
        ;(changed as any)[key] = next[key]
        dirty = true
      }
    }
    if (dirty) {
      applied.current = next
      bar.configure(changed)
    }
  })

  const content = createElement(QikbarContext.Provider, { value: bar }, children)
  if (!inline) return content
  return createElement('div', { ref: containerRef, className, style }, content)
}

/** Alias for `<Qikbar>` when used as a provider around your app. */
export const QikbarProvider = Qikbar

function useInstance(): QikbarInstance | null {
  const fromContext = useContext(QikbarContext)
  const [fallback, setFallback] = useState<QikbarInstance | null>(() => current)
  useEffect(() => {
    if (fromContext) return
    if (current && current !== fallback) setFallback(current)
    const w = (b: QikbarInstance) => setFallback(b)
    waiters.add(w)
    return () => void waiters.delete(w)
  }, [fromContext])
  return fromContext ?? fallback
}

export interface UseQikbar extends Omit<QikbarState, 'open'> {
  isOpen: boolean
  bar: QikbarInstance | null
  open: (options?: Parameters<QikbarInstance['open']>[0]) => void
  close: () => void
  toggle: () => void
  ask: (prompt?: string) => void
}

/** Control the bar and read its state. */
export function useQikbar(): UseQikbar {
  const bar = useInstance()
  const [state, setState] = useState<QikbarState>({ open: false, query: '', depth: 0, loading: false })
  useEffect(() => bar?.on('change', setState), [bar])
  const { open: isOpen, ...rest } = state
  return {
    ...rest,
    isOpen,
    bar,
    open: (o) => bar?.open(o),
    close: () => bar?.close(),
    toggle: () => bar?.toggle(),
    ask: (p) => bar?.ask(p),
  }
}

/**
 * Register commands while a component is mounted — great for page-specific actions.
 *
 * ```tsx
 * useCommands([{ title: 'Archive project', run: archive }], [archive])
 * ```
 */
export function useCommands(commands: Command[] | (() => Command[]), deps?: DependencyList) {
  const bar = useInstance()
  useEffect(() => {
    if (!bar) return
    return bar.register(typeof commands === 'function' ? commands() : commands)
  }, [bar, ...(deps ?? [commands])])
}

/** Add a dynamic search source while mounted. */
export function useSource(source: Source, deps?: DependencyList) {
  const bar = useInstance()
  useEffect(() => {
    if (!bar) return
    return bar.addSource(source)
  }, [bar, ...(deps ?? [source])])
}

/** Install an extension while mounted. */
export function useExtension(extension: Extension, preferences?: Record<string, any>, deps?: DependencyList) {
  const bar = useInstance()
  useEffect(() => {
    if (!bar) return
    return bar.use(extension, preferences)
  }, [bar, extension, ...(deps ?? [])])
}

export interface QikbarTriggerProps {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  /** Placeholder text. Default "Search…". */
  label?: string
  /** Shortcut shown on the right. Default "mod+k". */
  shortcut?: string | false
}

/** A search-box style button that opens the bar. Unstyled except for a few defaults; pass `className`. */
export function QikbarTrigger({ children, className, style, label = 'Search…', shortcut = 'mod+k' }: QikbarTriggerProps) {
  const { open } = useQikbar()
  const [keys, setKeys] = useState('')
  // Format after mount so server and client markup match (⌘ vs Ctrl).
  useEffect(() => {
    setKeys(shortcut ? formatHotkey(shortcut).map((c) => c.join(isMac ? '' : ' ')).join(' ') : '')
  }, [shortcut])
  return createElement(
    'button',
    { type: 'button', className, style, onClick: () => open(), 'aria-label': label, 'aria-haspopup': 'dialog' },
    children ?? [createElement('span', { key: 'l' }, label), keys ? createElement('kbd', { key: 'k', style: { marginLeft: 'auto' } }, keys) : null],
  )
}

export type { QikbarConfig, QikbarInstance, QikbarState } from '../core/types.js'
