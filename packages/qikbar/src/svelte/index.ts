/**
 * Svelte bindings (Svelte 4 and 5). No compiler step: a store for state and
 * actions for inline bars.
 *
 * ```svelte
 * <script>
 *   import { onDestroy } from 'svelte'
 *   import { goto } from '$app/navigation'
 *   import { qikbarStore } from '@qikbar/qikbar/svelte'
 *
 *   const bar = qikbarStore({ routes, navigate: (href) => goto(href) })
 *   onDestroy(bar.destroy)
 *   onDestroy(bar.register([{ title: 'Archive', run: archive }]))
 * </script>
 *
 * <button on:click={() => bar.open()}>Search {$bar.query}</button>
 * ```
 */

import { createQikbar } from '../index.js'
import type { Command, QikbarConfig, QikbarInstance, QikbarState } from '../core/types.js'

type Subscriber<T> = (value: T) => void

export interface QikbarStore extends QikbarInstance {
  /** Svelte store contract: `$bar` is the current state. */
  subscribe(run: Subscriber<QikbarState>): () => void
  /** The underlying instance. */
  readonly instance: QikbarInstance
}

/** Create a bar whose state is a Svelte store. Call `destroy()` in `onDestroy`. */
export function qikbarStore(config: QikbarConfig = {}): QikbarStore {
  const bar = createQikbar(config)
  let state: QikbarState = { open: false, query: '', depth: 0, loading: false }
  const subs = new Set<Subscriber<QikbarState>>()
  bar.on('change', (s) => {
    state = s
    for (const fn of subs) fn(s)
  })
  // Bind every method so `on:click={bar.open}` and `onDestroy(bar.destroy)` work.
  const store = Object.create(bar) as QikbarStore
  for (const key of ['open', 'close', 'toggle', 'register', 'addSource', 'use', 'configure', 'push', 'pop', 'setQuery', 'toast', 'ask', 'commands', 'on', 'preload', 'pins', 'pin', 'aliases', 'setAlias', 'destroy'] as const) {
    ;(store as any)[key] = (bar[key] as (...a: unknown[]) => unknown).bind(bar)
  }
  Object.defineProperty(store, 'instance', { value: bar })
  store.subscribe = (run) => {
    subs.add(run)
    run(state)
    return () => subs.delete(run)
  }
  return store
}

/**
 * Action: render an inline (always open) bar inside an element.
 *
 * ```svelte
 * <div use:qikbar={{ commands, placeholder: 'Search docs…' }} />
 * ```
 */
export function qikbar(node: HTMLElement, config: QikbarConfig = {}) {
  let bar = createQikbar({ ...config, inline: node })
  let applied = config
  return {
    update(next: QikbarConfig = {}) {
      const changed: Partial<QikbarConfig> = {}
      for (const key of new Set([...Object.keys(next), ...Object.keys(applied)]) as Set<keyof QikbarConfig>) {
        if (!Object.is(next[key], applied[key])) (changed as any)[key] = next[key]
      }
      applied = next
      bar.configure(changed)
    },
    destroy() {
      bar.destroy()
      bar = undefined as unknown as QikbarInstance
    },
  }
}

/**
 * Action: register commands while an element is in the DOM — handy for
 * page-specific commands without touching component lifecycle.
 *
 * ```svelte
 * <section use:commands={{ bar, commands: [{ title: 'Export report', run }] }}>…</section>
 * ```
 */
export function commands(_node: HTMLElement, params: { bar: QikbarInstance; commands: Command[] }) {
  let off = params.bar.register(params.commands)
  return {
    update(next: { bar: QikbarInstance; commands: Command[] }) {
      off()
      off = next.bar.register(next.commands)
    },
    destroy() {
      off()
    },
  }
}

export type { QikbarConfig, QikbarInstance, QikbarState } from '../core/types.js'
