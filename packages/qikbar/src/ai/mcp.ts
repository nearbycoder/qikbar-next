/**
 * A minimal MCP client (Streamable HTTP transport) that turns a remote MCP
 * server's tools into tools the bar's AI can call.
 *
 * ```ts
 * import { mcp } from '@qikbar/qikbar/ai'
 * createQikbar({ ai: { provider, mcp: [mcp({ url: '/api/mcp' })] } })
 * ```
 *
 * Browsers can only reach servers that allow CORS. For third-party servers,
 * proxy them through your backend (which also keeps tokens server-side).
 */

import type { JSONSchema, Tool, ToolProvider } from '../core/types.js'
import { parseSSE } from './sse.js'

export const MCP_PROTOCOL_VERSION = '2025-06-18'

export interface MCPOptions {
  /** The server's Streamable HTTP endpoint. */
  url: string
  /** Prefix for tool names and the label shown in errors. Default derived from the URL. */
  name?: string
  /** Extra headers, e.g. `{ Authorization: 'Bearer …' }`. A function is called per request. */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)
  /** Only expose these tools (by name). */
  include?: string[]
  /** Hide these tools (by name). */
  exclude?: string[]
  /**
   * Ask the user before running a tool. Default: ask unless the server marks the tool
   * `readOnlyHint: true`. Pass `true`/`false` to always/never ask, or a function per tool.
   */
  confirm?: boolean | ((tool: MCPToolInfo) => boolean)
  /** Re-list tools after this many ms. Default 5 minutes. */
  ttl?: number
  /** Custom fetch (for tests or proxies). */
  fetch?: typeof fetch
  /** Send cookies to the server (same-origin proxies). Default `"same-origin"`. */
  credentials?: RequestCredentials
}

export interface MCPToolInfo {
  name: string
  title?: string
  description?: string
  inputSchema?: JSONSchema
  annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean }
}

interface MCPContent {
  type: string
  text?: string
  mimeType?: string
  resource?: { uri?: string; text?: string }
  uri?: string
  name?: string
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id?: number | string
  result?: any
  error?: { code: number; message: string; data?: unknown }
}

export class MCPError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message)
    this.name = 'MCPError'
  }
}

/** A low-level MCP client. Most apps only need `mcp()`. */
export class MCPClient {
  private session?: string
  private protocol = MCP_PROTOCOL_VERSION
  private ready?: Promise<void>
  private negotiated = false
  private nextId = 1
  serverInfo?: { name?: string; version?: string }

  constructor(private options: MCPOptions) {}

  private async headers(): Promise<Record<string, string>> {
    const h = this.options.headers
    const extra = typeof h === 'function' ? await h() : (h ?? {})
    return {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(this.session ? { 'mcp-session-id': this.session } : {}),
      ...(this.negotiated ? { 'mcp-protocol-version': this.protocol } : {}),
      ...extra,
    }
  }

  private async post(body: object, signal?: AbortSignal, expectId?: number): Promise<JsonRpcResponse | undefined> {
    const doFetch = this.options.fetch ?? globalThis.fetch
    const res = await doFetch(this.options.url, {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify(body),
      signal,
      credentials: this.options.credentials ?? 'same-origin',
    })
    const session = res.headers.get('mcp-session-id')
    if (session) this.session = session
    if (res.status === 404 && this.session && expectId != null) {
      // The server forgot our session: start over once.
      this.session = undefined
      this.ready = undefined
      this.negotiated = false
      throw new MCPError('MCP session expired', 404)
    }
    if (!res.ok && res.status !== 202) {
      const text = await res.text().catch(() => '')
      throw new MCPError(`MCP server responded ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`, res.status)
    }
    if (expectId == null || res.status === 202) return undefined
    const type = res.headers.get('content-type') ?? ''
    if (type.includes('text/event-stream')) {
      for await (const ev of parseSSE(res)) {
        if (!ev.data) continue
        let msg: JsonRpcResponse | JsonRpcResponse[]
        try {
          msg = JSON.parse(ev.data)
        } catch {
          continue
        }
        for (const m of Array.isArray(msg) ? msg : [msg]) if (m.id === expectId) return m
      }
      throw new MCPError('MCP stream ended without a response')
    }
    const json = (await res.json()) as JsonRpcResponse | JsonRpcResponse[]
    const list = Array.isArray(json) ? json : [json]
    return list.find((m) => m.id === expectId) ?? list[0]
  }

  private async request<T = any>(method: string, params: object | undefined, signal?: AbortSignal, retry = true): Promise<T> {
    if (method !== 'initialize') await this.connect(signal)
    const id = this.nextId++
    let res: JsonRpcResponse | undefined
    try {
      res = await this.post({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }, signal, id)
    } catch (err) {
      if (retry && err instanceof MCPError && err.code === 404 && method !== 'initialize') return this.request(method, params, signal, false)
      throw err
    }
    if (!res) throw new MCPError(`No response to ${method}`)
    if (res.error) throw new MCPError(res.error.message, res.error.code)
    return res.result as T
  }

  /** Initialize the session (once). */
  connect(signal?: AbortSignal): Promise<void> {
    this.ready ??= (async () => {
      const result = await this.request<{ protocolVersion?: string; serverInfo?: { name?: string; version?: string } }>(
        'initialize',
        { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'qikbar', version: '0.2.0' } },
        signal,
      )
      if (result?.protocolVersion) this.protocol = result.protocolVersion
      this.negotiated = true
      this.serverInfo = result?.serverInfo
      await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' }, signal)
    })()
    this.ready.catch(() => {
      this.ready = undefined
    })
    return this.ready
  }

  /** List every tool, following pagination. */
  async listTools(signal?: AbortSignal): Promise<MCPToolInfo[]> {
    const tools: MCPToolInfo[] = []
    let cursor: string | undefined
    for (let page = 0; page < 20; page++) {
      const res = await this.request<{ tools?: MCPToolInfo[]; nextCursor?: string }>('tools/list', cursor ? { cursor } : undefined, signal)
      tools.push(...(res?.tools ?? []))
      cursor = res?.nextCursor
      if (!cursor) break
    }
    return tools
  }

  /** Call a tool and return its result as text for the model. */
  async callTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    const res = await this.request<{ content?: MCPContent[]; structuredContent?: unknown; isError?: boolean }>('tools/call', { name, arguments: args }, signal)
    const text = contentToText(res?.content, res?.structuredContent)
    if (res?.isError) throw new MCPError(text || `Tool ${name} failed`)
    return text
  }

  /** End the session (best effort). */
  async close() {
    if (!this.session) return
    const doFetch = this.options.fetch ?? globalThis.fetch
    try {
      await doFetch(this.options.url, { method: 'DELETE', headers: await this.headers(), credentials: this.options.credentials ?? 'same-origin' })
    } catch {
      // ignore
    }
    this.session = undefined
    this.ready = undefined
    this.negotiated = false
  }
}

function contentToText(content: MCPContent[] | undefined, structured: unknown): string {
  const parts: string[] = []
  for (const c of content ?? []) {
    if (c.type === 'text' && c.text != null) parts.push(c.text)
    else if (c.type === 'resource' && c.resource?.text) parts.push(c.resource.text)
    else if (c.type === 'resource_link') parts.push(`[${c.name ?? c.uri}](${c.uri})`)
    else if (c.type === 'image' || c.type === 'audio') parts.push(`[${c.type}${c.mimeType ? ` ${c.mimeType}` : ''}]`)
  }
  if (!parts.length && structured !== undefined) return JSON.stringify(structured)
  return parts.join('\n\n')
}

function nameFromUrl(url: string): string {
  try {
    const u = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost')
    const host = u.host.replace(/^(www|api|mcp)\./, '').split('.')[0]
    return (host || 'mcp').replace(/[^a-zA-Z0-9_-]/g, '_')
  } catch {
    return 'mcp'
  }
}

/** Use an MCP server's tools in the bar's AI chat. */
export function mcp(options: MCPOptions): ToolProvider & { client: MCPClient; refresh(): void } {
  const client = new MCPClient(options)
  const name = (options.name ?? nameFromUrl(options.url)).replace(/[^a-zA-Z0-9_-]/g, '_')
  let cache: { at: number; tools: Promise<Tool[]> } | undefined
  const ttl = options.ttl ?? 5 * 60_000

  const shouldConfirm = (info: MCPToolInfo) => {
    const c = options.confirm
    if (typeof c === 'function') return c(info)
    if (typeof c === 'boolean') return c
    return info.annotations?.readOnlyHint !== true
  }

  const load = async (signal?: AbortSignal): Promise<Tool[]> => {
    const infos = await client.listTools(signal)
    return infos
      .filter((t) => (!options.include || options.include.includes(t.name)) && !options.exclude?.includes(t.name))
      .map(
        (info): Tool => ({
          name: info.name,
          description: info.description || info.annotations?.title || info.title || info.name,
          parameters: info.inputSchema ?? { type: 'object', properties: {} },
          confirm: shouldConfirm(info) ? () => `Allow ${info.annotations?.title ?? info.title ?? info.name} (${name})?` : false,
          run: (args, ctx) => client.callTool(info.name, (args ?? {}) as Record<string, unknown>, ctx.signal),
        }),
      )
  }

  return {
    name,
    client,
    refresh() {
      cache = undefined
    },
    tools(signal) {
      if (!cache || Date.now() - cache.at > ttl) {
        const entry = { at: Date.now(), tools: load(signal) }
        cache = entry
        entry.tools.catch(() => {
          if (cache === entry) cache = undefined
        })
      }
      return cache.tools
    },
  }
}
