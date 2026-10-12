---
title: AI providers
description: Claude, GPT, Gemini, local models, Chrome's on-device model, bring-your-own-key, or your own provider.
group: AI
order: 2
---

Providers are tiny, dependency-free adapters that stream over `fetch`. They all implement the same interface, so you can switch models by changing one line.

```ts
import { anthropic, openai, gemini, openaiCompatible, ollama, browserAI, proxy, byok } from 'qikbar'
```

## Anthropic (Claude)

```ts
anthropic({
  apiKey: '…',
  model: 'claude-opus-5-5',  // default
  effort: 'low',             // default: keeps the bar snappy. 'medium' | 'high' | 'xhigh' | 'max'
  maxTokens: 16000,
})
```

- Uses the Messages API with streaming and tool use.
- For the lowest latency and cost, use `model: 'claude-haiku-5-5'`.
- Server-side refusal fallbacks are on by default for models that support them. Turn them off with `fallbacks: false`.
- Thinking blocks are kept and replayed between tool calls automatically.
- In the browser, it sends the `anthropic-dangerous-direct-browser-access` header. Prefer a [proxy](/docs/ai-server) in production.

## OpenAI

```ts
openai({ apiKey: '…', model: 'gpt-6-luna' }) // default model
```

Uses Chat Completions with streaming tool calls.

## Any OpenAI-compatible API

Groq, OpenRouter, Together, Fireworks, Mistral, DeepSeek, xAI, Perplexity, vLLM, LM Studio and others work this way:

```ts
openaiCompatible({ baseURL: 'https://openrouter.ai/api/v1', apiKey: '…', model: 'anthropic/claude-sonnet-5-5' })
openaiCompatible({ baseURL: 'https://api.groq.com/openai/v1', apiKey: '…', model: '…' })
```

Set `tools: false` for models without function calling.

## Ollama (local)

```ts
ollama({ model: 'llama3.2' })                  // http://localhost:11434/v1
ollama({ model: 'qwen3', baseURL: 'http://gpu-box:11434/v1' })
```

## Google Gemini

```ts
gemini({ apiKey: '…', model: 'gemini-flash-latest' }) // default model
```

Uses `streamGenerateContent` with function calling. Thought signatures are preserved across tool calls.

## Chrome built-in AI

Chrome's on-device model, through the Prompt API. It's free and private, and needs no key. It doesn't support tools, so it's chat only.

```ts
if (await browserAI.isAvailable()) createQikbar({ ai: browserAI() })
```

## Proxy

Your own server endpoint, created with [`createHandler`](/docs/ai-server). This is the recommended setup for production.

```ts
proxy('/api/qikbar')
proxy({ url: '/api/qikbar', headers: async () => ({ authorization: `Bearer ${await getToken()}` }) })
```

## Bring your own key

Let each user paste their own key. It's stored only in their browser:

```ts
import { byok } from 'qikbar'

createQikbar({
  ai: byok(),
  extensions: [byok.settings()], // adds "AI Settings" and "Remove AI API Key" commands
})
```

Users choose Anthropic, OpenAI, Gemini or any OpenAI-compatible endpoint, and optionally a model. Until a key is set, the chat explains how to add one. Limit the choices with `byok({ vendors: ['anthropic', 'openai'] })`, and pass the same options to `byok.settings()`.

## Write your own provider

A provider is an object with a `stream` method that yields events:

```ts
import type { AIProvider } from 'qikbar'

const myProvider: AIProvider = {
  id: 'my-llm',
  tools: true, // set false if the model can't call tools
  async *stream({ messages, system, tools, signal }) {
    // messages: { role: 'user' | 'assistant' | 'tool', content, toolCalls?, toolCallId? }[]
    const res = await fetch('/my-llm', { method: 'POST', body: JSON.stringify({ messages, system, tools }), signal })
    let text = ''
    for await (const chunk of readChunks(res)) {
      text += chunk
      yield { type: 'text', text: chunk }
    }
    // If the model wants to call a tool:
    // yield { type: 'tool_call', call: { id, name, args } }
    yield { type: 'done', message: { role: 'assistant', content: text } }
  },
}
```

| Event | Meaning |
| --- | --- |
| `{ type: 'text', text }` | A chunk of the answer |
| `{ type: 'tool_call', call: { id, name, args } }` | The model wants to run a tool |
| `{ type: 'done', message }` | The final assistant message. Set `message.raw` to replay provider-specific data on the next turn. |
| `{ type: 'error', error }` | A message for the user (for example, refused or filtered) |

Throwing an error also works. It's shown in the chat.
