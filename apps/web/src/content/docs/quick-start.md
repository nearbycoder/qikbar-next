---
title: Quick start
description: Add a fully featured command bar to your app in five minutes.
group: Getting Started
order: 3
---

This guide builds a command bar with routes, commands, live search and a form. It takes about five minutes.

## 1. Create the bar

Call `createQikbar` once, on the client:

```ts
import { createQikbar } from 'qikbar'

export const bar = createQikbar({
  placeholder: 'Search or jump to…',
})
```

Press <kbd>⌘</kbd><kbd>K</kbd>. The bar is empty, so let's fill it.

> [!TIP]
> Using React? Render `<Qikbar />` from `qikbar/react` instead. It takes the same options as props. See [React](/docs/react).

## 2. Add routes

Routes are pages in your app. Pass your router's navigate function so navigation stays client-side:

```ts
createQikbar({
  navigate: (href) => router.push(href),
  routes: [
    { path: '/', title: 'Dashboard', icon: 'home' },
    { path: '/projects', title: 'Projects', icon: 'folder' },
    { path: '/settings/billing', title: 'Billing', icon: 'credit-card', keywords: ['invoice', 'plan'] },
  ],
})
```

If you don't pass `navigate`, Qikbar clicks a matching link on the page, which works with most routers. Otherwise it does a normal navigation. See [Routing](/docs/routing).

## 3. Add commands

Commands run code. Group them with `section` and give them global shortcuts:

```ts
commands: [
  { title: 'New project', icon: 'plus', section: 'Projects', shortcut: 'c p', run: () => openNewProjectDialog() },
  { title: 'Toggle sidebar', icon: 'layout-dashboard', shortcut: 'mod+b', run: () => toggleSidebar() },
  { title: 'Sign out', icon: 'log-out', run: () => signOut() },
]
```

`shortcut: 'c p'` means press <kbd>C</kbd> then <kbd>P</kbd>, anywhere in your app.

## 4. Search your data

A **source** searches your API as the user types. Qikbar debounces the calls, cancels stale requests, and merges the results into their own section:

```ts
sources: [
  {
    id: 'projects',
    title: 'Projects',
    async search({ query, signal }) {
      const res = await fetch(`/api/projects?q=${encodeURIComponent(query)}`, { signal })
      const projects = await res.json()
      return projects.map((p) => ({
        title: p.name,
        subtitle: p.owner,
        icon: 'folder',
        href: `/projects/${p.id}`,
      }))
    },
  },
]
```

## 5. Push a view

Commands can open **views**: lists, grids, Markdown details, forms and AI chats. Here's a form:

```ts
import { form } from 'qikbar'

commands: [
  {
    title: 'Invite teammate',
    icon: 'users',
    view: form({
      title: 'Invite teammate',
      fields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'role', label: 'Role', type: 'select', options: [{ title: 'Member', value: 'member' }, { title: 'Admin', value: 'admin' }] },
      ],
      async onSubmit(values, ctx) {
        await api.invite(values)
        ctx.toast({ title: `Invited ${values.email}`, style: 'success' })
      },
    }),
  },
]
```

## 6. Add extensions

```ts
import { calculator, themeSwitcher, shortcuts } from 'qikbar/extensions'

createQikbar({
  // …
  extensions: [calculator(), themeSwitcher(), shortcuts()],
})
```

Now typing `12 * 7` or `5 km in mi` shows the answer instantly.

## 7. Make it yours

Pick a [theme preset](/docs/theming) or match your design tokens:

```ts
createQikbar({
  theme: { preset: 'linear', vars: { accent: 'var(--brand)', radius: '10px', font: 'inherit' } },
})
```

## 8. Optional: AI

```ts
import { proxy } from 'qikbar'

createQikbar({ ai: proxy('/api/qikbar') })
```

Users can now press <kbd>Tab</kbd> to ask AI, and the model can run your commands. See [AI](/docs/ai) to set up the server route.

## Add a trigger button

Any element with `data-qikbar-open` opens the bar:

```html
<button data-qikbar-open>Search… <kbd>⌘K</kbd></button>
```

Or call `bar.open()`.
