import type { APIRoute } from 'astro'
import { allDocs, GROUPS } from '../lib/docs'

export const GET: APIRoute = async ({ site }) => {
  const docs = await allDocs()
  const base = site ?? new URL('https://qikbar.com')
  const lines = [
    '# Qikbar',
    '',
    '> Qikbar is a free, open-source (MIT), zero-dependency command bar (⌘K / Ctrl+K) for any web app. It provides fuzzy search, routing, actions, nested views (list, grid, detail, form, AI chat), dynamic data sources, a Raycast-inspired extensions API, theming via CSS variables, and AI (Anthropic, OpenAI, Gemini, Ollama, OpenAI-compatible, proxy, bring-your-own-key) where the model can run app commands as tools. npm package: `qikbar`. Entry points: `qikbar`, `qikbar/react`, `qikbar/server`, `qikbar/extensions`, `qikbar/theme`, `qikbar/utils`.',
    '',
    'Every page is available as Markdown by appending `.md` to its URL. The full documentation in one file: ' + new URL('/llms-full.txt', base).href,
    '',
    '- [Set up with AI](' + new URL('/prompt.txt', base).href + '): a ready-made prompt for coding agents to install and configure Qikbar in an existing app.',
    '',
  ]
  for (const group of GROUPS) {
    const items = docs.filter((d) => d.data.group === group)
    if (!items.length) continue
    lines.push(`## ${group}`, '')
    for (const d of items) lines.push(`- [${d.data.title}](${new URL(`/docs/${d.id}.md`, base).href}): ${d.data.description}`)
    lines.push('')
  }
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
