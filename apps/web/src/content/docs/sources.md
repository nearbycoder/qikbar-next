---
title: Sources
description: Search your API, database or any async data as the user types.
group: Core Concepts
order: 3
---

A **source** provides results for the root search. Qikbar debounces the calls, cancels stale requests with an `AbortSignal`, and shows each source's results in its own section:

```ts
createQikbar({
  sources: [
    {
      id: 'customers',
      title: 'Customers',
      minQueryLength: 2,
      debounce: 200,
      limit: 6,
      async search({ query, signal }) {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(query)}`, { signal })
        const rows = await res.json()
        return rows.map((c) => ({
          id: `customer:${c.id}`,
          title: c.name,
          subtitle: c.email,
          icon: c.avatarUrl,
          href: `/customers/${c.id}`,
          accessories: [{ tag: { value: c.plan, color: 'purple' } }],
        }))
      },
    },
  ],
})
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `id` | — | **Required.** A unique id. |
| `title` | `"Results"` | The section heading. |
| `search({ query, signal, ctx })` | — | **Required.** Returns items, or a promise of items. |
| `minQueryLength` | `1` | Don't search below this length. |
| `debounce` | `150` | Milliseconds to wait after typing stops. |
| `limit` | `8` | The most results to show. |
| `filter` | `false` | Re-rank results with the local fuzzy matcher. Useful when `search` returns everything. |
| `position` | `"bottom"` | `"top"` puts results above matching commands (the calculator does this). |

## Behavior

- While a source loads, a thin progress bar animates under the input.
- Results from the previous query that still match stay visible, so the list doesn't flash empty.
- The top result stays selected as results arrive, unless the user has moved the selection.
- An error in one source is logged and doesn't affect other sources.
- AI models can query your sources through the built-in `search` tool. See [AI tools](/docs/ai-tools).

## Static data with local filtering

If your dataset is small, return everything and let Qikbar rank it:

```ts
{
  id: 'docs',
  title: 'Documentation',
  filter: true,
  debounce: 0,
  search: async () => (await getDocsIndex()).map((d) => ({ title: d.title, href: d.url })),
}
```

## Adding sources at runtime

```ts
const remove = bar.addSource(mySource)
```

In React, use [`useSource`](/docs/react#usesource).
