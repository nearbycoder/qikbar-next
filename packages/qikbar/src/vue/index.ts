/**
 * Vue 3 bindings.
 *
 * ```vue
 * <script setup lang="ts">
 * import { Qikbar, useCommands } from '@qikbar/qikbar/vue'
 * const router = useRouter()
 * </script>
 *
 * <template>
 *   <Qikbar :config="{ routes, navigate: (href) => router.push(href) }" />
 * </template>
 * ```
 */

import {
  defineComponent,
  getCurrentInstance,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  readonly,
  ref,
  shallowRef,
  watch,
  type InjectionKey,
  type PropType,
  type Ref,
  type ShallowRef,
} from 'vue'
import { createQikbar } from '../index.js'
import type { Command, Extension, QikbarConfig, QikbarInstance, QikbarState, Source } from '../core/types.js'

export const QikbarKey: InjectionKey<ShallowRef<QikbarInstance | null>> = Symbol('qikbar')

// The most recently mounted instance, so composables work outside <Qikbar>.
const current = shallowRef<QikbarInstance | null>(null)

function diff(next: QikbarConfig, prev: QikbarConfig): Partial<QikbarConfig> | undefined {
  const changed: Partial<QikbarConfig> = {}
  let dirty = false
  for (const key of new Set([...Object.keys(next), ...Object.keys(prev)]) as Set<keyof QikbarConfig>) {
    if (!Object.is(next[key], prev[key])) {
      ;(changed as any)[key] = next[key]
      dirty = true
    }
  }
  return dirty ? changed : undefined
}

/** Mounts a command bar. Put it once near the root of your app. */
export const Qikbar = defineComponent({
  name: 'Qikbar',
  props: {
    /** Everything you'd pass to `createQikbar()`. Changes are applied live. */
    config: { type: Object as PropType<Omit<QikbarConfig, 'inline'>>, default: () => ({}) },
    /** Render inline (always open) where the component is placed. */
    inline: { type: Boolean, default: false },
  },
  emits: { ready: (_bar: QikbarInstance) => true },
  setup(props, { slots, emit }) {
    const bar = shallowRef<QikbarInstance | null>(null)
    const el = ref<HTMLElement | null>(null)
    provide(QikbarKey, bar)
    let applied: QikbarConfig = {}

    const mount = () => {
      applied = { ...props.config }
      const instance = createQikbar({ ...applied, inline: props.inline ? (el.value ?? undefined) : undefined })
      bar.value = instance
      current.value = instance
      emit('ready', instance)
    }
    const unmount = () => {
      const instance = bar.value
      if (!instance) return
      instance.destroy()
      if (current.value === instance) current.value = null
      bar.value = null
    }

    onMounted(mount)
    onBeforeUnmount(unmount)
    watch(
      () => ({ ...props.config }),
      (next) => {
        const changed = diff(next, applied)
        applied = next
        if (changed && bar.value) bar.value.configure(changed)
      },
    )
    watch(
      () => props.inline,
      () => {
        unmount()
        mount()
      },
      { flush: 'post' },
    )

    return () => (props.inline ? h('div', { ref: el, class: 'qikbar-inline' }, slots.default?.()) : slots.default?.())
  },
})

/** The nearest bar (from `<Qikbar>` or the last one mounted). */
export function useQikbarInstance(): ShallowRef<QikbarInstance | null> {
  return getCurrentInstance() ? inject(QikbarKey, current) : current
}

export interface UseQikbar {
  bar: Readonly<ShallowRef<QikbarInstance | null>>
  state: Readonly<Ref<QikbarState>>
  open: (options?: Parameters<QikbarInstance['open']>[0]) => void
  close: () => void
  toggle: () => void
  ask: (prompt?: string) => void
}

/** Control the bar and read its state reactively. */
export function useQikbar(): UseQikbar {
  const bar = useQikbarInstance()
  const state = ref<QikbarState>({ open: false, query: '', depth: 0, loading: false })
  let off: (() => void) | undefined
  watch(
    bar,
    (b) => {
      off?.()
      off = b?.on('change', (s) => (state.value = s))
    },
    { immediate: true },
  )
  if (getCurrentInstance()) onBeforeUnmount(() => off?.())
  return {
    bar,
    state: readonly(state) as Readonly<Ref<QikbarState>>,
    open: (o) => bar.value?.open(o),
    close: () => bar.value?.close(),
    toggle: () => bar.value?.toggle(),
    ask: (p) => bar.value?.ask(p),
  }
}

/** Run `fn(bar)` while the component is mounted; re-runs when the bar or the getter's dependencies change. */
function whileMounted(fn: (bar: QikbarInstance) => () => void, deps?: () => unknown) {
  const bar = useQikbarInstance()
  let off: (() => void) | undefined
  const stop = watch(
    () => [bar.value, deps?.()] as const,
    ([b]) => {
      off?.()
      off = b ? fn(b) : undefined
    },
    { immediate: true },
  )
  onBeforeUnmount(() => {
    stop()
    off?.()
  })
}

/**
 * Register commands while the component is mounted. Pass a getter to re-register
 * when reactive state it reads changes.
 */
export function useCommands(commands: Command[] | (() => Command[])) {
  whileMounted(
    (b) => b.register(typeof commands === 'function' ? commands() : commands),
    typeof commands === 'function' ? commands : undefined,
  )
}

/** Add a search source while mounted. */
export function useSource(source: Source) {
  whileMounted((b) => b.addSource(source))
}

/** Install an extension while mounted. */
export function useExtension(extension: Extension, preferences?: Record<string, any>) {
  whileMounted((b) => b.use(extension, preferences))
}

export type { QikbarConfig, QikbarInstance, QikbarState } from '../core/types.js'
