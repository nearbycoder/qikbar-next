---
title: Troubleshooting
description: Fixes for the most common problems.
group: Reference
order: 5
---

### The hotkey doesn't open the bar

- Make sure `createQikbar` runs in the browser, not only on the server.
- Another library might handle <kbd>⌘</kbd><kbd>K</kbd> first and call `preventDefault()`. Try `hotkey: 'mod+shift+k'` to confirm, then remove the conflict.
- Single-key hotkeys like `/` are ignored while focus is in a text field. That's on purpose.

### Navigation reloads the page

Pass your router's function as `navigate`. Without it, Qikbar clicks a link, which only stays client-side if your router intercepts anchor clicks. See [Routing](/docs/routing#connect-your-router).

### Commands registered in React disappear or duplicate

`useCommands(commands, deps)` re-registers whenever `deps` change. With no `deps`, it re-registers whenever the array identity changes, which happens on every render if you create the array inline. Pass a dependency list, or `useMemo` the array.

### An extension asks for preferences every time

Required preferences must be non-empty. If you pass values when installing (`[ext, { token }]`), make sure they're defined when the bar is created. In React, pass a stable object.

### Styles look wrong

- Another stylesheet may target `.qb-*` classes or global elements with high specificity. Qikbar's reset has zero specificity, so a rule like `div { padding: 8px }` doesn't affect it, but `#app div` would.
- If your CSP blocks inline styles, pass `nonce`, or import `@qikbar/qikbar/styles.css` with `unstyled: true`.

### The bar is behind my modal or header

Raise `--qb-z` (default `2147483000`):

```css
.qb-root { --qb-z: 2147483646; }
```

### AI says “AI is not configured”

Pass `ai` to `createQikbar`. With `byok()`, the user needs to add a key in **AI Settings** first.

### AI requests fail with CORS errors

Anthropic, OpenAI and Gemini allow browser requests, but many OpenAI-compatible providers don't. Use a [server proxy](/docs/ai-server).

### The first open is slow

The UI chunk loads when the browser is idle. If the user opens the bar right after page load, it loads then. Call `bar.preload()` earlier, for example when the pointer enters your search button.
