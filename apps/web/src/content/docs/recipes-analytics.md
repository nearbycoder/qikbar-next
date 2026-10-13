---
title: Analytics
description: Learn what users search for, what they run, and where the bar falls short, with one event hook.
group: Recipes
order: 5
label: Analytics
---

`onEvent` reports what happens in the bar as plain objects. Send them to PostHog, Plausible, Segment, GA or your own endpoint.

```ts
import { createQikbar } from '@qikbar/qikbar'

createQikbar({
  onEvent: (event) => posthog.capture(`command_bar_${event.type}`, event),
})
```

You can also subscribe later: `bar.on('event', handler)`.

## Events

| `type` | Fields | When |
| --- | --- | --- |
| `open` / `close` | | The bar opens or closes |
| `search` | `query`, `results`, `view` | The user stopped typing for 800 ms (after async results arrive) |
| `no_results` | `query`, `view` | A search found nothing, the best signal for what's missing |
| `run` | `item`, `action`, `via`, `count?` | A command or action ran. `via` is `keyboard`, `click`, `shortcut`, `panel`, `ai` or `agent`. `count` is set for [bulk actions](/docs/multi-select). |
| `ask_ai` | `prompt` | A message was sent to the AI |
| `pin` / `unpin` | `item` | A command was [pinned](/docs/pins-and-aliases) |
| `alias` | `item`, `alias` | An alias was set (`null` when removed) |
| `undo` | `title` | Someone clicked Undo on a [toast](/docs/toasts) |
| `error` | `message` | A command threw |

`item` is `{ id, title, section }`, never the full object, so you don't leak data into analytics by accident.

## Examples

**PostHog**

```ts
onEvent: (e) => posthog.capture(`command_bar_${e.type}`, e)
```

**Plausible** (custom events take flat string props)

```ts
onEvent: (e) => {
  if (e.type === 'run') plausible('Command run', { props: { command: e.item.title, via: e.via } })
  if (e.type === 'no_results') plausible('Command bar: no results', { props: { query: e.query } })
}
```

**Google Analytics 4**

```ts
onEvent: (e) => gtag('event', `qikbar_${e.type}`, 'item' in e ? { item_id: e.item.id, item_name: e.item.title } : e)
```

**Your own endpoint**, batched:

```ts
const queue: QikbarEvent[] = []
createQikbar({ onEvent: (e) => queue.push({ ...e, at: Date.now() } as any) })
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && queue.length) navigator.sendBeacon('/api/events', JSON.stringify(queue.splice(0)))
})
```

## Find the gaps

`no_results` tells you what people expect your app to do. Pair it with a fallback that turns a dead end into feedback:

```ts
fallbacks: [
  {
    title: 'Request “{query}”',
    icon: 'message',
    run: (ctx) => {
      api.post('/feedback', { query: ctx.query })
      ctx.toast({ title: 'Thanks! We’ll look into it.', style: 'success' })
    },
  },
]
```

> [!NOTE]
> Qikbar itself sends no telemetry. Search queries can contain personal data, so treat them like any other user input.
