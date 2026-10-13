---
title: Svelte & SvelteKit
description: A store for state, actions for inline bars and page commands. Works with Svelte 4 and 5.
group: Frameworks
order: 4
---

`@qikbar/qikbar/svelte` needs no compiler plugin: the bar is a store, and inline bars and page commands are actions.

```svelte title="src/routes/+layout.svelte"
<script lang="ts">
  import { bar } from '$lib/qikbar'

  let { children } = $props()
</script>

<button onclick={() => bar?.open()}>
  Search {#if $bar?.open}…{/if}
</button>

{@render children()}
```

```ts title="src/lib/qikbar.ts"
import { browser } from '$app/environment'
import { goto } from '$app/navigation'
import { qikbarStore } from '@qikbar/qikbar/svelte'

export const bar = browser
  ? qikbarStore({
      navigate: (href) => goto(href),
      routes: [
        { path: '/', title: 'Home', icon: 'home' },
        { path: '/settings', title: 'Settings', icon: 'settings' },
      ],
      launcher: 'touch',
    })
  : undefined
```

`$bar` is the bar's state (`{ open, query, depth, loading }`), and every method (`open`, `register`, `destroy`, …) is bound, so `onclick={bar.open}` works.

## Page commands

`register` returns its cleanup function, so `$effect` handles it:

```svelte
<script lang="ts">
  import { bar } from '$lib/qikbar'
  let { data } = $props()
  $effect(() => bar?.register([{ title: `Edit ${data.post.title}`, icon: 'pencil', href: `/posts/${data.post.id}/edit` }]))
</script>
```

In Svelte 4, use `onDestroy(bar.register([...]))`, or the `commands` action:

```svelte
<script>
  import { commands } from '@qikbar/qikbar/svelte'
  import { bar } from '$lib/qikbar'
</script>

<section use:commands={{ bar, commands: [{ title: 'Export report', run: exportReport }] }}>…</section>
```

## Inline

```svelte
<script>
  import { qikbar } from '@qikbar/qikbar/svelte'
</script>

<div use:qikbar={{ commands, placeholder: 'Search docs…' }}></div>
```

The action applies config changes and destroys the bar when the element goes away.

## AI endpoint

```ts title="src/routes/api/qikbar/+server.ts"
import { createHandler, anthropic } from '@qikbar/qikbar/server'
import { ANTHROPIC_API_KEY } from '$env/static/private'

const handler = createHandler({ provider: anthropic({ apiKey: ANTHROPIC_API_KEY }) })
export const POST = ({ request }) => handler(request)
```
