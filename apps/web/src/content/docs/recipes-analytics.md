---
title: Analytics
description: Learn what users search for, what they run, and where the bar falls short.
group: Recipes
order: 5
label: Analytics
---

The bar is a direct line into what users want. Three hooks cover most needs.

```ts title="command-bar/analytics.ts"
import { createQikbar } from '@qikbar/qikbar'

const bar = createQikbar({
  // …
  onOpen: () => analytics.track('command_bar_opened', { path: location.pathname }),
  onRun: (item, action) =>
    analytics.track('command_run', {
      id: item.id,
      title: item.title,
      action: action.title,
      query: bar.query,
    }),
})

// Searches, debounced, so you learn what people look for.
let timer: ReturnType<typeof setTimeout>
bar.on('change', ({ open, query, depth }) => {
  clearTimeout(timer)
  if (!open || depth > 1 || query.length < 3) return
  timer = setTimeout(() => analytics.track('command_bar_search', { query }), 800)
})
```

## Find the gaps

Add a fallback that records searches that came up empty, and turns them into feedback:

```ts
fallbacks: [
  {
    title: 'Request “{query}”',
    icon: 'message',
    run: (ctx) => {
      analytics.track('command_bar_request', { query: ctx.query })
      ctx.toast({ title: 'Thanks! We’ll look into it.', style: 'success' })
    },
  },
]
```

> [!NOTE]
> Qikbar itself sends no telemetry. These hooks are yours to wire to PostHog, Segment, Plausible or anything else.
