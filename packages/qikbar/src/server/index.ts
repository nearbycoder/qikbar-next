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
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json', 'x-content-type-options': 'nosniff', ...headers },
  })

async function readJsonBody(request: Request, maxBytes: number): Promise<{ ok: true; data: unknown } | { ok: false; status: number; error: string }> {
  const cl = Number(request.headers.get('content-length'))
  if (Number.isFinite(cl) && cl > maxBytes) return { ok: false, status: 413, error: 'Request too large' }
  let text: string
  try {
    if (!request.body) {
      text = await request.text()
      if (text.length > maxBytes) return { ok: false, status: 413, error: 'Request too large' }
    } else {
      const reader = request.body.getReader()
      const decoder = new TextDecoder()
      let total = 0
      text = ''
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          total += value.byteLength
          if (total > maxBytes) {
            await reader.cancel().catch(() => {})
            return { ok: false, status: 413, error: 'Request too large' }
          }
          text += decoder.decode(value, { stream: true })
        }
        text += decoder.decode()
      } finally {
        reader.releaseLock()
      }
    }
  } catch {
    return { ok: false, status: 400, error: 'Invalid request body' }
  }
  try {
    return { ok: true, data: JSON.parse(text) }
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON' }
  }
}

/** Create a `(request: Request) => Promise<Response>` handler. */
export function createHandler(options: HandlerOptions) {
  const maxMessages = options.maxMessages ?? 50
  const maxChars = options.maxChars ?? 200_000
  const maxBodyBytes = maxChars * 4 + 4096
  return async function handler(request: Request): Promise<Response> {
    const headers = options.headers ?? {}
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return json(405, 'Method not allowed', headers)
    if (options.authorize) {
      const ok = await options.authorize(request)
      if (ok instanceof Response) return ok
      if (!ok) return json(401, 'Unauthorized', headers)
    }
    const parsed = await readJsonBody(request, maxBodyBytes)
    if (!parsed.ok) return json(parsed.status, parsed.error, headers)
    const raw = parsed.data
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json(400, 'Invalid JSON object', headers)
    const body = raw as Body
    const messages = Array.isArray(body.messages) ? body.messages : []
    if (!messages.length) return json(400, 'No messages', headers)
    if (messages.length > maxMessages) return json(413, 'Too many messages', headers)
    if (JSON.stringify(body).length > maxChars) return json(413, 'Request too large', headers)
    for (const m of messages) {
      if (!m || typeof m !== 'object' || !['user', 'assistant', 'tool'].includes(m.role) || typeof m.content !== 'string') {
        return json(400, 'Invalid message', headers)
      }
    }
    if (body.system !== undefined && typeof body.system !== 'string') return json(400, 'Invalid system prompt', headers)
    if (body.tools !== undefined) {
      if (!Array.isArray(body.tools) || body.tools.some((t) => !t || typeof t !== 'object' || typeof t.name !== 'string' || typeof t.description !== 'string')) {
        return json(400, 'Invalid tools', headers)
      }
    }
    let requestedMaxTokens: number | undefined
    if (body.maxTokens !== undefined) {
      if (typeof body.maxTokens !== 'number' || !Number.isFinite(body.maxTokens) || body.maxTokens <= 0) {
        return json(400, 'Invalid maxTokens', headers)
      }
      requestedMaxTokens = Math.floor(body.maxTokens)
    }
    const system = [options.system, options.allowClientSystem === false ? undefined : body.system].filter(Boolean).join('\n\n') || undefined
    const tools = options.allowTools === false ? undefined : body.tools?.slice(0, 64)
    const maxTokens = Math.min(requestedMaxTokens ?? options.maxTokens ?? 16000, options.maxTokens ?? Number.POSITIVE_INFINITY)

    const encoder = new TextEncoder()
    const streamController = new AbortController()
    const onReqAbort = () => streamController.abort()
    request.signal?.addEventListener('abort', onReqAbort, { once: true })
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: AIEvent) => {
          if (!streamController.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        }
        try {
          for await (const event of options.provider.stream({ messages, system, tools, maxTokens, signal: streamController.signal })) send(event)
        } catch (err) {
          if (!streamController.signal.aborted) send({ type: 'error', error: err instanceof Error ? err.message : 'AI request failed' })
        } finally {
          request.signal?.removeEventListener('abort', onReqAbort)
          if (!streamController.signal.aborted) controller.close()
        }
      },
      cancel() {
        streamController.abort()
      },
    })
    return new Response(stream, {
      headers: {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-store',
        'x-accel-buffering': 'no',
        'x-content-type-options': 'nosniff',
        ...headers,
      },
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
  const maxBodyBytes = maxChars * 4 + 4096
  return async function handler(request: Request): Promise<Response> {
    const headers = options.headers ?? {}
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return json(405, 'Method not allowed', headers)
    if (options.authorize) {
      const ok = await options.authorize(request)
      if (ok instanceof Response) return ok
      if (!ok) return json(401, 'Unauthorized', headers)
    }
    const parsed = await readJsonBody(request, maxBodyBytes)
    if (!parsed.ok) return json(parsed.status, parsed.error, headers)
    const raw = parsed.data
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json(400, 'Expected { texts: string[] }', headers)
    const texts = (raw as { texts?: unknown }).texts
    if (!Array.isArray(texts) || !texts.length || texts.some((t) => typeof t !== 'string')) return json(400, 'Expected { texts: string[] }', headers)
    if (texts.length > maxTexts) return json(413, 'Too many texts', headers)
    if ((texts as string[]).reduce((n, t) => n + t.length, 0) > maxChars) return json(413, 'Request too large', headers)
    try {
      const embeddings = await options.embed(texts as string[], { signal: request.signal ?? new AbortController().signal })
      return new Response(JSON.stringify({ embeddings }), {
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
      })
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
  write(chunk: Uint8Array | string): unknown
  end(chunk?: Uint8Array | string): unknown
}

const DEFAULT_MAX_NODE_BODY = 2 * 1024 * 1024

/** Adapt a Web handler to Node's `(req, res)` signature (Express, Fastify raw, node:http). */
export function toNodeHandler(handler: (request: Request) => Promise<Response>, options: { maxBodyBytes?: number } = {}) {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_NODE_BODY
  return async (req: NodeReq, res: NodeRes) => {
    const controller = new AbortController()
    res.on('close', () => controller.abort())
    let body: string | undefined
    if (req.body !== undefined) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      if (body.length > maxBodyBytes) {
        res.writeHead(413, { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' })
        return res.end(JSON.stringify({ error: 'Request too large' }))
      }
    } else if (req.method !== 'GET' && req.method !== 'HEAD') {
      const decoder = new TextDecoder()
      let total = 0
      let text = ''
      for await (const chunk of req) {
        total += typeof chunk === 'string' ? chunk.length : chunk.byteLength
        if (total > maxBodyBytes) {
          res.writeHead(413, { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' })
          return res.end(JSON.stringify({ error: 'Request too large' }))
        }
        text += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
      }
      body = text + decoder.decode()
    }
    const rawHost = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host
    const safeHost = rawHost && /^[a-z0-9._-]+(?::\d{1,5})?$/i.test(rawHost) ? rawHost : 'localhost'
    const reqPath = req.url?.startsWith('/') ? req.url : '/'
    const response = await handler(
      new Request(`http://${safeHost}${reqPath}`, {
        method: req.method,
        headers: Object.entries(req.headers).flatMap(([k, v]) => (v == null ? [] : Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v] as [string, string]])),
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
        signal: controller.signal,
      }),
    )
    res.writeHead(response.status, Object.fromEntries(response.headers))
    if (!response.body) return res.end()
    const reader = response.body.getReader()
    try {
      for (;;) {
        if (controller.signal.aborted) {
          await reader.cancel().catch(() => {})
          break
        }
        const { value, done } = await reader.read()
        if (done) break
        res.write(value)
      }
    } finally {
      reader.releaseLock()
      res.end()
    }
  }
}
