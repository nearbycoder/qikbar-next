/**
 * Zero-dependency AI providers. Each one streams text and tool calls through
 * the same `AIProvider` interface, so the bar works with any model.
 *
 * Security: providers that take an `apiKey` call the vendor directly from the
 * browser. That's fine for prototypes, internal tools, and "bring your own key"
 * setups where users paste their own key. For production apps with a shared
 * key, use `proxy()` on the client and `createHandler()` from `qikbar/server`.
 */

import type { AIEvent, AIMessage, AIProvider, AIRequest, AIToolCall, AIToolDefinition, JSONSchema } from '../core/types'
import { errorFromResponse, parseNDJSON, parseSSE } from './sse'

let callCounter = 0
const newCallId = () => `call_${Date.now().toString(36)}${(callCounter++).toString(36)}`

function parseArgs(json: string): { args: Record<string, unknown>; error?: string } {
  if (!json.trim()) return { args: {} }
  try {
    const parsed = JSON.parse(json)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { args: parsed }
    return { args: {}, error: 'Tool arguments must be a JSON object.' }
  } catch {
    return { args: {}, error: `Invalid JSON arguments: ${json.slice(0, 200)}` }
  }
}

// ─── Anthropic ──────────────────────────────────────────────────────────────

export interface AnthropicOptions {
  apiKey?: string
  /** Default `"claude-opus-5-5"`. Use `"claude-haiku-5-5"` for the lowest latency and cost. */
  model?: string
  baseURL?: string
  maxTokens?: number
  /** Reasoning effort. Default `"low"` — a command bar should feel instant. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | false
  /**
   * Server-side refusal fallbacks (Claude API only). When a safety classifier
   * declines a request, the API re-runs it on a fallback model. Default `true`
   * on models that support it.
   */
  fallbacks?: boolean
  headers?: Record<string, string>
  /** Custom fetch (e.g. for proxies or tests). */
  fetch?: typeof fetch
}

const ANTHROPIC_EFFORT_MODELS = /claude-(opus|sonnet|haiku|fable|mythos)-5|claude-opus-4-[5-8]/
const ANTHROPIC_FALLBACK_MODELS = /^claude-(opus-5|opus-5-5|sonnet-5-5|fable-5-1)$/

export function anthropic(options: AnthropicOptions = {}): AIProvider {
  const model = options.model ?? 'claude-opus-5-5'
  const baseURL = (options.baseURL ?? 'https://api.anthropic.com').replace(/\/$/, '')
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))

  function toMessages(messages: AIMessage[]) {
    const out: { role: 'user' | 'assistant'; content: unknown }[] = []
    for (const m of messages) {
      if (m.role === 'user') out.push({ role: 'user', content: m.content })
      else if (m.role === 'assistant') {
        if (m.raw?.provider === 'anthropic') out.push({ role: 'assistant', content: m.raw.data })
        else {
          const blocks: unknown[] = []
          if (m.content) blocks.push({ type: 'text', text: m.content })
          for (const c of m.toolCalls ?? []) blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args })
          out.push({ role: 'assistant', content: blocks.length ? blocks : m.content || '…' })
        }
      } else {
        // All results for one assistant turn go back in a single user message.
        const block = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content, ...(m.isError ? { is_error: true } : {}) }
        const last = out[out.length - 1]
        if (last?.role === 'user' && Array.isArray(last.content) && (last.content as any[])[0]?.type === 'tool_result') (last.content as unknown[]).push(block)
        else out.push({ role: 'user', content: [block] })
      }
    }
    return out
  }

  return {
    id: 'anthropic',
    model,
    async *stream(req: AIRequest): AsyncIterable<AIEvent> {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        ...options.headers,
      }
      if (options.apiKey) {
        headers['x-api-key'] = options.apiKey
        headers['anthropic-dangerous-direct-browser-access'] = 'true'
      }
      const body: Record<string, unknown> = {
        model,
        max_tokens: req.maxTokens ?? options.maxTokens ?? 16000,
        stream: true,
        messages: toMessages(req.messages),
      }
      if (req.system) body.system = req.system
      if (req.tools?.length) {
        body.tools = req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters, eager_input_streaming: true }))
      }
      const effort = options.effort === undefined ? (ANTHROPIC_EFFORT_MODELS.test(model) ? 'low' : false) : options.effort
      if (effort) body.output_config = { effort }
      if (options.fallbacks !== false && ANTHROPIC_FALLBACK_MODELS.test(model) && !options.baseURL) {
        body.fallbacks = 'default'
        headers['anthropic-beta'] = [headers['anthropic-beta'], 'server-side-fallback-2026-07-01'].filter(Boolean).join(',')
      }

      const res = await doFetch(`${baseURL}/v1/messages`, { method: 'POST', headers, body: JSON.stringify(body), signal: req.signal })
      if (!res.ok) throw await errorFromResponse(res, 'Anthropic')

      const blocks: Record<number, any> = {}
      let stopReason: string | undefined
      let text = ''
      for await (const msg of parseSSE(res)) {
        if (!msg.data || msg.data === '[DONE]') continue
        const ev = JSON.parse(msg.data)
        switch (ev.type) {
          case 'content_block_start': {
            const block = { ...ev.content_block }
            if (block.type === 'tool_use') block._json = ''
            blocks[ev.index] = block
            if (block.type === 'text' && block.text) {
              text += block.text
              yield { type: 'text', text: block.text }
            }
            break
          }
          case 'content_block_delta': {
            const block = blocks[ev.index]
            const d = ev.delta
            if (!block) break
            if (d.type === 'text_delta') {
              block.text = (block.text ?? '') + d.text
              text += d.text
              yield { type: 'text', text: d.text }
            } else if (d.type === 'input_json_delta') block._json += d.partial_json
            else if (d.type === 'thinking_delta') block.thinking = (block.thinking ?? '') + d.thinking
            else if (d.type === 'signature_delta') block.signature = d.signature
            break
          }
          case 'content_block_stop': {
            const block = blocks[ev.index]
            if (block?.type === 'tool_use') {
              const { args, error } = parseArgs(block._json)
              block.input = args
              if (error) block._error = error
              delete block._json
            }
            break
          }
          case 'message_delta':
            if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason
            break
          case 'error':
            throw new Error(`Anthropic: ${ev.error?.message ?? 'stream error'}`)
        }
      }

      const ordered = Object.keys(blocks)
        .map(Number)
        .sort((a, b) => a - b)
        .map((i) => blocks[i])
      const toolCalls: AIToolCall[] = []
      // Never run tools from a truncated or declined turn.
      if (stopReason !== 'max_tokens' && stopReason !== 'refusal') {
        for (const b of ordered) {
          if (b.type !== 'tool_use') continue
          const call: AIToolCall = { id: b.id, name: b.name, args: b.input ?? {} }
          if (b._error) call.error = b._error
          toolCalls.push(call)
          yield { type: 'tool_call', call }
        }
      }
      for (const b of ordered) delete b._error
      if (stopReason === 'refusal') yield { type: 'error', error: 'The model declined to answer this request.' }
      yield {
        type: 'done',
        stopReason,
        message: { role: 'assistant', content: text, toolCalls: toolCalls.length ? toolCalls : undefined, raw: { provider: 'anthropic', data: ordered } },
      }
    },
  }
}

// ─── OpenAI (and every OpenAI-compatible API) ───────────────────────────────

export interface OpenAIOptions {
  apiKey?: string
  /** Default `"gpt-6-luna"`. */
  model?: string
  /** Point at any OpenAI-compatible API: Groq, OpenRouter, Together, Mistral, Ollama (`http://localhost:11434/v1`), LM Studio, vLLM… */
  baseURL?: string
  maxTokens?: number
  headers?: Record<string, string>
  /** Some local models don't support tools. Default true. */
  tools?: boolean
  fetch?: typeof fetch
  /** Provider id shown in the UI. Default `"openai"`. */
  id?: string
}

export function openai(options: OpenAIOptions = {}): AIProvider {
  const model = options.model ?? 'gpt-6-luna'
  const baseURL = (options.baseURL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))

  function toMessages(messages: AIMessage[], system?: string) {
    const out: Record<string, unknown>[] = []
    if (system) out.push({ role: 'system', content: system })
    for (const m of messages) {
      if (m.role === 'user') out.push({ role: 'user', content: m.content })
      else if (m.role === 'assistant')
        out.push({
          role: 'assistant',
          content: m.content || null,
          ...(m.toolCalls?.length
            ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) }
            : {}),
        })
      else out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content })
    }
    return out
  }

  return {
    id: options.id ?? 'openai',
    model,
    tools: options.tools ?? true,
    async *stream(req: AIRequest): AsyncIterable<AIEvent> {
      const body: Record<string, unknown> = { model, stream: true, messages: toMessages(req.messages, req.system) }
      const maxTokens = req.maxTokens ?? options.maxTokens
      if (maxTokens) body.max_completion_tokens = maxTokens
      if (req.tools?.length && options.tools !== false) {
        body.tools = req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }))
      }
      const res = await doFetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
          ...options.headers,
        },
        body: JSON.stringify(body),
        signal: req.signal,
      })
      if (!res.ok) throw await errorFromResponse(res, options.id ?? 'OpenAI')

      let text = ''
      let stopReason: string | undefined
      const calls: { id: string; name: string; json: string }[] = []
      for await (const msg of parseSSE(res)) {
        if (!msg.data || msg.data === '[DONE]') continue
        const chunk = JSON.parse(msg.data)
        if (chunk.error) throw new Error(`${options.id ?? 'OpenAI'}: ${chunk.error.message ?? chunk.error}`)
        const choice = chunk.choices?.[0]
        if (!choice) continue
        const delta = choice.delta ?? {}
        if (typeof delta.content === 'string' && delta.content) {
          text += delta.content
          yield { type: 'text', text: delta.content }
        }
        for (const tc of delta.tool_calls ?? []) {
          const i = tc.index ?? 0
          calls[i] ??= { id: tc.id ?? newCallId(), name: '', json: '' }
          if (tc.id) calls[i].id = tc.id
          if (tc.function?.name) calls[i].name += tc.function.name
          if (tc.function?.arguments) calls[i].json += tc.function.arguments
        }
        if (choice.finish_reason) stopReason = choice.finish_reason
      }
      const toolCalls: AIToolCall[] = []
      if (stopReason !== 'length' && stopReason !== 'content_filter') {
        for (const c of calls.filter(Boolean)) {
          const { args, error } = parseArgs(c.json)
          const call: AIToolCall = { id: c.id, name: c.name, args, ...(error ? { error } : {}) }
          toolCalls.push(call)
          yield { type: 'tool_call', call }
        }
      }
      if (stopReason === 'content_filter') yield { type: 'error', error: 'The response was blocked by the provider’s content filter.' }
      yield { type: 'done', stopReason, message: { role: 'assistant', content: text, toolCalls: toolCalls.length ? toolCalls : undefined } }
    },
  }
}

/** Any OpenAI-compatible endpoint (Groq, OpenRouter, Together, Mistral, DeepSeek, xAI, Ollama, LM Studio…). */
export function openaiCompatible(options: OpenAIOptions & { baseURL: string; model: string }): AIProvider {
  return openai({ id: 'openai-compatible', ...options })
}

/** Local models via Ollama. */
export function ollama(options: { model: string; baseURL?: string; tools?: boolean } = { model: 'llama3.2' }): AIProvider {
  return openai({ id: 'ollama', baseURL: options.baseURL ?? 'http://localhost:11434/v1', model: options.model, tools: options.tools })
}

// ─── Google Gemini ──────────────────────────────────────────────────────────

export interface GeminiOptions {
  apiKey?: string
  /** Default `"gemini-flash-latest"`. */
  model?: string
  baseURL?: string
  maxTokens?: number
  headers?: Record<string, string>
  fetch?: typeof fetch
}

/** Gemini's function declarations accept an OpenAPI subset of JSON schema. */
function geminiSchema(schema: JSONSchema): JSONSchema {
  const { additionalProperties: _a, $schema: _s, default: _d, ...rest } = schema as Record<string, any>
  const out: Record<string, any> = { ...rest }
  if (rest.properties) out.properties = Object.fromEntries(Object.entries(rest.properties).map(([k, v]) => [k, geminiSchema(v as JSONSchema)]))
  if (rest.items) out.items = geminiSchema(rest.items)
  return out
}

export function gemini(options: GeminiOptions = {}): AIProvider {
  const model = options.model ?? 'gemini-flash-latest'
  const baseURL = (options.baseURL ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '')
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))

  function toContents(messages: AIMessage[]) {
    const out: { role: 'user' | 'model'; parts: unknown[] }[] = []
    for (const m of messages) {
      if (m.role === 'user') out.push({ role: 'user', parts: [{ text: m.content }] })
      else if (m.role === 'assistant') {
        if (m.raw?.provider === 'gemini') out.push({ role: 'model', parts: m.raw.data as unknown[] })
        else {
          const parts: unknown[] = []
          if (m.content) parts.push({ text: m.content })
          for (const c of m.toolCalls ?? []) parts.push({ functionCall: { name: c.name, args: c.args } })
          out.push({ role: 'model', parts: parts.length ? parts : [{ text: '' }] })
        }
      } else {
        const part = { functionResponse: { name: m.toolName ?? 'tool', response: m.isError ? { error: m.content } : { result: m.content } } }
        const last = out[out.length - 1]
        if (last?.role === 'user' && (last.parts[0] as any)?.functionResponse) last.parts.push(part)
        else out.push({ role: 'user', parts: [part] })
      }
    }
    return out
  }

  return {
    id: 'gemini',
    model,
    async *stream(req: AIRequest): AsyncIterable<AIEvent> {
      const body: Record<string, unknown> = { contents: toContents(req.messages) }
      if (req.system) body.systemInstruction = { parts: [{ text: req.system }] }
      if (req.tools?.length) {
        body.tools = [
          {
            functionDeclarations: req.tools.map((t: AIToolDefinition) => ({
              name: t.name,
              description: t.description,
              ...(t.parameters?.properties && Object.keys(t.parameters.properties).length ? { parameters: geminiSchema(t.parameters) } : {}),
            })),
          },
        ]
      }
      const maxTokens = req.maxTokens ?? options.maxTokens
      if (maxTokens) body.generationConfig = { maxOutputTokens: maxTokens }
      const res = await doFetch(`${baseURL}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(options.apiKey ? { 'x-goog-api-key': options.apiKey } : {}), ...options.headers },
        body: JSON.stringify(body),
        signal: req.signal,
      })
      if (!res.ok) throw await errorFromResponse(res, 'Gemini')

      let text = ''
      let stopReason: string | undefined
      const parts: any[] = []
      const toolCalls: AIToolCall[] = []
      for await (const msg of parseSSE(res)) {
        if (!msg.data) continue
        const chunk = JSON.parse(msg.data)
        if (chunk.error) throw new Error(`Gemini: ${chunk.error.message}`)
        if (chunk.promptFeedback?.blockReason) {
          yield { type: 'error', error: `Blocked by Gemini (${chunk.promptFeedback.blockReason}).` }
          continue
        }
        const cand = chunk.candidates?.[0]
        if (!cand) continue
        for (const part of cand.content?.parts ?? []) {
          if (part.functionCall) {
            parts.push(part)
            const call: AIToolCall = { id: part.functionCall.id ?? newCallId(), name: part.functionCall.name, args: part.functionCall.args ?? {} }
            toolCalls.push(call)
          } else if (typeof part.text === 'string') {
            const last = parts[parts.length - 1]
            if (!part.thought && last && typeof last.text === 'string' && !last.thought && !last.thoughtSignature && !part.thoughtSignature) last.text += part.text
            else parts.push({ ...part })
            if (!part.thought && part.text) {
              text += part.text
              yield { type: 'text', text: part.text }
            }
          } else parts.push(part)
        }
        if (cand.finishReason) stopReason = cand.finishReason
      }
      if (stopReason !== 'MAX_TOKENS') for (const call of toolCalls) yield { type: 'tool_call', call }
      if (stopReason === 'SAFETY') yield { type: 'error', error: 'The response was blocked by Gemini safety filters.' }
      yield {
        type: 'done',
        stopReason,
        message: { role: 'assistant', content: text, toolCalls: toolCalls.length && stopReason !== 'MAX_TOKENS' ? toolCalls : undefined, raw: { provider: 'gemini', data: parts } },
      }
    },
  }
}

// ─── Built-in browser AI (Chrome's on-device model) ─────────────────────────

/**
 * Chrome's built-in on-device model via the Prompt API (`LanguageModel`).
 * Free and private, no API key. No tool calling. Check `browserAI.isAvailable()` first.
 */
export const browserAI = /* @__PURE__ */ Object.assign(
  function browserAI(): AIProvider {
  return {
    id: 'browser',
    model: 'on-device',
    tools: false,
    async *stream(req: AIRequest): AsyncIterable<AIEvent> {
      const LM = (globalThis as any).LanguageModel
      if (!LM) throw new Error('Built-in AI is not available in this browser.')
      const history = req.messages.filter((m) => m.role !== 'tool')
      const last = history.pop()
      const initialPrompts = [
        ...(req.system ? [{ role: 'system', content: req.system }] : []),
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ]
      const session = await LM.create({ initialPrompts, signal: req.signal })
      let total = ''
      try {
        const stream = session.promptStreaming(last?.content ?? '', { signal: req.signal })
        for await (const chunk of stream as AsyncIterable<string>) {
          // Older Chrome versions emitted the full text so far; newer ones emit deltas.
          const delta = chunk.startsWith(total) && total ? chunk.slice(total.length) : chunk
          total += delta
          if (delta) yield { type: 'text', text: delta }
        }
      } finally {
        session.destroy?.()
      }
      yield { type: 'done', message: { role: 'assistant', content: total } }
    },
  }
  },
  {
    /** Whether the on-device model can be used in this browser. */
    async isAvailable(): Promise<boolean> {
      const LM = (globalThis as any).LanguageModel
      if (!LM?.availability) return false
      try {
        return (await LM.availability()) !== 'unavailable'
      } catch {
        return false
      }
    },
  },
)

// ─── Proxy (recommended for production) ───────────────────────────────────

export interface ProxyOptions {
  /** Your endpoint created with `createHandler()` from `qikbar/server`. */
  url: string
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)
  credentials?: RequestCredentials
  fetch?: typeof fetch
}

/** Stream through your own server so API keys never reach the browser. */
export function proxy(options: ProxyOptions | string): AIProvider {
  const opts = typeof options === 'string' ? { url: options } : options
  const doFetch = opts.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  return {
    id: 'proxy',
    async *stream(req: AIRequest): AsyncIterable<AIEvent> {
      const extra = typeof opts.headers === 'function' ? await opts.headers() : opts.headers
      const res = await doFetch(opts.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/x-ndjson', ...extra },
        credentials: opts.credentials ?? 'same-origin',
        body: JSON.stringify({ messages: req.messages, system: req.system, tools: req.tools, maxTokens: req.maxTokens }),
        signal: req.signal,
      })
      if (!res.ok) throw await errorFromResponse(res, 'AI proxy')
      yield* parseNDJSON<AIEvent>(res)
    },
  }
}
