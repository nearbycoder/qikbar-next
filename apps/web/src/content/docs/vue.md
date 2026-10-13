---
title: Vue & Nuxt
description: The official Vue 3 bindings, a Qikbar component and composables, with Vue Router and Nuxt.
group: Frameworks
order: 3
---

`@qikbar/qikbar/vue` has a `<Qikbar>` component and composables that clean up after themselves.

```vue title="src/App.vue"
<script setup lang="ts">
import { Qikbar } from '@qikbar/qikbar/vue'
import { calculator } from '@qikbar/qikbar/extensions'
import { useRouter } from 'vue-router'

const router = useRouter()
const config = {
  navigate: (href: string) => router.push(href),
  routes: router.getRoutes()
    .filter((r) => r.meta?.title)
    .map((r) => ({ path: r.path, title: String(r.meta.title) })),
  extensions: [calculator()],
  launcher: 'touch' as const,
}
</script>

<template>
  <Qikbar :config="config">
    <RouterView />
  </Qikbar>
</template>
```

`config` takes everything `createQikbar()` does. Changes to it are applied to the running bar (no remount).

## Contextual commands

`useCommands` registers commands while a component is mounted. Pass a getter to re-register when reactive state changes:

```vue
<script setup lang="ts">
import { useCommands } from '@qikbar/qikbar/vue'

const props = defineProps<{ project: { id: string; name: string } }>()

useCommands(() => [
  { title: `Archive ${props.project.name}`, icon: 'trash', run: () => archive(props.project.id) },
])
</script>
```

`useSource(source)` and `useExtension(ext, prefs)` work the same way.

## Control and state

```vue
<script setup lang="ts">
import { useQikbar } from '@qikbar/qikbar/vue'
const { open, state } = useQikbar()
</script>

<template>
  <button @click="open()">Search {{ state.open ? '(open)' : '' }}</button>
</template>
```

Or skip the script entirely: `<button data-qikbar-open>Search</button>`.

## Inline

```vue
<Qikbar inline :config="{ commands, placeholder: 'Search docs…' }" />
```

## Nuxt

Use the component in `app.vue` (it only creates the bar on the client), or make a client plugin:

```ts title="plugins/qikbar.client.ts"
import { createQikbar } from '@qikbar/qikbar'

export default defineNuxtPlugin(() => {
  const bar = createQikbar({ navigate: (href) => navigateTo(href), autoIndex: true })
  return { provide: { qikbar: bar } }
})
```

AI endpoint in `server/api/qikbar.post.ts`:

```ts
import { createHandler, anthropic } from '@qikbar/qikbar/server'
const handler = createHandler({ provider: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) })
export default defineEventHandler((event) => handler(toWebRequest(event)))
```
