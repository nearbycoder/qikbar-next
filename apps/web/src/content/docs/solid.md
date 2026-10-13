---
title: SolidJS
description: A provider, primitives and reactive commands for SolidJS and SolidStart.
group: Frameworks
order: 5
---

```tsx title="src/app.tsx"
import { QikbarProvider } from '@qikbar/qikbar/solid'
import { useNavigate } from '@solidjs/router'

export default function App(props) {
  const navigate = useNavigate()
  return (
    <QikbarProvider config={{ routes, navigate: (href) => navigate(href), launcher: 'touch' }}>
      {props.children}
    </QikbarProvider>
  )
}
```

The bar belongs to the provider's owner and is destroyed with it. `config` is tracked, so signals you read in it are applied live.

## Commands from components

```tsx
import { useCommands } from '@qikbar/qikbar/solid'

function ProjectPage(props) {
  useCommands(() => [
    { title: `Archive ${props.project.name}`, icon: 'trash', run: () => archive(props.project.id) },
  ])
  return <div>…</div>
}
```

Pass an accessor and the commands re-register when the signals it reads change. `useSource` and `useExtension` work the same way.

## State and control

```tsx
import { useQikbar } from '@qikbar/qikbar/solid'

function SearchButton() {
  const { open, state } = useQikbar()
  return <button onClick={() => open()}>{state().open ? 'Searching…' : 'Search'}</button>
}
```

## Without the provider

`createQikbar` (from `@qikbar/qikbar/solid`) creates a bar owned by the current reactive scope:

```tsx
const bar = createQikbar(() => ({ placeholder: placeholder() }))
```

## Inline

```tsx
import { inlineQikbar } from '@qikbar/qikbar/solid'

<div ref={inlineQikbar({ commands, placeholder: 'Search docs…' })} />
```

## SolidStart

The bar only runs in the browser; the provider does nothing during SSR. For the AI endpoint, use `createHandler` from `@qikbar/qikbar/server` in an API route:

```ts title="src/routes/api/qikbar.ts"
import { createHandler, anthropic } from '@qikbar/qikbar/server'
const handler = createHandler({ provider: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) })
export const POST = ({ request }) => handler(request)
```
