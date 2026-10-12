import { afterEach, describe, expect, it, vi } from 'vitest'
import { runAgent } from '../src/ai/agent'
import { anthropic, gemini, openai, proxy } from '../src/ai/providers'
import { createHandler } from '../src/server/index'
import type { AIEvent, AIProvider, AIRequest } from '../src/core/types'
import { setup, settle, tick } from './helpers'

const sse = (events: unknown[], named = false) =>
  new Response(
    events.map((e) => (named ? `event: ${(e as any).type}\ndata: ${JSON.stringify(e)}\n\n` : `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`)).join(''),
    { headers: { 'content-type': 'text/event-stream' } },
  )

async function collect(it: AsyncIterable<AIEvent>) {
  const out: AIEvent[] = []
  for await (const e of it) out.push(e)
  return out
}

describe('anthropic provider', () => {
  it('streams text and tool calls, keeping raw blocks for replay', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      expect(body.model).toBe('claude-opus-5-5')
      expect(body.output_config).toEqual({ effort: 'low' })
      expect(body.fallbacks).toBe('default')
      expect(body.tools[0]).toMatchObject({ name: 'run', eager_input_streaming: true })
      expect((init.headers as Record<string, string>)['anthropic-beta']).toContain('server-side-fallback-2026-07-01')
      return sse(
        [
          { type: 'message_start', message: { id: 'm' } },
          { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
          { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig' } },
          { type: 'content_block_stop', index: 0 },
          { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
          { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Opening ' } },
          { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'billing.' } },
          { type: 'content_block_stop', index: 1 },
          { type: 'content_block_start', index: 2, content_block: { type: 'tool_use', id: 'toolu_1', name: 'run', input: {} } },
          { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: '{"id":' } },
          { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: '"route:/billing"}' } },
          { type: 'content_block_stop', index: 2 },
          { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
          { type: 'message_stop' },
        ],
        true,
      )
    })
    const p = anthropic({ apiKey: 'k', fetch: fetch as any })
    const events = await collect(
      p.stream({ messages: [{ role: 'user', content: 'billing' }], tools: [{ name: 'run', description: 'run', parameters: { type: 'object' } }] }),
    )
    expect(events.filter((e) => e.type === 'text').map((e: any) => e.text).join('')).toBe('Opening billing.')
    const call = events.find((e) => e.type === 'tool_call') as any
    expect(call.call).toEqual({ id: 'toolu_1', name: 'run', args: { id: 'route:/billing' } })
    const done = events.find((e) => e.type === 'done') as any
    expect(done.message.raw.data[0]).toMatchObject({ type: 'thinking', signature: 'sig' })
    expect(done.message.raw.data[2]).toEqual({ type: 'tool_use', id: 'toolu_1', name: 'run', input: { id: 'route:/billing' } })
  })

  it('does not run tools from truncated turns', async () => {
    const fetch = async () =>
      sse(
        [
          { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 't', name: 'run', input: {} } },
          { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"id":"x' } },
          { type: 'content_block_stop', index: 0 },
          { type: 'message_delta', delta: { stop_reason: 'max_tokens' } },
        ],
        true,
      )
    const events = await collect(anthropic({ apiKey: 'k', fetch: fetch as any }).stream({ messages: [{ role: 'user', content: 'x' }] }))
    expect(events.some((e) => e.type === 'tool_call')).toBe(false)
  })

  it('groups tool results into one user message and replays raw content', async () => {
    let sent: any
    const fetch = async (_: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string)
      return sse([{ type: 'message_delta', delta: { stop_reason: 'end_turn' } }], true)
    }
    await collect(
      anthropic({ apiKey: 'k', fetch: fetch as any, model: 'claude-haiku-5-5' }).stream({
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: '', raw: { provider: 'anthropic', data: [{ type: 'tool_use', id: 'a', name: 'x', input: {} }, { type: 'tool_use', id: 'b', name: 'x', input: {} }] } },
          { role: 'tool', toolCallId: 'a', content: 'one' },
          { role: 'tool', toolCallId: 'b', content: 'two', isError: true },
        ],
      }),
    )
    expect(sent.fallbacks).toBeUndefined()
    expect(sent.messages).toHaveLength(3)
    expect(sent.messages[2].content).toEqual([
      { type: 'tool_result', tool_use_id: 'a', content: 'one' },
      { type: 'tool_result', tool_use_id: 'b', content: 'two', is_error: true },
    ])
  })
})

describe('openai provider', () => {
  it('assembles streamed tool call arguments', async () => {
    const fetch = async (url: string) => {
      expect(url).toBe('https://api.openai.com/v1/chat/completions')
      return sse([
        { choices: [{ delta: { content: 'Hi' } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'search', arguments: '{"que' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ry":"acme"}' } }] } }] },
        { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
        '[DONE]',
      ])
    }
    const events = await collect(openai({ apiKey: 'k', fetch: fetch as any }).stream({ messages: [{ role: 'user', content: 'x' }] }))
    expect((events.find((e) => e.type === 'tool_call') as any).call).toEqual({ id: 'c1', name: 'search', args: { query: 'acme' } })
  })
})

describe('gemini provider', () => {
  it('parses function calls and keeps thought signatures', async () => {
    const fetch = async (url: string) => {
      expect(url).toContain(':streamGenerateContent?alt=sse')
      return sse([
        { candidates: [{ content: { parts: [{ text: 'Sure' }] } }] },
        { candidates: [{ content: { parts: [{ functionCall: { name: 'run', args: { id: 'x' } }, thoughtSignature: 'abc' }] }, finishReason: 'STOP' }] },
      ])
    }
    const events = await collect(gemini({ apiKey: 'k', fetch: fetch as any }).stream({ messages: [{ role: 'user', content: 'x' }] }))
    expect((events.find((e) => e.type === 'tool_call') as any).call).toMatchObject({ name: 'run', args: { id: 'x' } })
    const done = events.find((e) => e.type === 'done') as any
    expect(done.message.raw.data[1].thoughtSignature).toBe('abc')
  })
})

/** A scripted provider for agent tests. */
function scripted(turns: ((req: AIRequest) => AIEvent[])[]): AIProvider {
  let i = 0
  return {
    id: 'mock',
    async *stream(req) {
      const events = turns[Math.min(i++, turns.length - 1)]!(req)
      for (const e of events) yield e
    },
  }
}

describe('runAgent', () => {
  it('executes tools and feeds results back', async () => {
    const seen: AIRequest[] = []
    const provider = scripted([
      (req) => {
        seen.push(req)
        const call = { id: '1', name: 'add', args: { a: 2, b: 3 } }
        return [{ type: 'tool_call', call }, { type: 'done', message: { role: 'assistant', content: '', toolCalls: [call] } }]
      },
      (req) => {
        seen.push(req)
        return [{ type: 'text', text: 'It is 5' }, { type: 'done', message: { role: 'assistant', content: 'It is 5' } }]
      },
    ])
    const events = await collect(
      runAgent({
        provider,
        messages: [{ role: 'user', content: '2+3?' }],
        tools: [{ definition: { name: 'add', description: '', parameters: {} }, run: async (a: any) => a.a + a.b }],
        signal: new AbortController().signal,
      }) as any,
    )
    expect(seen[1]!.messages.at(-1)).toMatchObject({ role: 'tool', content: '5', toolCallId: '1' })
    expect(events.some((e: any) => e.type === 'tool_end' && e.ok)).toBe(true)
  })
})

describe('chat in the bar', () => {
  let t: ReturnType<typeof setup> | undefined
  afterEach(() => t?.bar.destroy())

  it('lets the AI navigate by running a command', async () => {
    const navigate = vi.fn()
    const provider = scripted([
      (req) => {
        expect(req.system).toContain('route:/billing | Billing')
        const call = { id: '1', name: 'run', args: { id: 'route:/billing' } }
        return [{ type: 'tool_call', call }, { type: 'done', message: { role: 'assistant', content: '', toolCalls: [call] } }]
      },
      () => [{ type: 'text', text: 'Done — you are on **Billing**.' }, { type: 'done', message: { role: 'assistant', content: 'Done' } }],
    ])
    t = setup({ ai: provider, routes: [{ path: '/billing', title: 'Billing' }], navigate })
    t.bar.open()
    await t.type('take me to billing')
    await t.press('Tab')
    await tick(10)
    await settle()
    expect(navigate).toHaveBeenCalledWith('/billing', { newTab: false })
    expect(t.$('.qb-msg-user')?.textContent).toBe('take me to billing')
    expect(t.$('.qb-tool')?.textContent).toContain('Opening Billing')
    expect(t.$('.qb-msg-ai strong')?.textContent).toBe('Billing')
  })

  it('shows Ask AI as a fallback', async () => {
    t = setup({ ai: scripted([() => [{ type: 'done', message: { role: 'assistant', content: '' } }]]) })
    t.bar.open()
    await t.type('what is love')
    expect(t.titles()).toContain('Ask AI')
  })
})

describe('server handler + proxy', () => {
  it('streams events end to end', async () => {
    const upstream = scripted([() => [{ type: 'text', text: 'hello' }, { type: 'done', message: { role: 'assistant', content: 'hello' } }]])
    const handler = createHandler({ provider: upstream, system: 'server rules' })
    const client = proxy({ url: 'https://app.test/api/qikbar', fetch: ((url: string, init: RequestInit) => handler(new Request(url, init))) as any })
    const events = await collect(client.stream({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(events.map((e) => e.type)).toEqual(['text', 'done'])
  })

  it('rejects unauthorized and malformed requests', async () => {
    const handler = createHandler({ provider: scripted([() => []]), authorize: () => false })
    expect((await handler(new Request('https://x', { method: 'POST', body: '{}' }))).status).toBe(401)
    const open = createHandler({ provider: scripted([() => []]) })
    expect((await open(new Request('https://x', { method: 'POST', body: 'nope' }))).status).toBe(400)
    expect((await open(new Request('https://x', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'system', content: 'x' }] }) }))).status).toBe(400)
  })
})
