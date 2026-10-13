---
title: Semantic search
description: Find commands by meaning as well as spelling, with embeddings from OpenAI, Gemini, Ollama or your own server.
group: AI
order: 5
---

Fuzzy search matches what people type. Semantic search matches what they mean: "cancel my plan" finds **Downgrade subscription**, and "add a colleague" finds **Invite teammate**. Results that fuzzy search missed show up in a **Related** section.

```ts
import { createQikbar, proxyEmbeddings } from '@qikbar/qikbar'

createQikbar({
  commands,
  semantic: { embed: proxyEmbeddings({ url: '/api/embed' }) },
})
```

Semantic search is optional and off by default. Fuzzy search stays instant; related results arrive a moment later, once typing pauses.

## Keep your key on the server

Serve embeddings from your backend with `createEmbeddingsHandler`, so the API key never reaches the browser:

```ts title="app/api/embed/route.ts"
import { createEmbeddingsHandler, openaiEmbeddings } from '@qikbar/qikbar/server'

const handler = createEmbeddingsHandler({
  embed: openaiEmbeddings({ apiKey: process.env.OPENAI_API_KEY }),
  // Optional: only signed-in users.
  authorize: async (req) => !!(await getSession(req)),
})

export { handler as POST }
```

It works anywhere with Web `Request`/`Response` (Next.js, Remix, SvelteKit, Astro, Hono, Bun, Deno, Workers). Use `toNodeHandler()` for Express.

## Providers

| Function | Notes |
| --- | --- |
| `openaiEmbeddings({ apiKey, model, dimensions, baseURL })` | `text-embedding-3-small`, 256 dimensions by default. `baseURL` works with any OpenAI-compatible API. |
| `geminiEmbeddings({ apiKey, model, dimensions })` | `gemini-embedding-001` |
| `ollamaEmbeddings({ model, host })` | Local and free. `nomic-embed-text` by default. |
| `proxyEmbeddings({ url, headers })` | Calls your `createEmbeddingsHandler` endpoint |
| `cachedEmbeddings(embed)` | Wraps any of the above so repeated texts aren't re-embedded |

Or write your own. `embed` takes texts and returns one vector per text:

```ts
semantic: {
  embed: async (texts, { signal }) => {
    const res = await fetch('/my/embeddings', { method: 'POST', body: JSON.stringify({ texts }), signal })
    return (await res.json()).vectors
  },
}
```

## How it works

1. The first time someone searches, Qikbar embeds every command once (title, subtitle, section, keywords and description) and keeps the vectors in memory. Commands are only re-embedded when their text changes.
2. Each query (3+ characters, after a 250 ms pause) is embedded and compared with cosine similarity.
3. Matches above the threshold that fuzzy search didn't already find are shown under **Related**.

Write good `description`s and `keywords` on your commands: they're what the meaning is matched against.

## Options

| Option | Default | |
| --- | --- | --- |
| `embed` | required | `(texts, { signal }) => Promise<number[][]>` |
| `threshold` | `0.35` | Minimum similarity (0–1). Raise it if Related shows loose matches. |
| `limit` | `5` | Maximum Related results |
| `minQueryLength` | `3` | Shorter queries skip semantic search |
| `debounce` | `250` | Wait after typing, in ms |
| `sources` | `false` | Also match results from [sources](/docs/sources) |

The right threshold depends on the model. For `text-embedding-3-small`, 0.35–0.45 works well; for `nomic-embed-text`, try 0.5.

If the embedder fails (offline, rate limited), Qikbar logs one warning and carries on with fuzzy search.
