import { afterEach, describe, expect, it, vi } from 'vitest'
import { cachedEmbeddings, geminiEmbeddings, ollamaEmbeddings, openaiEmbeddings, proxyEmbeddings } from '../src/ai/embeddings'
import { MCPClient, mcp } from '../src/ai/mcp'
import { createEmbeddingsHandler } from '../src/server/index'
import type { AIEvent, AIProvider, AIRequest } from '../src/core/types'
import { setup, settle, tick } from './helpers'

// ─── A fake MCP server (Streamable HTTP) ────────────────────────────────────

interface FakeServerOptions {
  sse?: boolean
  pageSize?: number
  /** Forget sessions after this many requests. */
  expireAfter?: number
}

function fakeServer(opts: FakeServerOptions = {}) {
  const tools = [
    { name: 'echo', description: 'Echo text back', inputSchema: { type: 'object', properties: { text: { type: 'string' } } }, annotations: { readOnlyHint: true } },
    { name: 'delete_repo', description: 'Delete a repository', inputSchema: { type: 'object', properties: { name: { type: 'string' } } }, annotations: { destructiveHint: true } },
    { name: 'fail', description: 'Always fails', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
  ]
  const log: { method: string; session: string | null; protocol: string | null; body: any }[] = []
  let sessions = 0
  const live = new Set<string>()
  let requests = 0
  const reply = (body: unknown, headers: Record<string, string> = {}) => {
    if (opts.sse) {
      const frames = [`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/progress', params: {} })}\n\n`, `event: message\ndata: ${JSON.stringify(body)}\n\n`]
      return new Response(frames.join(''), { headers: { 'content-type': 'text/event-stream', ...headers } })
    }
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', ...headers } })
  }
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>
    const session = headers['mcp-session-id'] ?? null
    if (init.method === 'DELETE') {
      if (session) live.delete(session)
      return new Response(null, { status: 200 })
    }
    const body = JSON.parse(init.body as string)
    log.push({ method: body.method, session, protocol: headers['mcp-protocol-version'] ?? null, body })
    requests++
    if (opts.expireAfter && requests === opts.expireAfter) live.clear()
    if (body.method === 'initialize') {
      const id = `s${++sessions}`
      live.add(id)
      return reply({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'fake', version: '1' } } }, { 'mcp-session-id': id })
    }
    if (!session || !live.has(session)) return new Response('unknown session', { status: 404 })
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 })
    if (body.method === 'tools/list') {
      const size = opts.pageSize ?? tools.length
      const start = body.params?.cursor ? Number(body.params.cursor) : 0
      const page = tools.slice(start, start + size)
      const next = start + size < tools.length ? String(start + size) : undefined
      return reply({ jsonrpc: '2.0', id: body.id, result: { tools: page, ...(next ? { nextCursor: next } : {}) } })
    }
    if (body.method === 'tools/call') {
      const { name, arguments: args } = body.params
      if (name === 'echo') return reply({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: `echo: ${args.text}` }] } })
      if (name === 'delete_repo') return reply({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: `deleted ${args.name}` }] } })
      if (name === 'fail') return reply({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: 'boom' }], isError: true } })
      return reply({ jsonrpc: '2.0', id: body.id, error: { code: -32602, message: `Unknown tool ${name}` } })
    }
    return reply({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } })
  })
  return { fetch, log, tools }
}

describe('MCP client', () => {
  it('initializes once, sends the session and protocol headers, and lists tools across pages', async () => {
    const server = fakeServer({ pageSize: 2 })
    const client = new MCPClient({ url: 'https://example.com/mcp', fetch: server.fetch as any, headers: { authorization: 'Bearer t' } })
    const tools = await client.listTools()
    expect(tools.map((t) => t.name)).toEqual(['echo', 'delete_repo', 'fail'])
    expect(server.log.map((l) => l.method)).toEqual(['initialize', 'notifications/initialized', 'tools/list', 'tools/list'])
    expect(server.log[0]!.protocol).toBeNull()
    expect(server.log[2]).toMatchObject({ session: 's1', protocol: '2025-06-18' })
    expect(server.log[3]!.body.params).toEqual({ cursor: '2' })
    expect((server.fetch.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ authorization: 'Bearer t', accept: 'application/json, text/event-stream' })
    expect(client.serverInfo).toEqual({ name: 'fake', version: '1' })
  })

  it('reads responses from an SSE stream', async () => {
    const server = fakeServer({ sse: true })
    const client = new MCPClient({ url: '/mcp', fetch: server.fetch as any })
    expect(await client.callTool('echo', { text: 'hi' })).toBe('echo: hi')
  })

  it('throws tool errors and JSON-RPC errors', async () => {
    const server = fakeServer()
    const client = new MCPClient({ url: '/mcp', fetch: server.fetch as any })
    await expect(client.callTool('fail', {})).rejects.toThrow('boom')
    await expect(client.callTool('nope', {})).rejects.toThrow('Unknown tool nope')
  })

  it('re-initializes when the server forgets the session', async () => {
    const server = fakeServer({ expireAfter: 3 })
    const client = new MCPClient({ url: '/mcp', fetch: server.fetch as any })
    await client.listTools()
    expect(await client.callTool('echo', { text: 'again' })).toBe('echo: again')
    expect(server.log.filter((l) => l.method === 'initialize').length).toBe(2)
  })

  it('reports HTTP failures', async () => {
    const client = new MCPClient({ url: '/mcp', fetch: (async () => new Response('nope', { status: 500 })) as any })
    await expect(client.listTools()).rejects.toThrow('MCP server responded 500: nope')
  })
})

describe('mcp() tool provider', () => {
  it('turns server tools into bar tools, asking before ones that are not read-only', async () => {
    const server = fakeServer()
    const provider = mcp({ url: 'https://api.github.com/mcp', fetch: server.fetch as any, exclude: ['fail'] })
    expect(provider.name).toBe('github')
    const tools = await provider.tools()
    expect(tools.map((t) => t.name)).toEqual(['echo', 'delete_repo'])
    expect(tools[0]!.confirm).toBe(false)
    expect(typeof tools[1]!.confirm).toBe('function')
    expect(await tools[0]!.run({ text: 'x' }, { signal: new AbortController().signal } as any)).toBe('echo: x')
  })

  it('caches the tool list and reloads after refresh()', async () => {
    const server = fakeServer()
    const provider = mcp({ url: '/mcp', name: 'srv', fetch: server.fetch as any, include: ['echo'] })
    await provider.tools()
    await provider.tools()
    expect(server.log.filter((l) => l.method === 'tools/list').length).toBe(1)
    provider.refresh()
    expect((await provider.tools()).map((t) => t.name)).toEqual(['echo'])
    expect(server.log.filter((l) => l.method === 'tools/list').length).toBe(2)
  })

  it('lets the chat model call MCP tools', async () => {
    const server = fakeServer()
    let seen: AIRequest | undefined
    let turn = 0
    const provider: AIProvider = {
      id: 'mock',
      async *stream(req): AsyncIterable<AIEvent> {
        if (turn++ === 0) {
          seen = req
          const call = { id: 'c1', name: 'srv__echo', args: { text: 'from chat' } }
          yield { type: 'tool_call', call }
          yield { type: 'done', message: { role: 'assistant', content: '', toolCalls: [call] } }
        } else {
          const result = req.messages.at(-1)!
          yield { type: 'text', text: `Server said ${result.content}` }
          yield { type: 'done', message: { role: 'assistant', content: 'ok' } }
        }
      },
    }
    const t = setup({ ai: { provider, mcp: [mcp({ url: '/mcp', name: 'srv', fetch: server.fetch as any })] } })
    t.bar.ask('use the server')
    await tick(30)
    await settle()
    expect(seen!.tools!.map((x) => x.name)).toContain('srv__echo')
    expect(t.$('.qb-msg-ai .qb-md')?.textContent).toContain('Server said echo: from chat')
    t.bar.destroy()
  })

  it('keeps chatting when an MCP server is down', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const provider: AIProvider = {
      id: 'mock',
      async *stream(): AsyncIterable<AIEvent> {
        yield { type: 'text', text: 'Hello' }
        yield { type: 'done', message: { role: 'assistant', content: 'Hello' } }
      },
    }
    const down = mcp({ url: '/mcp', name: 'down', fetch: (async () => new Response('', { status: 503 })) as any })
    const t = setup({ ai: { provider, mcp: [down] } })
    t.bar.ask('hi')
    await tick(30)
    await settle()
    expect(t.$('.qb-msg-ai .qb-md')?.textContent).toContain('Hello')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
    t.bar.destroy()
  })
})

// ─── WebMCP ─────────────────────────────────────────────────────────────────

function installModelContext() {
  const tools = new Map<string, any>()
  const mc = {
    registerTool: vi.fn((tool: any, opts?: { signal?: AbortSignal }) => {
      if (tools.has(tool.name)) throw new Error('duplicate')
      tools.set(tool.name, tool)
      opts?.signal?.addEventListener('abort', () => tools.delete(tool.name))
    }),
  }
  ;(document as any).modelContext = mc
  return { tools, mc, remove: () => delete (document as any).modelContext }
}

describe('WebMCP', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => cleanup?.())

  it('registers search, list and run tools and unregisters them on destroy', async () => {
    const ctx = installModelContext()
    cleanup = ctx.remove
    const navigate = vi.fn()
    const t = setup({
      webmcp: true,
      navigate,
      routes: [{ path: '/billing', title: 'Billing' }],
      commands: [{ id: 'theme', title: 'Toggle theme', run: () => {} }],
      tools: [{ name: 'weather', description: 'Get the weather', parameters: { type: 'object', properties: { city: { type: 'string' } } }, run: (a: any) => `Sunny in ${a.city}` }],
    })
    expect([...ctx.tools.keys()].sort()).toEqual(['qikbar_list_commands', 'qikbar_run', 'qikbar_search', 'qikbar_weather'])
    expect(ctx.tools.get('qikbar_search').annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true })

    const listed = JSON.parse(await ctx.tools.get('qikbar_list_commands').execute({}))
    expect(listed.map((i: any) => i.id)).toEqual(['theme', 'route:/billing'])

    const found = JSON.parse(await ctx.tools.get('qikbar_search').execute({ query: 'bill' }))
    expect(found[0]).toMatchObject({ id: 'route:/billing', title: 'Billing' })

    expect(await ctx.tools.get('qikbar_run').execute({ id: 'route:/billing' })).toBe('Navigated to /billing.')
    expect(navigate).toHaveBeenCalledWith('/billing', { newTab: false })
    expect(await ctx.tools.get('qikbar_run').execute({ id: 'missing' })).toContain('No item with id "missing"')
    expect(await ctx.tools.get('qikbar_weather').execute({ city: 'Oslo' })).toBe('Sunny in Oslo')

    t.bar.destroy()
    expect(ctx.tools.size).toBe(0)
  })

  it('reports agent runs as events and can hide run and tools', async () => {
    const ctx = installModelContext()
    cleanup = ctx.remove
    const onEvent = vi.fn()
    const t = setup({ webmcp: { prefix: 'acme', run: false, tools: false }, onEvent, commands: [{ title: 'A' }] })
    expect([...ctx.tools.keys()].sort()).toEqual(['acme_list_commands', 'acme_search'])
    t.bar.configure({ webmcp: true })
    expect([...ctx.tools.keys()].sort()).toEqual(['qikbar_list_commands', 'qikbar_run', 'qikbar_search'])
    const run = vi.fn()
    t.bar.register({ id: 'x', title: 'Do it', run })
    expect(await ctx.tools.get('qikbar_run').execute({ id: 'x' })).toBe('Ran "Do it".')
    expect(run).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'run', via: 'agent' }))
    t.bar.configure({ webmcp: false })
    expect(ctx.tools.size).toBe(0)
    t.bar.destroy()
  })

  it('does nothing without a model context', () => {
    const t = setup({ webmcp: true })
    expect(() => t.bar.destroy()).not.toThrow()
  })
})

// ─── Embeddings ─────────────────────────────────────────────────────────────

describe('embeddings', () => {
  const signal = new AbortController().signal

  it('calls OpenAI with small vectors and restores input order', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      expect(body).toEqual({ model: 'text-embedding-3-small', input: ['a', 'b'], dimensions: 256 })
      expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk')
      return Response.json({ data: [{ index: 1, embedding: [2] }, { index: 0, embedding: [1] }] })
    })
    expect(await openaiEmbeddings({ apiKey: 'sk', fetch: fetch as any })(['a', 'b'], { signal })).toEqual([[1], [2]])
    expect(fetch.mock.calls[0]![0]).toBe('https://api.openai.com/v1/embeddings')
  })

  it('supports Ollama, Gemini and a proxy', async () => {
    const ollama = vi.fn(async (_url: string) => Response.json({ embeddings: [[1, 2]] }))
    expect(await ollamaEmbeddings({ fetch: ollama as any })(['x'], { signal })).toEqual([[1, 2]])
    expect(ollama.mock.calls[0]![0]).toBe('http://localhost:11434/api/embed')
    const gemini = vi.fn(async () => Response.json({ embeddings: [{ values: [3] }] }))
    expect(await geminiEmbeddings({ apiKey: 'g', fetch: gemini as any })(['x'], { signal })).toEqual([[3]])
    const proxied = vi.fn(async () => Response.json({ embeddings: [[4]] }))
    expect(await proxyEmbeddings({ url: '/api/embed', fetch: proxied as any })(['x'], { signal })).toEqual([[4]])
  })

  it('throws readable errors', async () => {
    const fetch = async () => new Response('bad key', { status: 401 })
    await expect(openaiEmbeddings({ fetch: fetch as any })(['a'], { signal })).rejects.toThrow('Embeddings request failed (401): bad key')
  })

  it('caches repeated texts', async () => {
    const embed = vi.fn(async (texts: string[]) => texts.map((t) => [t.length]))
    const cached = cachedEmbeddings(embed)
    expect(await cached(['a', 'bb'], { signal })).toEqual([[1], [2]])
    expect(await cached(['bb', 'ccc'], { signal })).toEqual([[2], [3]])
    expect(embed.mock.calls.map((c) => c[0])).toEqual([['a', 'bb'], ['ccc']])
  })

  it('serves embeddings from the server handler', async () => {
    const handler = createEmbeddingsHandler({ embed: async (texts) => texts.map(() => [0.5]), maxTexts: 2 })
    const post = (body: unknown) => handler(new Request('http://x/api/embed', { method: 'POST', body: JSON.stringify(body) }))
    const ok = await post({ texts: ['a'] })
    expect(await ok.json()).toEqual({ embeddings: [[0.5]] })
    expect((await post({ texts: 'nope' })).status).toBe(400)
    expect((await post({ texts: ['a', 'b', 'c'] })).status).toBe(413)
    expect((await handler(new Request('http://x', { method: 'GET' }))).status).toBe(405)
    const denied = createEmbeddingsHandler({ embed: async () => [], authorize: () => false })
    expect((await denied(new Request('http://x', { method: 'POST', body: '{"texts":["a"]}' }))).status).toBe(401)
  })
})
