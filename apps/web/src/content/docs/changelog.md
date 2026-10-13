---
title: Changelog
description: What's new in each release.
group: Reference
order: 7
---

## 0.2.0

A big release: mobile, personalization, MCP and WebMCP, translations, and official bindings for every major framework. Everything is backwards compatible.

**New**

- **[Mobile & touch](/docs/mobile).** Automatic touch layout without keyboard hints, 48px rows, long-press (and right-click) for actions, no iOS zoom, and sizing that stays above the on-screen keyboard. A floating `launcher` button opens the bar on phones.
- **[Pins & aliases](/docs/pins-and-aliases).** Users pin commands to the top (⌘⇧P) and give them aliases that jump straight to them. `bar.pins()`, `bar.pin()`, `bar.aliases()` and `bar.setAlias()` control them from code.
- **[Undo toasts](/docs/toasts).** `ctx.toast({ title, undo })` adds an Undo button bound to ⌘Z; `action` adds any button.
- **[Multi-select](/docs/multi-select).** `multiSelect: true` on lists and grids, Shift/⌘-click and Shift+arrows to mark, and `runMany(items)` for bulk actions.
- **[Semantic search](/docs/semantic-search).** Find commands by meaning with embeddings from OpenAI, Gemini, Ollama or your server (`createEmbeddingsHandler`).
- **[MCP servers](/docs/mcp).** `ai.mcp: [mcp({ url })]` gives the AI the tools of any MCP server (Streamable HTTP, sessions, SSE).
- **[WebMCP](/docs/webmcp).** `webmcp: true` exposes your commands to AI agents in the browser through `document.modelContext`.
- **[Translations](/docs/i18n).** Every string is a label. Bundled locales: Spanish, French, German, Portuguese, Italian, Dutch, Japanese, Chinese and Korean.
- **[Usage events](/docs/recipes-analytics).** `onEvent` reports opens, searches, empty searches, runs (and how), AI questions, pins, undos and errors.
- **Framework bindings.** [Vue](/docs/vue), [Svelte](/docs/svelte), [SolidJS](/docs/solid) and a [`<qik-bar>` web component](/docs/web-component) (with declarative `<qik-command>` children, great for HTMX and [Angular](/docs/angular)).
- **[Registry & CLI](/docs/extension-registry).** `npx @qikbar/qikbar add weather` copies extensions from the registry into your project.

**Fixes**

- ⌘⇧/Ctrl+Shift shortcuts ending in N, J or P no longer get swallowed by the Emacs-style list navigation on Windows and Linux.
- Toasts now show on small screens.
- The search input can no longer pick up a host page's global `:focus-visible` outline.

## 0.1.0

The first open-source release, published as `@qikbar/qikbar`. Qikbar is now a free MIT-licensed library instead of a hosted SaaS.

**Library**

- `createQikbar` with commands, routes, sources, fallbacks, extensions and `autoIndex`
- Fuzzy ranking with word-boundary and acronym awareness, frecency and highlighting
- Views: list (with detail panel and virtualization), grid, detail (streaming Markdown), form, chat
- Actions: primary and secondary actions, the action panel, shortcuts, confirmations, toasts and HUD
- Inline arguments, global shortcuts and key sequences
- A lazy UI chunk: about 3.5 KB boots the shell
- 14 theme presets, CSS variables, class name slots, unstyled mode, automatic light and dark

**AI**

- Providers: `anthropic`, `openai`, `openaiCompatible`, `ollama`, `gemini`, `browserAI`, `proxy`, `byok`
- An agent loop where the model can `search`, `run` and `read_page`, plus your own tools
- `createHandler` and `toNodeHandler` in `@qikbar/qikbar/server`

**Ecosystem**

- `@qikbar/qikbar/react`: `<Qikbar>`, hooks and `<QikbarTrigger>`
- Built-in extensions: calculator, theme switcher, page tools, AI actions, shortcuts, AI settings
- Eleven example extensions, a theme builder, a playground, and docs for AI agents (`llms.txt`)
