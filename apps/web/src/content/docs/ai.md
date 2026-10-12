---
title: AI
description: Chat, answers and natural-language actions with any model. The AI can run your app's commands as tools.
group: AI
order: 1
label: Overview
---

Add one option and your command bar becomes an assistant that can act on the user's behalf:

```ts
import { createQikbar, proxy } from 'qikbar'

createQikbar({
  routes,
  commands,
  sources,
  ai: proxy('/api/qikbar'), // or anthropic(), openai(), gemini(), byok()…
})
```

## What users get

- **Ask AI from anywhere.** Type a question and press <kbd>Tab</kbd>, or pick the **Ask AI** fallback at the bottom of the results.
- **Natural-language actions.** “Take me to billing”, “open the Apollo project”, “invite sam@acme.co as an admin”. The model calls your commands and sources as tools.
- **Page awareness.** “Summarize this page” or “what does this error mean?” The model can read the current page if you allow it.
- **Follow-ups.** The chat keeps context. <kbd>Esc</kbd> stops a response, and pressing it again goes back.

## How it works

When a chat starts, Qikbar builds a system prompt with the page title, the current path, and a compact list of your commands (id, title, section). It also gives the model these tools:

| Tool | What it does |
| --- | --- |
| `search` | Searches commands, routes and every [source](/docs/sources), and returns items with ids |
| `run` | Runs an item's primary action by id: navigates, runs code, or opens a view |
| `read_page` | Returns the visible text of the current page (turn off with `pageContext: false`) |
| Your tools | Anything in `tools` or in an [extension's `tools`](/docs/ai-tools) |

The model runs in a loop. It streams text, calls tools, reads the results and continues, for up to `maxSteps` steps. Each tool call shows up as a small chip in the chat ("Opening Billing", "Searching 'acme'"). Destructive actions and tools marked `confirm` ask the user before running.

## Options

```ts
createQikbar({
  ai: {
    provider: anthropic({ apiKey }),   // required
    name: 'Acme AI',                   // label in the UI, default "AI"
    system: 'Our product is called Acme. Be friendly.', // added to the system prompt
    fallback: true,                    // show "Ask AI" in results, default true
    tools: true,                       // let the model run commands, default true
    pageContext: true,                 // allow read_page, default true
    maxSteps: 6,                       // tool-calling steps per message
    suggestions: ['What can I do here?', 'Open my latest invoice'],
  },
})
```

Passing a provider directly (`ai: anthropic()`) uses the defaults.

## Choosing where the key lives

| Setup | Use when | Key exposure |
| --- | --- | --- |
| [`proxy()`](/docs/ai-server) + `createHandler` | Production apps paying for AI | Server only ✅ |
| [`byok()`](/docs/ai-providers#bring-your-own-key) | Users bring their own key | Each user's own browser |
| `anthropic({ apiKey })` in the browser | Prototypes, internal tools, local dev | Visible to anyone who opens devtools ⚠️ |
| [`browserAI()`](/docs/ai-providers#chrome-built-in-ai) | Free, private, on-device | None |

> [!WARNING]
> An API key in browser code is public. Anyone can copy it from devtools. Use a [server proxy](/docs/ai-server) for anything real.

## Using AI in your own commands

`ctx.ai` is available everywhere:

```ts
{
  title: 'Write release notes',
  icon: 'wand',
  run: (ctx) => detail({
    title: 'Release notes',
    markdown: ctx.ai!.stream(`Write release notes for these commits:\n${commits}`),
  }),
}
```

`ctx.ai.ask(prompt)` returns the whole answer as a promise. `ctx.ai.stream(prompt)` returns an async iterable you can pass straight to a detail view.

The [`aiActions()`](/docs/built-in-extensions#ai-actions) extension adds *Summarize This Page*, *Explain Selected Text* and *Translate*.

## Opening a chat from code

```ts
bar.ask('How do I invite my team?')                     // opens and sends
bar.open({ view: chat({ system: 'You are a SQL expert.' }) }) // empty chat with a custom prompt
```

## Privacy

Qikbar sends nothing anywhere unless you configure a provider. When a chat runs, the provider receives the conversation, the page title and path, and your command titles. It receives page text only if the model calls `read_page`, and search results only if it calls `search`. Turn tools off with `tools: false` for a plain chat.
