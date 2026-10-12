---
title: React
description: The Qikbar component, hooks for contextual commands, and a trigger button.
group: Frameworks
order: 1
---

```bash
npm install qikbar
```

## `<Qikbar>`

Render it once, near the root. Every [config option](/docs/api#config) is a prop:

```tsx
import { Qikbar } from 'qikbar/react'
import { calculator, themeSwitcher } from 'qikbar/extensions'

const extensions = [calculator(), themeSwitcher()]

export function App() {
  const navigate = useNavigate() // React Router
  return (
    <>
      <Qikbar
        routes={routes}
        commands={commands}
        extensions={extensions}
        navigate={(href) => navigate(href)}
        theme="linear"
      />
      <Routes>…</Routes>
    </>
  )
}
```

Props update the running instance, and only changed keys are applied. Callbacks (`navigate`, `onOpen`, `onClose`, `onRun`) can be inline functions. They're wrapped, so changing them never reconfigures the bar.

> [!IMPORTANT]
> Create extension instances **outside** the component, or memoize them, so they aren't reinstalled on every render.

`<Qikbar>` can also wrap your app and act as a provider, though hooks work without it:

```tsx
<Qikbar routes={routes}>
  <App />
</Qikbar>
```

## `useCommands`

Register commands while a component is mounted. This is ideal for page-specific actions:

```tsx
import { useCommands } from 'qikbar/react'

function ProjectPage({ project }) {
  useCommands(
    [
      { title: `Rename ${project.name}`, icon: 'pencil', section: 'This project', run: () => openRename(project) },
      { title: 'Archive project', icon: 'trash', section: 'This project', run: () => archive(project.id) },
    ],
    [project.id, project.name],
  )
  return …
}
```

The second argument is a dependency list. If you omit it, the commands re-register whenever the array identity changes.

## `useSource`

```tsx
useSource({
  id: 'members',
  title: 'Members',
  search: ({ query, signal }) => api.members.search(query, { signal }).then((ms) => ms.map(toItem)),
}, [])
```

## `useExtension`

```tsx
useExtension(github, { token: session.githubToken }, [session.githubToken])
```

## `useQikbar`

```tsx
const { open, close, toggle, ask, isOpen, query, depth, loading, bar } = useQikbar()

<button onClick={() => open()}>Search</button>
<button onClick={() => ask('Summarize my week')}>Ask AI</button>
```

`open({ query, view })` can prefill the search or open straight into a view.

## `<QikbarTrigger>`

A search-box style button. Style it with `className`:

```tsx
<QikbarTrigger className="flex w-64 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm text-muted-foreground" label="Search…" />
```

It renders the label and the platform-correct shortcut (⌘K or Ctrl K) after hydration, so server and client markup match.

## Inline

```tsx
<Qikbar inline className="mx-auto max-w-2xl" commands={commands} hotkey={false} />
```

## Server components

`qikbar/react` is marked `"use client"`. Import it from a client component.
