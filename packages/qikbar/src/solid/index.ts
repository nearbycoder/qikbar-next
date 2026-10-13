/**
 * SolidJS bindings.
 *
 * ```tsx
 * import { QikbarProvider, useCommands } from '@qikbar/qikbar/solid'
 * import { useNavigate } from '@solidjs/router'
 *
 * <QikbarProvider config={{ routes, navigate: (href) => navigate(href) }}>
 *   <App />
 * </QikbarProvider>
 * ```
 */

import { createComponent, createContext, createEffect, createSignal, on, onCleanup, onMount, untrack, useContext, type Accessor, type JSX } from 'solid-js'
import { createQikbar as create } from '../index.js'
import type { Command, Extension, QikbarConfig, QikbarInstance, QikbarState, Source } from '../core/types.js'

const QikbarContext = createContext<Accessor<QikbarInstance | null>>()

// The most recently created instance, for primitives used outside the provider.
const [current, setCurrent] = createSignal<QikbarInstance | null>(null)

/**
 * Create a bar owned by the current reactive scope (destroyed on cleanup).
 * Pass an accessor to apply config changes live.
 */
export function createQikbar(config: QikbarConfig | Accessor<QikbarConfig> = {}): QikbarInstance {
  const read = typeof config === 'function' ? config : () => config
  let applied = untrack(read)
  const bar = create(applied)
  setCurrent(bar)
  if (typeof config === 'function') {
    createEffect(
      on(read, (next) => {
        const changed: Partial<QikbarConfig> = {}
        let dirty = false
        for (const key of new Set([...Object.keys(next), ...Object.keys(applied)]) as Set<keyof QikbarConfig>) {
          if (!Object.is(next[key], applied[key])) {
            ;(changed as any)[key] = next[key]
            dirty = true
          }
        }
        applied = next
        if (dirty) bar.configure(changed)
      }, { defer: true }),
    )
  }
  onCleanup(() => {
    bar.destroy()
    if (current() === bar) setCurrent(null)
  })
  return bar
}

/** Provide a bar to the components below. */
export function QikbarProvider(props: { config?: QikbarConfig; children?: JSX.Element }): JSX.Element {
  const bar = createQikbar(() => props.config ?? {})
  return createComponent(QikbarContext.Provider, {
    value: () => bar,
    get children() {
      return props.children
    },
  })
}

function useInstance(): Accessor<QikbarInstance | null> {
  return useContext(QikbarContext) ?? current
}

/** Read the bar's state reactively and control it. */
export function useQikbar() {
  const bar = useInstance()
  const [state, setState] = createSignal<QikbarState>({ open: false, query: '', depth: 0, loading: false })
  createEffect(() => {
    const b = bar()
    if (!b) return
    onCleanup(b.on('change', setState))
  })
  return {
    bar,
    state,
    open: (o?: Parameters<QikbarInstance['open']>[0]) => bar()?.open(o),
    close: () => bar()?.close(),
    toggle: () => bar()?.toggle(),
    ask: (p?: string) => bar()?.ask(p),
  }
}

/** Register commands while the owner is alive. Pass an accessor to re-register on change. */
export function useCommands(commands: Command[] | Accessor<Command[]>) {
  const bar = useInstance()
  createEffect(() => {
    const b = bar()
    const list = typeof commands === 'function' ? commands() : commands
    if (b) onCleanup(b.register(list))
  })
}

/** Add a search source while the owner is alive. */
export function useSource(source: Source) {
  const bar = useInstance()
  createEffect(() => {
    const b = bar()
    if (b) onCleanup(b.addSource(source))
  })
}

/** Install an extension while the owner is alive. */
export function useExtension(extension: Extension, preferences?: Record<string, any>) {
  const bar = useInstance()
  createEffect(() => {
    const b = bar()
    if (b) onCleanup(b.use(extension, preferences))
  })
}

/** Render an inline bar into an element: `<div ref={inlineQikbar({ commands })} />`. */
export function inlineQikbar(config: QikbarConfig = {}) {
  return (el: HTMLElement) => {
    onMount(() => {
      const bar = create({ ...config, inline: el })
      onCleanup(() => bar.destroy())
    })
  }
}

export type { QikbarConfig, QikbarInstance, QikbarState } from '../core/types.js'
