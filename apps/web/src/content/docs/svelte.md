---
title: Svelte & SvelteKit
description: Create Qikbar in your root layout and navigate with goto.
group: Frameworks
order: 4
---

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { createQikbar } from 'qikbar'
  import { calculator } from 'qikbar/extensions'

  let { children } = $props()

  onMount(() => {
    const bar = createQikbar({
      navigate: (href) => goto(href),
      routes: [
        { path: '/', title: 'Home', icon: 'home' },
        { path: '/settings', title: 'Settings', icon: 'settings' },
      ],
      extensions: [calculator()],
    })
    return () => bar.destroy()
  })
</script>

{@render children()}
```

SvelteKit intercepts anchor clicks, so the [default navigator](/docs/routing#the-default-navigator) already does client-side navigation. `navigate` is optional.

## Share the instance

```ts
// src/lib/qikbar.ts
import { createQikbar } from 'qikbar'
export const bar = typeof window !== 'undefined' ? createQikbar({ autoIndex: true }) : undefined
```

## Page-level commands

```svelte
<script lang="ts">
  import { bar } from '$lib/qikbar'
  let { data } = $props()
  $effect(() => bar?.register([{ title: `Edit ${data.post.title}`, icon: 'pencil', href: `/posts/${data.post.id}/edit` }]))
</script>
```

`$effect` cleans up automatically because `register` returns the unregister function.

## AI endpoint

```ts
// src/routes/api/qikbar/+server.ts
import { createHandler, anthropic } from 'qikbar/server'
import { ANTHROPIC_API_KEY } from '$env/static/private'

const handler = createHandler({ provider: anthropic({ apiKey: ANTHROPIC_API_KEY }) })
export const POST = ({ request }) => handler(request)
```
