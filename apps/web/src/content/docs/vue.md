---
title: Vue & Nuxt
description: Use Qikbar's vanilla API from Vue 3 or Nuxt, with Vue Router navigation and composables.
group: Frameworks
order: 3
---

Qikbar doesn't need a Vue wrapper. Create it once and use it from anywhere.

```ts title="src/command-bar.ts"
import { createQikbar } from 'qikbar'
import { calculator, themeSwitcher } from 'qikbar/extensions'
import router from './router'

export const bar = createQikbar({
  navigate: (href) => router.push(href),
  routes: router.getRoutes()
    .filter((r) => r.meta?.title)
    .map((r) => ({ path: r.path, title: String(r.meta.title), icon: (r.meta.icon as string) ?? 'file' })),
  extensions: [calculator(), themeSwitcher()],
})
```

```ts title="src/main.ts"
import './command-bar'
```

## A composable for contextual commands

```ts title="src/composables/useCommands.ts"
import { onMounted, onUnmounted, watch, type Ref } from 'vue'
import type { Command } from 'qikbar'
import { bar } from '../command-bar'

export function useCommands(commands: Ref<Command[]> | Command[]) {
  let off: (() => void) | undefined
  const register = (cmds: Command[]) => {
    off?.()
    off = bar.register(cmds)
  }
  if (Array.isArray(commands)) onMounted(() => register(commands))
  else watch(commands, register, { immediate: true })
  onUnmounted(() => off?.())
}
```

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useCommands } from '@/composables/useCommands'
const props = defineProps<{ project: { id: string; name: string } }>()
useCommands(computed(() => [{ title: `Archive ${props.project.name}`, icon: 'trash', run: () => archive(props.project.id) }]))
</script>
```

## Trigger button

```vue
<button data-qikbar-open>Search… <kbd>⌘K</kbd></button>
```

## Nuxt

Create a client-only plugin:

```ts title="plugins/qikbar.client.ts"
import { createQikbar } from 'qikbar'

export default defineNuxtPlugin(() => {
  const bar = createQikbar({ navigate: (href) => navigateTo(href), autoIndex: true })
  return { provide: { qikbar: bar } }
})
```

Add an AI endpoint in `server/api/qikbar.post.ts`:

```ts
import { createHandler, anthropic } from 'qikbar/server'
const handler = createHandler({ provider: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) })
export default defineEventHandler((event) => handler(toWebRequest(event)))
```
