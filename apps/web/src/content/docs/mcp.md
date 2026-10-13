---
title: MCP servers
description: Give the bar's AI the tools from any MCP server, so it can act in your other systems too.
group: AI
order: 6
label: MCP servers
---

The [Model Context Protocol](https://modelcontextprotocol.io) is the standard way to give AI models tools. With `mcp()`, every tool on an MCP server becomes something the bar's AI can call, next to your own commands and [tools](/docs/ai-tools).

```ts
import { createQikbar, mcp, proxy } from '@qikbar/qikbar'

createQikbar({
  ai: {
    provider: proxy({ url: '/api/ai' }),
    mcp: [mcp({ url: '/api/mcp' })],
  },
})
```

Now "file a bug for the checkout crash" can call your issue tracker's MCP tools, and "take me to billing" still runs your own commands.

## Connecting

`mcp()` speaks the Streamable HTTP transport (protocol version `2025-06-18`): JSON or SSE responses, sessions, pagination and session expiry are handled for you.

```ts
mcp({
  url: 'https://mcp.example.com/mcp',
  name: 'tracker', // tool names become tracker__create_issue
  headers: async () => ({ authorization: `Bearer ${await getToken()}` }),
  include: ['create_issue', 'search_issues'], // or exclude: [...]
})
```

Browsers can only reach MCP servers that allow CORS from your origin. For third-party servers, put a small proxy on your backend: it keeps tokens on the server and avoids CORS. Your own MCP server on the same origin needs nothing special; cookies are sent automatically (`credentials: 'same-origin'`).

## Confirmations

The AI asks the user before running any tool the server hasn't marked as read-only (`readOnlyHint: true`). Change that per server:

```ts
mcp({ url, confirm: true }) // always ask
mcp({ url, confirm: false }) // never ask (only for tools you trust)
mcp({ url, confirm: (tool) => tool.annotations?.destructiveHint === true })
```

## Caching and failures

Tool lists are fetched when a chat starts and cached for 5 minutes (`ttl`). Call `.refresh()` to reload sooner:

```ts
const tracker = mcp({ url: '/api/mcp' })
createQikbar({ ai: { provider, mcp: [tracker] } })

onDeploy(() => tracker.refresh())
```

If a server is down, its tools are skipped for that message and the chat carries on.

## Lower level

`MCPClient` gives you the protocol directly, for building your own integrations:

```ts
import { MCPClient } from '@qikbar/qikbar/ai'

const client = new MCPClient({ url: '/api/mcp' })
const tools = await client.listTools()
const text = await client.callTool('search_issues', { query: 'checkout' })
```

## The other direction

To let AI agents in the browser use *your* commands, see [WebMCP](/docs/webmcp).
