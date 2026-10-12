import { byok, type AIEvent, type AIProvider, type AIRequest } from 'qikbar'

/**
 * The site's AI: if the visitor saved their own key (AI Settings), use it.
 * Otherwise a small scripted model that shows how tool calling works.
 */
const real = byok()

function hasKey() {
  try {
    const s = JSON.parse(localStorage.getItem('qikbar:byok') ?? 'null')
    return !!(s?.apiKey || s?.vendor === 'openai-compatible')
  } catch {
    return false
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function* say(text: string): AsyncIterable<AIEvent> {
  for (const chunk of text.match(/\S+\s*|\s+/g) ?? []) {
    await sleep(14 + Math.random() * 18)
    yield { type: 'text', text: chunk }
  }
  yield { type: 'done', message: { role: 'assistant', content: text } }
}

function call(name: string, args: Record<string, unknown>): AIEvent[] {
  const c = { id: `demo_${Math.random().toString(36).slice(2)}`, name, args }
  return [
    { type: 'tool_call', call: c },
    { type: 'done', message: { role: 'assistant', content: '', toolCalls: [c] } },
  ]
}

const ACT = /^(?:please\s+)?(?:go(?: to)?|open|take me to|navigate to|show(?: me)?|switch to|run|toggle|launch)\s+(.+?)[.!?]*$/i
const ASK = /\b(how|what|why|can|does|do|is|where|which|explain)\b/i

export const demoAI: AIProvider = {
  id: 'qikbar-demo',
  async *stream(req: AIRequest): AsyncIterable<AIEvent> {
    if (hasKey()) {
      yield* real.stream(req)
      return
    }
    await sleep(250)
    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user')?.content.trim() ?? ''
    const last = req.messages[req.messages.length - 1]!
    const tools = new Set(req.tools?.map((t) => t.name))

    // After a tool ran, decide the next step.
    if (last.role === 'tool') {
      let results: any
      try {
        results = JSON.parse(last.content)
      } catch {
        results = last.content
      }
      if (last.toolName === 'search') {
        const intent = ACT.test(lastUser)
        if (Array.isArray(results) && results.length) {
          if (intent && tools.has('run')) {
            for (const e of call('run', { id: results[0].id })) yield e
            return
          }
          const links = results
            .slice(0, 4)
            .map((r: any) => (r.href ? `- [${r.title}](${r.href})${r.subtitle ? ` — ${r.subtitle}` : ''}` : `- **${r.title}**`))
            .join('\n')
          yield* say(`Here's what I found in the docs:\n\n${links}\n\nWant me to open one? Say “open ${results[0].title}”.`)
          return
        }
        yield* say(`I couldn't find anything for that. Try rephrasing, or browse the [docs](/docs).`)
        return
      }
      if (last.toolName === 'read_page') {
        const title = String(results).match(/^# (.+)$/m)?.[1] ?? 'this page'
        const words = String(results).split(/\s+/).length
        yield* say(
          `**${title}** has about ${words.toLocaleString()} words. I'm a demo model, so I can only skim. Add your own API key with **AI Settings** in the bar and I'll write a real summary.`,
        )
        return
      }
      yield* say(last.isError ? `That didn't work: ${last.content}` : `Done. ${last.content.replace(/^Ran "(.+)"\.$/, 'I opened **$1** for you.').replace(/^Navigated to (.+)\.$/, 'You’re now on `$1`.')}`)
      return
    }

    // A fresh user message.
    const act = lastUser.match(ACT)
    if (act && tools.has('search')) {
      for (const e of call('search', { query: act[1] })) yield e
      return
    }
    if (/summar|this page|tl;?dr/i.test(lastUser) && tools.has('read_page')) {
      for (const e of call('read_page', {})) yield e
      return
    }
    if (/what can (you|i) do|help|hello|hi\b|hey/i.test(lastUser)) {
      yield* say(
        [
          "I'm the **Qikbar demo assistant**. I'm not a real model, but I use the same tools a real one would:",
          '',
          '- **Act**: “go to theming”, “open the React docs”, “toggle dark mode”',
          '- **Find**: “how do I add a source?”',
          '- **Read**: “summarize this page”',
          '',
          'To use a real model, open **AI Settings** and paste your Anthropic, OpenAI or Gemini key. It stays in your browser.',
        ].join('\n'),
      )
      return
    }
    if (ASK.test(lastUser) && tools.has('search')) {
      const topic = lastUser
        .replace(/[?.!]/g, '')
        .replace(/\b(how|what|why|can|does|do|is|where|which|explain|i|you|we|the|a|an|to|in|with|qikbar|use|add|make|set|up)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      for (const e of call('search', { query: topic || lastUser })) yield e
      return
    }
    yield* say(
      `You said: “${lastUser}”.\n\nI'm a scripted demo model. Try “go to extensions” or “how do I theme it?”. Or add your own key in **AI Settings** for real answers.`,
    )
  },
}
