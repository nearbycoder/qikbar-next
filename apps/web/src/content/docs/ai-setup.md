---
title: Set up with AI
description: A copy-paste prompt that lets Claude Code, Cursor, Copilot or Codex add Qikbar to your app.
group: Getting Started
order: 4
---

Qikbar is designed so that a coding agent can integrate it in one pass. The agent reads your router, pages and API, then writes the config. Copy this prompt into Claude Code, Cursor, Windsurf, GitHub Copilot, Codex, or any other agent:

<div class="prompt-embed" data-prompt-embed></div>

You can also fetch it directly: [`/prompt.txt`](/prompt.txt).

## Documentation for AI

Every page in these docs is available as plain Markdown:

- **[/llms.txt](/llms.txt)**: an index of every page, following the [llms.txt](https://llmstxt.org) convention
- **[/llms-full.txt](/llms-full.txt)**: the entire documentation in one file
- **Any page + `.md`**: for example [`/docs/sources.md`](/docs/sources.md)

Each docs page also has **Copy as Markdown**, **Open in Claude** and **Open in ChatGPT** buttons at the top.

## Tips for agents

- Mount Qikbar **once**. In React, render `<Qikbar>` near the root. Elsewhere, call `createQikbar` in your client entry.
- Use the app's router for `navigate`. Never hard-code `window.location` if a router exists.
- Use `sources` for data that lives on the server, with the app's existing fetch layer.
- Theme with the app's existing CSS variables, for example `vars: { accent: 'var(--primary)' }`.
- Keep AI keys on the server with `createHandler` from `@qikbar/qikbar/server`.

## Add Qikbar to your project instructions

If your repo has an `AGENTS.md`, `CLAUDE.md` or `.cursor/rules`, add this line so future changes keep the bar up to date:

```md
When adding a page, route, or user-facing action, also register it with Qikbar (see src/command-bar.ts). Qikbar docs: https://qikbar.com/llms.txt
```
