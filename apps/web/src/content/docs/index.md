---
title: Introduction
description: Qikbar is a free, open-source command bar for any web app. It brings search, routing, actions, extensions and AI together in one tiny package.
group: Getting Started
order: 1
---

Qikbar adds a **⌘K command bar** to your web app, like Raycast, Linear or Vercel have. Users press <kbd>⌘</kbd><kbd>K</kbd> (<kbd>Ctrl</kbd><kbd>K</kbd> on Windows and Linux) to:

- **Search** everything: pages, commands, and live records from your API
- **Navigate** anywhere using your existing router
- **Act** with keyboard-driven actions, forms and nested views
- **Ask AI** to do things: “open the Acme project”, “invite Sam to the team”

```ts
import { createQikbar } from 'qikbar'

createQikbar({
  routes: [
    { path: '/', title: 'Home', icon: 'home' },
    { path: '/settings', title: 'Settings', icon: 'settings' },
  ],
  commands: [{ title: 'Toggle dark mode', icon: 'moon', run: () => toggleTheme() }],
})
```

That's a complete integration. Press <kbd>⌘</kbd><kbd>K</kbd>.

## Why Qikbar

**Batteries included.** A command palette needs fuzzy ranking, keyboard handling, accessibility, async data, nested views, theming and, increasingly, AI. Qikbar ships all of it so you don't have to build it.

**Framework-agnostic.** The core is plain TypeScript with zero dependencies. Use the vanilla API anywhere, the React bindings in React and Next.js, or a single `<script>` tag.

**Fast.** About 3.5 KB boots the shell. The UI loads when the browser is idle. Ranking 10,000 commands takes about 3 ms, and lists with 100,000 rows are virtualized.

**AI-native.** Connect Claude, GPT, Gemini, a local model, or a proxy to your own server. Every command, route and data source becomes a tool the model can call. Users type what they want and Qikbar does it.

**Extensible.** The [extensions API](/docs/extensions) is inspired by Raycast. It bundles commands, live sources, AI tools and user preferences into a portable package.

**Yours.** MIT licensed. No accounts, no tracking, no SaaS.

## Core ideas

| Concept | What it is |
| --- | --- |
| [Commands](/docs/commands) | Items at the root of the bar: a title, an icon, and something to do |
| [Routes](/docs/routing) | Pages in your app, opened with your router |
| [Sources](/docs/sources) | Async search providers, for example records from your API |
| [Views](/docs/views) | Screens a command can push: list, grid, detail, form, chat |
| [Actions](/docs/actions) | What you can do with the selected item (<kbd>↵</kbd>, <kbd>⌘</kbd><kbd>↵</kbd>, <kbd>⌘</kbd><kbd>.</kbd>) |
| [Extensions](/docs/extensions) | Reusable bundles of commands, sources, tools and preferences |
| [AI](/docs/ai) | Chat and natural-language actions with any model |

Everything is **plain data**. A command is an object, a view is an object, and an action is an object with a `run` function. You can generate them, serialize most of them, and an AI model can reason about them.

## Next steps

- [Install Qikbar](/docs/installation)
- [Follow the quick start](/docs/quick-start)
- [Let your coding agent set it up](/docs/ai-setup)
