---
title: Multi-select
description: Let users mark several items in a list and run one action on all of them.
group: Core Concepts
order: 10
---

Add `multiSelect: true` to a list or grid view, and give actions a `runMany` function. Users mark items, then run the action once for all of them:

```ts
import { list } from '@qikbar/qikbar'

const people = list({
  title: 'Team',
  multiSelect: true,
  items: members.map((m) => ({
    id: m.id,
    title: m.name,
    subtitle: m.email,
    actions: [
      {
        title: 'Assign Issue',
        icon: 'user',
        run: () => assign([m.id]),
        runMany: (items) => assign(items.map((i) => i.id!)),
      },
      { title: 'Copy Email', icon: 'copy', run: (ctx) => ctx.copy(m.email) },
    ],
  })),
})
```

## Marking items

| Input | What it does |
| --- | --- |
| Shift + ↑ / ↓ | Mark rows while moving |
| ⌘-click / Ctrl-click | Mark or unmark one row |
| Shift-click | Mark every row from the last one you clicked |
| Click (while some are marked) | Mark or unmark that row |
| **Select** in the action panel (⌘⇧X) | Mark the selected row (handy on touch) |
| Escape | Clear the marks (press again to go back) |

Marked rows get a filled checkbox, and the footer shows "3 selected".

## Running actions

While items are marked:

- The action panel lists only actions that have `runMany`, plus **Select All** (⌘⇧A) and **Clear Selection**.
- ↵ runs the first action with `runMany`.
- `runMany(items, ctx)` receives the marked items in the order they appear. Return values work like `run`: return a view to push it, `false` to keep the bar open.

Marks are cleared after a bulk action succeeds. Marks survive typing in the search box, so users can search, mark, search again and mark more.

Inside any action, `ctx.selection` holds the marked items, in case a single-item action wants to know about them.

## Undo

Bulk changes are a good place for an [undo toast](/docs/toasts):

```ts
runMany: async (items, ctx) => {
  await archive(items)
  ctx.toast({ title: `Archived ${items.length} projects`, undo: () => restore(items) })
}
```
