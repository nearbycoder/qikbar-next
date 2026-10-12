---
title: Views
description: Push lists, grids, Markdown documents, forms and AI chats onto the navigation stack.
group: Core Concepts
order: 4
---

Commands can open **views**. Views stack like pages: <kbd>Esc</kbd> or <kbd>⌫</kbd> on an empty input goes back, and the header shows a breadcrumb. There are five types:

| Helper | Shows |
| --- | --- |
| `list()` | A searchable list, optionally with a Markdown side panel |
| `grid()` | A grid of images or icons |
| `detail()` | A Markdown document with optional metadata. It can stream. |
| `form()` | Fields with validation |
| `chat()` | An AI conversation |

The helpers only add a `type` field. `list({...})` is the same as `{ type: 'list', ... }`.

```ts
import { list, grid, detail, form, chat } from 'qikbar'
```

## Opening a view

```ts
// As a command's primary action
{ title: 'Projects', view: list({ items: projects }) }

// Lazily: build the view when it opens
{ title: 'Projects', view: async (ctx) => list({ items: await api.projects() }) }

// Return it from run or an action
{ title: 'Projects', run: () => list({ items: projects }) }

// Imperatively
ctx.push(view)
bar.push(view)
bar.open({ view })
```

## List

```ts
list({
  title: 'Issues',                     // breadcrumb
  placeholder: 'Search issues…',
  items: [ { title: 'Fix login', subtitle: '#142', accessories: [{ tag: 'bug' }] } ],
  detail: true,                        // show item.detail Markdown in a side panel
  emptyView: { title: 'No issues', description: 'You are all caught up', icon: 'check-circle' },
  actions: [ /* actions available on every item */ ],
})
```

### Async items

Pass a function to load items. It receives the current query and an `AbortSignal`, and is debounced (`debounce`, 120 ms by default). With a loader, local filtering is off by default because your loader handles the query. Set `filter: true` to rank results locally.

```ts
list({
  items: async ({ query, signal }) => {
    const res = await fetch(`/api/issues?q=${query}`, { signal })
    return (await res.json()).map(toItem)
  },
})
```

### Streaming items

Return an async iterable to show results progressively, for example from pagination or a slow backend:

```ts
list({
  async *items({ query }) {
    let page = 1
    let all = []
    while (page <= 3) {
      all = [...all, ...(await api.search(query, page++))]
      yield all
    }
  },
})
```

### Sections

Items with a `section` field are grouped under headings, in the order the sections first appear.

### Detail panel

With `detail: true`, the selected item's `detail` field is rendered as Markdown next to the list. `detail` can be a string or an async function, and results are cached per item.

```ts
{ title: 'README.md', detail: async () => await fetchReadme() }
```

## Grid

```ts
grid({
  title: 'Team',
  columns: 5,           // default 5
  aspectRatio: '1',     // or '16/9'
  fit: 'cover',         // or 'contain'
  items: people.map((p) => ({ title: p.name, subtitle: p.role, image: p.avatar })),
})
```

Arrow keys move in two dimensions. `items` can be a loader, like in lists.

## Detail

```ts
detail({
  title: 'Release notes',
  markdown: '# v2.0\n\n- New things',
  metadata: [
    { label: 'Version', value: '2.0.0' },
    { label: 'Status', tag: { value: 'Stable', color: 'green' } },
    { label: 'Docs', value: 'Read more', href: '/docs' },
  ],
  actions: [action.copy(text, { title: 'Copy release notes' })],
})
```

`markdown` can be a string, an async function, or an **async iterable of chunks**, so you can stream AI output straight into it:

```ts
{
  title: 'Summarize this page',
  run: (ctx) => detail({ title: 'Summary', markdown: ctx.ai!.stream(`Summarize: ${document.body.innerText}`) }),
}
```

Markdown is rendered safely. HTML is escaped and `javascript:` links are removed. It supports headings, lists, task lists, tables, code blocks with a copy button, quotes, links and images.

## Form

```ts
form({
  title: 'New issue',
  submitLabel: 'Create issue',
  fields: [
    { name: 'title', label: 'Title', required: true, placeholder: 'Short summary' },
    { name: 'body', label: 'Description', type: 'textarea' },
    { name: 'priority', label: 'Priority', type: 'select', options: [{ title: 'High', value: 'high' }, { title: 'Low', value: 'low' }] },
    { name: 'due', label: 'Due', type: 'date' },
    { name: 'notify', label: 'Notify the team', type: 'checkbox', defaultValue: true },
    { name: 'estimate', label: 'Estimate', type: 'number', validate: (v) => (v > 40 ? 'Too big, split it up' : undefined) },
  ],
  async onSubmit(values, ctx) {
    await api.createIssue(values)
    ctx.toast({ title: 'Issue created', style: 'success' })
  },
})
```

Field types: `text`, `textarea`, `password`, `number`, `email`, `url`, `checkbox`, `select` and `date`.

Submit with <kbd>⌘</kbd><kbd>↵</kbd>, or <kbd>↵</kbd> in a single-line field. Like actions, `onSubmit` closes the bar when it finishes. Return `false` to stay, or return a view to push it.

## Chat

```ts
chat({ title: 'Support', prompt: 'How do I export my data?', system: 'You are Acme support.', tools: false })
```

It opens an AI conversation and sends `prompt` immediately if you set one. Requires [AI](/docs/ai). `bar.ask(prompt)` is a shortcut.

## Re-rendering

Call `ctx.render(view)` to replace the current view, for example after changing data. The search text and selection are kept:

```ts
const todos = () =>
  list({
    title: 'Todos',
    items: store.todos.map((t) => ({
      title: t.text,
      icon: t.done ? 'check-circle' : 'circle',
      run: (ctx) => {
        store.toggle(t.id)
        ctx.render(todos())
        return false
      },
    })),
  })
```

## Lifecycle

- Every view's `ctx.signal` is aborted when the view is popped or the bar closes. Pass it to `fetch`.
- `onClose()` runs when the view is removed.
- The navigation stack resets each time the bar opens.
