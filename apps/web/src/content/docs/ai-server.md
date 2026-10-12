---
title: Server proxy
description: Keep API keys on your server with one function. Works with Next.js, Hono, Express, Bun, Deno and Cloudflare Workers.
group: AI
order: 3
---

`createHandler` turns any provider into an endpoint that streams to the `proxy()` provider in the browser. Tools still run in the browser, where your commands live. The server only talks to the model.

```ts
// Browser
createQikbar({ ai: proxy('/api/qikbar') })
```

## Next.js (App Router)

```ts title="app/api/qikbar/route.ts"
import { createHandler, anthropic } from '@qikbar/qikbar/server'

export const POST = createHandler({
  provider: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
})
```

## Hono

```ts
import { Hono } from 'hono'
import { createHandler, openai } from '@qikbar/qikbar/server'

const qikbar = createHandler({ provider: openai({ apiKey: process.env.OPENAI_API_KEY }) })
const app = new Hono()
app.post('/api/qikbar', (c) => qikbar(c.req.raw))
```

## Express / Node

```ts
import express from 'express'
import { createHandler, toNodeHandler, anthropic } from '@qikbar/qikbar/server'

const app = express()
app.post('/api/qikbar', express.json(), toNodeHandler(createHandler({ provider: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) })))
```

## Bun, Deno, Cloudflare Workers

```ts
const handler = createHandler({ provider: gemini({ apiKey: env.GEMINI_API_KEY }) })

Bun.serve({ fetch: (req) => (new URL(req.url).pathname === '/api/qikbar' ? handler(req) : new Response('Not found', { status: 404 })) })
export default { fetch: handler } // Workers
```

SvelteKit (`+server.ts`), Remix and React Router actions, Astro endpoints and Nuxt (`toWebRequest`) all use the same pattern: pass the Web `Request` to the handler.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `provider` | — | **Required.** Any provider: `anthropic()`, `openai()`, `gemini()`, `ollama()`… |
| `system` | — | A server-side system prompt, prepended to the bar's prompt. |
| `allowClientSystem` | `true` | Accept the bar's system prompt (page title, command list). |
| `allowTools` | `true` | Forward tool definitions from the bar. |
| `authorize(request)` | — | Return `false` (401) or a `Response` to reject a request. |
| `maxMessages` | `50` | Reject longer conversations. |
| `maxChars` | `200000` | Reject larger payloads. |
| `maxTokens` | — | Cap output tokens. |
| `headers` | — | Extra response headers, for example for CORS. |

## Authentication and rate limiting

> [!CAUTION]
> Anyone who can reach the endpoint can spend your tokens. Always add `authorize` in production.

Check the session and rate-limit per user:

```ts
export const POST = createHandler({
  provider: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  async authorize(request) {
    const session = await getSession(request)
    if (!session) return false
    const { success } = await ratelimit.limit(session.userId)
    return success || new Response('Slow down', { status: 429 })
  },
})
```

## Protocol

The endpoint receives `POST { messages, system?, tools?, maxTokens? }` and responds with newline-delimited JSON (`application/x-ndjson`). Each line is an AI event (`text`, `tool_call`, `done`, `error`). You can implement it in any language.
