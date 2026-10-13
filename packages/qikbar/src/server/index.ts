/**
 * Server-side AI handler. Keeps your API key on the server and streams
 * normalized events to the `proxy()` provider in the browser.
 *
 * Works anywhere with Web `Request`/`Response`: Next.js route handlers,
 * Remix/React Router, SvelteKit, Astro, Hono, Bun, Deno, Cloudflare Workers.
 * Use `toNodeHandler()` for Express or `node:http`.
 */

import type { AIEvent, AIMessage, AIProvider, AIToolDefinition } from '../core/types.js'

export { anthropic, gemini, ollama, openai, openaiCompatible } from '../ai/providers.js'
export { geminiEmbeddings, ollamaEmbeddings, openaiEmbeddings } from '../ai/embeddings.js'

export interface HandlerOptions {
  provider: AIProvider
  /** Server-side system prompt, prepended to the client's. */
  system?: string
  /** Accept the system prompt sent by the bar (page title, command list…). Default true. */
  allowClientSystem?: boolean
  /** Accept tool definitions from the bar. Default true. */
  allowTools?: boolean
  /** Return false (or a Response) to reject a request — check sessions, rate limits, etc. */
  authorize?: (request: Request) => boolean | Response | Promise<boolean | Response>
  /** Max messages per request. Default 50. */
  maxMessages?: number
  /** Max total characters per request. Default 200 000. */
  maxChars?: number
  /** Cap on output tokens. */
  maxTokens?: number
  /** Extra response headers (e.g. CORS). */
  headers?: Record<string, string>
}

interface Body {
  messages?: AIMessage[]
  system?: string
  tools?: AIToolDefinition[]
  maxTokens?: number
}

const json = (status: number, error: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json', ...headers } })

/** Create a `(request: Request) => Promise<Response>` handler. */
export function createHandler(options: HandlerOptions) {
  const maxMessages = options.maxMessages ?? 50
  const maxChars = options.maxChars ?? 200_000
  return async function handler(request: Request): Promise<Response> {
    const headers = options.headers ?? {}
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return json(405, 'Method not allowed', headers)
    if (options.authorize) {
      const ok = await options.authorize(request)
      if (ok instanceof Response) return ok
      if (!ok) return json(401, 'Unauthorized', headers)
    }
    let body: Body
    try {
      body = (await request.json()) as Body
    } catch {
      return json(400, 'Invalid JSON', headers)
    }
    const messages = Array.isArray(body.messages) ? body.messages : []
    if (!messages.length) return json(400, 'No messages', headers)
    if (messages.length > maxMessages) return json(413, 'Too many messages', headers)
    if (JSON.stringify(body).length > maxChars) return json(413, 'Request too large', headers)
    for (const m of messages) {
      if (!m || !['user', 'assistant', 'tool'].includes(m.role) || typeof m.content !== 'string') return json(400, 'Invalid message', headers)
    }
    const system = [options.system, options.allowClientSystem === false ? undefined : body.system].filter(Boolean).join('\n\n') || undefined
    const tools = options.allowTools === false ? undefined : body.tools?.slice(0, 64)
    const maxTokens = Math.min(body.maxTokens ?? options.maxTokens ?? 16000, options.maxTokens ?? Number.POSITIVE_INFINITY)

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: AIEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        try {
          for await (const event of options.provider.stream({ messages, system, tools, maxTokens, signal: request.signal })) send(event)
        } catch (err) {
          if (!request.signal?.aborted) send({ type: 'error', error: err instanceof Error ? err.message : 'AI request failed' })
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, {
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no', ...headers },
    })
  }
}

export interface EmbeddingsHandlerOptions {
  /** Turn texts into vectors, e.g. `openaiEmbeddings({ apiKey: process.env.OPENAI_API_KEY })`. */
  embed: (texts: string[], options: { signal: AbortSignal }) => Promise<number[][]>
  /** Return false (or a Response) to reject a request. */
  authorize?: (request: Request) => boolean | Response | Promise<boolean | Response>
  /** Max texts per request. Default 256. */
  maxTexts?: number
  /** Max total characters per request. Default 100 000. */
  maxChars?: number
  headers?: Record<string, string>
}

/**
 * A `(request) => Response` endpoint for `proxyEmbeddings()`, so semantic search
 * works without exposing an API key. Accepts `{ texts: string[] }`, returns `{ embeddings }`.
 */
export function createEmbeddingsHandler(options: EmbeddingsHandlerOptions) {
  const maxTexts = options.maxTexts ?? 256
  const maxChars = options.maxChars ?? 100_000
  return async function handler(request: Request): Promise<Response> {
    const headers = options.headers ?? {}
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return json(405, 'Method not allowed', headers)
    if (options.authorize) {
      const ok = await options.authorize(request)
      if (ok instanceof Response) return ok
      if (!ok) return json(401, 'Unauthorized', headers)
    }
    let body: { texts?: unknown }
    try {
      body = (await request.json()) as { texts?: unknown }
    } catch {
      return json(400, 'Invalid JSON', headers)
    }
    const texts = body.texts
    if (!Array.isArray(texts) || !texts.length || texts.some((t) => typeof t !== 'string')) return json(400, 'Expected { texts: string[] }', headers)
    if (texts.length > maxTexts) return json(413, 'Too many texts', headers)
    if ((texts as string[]).reduce((n, t) => n + t.length, 0) > maxChars) return json(413, 'Request too large', headers)
    try {
      const embeddings = await options.embed(texts as string[], { signal: request.signal ?? new AbortController().signal })
      return new Response(JSON.stringify({ embeddings }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } })
    } catch (err) {
      return json(502, err instanceof Error ? err.message : 'Embedding failed', headers)
    }
  }
}

/** The subset of Node's IncomingMessage used here (kept structural so consumers don't need @types/node). */
interface NodeReq extends AsyncIterable<Uint8Array | string> {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

/** The subset of Node's ServerResponse used here. */
interface NodeRes {
  on(event: 'close', listener: () => void): unknown
  writeHead(status: number, headers: Record<string, string>): unknown
  write(chunk: Uint8Array): unknown
  end(): unknown
}

/** Adapt a Web handler to Node's `(req, res)` signature (Express, Fastify raw, node:http). */
export function toNodeHandler(handler: (request: Request) => Promise<Response>) {
  return async (req: NodeReq, res: NodeRes) => {
    const controller = new AbortController()
    res.on('close', () => controller.abort())
    let body: string | undefined
    if (req.body !== undefined) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    else {
      const decoder = new TextDecoder()
      let text = ''
      for await (const chunk of req) text += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
      body = text + decoder.decode()
    }
    const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`
    const response = await handler(
      new Request(url, {
        method: req.method,
        headers: Object.entries(req.headers).flatMap(([k, v]) => (v == null ? [] : Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v] as [string, string]])),
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
        signal: controller.signal,
      }),
    )
    res.writeHead(response.status, Object.fromEntries(response.headers))
    if (!response.body) return res.end()
    const reader = response.body.getReader()
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      res.write(value)
    }
    res.end()
  }
}
