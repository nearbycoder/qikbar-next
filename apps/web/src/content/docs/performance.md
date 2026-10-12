---
title: Performance
description: How Qikbar stays fast, from boot to the 100,000th row.
group: Reference
order: 2
---

## Boot: about 3.5 KB

`createQikbar()` returns a tiny shell (about 3.5 KB gzipped) that only listens for the hotkey and `data-qikbar-open` clicks. The UI, about 35 KB gzipped, loads in an `requestIdleCallback`, or immediately on first use, as a separate chunk. Calls you make before it loads (`register`, `use`, `on`…) are queued and replayed.

Nothing renders until the first open, and no styles are injected before then either.

To load the UI earlier, for example when the pointer hovers your search button:

```ts
button.addEventListener('pointerenter', () => bar.preload(), { once: true })
```

The script-tag build bundles everything (about 47 KB gzipped).

## Ranking: about 3 ms for 10,000 items

- Each item's searchable text is normalized once and cached in a `WeakMap`.
- A 27-bit character mask rejects non-matching items before any fuzzy work.
- The matcher is linear time per field. It does a greedy pass with boundary preference, plus a contiguous-substring check. There's no O(n·m) dynamic programming.
- Sorting is stable and limited to the top 300 results at the root.

## Rendering

- Lists over 150 rows are **virtualized**: only visible rows plus overscan are in the DOM. 100,000 rows scroll at 60fps.
- Rows are keyed and reused between keystrokes. Changing selection only flips two `aria-selected` attributes.
- Async updates are batched into one render per microtask. Streaming Markdown is throttled to animation frames.
- There's no framework runtime and no virtual DOM. The renderer updates the DOM directly.

## Network

- Sources are debounced (150 ms by default) and cancelled with `AbortSignal` when the query changes.
- Results from the previous query that still match stay visible while new ones load, so the list never flashes empty.
- AI providers stream over `fetch`. There's no SDK to download.

## Measuring

```ts
import { rank } from 'qikbar/utils'

console.time('rank')
rank(items, 'set inv')
console.timeEnd('rank')
```
