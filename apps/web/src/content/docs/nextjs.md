---
title: Next.js
description: Add Qikbar to a Next.js App Router project, with client-side navigation and an AI route handler.
group: Frameworks
order: 2
---

## 1. A client component

```tsx title="app/command-bar.tsx"
'use client'

import { useRouter } from 'next/navigation'
import { Qikbar } from 'qikbar/react'
import { proxy } from 'qikbar'
import { calculator, themeSwitcher, shortcuts } from 'qikbar/extensions'

const extensions = [calculator(), themeSwitcher(), shortcuts()]

const routes = [
  { path: '/dashboard', title: 'Dashboard', icon: 'layout-dashboard' },
  { path: '/projects', title: 'Projects', icon: 'folder' },
  { path: '/settings', title: 'Settings', icon: 'settings' },
]

export function CommandBar() {
  const router = useRouter()
  return (
    <Qikbar
      routes={routes}
      extensions={extensions}
      navigate={(href, { newTab }) => (newTab ? window.open(href) : router.push(href))}
      sources={[
        {
          id: 'projects',
          title: 'Projects',
          search: async ({ query, signal }) => {
            const res = await fetch(`/api/projects/search?q=${encodeURIComponent(query)}`, { signal })
            return (await res.json()).map((p: { id: string; name: string }) => ({ title: p.name, icon: 'folder', href: `/projects/${p.id}` }))
          },
        },
      ]}
      ai={proxy('/api/qikbar')}
    />
  )
}
```

Define the `sources` array outside the component, or memoize it, if you don't want it re-registered on every render.

## 2. Mount it in the root layout

```tsx title="app/layout.tsx"
import { CommandBar } from './command-bar'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CommandBar />
      </body>
    </html>
  )
}
```

## 3. Optional: an AI route

```ts title="app/api/qikbar/route.ts"
import { createHandler, anthropic } from 'qikbar/server'
import { auth } from '@/auth'

export const POST = createHandler({
  provider: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  authorize: async () => !!(await auth()),
})
```

## Page-specific commands

```tsx
'use client'
import { useCommands } from 'qikbar/react'

export function InvoiceActions({ invoice }) {
  useCommands([{ title: `Download invoice ${invoice.number}`, icon: 'download', url: invoice.pdfUrl }], [invoice.id])
  return null
}
```

## Pages Router

Use `useRouter` from `next/router` and render `<CommandBar />` in `_app.tsx`. Everything else is the same.
