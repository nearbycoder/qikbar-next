import { byok, createQikbar, type Item } from '@qikbar/qikbar'
import { calculator, page, shortcuts, themeSwitcher } from '@qikbar/qikbar/extensions'
import { demoAI } from './demo-ai'
import { catalog, installedNames, INSTALLED_KEY } from '../data/extensions'

interface SearchEntry {
  title: string
  href: string
  group: string
  page?: string
  description?: string
}

let index: Promise<SearchEntry[]> | undefined
const loadIndex = (): Promise<SearchEntry[]> => (index ??= fetch('/search-index.json').then((r) => r.json()))

const go = (href: string) => {
  location.href = href
}

export const bar = createQikbar({
  placeholder: 'Search docs, run commands, or ask AI…',
  navigate: (href, { newTab }) => (newTab ? window.open(href, '_blank') : go(href)),
  ai: {
    provider: demoAI,
    name: 'AI',
    suggestions: ['What can you do?', 'Go to theming', 'How do I add a source?', 'Summarize this page'],
  },
  routes: [
    { path: '/', title: 'Home', icon: 'home', section: 'Qikbar' },
    { path: '/docs', title: 'Documentation', icon: 'book', section: 'Qikbar', keywords: ['docs', 'guide'] },
    { path: '/themes', title: 'Theme Builder', icon: 'palette', section: 'Qikbar', keywords: ['colors', 'presets', 'css'] },
    { path: '/extensions', title: 'Extensions', icon: 'puzzle', section: 'Qikbar', keywords: ['plugins', 'store'] },
    { path: '/playground', title: 'Playground', icon: 'code', section: 'Qikbar', keywords: ['try', 'sandbox', 'editor', 'demo'] },
  ],
  commands: [
    { title: 'View on GitHub', icon: 'github', url: 'https://github.com/nearbycoder/qikbar-next', section: 'Qikbar', keywords: ['source', 'repo', 'star'] },
    {
      title: 'Copy Install Command',
      subtitle: 'npm install @qikbar/qikbar',
      icon: 'terminal',
      section: 'Qikbar',
      keywords: ['npm', 'install', 'pnpm', 'bun'],
      actions: [
        {
          title: 'Copy npm Command',
          icon: 'copy',
          run: async (ctx) => {
            await ctx.copy('npm install @qikbar/qikbar')
            ctx.toast({ title: 'Copied npm install @qikbar/qikbar', style: 'success' })
          },
        },
        {
          title: 'Copy pnpm Command',
          icon: 'copy',
          run: async (ctx) => {
            await ctx.copy('pnpm add @qikbar/qikbar')
            ctx.toast({ title: 'Copied pnpm add @qikbar/qikbar', style: 'success' })
          },
        },
      ],
    },
    {
      title: 'Copy AI Setup Prompt',
      subtitle: 'Paste into Claude Code, Cursor or Copilot',
      icon: 'sparkles',
      section: 'Qikbar',
      keywords: ['llm', 'agent', 'prompt', 'install'],
      run: async (ctx) => {
        const text = await fetch('/prompt.txt').then((r) => r.text())
        await ctx.copy(text)
        ctx.toast({ title: 'Prompt copied', message: 'Paste it into your coding agent', style: 'success' })
      },
    },
    { title: 'Open llms.txt', icon: 'file-text', href: '/llms.txt', section: 'Qikbar', searchOnly: true, keywords: ['ai', 'llm'] },
  ],
  sources: [
    {
      id: 'docs',
      title: 'Documentation',
      debounce: 0,
      filter: true,
      limit: 8,
      async search() {
        const entries = await loadIndex()
        return entries.map<Item>((e) => ({
          id: `doc:${e.href}`,
          title: e.title,
          subtitle: e.page ? e.page : e.group,
          description: e.description,
          icon: e.page ? 'hash' : 'book',
          keywords: [e.group, e.page ?? ''].filter(Boolean),
          href: e.href,
        }))
      },
    },
  ],
  extensions: [calculator(), themeSwitcher(), page({ headings: '.prose h2[id], .prose h3[id]' }), shortcuts(), byok.settings()],
})

// Extensions installed from the /extensions page.
const uninstallers = new Map<string, () => void>()
export function setInstalled(name: string, on: boolean) {
  const entry = catalog.find((c) => c.extension.name === name)
  if (!entry) return
  if (on && !uninstallers.has(name)) uninstallers.set(name, bar.use(entry.extension))
  if (!on) {
    uninstallers.get(name)?.()
    uninstallers.delete(name)
  }
  localStorage.setItem(INSTALLED_KEY, JSON.stringify([...uninstallers.keys()]))
}
for (const name of installedNames()) setInstalled(name, true)

// Warm the docs index when the bar opens.
bar.on('open', () => void loadIndex())

declare global {
  interface Window {
    qikbar: typeof bar
    qikbarSetInstalled: typeof setInstalled
  }
}
window.qikbar = bar
window.qikbarSetInstalled = setInstalled
