import { createQikbar, type Item } from '@qikbar/qikbar'
import { demoAI } from './demo-ai'
import { INSTALLED_KEY, installedNames } from '../lib/installed'

interface SearchEntry {
  title: string
  href: string
  group: string
  page?: string
  description?: string
}

// Map entries into stable Item objects once so the fuzzy matcher's WeakMap cache hits on every keystroke.
let indexItems: Promise<Item[]> | undefined
const loadIndex = (): Promise<Item[]> =>
  (indexItems ??= fetch('/search-index.json')
    .then((r) => r.json() as Promise<SearchEntry[]>)
    .then((entries) =>
      entries.map<Item>((e) => ({
        id: `doc:${e.href}`,
        title: e.title,
        subtitle: e.page ? e.page : e.group,
        description: e.description,
        icon: e.page ? 'hash' : 'book',
        keywords: [e.group, e.page ?? ''].filter(Boolean),
        href: e.href,
      })),
    ))

let promptPromise: Promise<string> | undefined
const loadPrompt = () => (promptPromise ??= fetch('/prompt.txt').then((r) => r.text()))

const go = (href: string) => {
  location.href = href
}

export const bar = createQikbar({
  placeholder: 'Search docs, run commands, or ask AI…',
  // A search button on phones, and the docs as tools for browser AI agents.
  launcher: 'touch',
  webmcp: true,
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
        const text = await loadPrompt()
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
      search: () => loadIndex(),
    },
  ],
})

// Load built-in extensions (calculator, theme switcher, page, shortcuts) and BYOK settings lazily
// when idle or on first open so docs/marketing pages don't parse them on the critical path.
let extrasLoaded = false
const loadExtras = () => {
  if (extrasLoaded) return
  extrasLoaded = true
  void import('@qikbar/qikbar/extensions').then(({ calculator, page, shortcuts, themeSwitcher }) => {
    bar.use(calculator())
    bar.use(themeSwitcher())
    bar.use(page({ headings: '.prose h2[id], .prose h3[id]' }))
    bar.use(shortcuts())
  })
  void import('@qikbar/qikbar/ai').then(({ byok }) => bar.use(byok.settings()))
}
const idle = (globalThis as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined
if (idle) idle(loadExtras, { timeout: 2500 })
else setTimeout(loadExtras, 1200)

// Extensions installed from the /extensions page (catalog loads only when needed).
let catalogPromise: Promise<typeof import('../data/extensions')> | undefined
const loadCatalog = () => (catalogPromise ??= import('../data/extensions'))
const installed = new Set<string>(installedNames())
const uninstallers = new Map<string, () => void>()

export async function setInstalled(name: string, on: boolean): Promise<void> {
  if (on) installed.add(name)
  else installed.delete(name)
  try {
    localStorage.setItem(INSTALLED_KEY, JSON.stringify([...installed]))
  } catch {
    // ignore
  }
  if (!on) {
    uninstallers.get(name)?.()
    uninstallers.delete(name)
    return
  }
  if (uninstallers.has(name)) return
  const { catalog } = await loadCatalog()
  if (!installed.has(name) || uninstallers.has(name)) return
  const entry = catalog.find((c) => c.extension.name === name)
  if (entry) uninstallers.set(name, bar.use(entry.extension))
}

if (installed.size) {
  void loadCatalog().then(({ catalog }) => {
    for (const name of installed) {
      if (uninstallers.has(name)) continue
      const entry = catalog.find((c) => c.extension.name === name)
      if (entry) uninstallers.set(name, bar.use(entry.extension))
    }
  })
}

// Warm the docs index and extensions when the bar opens.
bar.on('open', () => {
  void loadIndex()
  loadExtras()
})

declare global {
  interface Window {
    qikbar: typeof bar
    qikbarSetInstalled: typeof setInstalled
  }
}
window.qikbar = bar
window.qikbarSetInstalled = setInstalled
