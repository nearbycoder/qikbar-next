import type { AIClient, AIMessage, AIProvider, AIToolCall, AIToolDefinition } from '../core/types'

/** Create the simple `ask` / `stream` client exposed as `ctx.ai`. */
export function createAIClient(provider: AIProvider, defaultSystem?: string): AIClient {
  async function* stream(prompt: string, options: { system?: string; signal?: AbortSignal } = {}): AsyncIterable<string> {
    for await (const ev of provider.stream({
      messages: [{ role: 'user', content: prompt }],
      system: options.system ?? defaultSystem,
      signal: options.signal,
    })) {
      if (ev.type === 'text') yield ev.text
      else if (ev.type === 'error') throw new Error(ev.error)
    }
  }
  return {
    provider,
    stream,
    async ask(prompt, options) {
      let out = ''
      for await (const t of stream(prompt, options)) out += t
      return out
    },
  }
}

export interface RuntimeTool {
  definition: AIToolDefinition
  /** Human-readable label for the UI ("Opening Billing…"). */
  label?: (args: Record<string, unknown>) => string
  run: (args: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>
}

export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_start'; call: AIToolCall; label: string }
  | { type: 'tool_end'; call: AIToolCall; ok: boolean; result: string }
  | { type: 'message'; message: AIMessage }
  | { type: 'error'; error: string }

export interface RunAgentOptions {
  provider: AIProvider
  /** Conversation so far (not mutated). */
  messages: AIMessage[]
  system?: string
  tools?: RuntimeTool[]
  maxSteps?: number
  signal: AbortSignal
}

function stringify(value: unknown): string {
  if (value === undefined) return 'Done.'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const MAX_RESULT = 12000

/**
 * Run a tool-calling loop: stream the model's answer, execute requested
 * tools, feed results back, repeat until the model stops calling tools.
 */
export async function* runAgent(options: RunAgentOptions): AsyncIterable<AgentEvent> {
  const { provider, system, signal } = options
  const tools = provider.tools === false ? [] : (options.tools ?? [])
  const history = [...options.messages]
  const maxSteps = options.maxSteps ?? 6

  for (let step = 0; step < maxSteps; step++) {
    const calls: AIToolCall[] = []
    let assistant: AIMessage | undefined
    let text = ''
    for await (const ev of provider.stream({
      messages: [...history],
      system,
      tools: tools.length && step < maxSteps - 1 ? tools.map((t) => t.definition) : undefined,
      signal,
    })) {
      if (ev.type === 'text') {
        text += ev.text
        yield ev
      } else if (ev.type === 'tool_call') calls.push(ev.call)
      else if (ev.type === 'error') yield ev
      else if (ev.type === 'done') assistant = ev.message
    }
    assistant ??= { role: 'assistant', content: text, toolCalls: calls.length ? calls : undefined }
    history.push(assistant)
    yield { type: 'message', message: assistant }
    if (!calls.length || signal.aborted) return

    for (const call of calls) {
      const tool = tools.find((t) => t.definition.name === call.name)
      const label = tool?.label?.(call.args) ?? call.name
      yield { type: 'tool_start', call, label }
      let content: string
      let isError = false
      if (call.error) {
        content = call.error
        isError = true
      } else if (!tool) {
        content = `Unknown tool "${call.name}".`
        isError = true
      } else {
        try {
          content = stringify(await tool.run(call.args, signal))
        } catch (err) {
          content = err instanceof Error ? err.message : String(err)
          isError = true
        }
      }
      if (content.length > MAX_RESULT) content = `${content.slice(0, MAX_RESULT)}… (truncated)`
      const message: AIMessage = { role: 'tool', toolCallId: call.id, toolName: call.name, content, ...(isError ? { isError } : {}) }
      history.push(message)
      yield { type: 'message', message }
      yield { type: 'tool_end', call, ok: !isError, result: content }
      if (signal.aborted) return
    }
  }
}
