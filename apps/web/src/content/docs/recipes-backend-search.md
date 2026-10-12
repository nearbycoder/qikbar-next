---
title: Search your backend
description: Connect sources to REST, Algolia, Supabase, GraphQL, tRPC and TanStack Query.
group: Recipes
order: 1
label: Backend search
---

A [source](/docs/sources) is just an async function, so any backend works. Each recipe returns items with `href`, so selecting one navigates with your router.

## REST

```ts title="sources/projects.ts"
import type { Source } from '@qikbar/qikbar'

export const projects: Source = {
  id: 'projects',
  title: 'Projects',
  minQueryLength: 2,
  async search({ query, signal }) {
    const res = await fetch(`/api/projects?q=${encodeURIComponent(query)}&limit=8`, { signal })
    if (!res.ok) return []
    const rows: { id: string; name: string; owner: string; updatedAt: string }[] = await res.json()
    return rows.map((p) => ({
      id: `project:${p.id}`,
      title: p.name,
      subtitle: p.owner,
      icon: 'folder',
      href: `/projects/${p.id}`,
      accessories: [{ date: p.updatedAt }],
    }))
  },
}
```

> [!TIP]
> Always pass `signal` to `fetch`. Qikbar cancels the request when the user keeps typing, so stale responses never overwrite fresh ones.

## Algolia

Use the REST API directly (no SDK needed) and keep the **search-only** key in the client:

```ts title="sources/algolia.ts"
const APP_ID = 'YOUR_APP_ID'
const SEARCH_KEY = 'YOUR_SEARCH_ONLY_KEY'

export const docs: Source = {
  id: 'algolia',
  title: 'Docs',
  debounce: 80,
  async search({ query, signal }) {
    const res = await fetch(`https://${APP_ID}-dsn.algolia.net/1/indexes/docs/query`, {
      method: 'POST',
      signal,
      headers: { 'x-algolia-application-id': APP_ID, 'x-algolia-api-key': SEARCH_KEY },
      body: JSON.stringify({ query, hitsPerPage: 8 }),
    })
    const { hits } = await res.json()
    return hits.map((h: any) => ({ id: h.objectID, title: h.title, subtitle: h.section, icon: 'book', href: h.url }))
  },
}
```

## Supabase

```ts title="sources/customers.ts"
import { supabase } from '@/lib/supabase'

export const customers: Source = {
  id: 'customers',
  title: 'Customers',
  async search({ query, signal }) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email, plan')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(8)
      .abortSignal(signal)
    return (data ?? []).map((c) => ({
      id: `customer:${c.id}`,
      title: c.name,
      subtitle: c.email,
      icon: 'user',
      href: `/customers/${c.id}`,
      accessories: [{ tag: { value: c.plan, color: c.plan === 'pro' ? 'purple' : 'gray' } }],
    }))
  },
}
```

> [!WARNING]
> Row-level security still applies. The source runs as the signed-in user, so they only see what they're allowed to see.

## GraphQL

```ts
async search({ query, signal }) {
  const res = await fetch('/graphql', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'query($q: String!) { searchIssues(q: $q, first: 8) { id title number } }', variables: { q: query } }),
  })
  const { data } = await res.json()
  return data.searchIssues.map((i) => ({ title: i.title, subtitle: `#${i.number}`, icon: 'circle', href: `/issues/${i.number}` }))
}
```

## tRPC

```ts
import { trpc } from '@/utils/trpc' // a vanilla tRPC client

export const issues: Source = {
  id: 'issues',
  title: 'Issues',
  search: async ({ query, signal }) =>
    (await trpc.issues.search.query({ q: query }, { signal })).map((i) => ({ title: i.title, href: `/issues/${i.id}` })),
}
```

## TanStack Query cache

Reuse your query cache so results that are already loaded appear instantly:

```ts
import { queryClient } from '@/lib/query'

export const teams: Source = {
  id: 'teams',
  title: 'Teams',
  search: ({ query, signal }) =>
    queryClient.fetchQuery({
      queryKey: ['teams', 'search', query],
      queryFn: () => api.teams.search(query, { signal }),
      staleTime: 30_000,
    }).then((teams) => teams.map((t) => ({ title: t.name, icon: 'users', href: `/teams/${t.slug}` }))),
}
```

## Search everything once, filter locally

For small datasets (fewer than about 5,000 rows), fetch everything once and let Qikbar rank it. Every keystroke after the first is instant:

```ts
let cache: Promise<Item[]> | undefined

export const people: Source = {
  id: 'people',
  title: 'People',
  filter: true,
  debounce: 0,
  search: () => (cache ??= fetch('/api/people').then((r) => r.json()).then((ps) => ps.map(toItem))),
}
```
