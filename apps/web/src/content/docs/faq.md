---
title: FAQ
description: Common questions about Qikbar.
group: Reference
order: 6
---

### Is it really free?

Yes. Qikbar is MIT licensed with no paid tier, no telemetry and no account. AI features use your own provider and keys.

### Does it work without React?

Yes. The core has no dependencies and works in any framework or none. `qikbar/react` is an optional thin wrapper.

### Does it work with SSR?

Yes. `createQikbar` does nothing on the server. `qikbar/react` is marked `"use client"`.

### How do I open it from a button?

Add `data-qikbar-open` to any element, call `bar.open()`, or use `<QikbarTrigger>` in React.

### Can I prefill the search?

`bar.open({ query: 'invoices' })`, or `<button data-qikbar-open data-qikbar-query="invoices">`.

### Can I change the hotkey?

`hotkey: 'mod+p'`, `hotkey: ['mod+k', '/']`, or `hotkey: false`.

### How do I hide a command unless it's relevant?

Use `when: () => user.isAdmin` to hide it conditionally, or `searchOnly: true` to show it only when the user searches.

### Will AI cost me money?

Only if you configure a paid provider. You can use `byok()` so users bring their own key, `browserAI()` for Chrome's free on-device model, or `ollama()` for local models.

### Is my API key safe?

In the browser, no key is safe. Use [`createHandler`](/docs/ai-server) on your server with `proxy()` on the client for production.

### Can the AI do something destructive?

Only through the commands and tools you provide. Actions with `style: 'destructive'` and tools with `confirm` ask the user first. Turn off tool use entirely with `ai: { provider, tools: false }`.

### How do I test commands?

Commands are data. Call `command.run(fakeCtx)` in a unit test, or open the bar in a DOM test environment (happy-dom or jsdom) and dispatch key events. The Qikbar repo has examples.

### Can I use it in a browser extension or Electron?

Yes. It's plain DOM code with no framework or Node APIs.

### How do I contribute?

See [CONTRIBUTING.md](https://github.com/nearbycoder/qikbar-next/blob/main/CONTRIBUTING.md). Issues, extensions and themes are welcome.
