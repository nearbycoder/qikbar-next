/**
 * Server-side AI handler. Keeps your API key on the server and streams
 * normalized events to the `proxy()` provider in the browser.
 *
 * Works anywhere with Web `Request`/`Response`: Next.js route handlers,
 * Remix/React Router, SvelteKit, Astro, Hono, Bun, Deno, Cloudflare Workers.
 * Use `toNodeHandler()` for Express or `node:http`.
 */

import type { AIEvent, AIMessage, AIProvider, AIToolDefinition } from '../core/types'

export { anthropic, gemini, ollama, openai, openaiCompatible } from '../ai/providers'

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

type NodeReq = import('node:http').IncomingMessage & { body?: unknown }
type NodeRes = import('node:http').ServerResponse

/** Adapt a Web handler to Node's `(req, res)` signature (Express, Fastify raw, node:http). */
export function toNodeHandler(handler: (request: Request) => Promise<Response>) {
  return async (req: NodeReq, res: NodeRes) => {
    const controller = new AbortController()
    res.on('close', () => controller.abort())
    let body: string | undefined
    if (req.body !== undefined) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    else {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      body = Buffer.concat(chunks).toString('utf8')
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
