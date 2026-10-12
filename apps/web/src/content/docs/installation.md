---
title: Installation
description: Install Qikbar from npm or load it from a CDN with a script tag.
group: Getting Started
order: 2
---

## Package manager

```bash
npm install @qikbar/qikbar
# or
pnpm add @qikbar/qikbar
yarn add @qikbar/qikbar
bun add @qikbar/qikbar
```

Qikbar has **no dependencies**. React is an optional peer dependency, needed only if you import `@qikbar/qikbar/react`.

## Entry points

| Import | Use it for |
| --- | --- |
| `@qikbar/qikbar` | `createQikbar`, view helpers (`list`, `form`, …), AI providers, types |
| `@qikbar/qikbar/react` | `<Qikbar>`, `useQikbar`, `useCommands`, `useSource`, `useExtension`, `<QikbarTrigger>` |
| `@qikbar/qikbar/extensions` | Built-in extensions: `calculator`, `themeSwitcher`, `page`, `aiActions`, `shortcuts` |
| `@qikbar/qikbar/server` | `createHandler` for an AI proxy endpoint, plus server-side providers |
| `@qikbar/qikbar/theme` | Theme presets, `themeToCss`, the default stylesheet as a string |
| `@qikbar/qikbar/utils` | The fuzzy matcher, Markdown renderer, icons, hotkey helpers |
| `@qikbar/qikbar/styles.css` | The default stylesheet as a file (optional; styles are injected automatically) |

## CDN / script tag

You don't need a build step:

```html
<script src="https://unpkg.com/@qikbar/qikbar/dist/qikbar.global.js"></script>
<script>
  const bar = Qikbar.createQikbar({ autoIndex: true })
</script>
```

Everything is available on the `Qikbar` global, including the built-in extensions under `Qikbar.extensions`.

Or use native ES modules:

```html
<script type="module">
  import { createQikbar } from 'https://esm.sh/@qikbar/qikbar'
  createQikbar({ autoIndex: true })
</script>
```

## Requirements

- Any evergreen browser (Chrome, Edge, Firefox, Safari 16.4+)
- TypeScript 5+ for types (optional)
- Server helpers run on any runtime with Web `Request` / `Response`: Node 18+, Bun, Deno, Cloudflare Workers, Vercel and Netlify

## Styles

By default Qikbar injects one `<style id="qikbar-styles">` tag the first time the bar opens. If your [Content Security Policy](/docs/styling#content-security-policy) blocks inline styles, pass a `nonce`, or set `unstyled: true` and import `@qikbar/qikbar/styles.css` yourself.
