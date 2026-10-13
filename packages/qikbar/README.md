<p>
  <img src="https://raw.githubusercontent.com/nearbycoder/qikbar-next/main/assets/logo-wordmark-light.png" width="240" alt="Qikbar">
</p>

# qikbar

**The open-source command bar for any web app.** Raycast-style search, routing, actions, extensions and AI in one tiny, themeable package with zero dependencies.

📖 **Docs:** [qikbar.com/docs](https://qikbar.com/docs) · 🤖 **For AI agents:** [qikbar.com/llms-full.txt](https://qikbar.com/llms-full.txt)

```bash
npm install @qikbar/qikbar
```

## Vanilla

```ts
import { createQikbar, form } from '@qikbar/qikbar'
import { calculator, themeSwitcher } from '@qikbar/qikbar/extensions'

const bar = createQikbar({
  navigate: (href) => router.push(href),
  routes: [
    { path: '/', title: 'Dashboard', icon: 'home' },
    { path: '/settings', title: 'Settings', icon: 'settings' },
  ],
  commands: [
    { title: 'Toggle sidebar', icon: 'layout-dashboard', shortcut: 'mod+b', run: () => toggleSidebar() },
    {
      title: 'Invite teammate',
      icon: 'users',
      view: form({
        title: 'Invite teammate',
        fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
        onSubmit: async (values, ctx) => {
          await api.invite(values.email)
          ctx.toast({ title: 'Invite sent', style: 'success' })
        },
      }),
    },
  ],
  sources: [
    {
      id: 'projects',
      title: 'Projects',
      search: async ({ query, signal }) =>
        (await fetch(`/api/projects?q=${query}`, { signal }).then((r) => r.json())).map((p) => ({
          title: p.name,
          icon: 'folder',
          href: `/projects/${p.id}`,
        })),
    },
  ],
  extensions: [calculator(), themeSwitcher()],
  theme: 'linear',
})
```

## React

```tsx
import { Qikbar, useCommands } from '@qikbar/qikbar/react'

<Qikbar routes={routes} commands={commands} navigate={(href) => router.push(href)} />

// Page-specific commands, anywhere in the tree
useCommands([{ title: 'Archive project', icon: 'trash', run: archive }], [archive])
```

## Vue, Svelte, Solid and web components

```ts
import { Qikbar, useCommands } from '@qikbar/qikbar/vue' // <Qikbar :config="…" />
import { qikbarStore } from '@qikbar/qikbar/svelte' // $bar is the state
import { QikbarProvider, useCommands } from '@qikbar/qikbar/solid'
import '@qikbar/qikbar/element' // <qik-bar><qik-command href="/settings">Settings</qik-command></qik-bar>
```

## Mobile, personalization and more

```ts
createQikbar({
  launcher: 'touch', // a floating search button on phones
  labels: de, // from '@qikbar/qikbar/locales'
  semantic: { embed: proxyEmbeddings({ url: '/api/embed' }) }, // search by meaning
  webmcp: true, // let browser AI agents use your commands
  onEvent: (e) => posthog.capture(`command_bar_${e.type}`, e), // analytics
})
```

Users can pin commands (⌘⇧P) and give them aliases, lists can be `multiSelect` with bulk `runMany` actions, and `ctx.toast({ title, undo })` adds Undo with ⌘Z.

## Extensions from the registry

```bash
npx @qikbar/qikbar add weather currency
```

## AI

```ts
import { createQikbar, proxy } from '@qikbar/qikbar'
createQikbar({ routes, commands, ai: proxy('/api/qikbar') })

// app/api/qikbar/route.ts
import { createHandler, anthropic } from '@qikbar/qikbar/server'
export const POST = createHandler({ provider: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) })
```

Press <kbd>Tab</kbd> in the bar to ask AI. The model can search and run your commands. Providers: `anthropic`, `openai`, `gemini`, `openaiCompatible`, `ollama`, `browserAI`, `proxy`, `byok`. Add MCP servers' tools with `ai: { provider, mcp: [mcp({ url: '/api/mcp' })] }`.

## Script tag

```html
<script src="https://unpkg.com/@qikbar/qikbar/dist/qikbar.global.js"></script>
<script>Qikbar.createQikbar({ autoIndex: true })</script>
```

## License

MIT
