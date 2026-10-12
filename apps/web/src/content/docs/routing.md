---
title: Routing
description: Turn your app's pages into searchable destinations and navigate with your existing router.
group: Core Concepts
order: 2
---

## Routes

```ts
createQikbar({
  routes: [
    { path: '/', title: 'Home', icon: 'home' },
    { path: '/projects', title: 'Projects', icon: 'folder', keywords: ['work'] },
    { path: '/settings/billing', title: 'Billing', icon: 'credit-card', section: 'Settings', shortcut: 'g b' },
  ],
})
```

Each route becomes a command with `href: path`, in the **Navigation** section unless you set `section`. Routes get *Open*, *Open in New Tab* (<kbd>⌘</kbd><kbd>↵</kbd>) and *Copy Link* actions.

Any command or list item can navigate with `href`, and code can navigate with `ctx.navigate(href)`.

## Connect your router

Pass `navigate` so navigation is client-side:

```ts
createQikbar({ navigate: (href, { newTab }) => (newTab ? window.open(href) : router.push(href)) })
```

| Router | `navigate` |
| --- | --- |
| Next.js (App Router) | `const router = useRouter()` → `(href) => router.push(href)` |
| React Router | `const navigate = useNavigate()` → `(href) => navigate(href)` |
| TanStack Router | `(href) => router.navigate({ to: href })` |
| Vue Router | `(href) => router.push(href)` |
| SvelteKit | `import { goto } from '$app/navigation'` → `(href) => goto(href)` |
| Nuxt | `(href) => navigateTo(href)` |
| Angular | `(href) => this.router.navigateByUrl(href)` |
| Remix / React Router 7 | `(href) => navigate(href)` |
| Astro (View Transitions) | `import { navigate } from 'astro:transitions/client'` → `(href) => navigate(href)` |

### The default navigator

If you don't pass `navigate`, Qikbar:

1. Clicks an existing `<a href>` on the page with the same `href`. This runs framework link handlers, such as Next.js `<Link>`.
2. Otherwise clicks a temporary anchor. Routers that intercept anchor clicks pick this up: SvelteKit, Astro, Nuxt, Turbo, htmx-boost and others.
3. Otherwise the browser does a normal navigation.

This works for most apps without configuration.

## Index your page automatically

`autoIndex` turns links and elements already on your page into commands. You don't need to configure anything:

```ts
createQikbar({ autoIndex: true })
```

It indexes:

- **Links** in `nav`, `header`, `aside` and `[data-qikbar-index]`. A link's section comes from `data-qikbar-section` or the nav's `aria-label`.
- **Elements with `data-qikbar`**, which become commands that click the element:

```html
<button data-qikbar="Sign out" data-qikbar-icon="log-out" data-qikbar-keywords="logout,exit">Sign out</button>
<button data-qikbar="Export CSV" data-qikbar-section="Reports" data-qikbar-shortcut="mod+e">Export</button>
```

Add `data-qikbar-ignore` to skip a region. Indexing runs each time the bar opens, so it always reflects the current page.

```ts
createQikbar({
  autoIndex: { links: 'nav a, .sidebar a', elements: true, section: 'Pages' },
})
```

## Dynamic routes

For routes with parameters, like `/projects/:id`, use a [source](/docs/sources) that returns items with `href`:

```ts
sources: [{
  id: 'projects',
  title: 'Projects',
  search: async ({ query }) => (await api.projects.search(query)).map((p) => ({
    title: p.name, icon: 'folder', href: `/projects/${p.id}`,
  })),
}]
```
