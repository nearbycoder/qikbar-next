---
title: WebMCP
description: Expose your app's commands to AI agents in the browser, with one option.
group: AI
order: 7
---

[WebMCP](https://webmachinelearning.github.io/webmcp/) lets a web page offer tools to AI agents running in the browser: Chrome's built-in agent, browser extensions, or desktop assistants that drive a browser. With `webmcp: true`, every command in your bar becomes something those agents can find and run.

```ts
createQikbar({ commands, routes, webmcp: true })
```

That's it. When the browser supports WebMCP, Qikbar registers these tools with `document.modelContext`:

| Tool | What it does |
| --- | --- |
| `qikbar_list_commands` | Lists every command and page, with ids |
| `qikbar_search` | Searches commands, pages and your [sources](/docs/sources) (live data) |
| `qikbar_run` | Opens a page or runs a command by id, with arguments |
| `qikbar_<tool>` | Each of your [AI tools](/docs/ai-tools), and tools from extensions |

So an agent asked to "open the Acme billing page" can search your app's data and navigate there, the same way your users do with ⌘K. You don't write any agent-specific code.

## Options

```ts
createQikbar({
  webmcp: {
    prefix: 'acme', // acme_search, acme_run, …
    run: false, // read-only: list and search, but don't run anything
    tools: false, // don't expose ai.tools / extension tools
  },
})
```

## Safety

- Destructive commands (`style: 'destructive'`) ask the user to confirm before an agent can run them, and tools with `confirm` ask too.
- Search results are marked as untrusted content, so agents treat record text as data, not instructions.
- Runs by agents are reported to [`onEvent`](/docs/recipes-analytics) with `via: 'agent'`.
- Use `run: false` if agents should only look things up.

## Browser support

WebMCP is new. Qikbar uses `document.modelContext.registerTool()` (and the older `navigator.modelContext`), and does nothing when neither exists, so it's safe to turn on today. The [`@mcp-b/webmcp-polyfill`](https://www.npmjs.com/package/@mcp-b/webmcp-polyfill) adds support to other browsers.

With `webmcp` on, the bar's UI loads right away (instead of when the browser is idle), so tools are available as soon as an agent looks.
