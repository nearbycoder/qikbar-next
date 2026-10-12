/**
 * Built-in extensions. Each is a plain `Extension` object — read the source to
 * learn the extension API, or copy one as a starting point for your own.
 */

import { action, defineExtension } from '../core/define.js'
import { formatHotkey, isMac } from '../core/hotkeys.js'
import type { Context, Extension, Item, QikbarInstance } from '../core/types.js'
import { convert, evaluate, formatNumber, looksLikeMath } from './math.js'

export { convert, evaluate, formatNumber } from './math.js'

// ─── Calculator ─────────────────────────────────────────────────────────────

/** Type math or conversions straight into the bar: `12 * (3 + 4)`, `15% of 80`, `5 km in mi`. */
export function calculator(): Extension {
  return defineExtension({
    name: 'calculator',
    title: 'Calculator',
    icon: 'calculator',
    description: 'Evaluate math and convert units as you type.',
    sources: [
      {
        id: 'calculator',
        title: 'Calculator',
        position: 'top',
        debounce: 0,
        search({ query }) {
          const q = query.trim().replace(/^=/, '')
          if (!looksLikeMath(q)) return []
          let text: string
          try {
            const conv = convert(q)
            text = conv ? `${formatNumber(conv.value)} ${conv.unit}` : formatNumber(evaluate(q))
          } catch {
            return []
          }
          const raw = text.replace(/,/g, '')
          return [
            {
              id: 'calculator:result',
              title: text,
              subtitle: `= ${q}`,
              icon: 'calculator',
              noHistory: true,
              accessories: [{ text: 'Copy', kbd: 'enter' }],
              actions: [
                action.copy(raw, { title: 'Copy Result', shortcut: undefined }),
                action.copy(`${q} = ${text}`, { title: 'Copy Equation', shortcut: 'mod+shift+c' }),
              ],
            },
          ]
        },
      },
    ],
  })
}

// ─── Theme ──────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeSwitcherOptions {
  /** Apply a theme. Default: toggles the `dark` class and `color-scheme` on `<html>` and saves to localStorage. */
  set?: (mode: ThemeMode) => void
  /** Shortcut for "Toggle Theme". Default `"mod+shift+l"`. */
  shortcut?: string | false
  storageKey?: string
}

/** Light / dark / system theme commands. */
export function themeSwitcher(options: ThemeSwitcherOptions = {}): Extension {
  const key = options.storageKey ?? 'theme'
  const apply =
    options.set ??
    ((mode: ThemeMode) => {
      const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
      const html = document.documentElement
      html.classList.toggle('dark', dark)
      html.classList.toggle('light', !dark)
      html.style.colorScheme = dark ? 'dark' : 'light'
      try {
        if (mode === 'system') localStorage.removeItem(key)
        else localStorage.setItem(key, mode)
      } catch {
        // ignore
      }
    })
  const isDark = () => document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark'
  const set = (mode: ThemeMode, label: string) => (ctx: Context) => {
    apply(mode)
    ctx.toast({ title: label, style: 'success', duration: 1500 })
  }
  return defineExtension({
    name: 'theme',
    title: 'Appearance',
    icon: 'palette',
    commands: [
      {
        name: 'toggle',
        title: 'Toggle Dark Mode',
        icon: 'moon',
        keywords: ['theme', 'light', 'dark', 'appearance', 'night'],
        shortcut: options.shortcut === false ? undefined : (options.shortcut ?? 'mod+shift+l'),
        run: (ctx) => set(isDark() ? 'light' : 'dark', isDark() ? 'Light mode' : 'Dark mode')(ctx),
      },
      { name: 'light', title: 'Use Light Theme', icon: 'sun', keywords: ['theme', 'appearance'], searchOnly: true, run: set('light', 'Light mode') },
      { name: 'dark', title: 'Use Dark Theme', icon: 'moon', keywords: ['theme', 'appearance'], searchOnly: true, run: set('dark', 'Dark mode') },
      { name: 'system', title: 'Use System Theme', icon: 'monitor', keywords: ['theme', 'appearance', 'auto'], searchOnly: true, run: set('system', 'System theme') },
    ],
  })
}

// ─── Page ───────────────────────────────────────────────────────────────────

export interface PageOptions {
  /** Index headings on the current page so users can jump to them. Default `"h1[id], h2[id], h3[id]"`. Set `false` to disable. */
  headings?: string | false
}

/** Browser and page utilities: back/forward, copy URL, scroll, print, share, jump to heading. */
export function page(options: PageOptions = {}): Extension {
  const selector = options.headings ?? 'h1[id], h2[id], h3[id]'
  const p = (name: string, title: string, icon: string, run: (ctx: Context) => unknown, extra: Partial<Item> = {}) => ({
    name,
    title,
    icon,
    searchOnly: true,
    run: async (ctx: Context) => {
      await run(ctx)
    },
    ...extra,
  })
  return defineExtension({
    name: 'page',
    title: 'Page',
    icon: 'file',
    commands: [
      p('back', 'Go Back', 'arrow-left', () => history.back(), { keywords: ['history', 'previous'] }),
      p('forward', 'Go Forward', 'arrow-right', () => history.forward(), { keywords: ['history', 'next'] }),
      p('reload', 'Reload Page', 'refresh', () => location.reload(), { keywords: ['refresh'] }),
      p(
        'copy-url',
        'Copy Page URL',
        'link',
        async (ctx) => {
          const ok = await ctx.copy(location.href)
          ctx.toast({ title: ok ? 'Copied page URL' : 'Copy failed', style: ok ? 'success' : 'failure' })
        },
        { keywords: ['link', 'share', 'address'] },
      ),
      p('top', 'Scroll to Top', 'arrow-up-right', () => window.scrollTo({ top: 0, behavior: 'smooth' })),
      p('bottom', 'Scroll to Bottom', 'chevron-down', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })),
      p('print', 'Print Page', 'file-text', () => setTimeout(() => window.print(), 150)),
      p('share', 'Share Page…', 'send', () => navigator.share?.({ title: document.title, url: location.href }), {
        when: () => typeof navigator !== 'undefined' && 'share' in navigator,
      }),
    ],
    sources: selector
      ? [
          {
            id: 'page-headings',
            title: 'On This Page',
            debounce: 0,
            filter: true,
            limit: 6,
            search() {
              const seen = new Set<string>()
              return [...document.querySelectorAll<HTMLElement>(selector)]
                .filter((el) => !el.closest('.qb-root') && el.id && !seen.has(el.id) && seen.add(el.id))
                .map((el) => ({
                  id: `heading:${el.id}`,
                  title: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
                  subtitle: `#${el.id}`,
                  icon: 'hash',
                  noHistory: true,
                  run: (ctx: Context) => {
                    ctx.close()
                    history.replaceState(null, '', `#${el.id}`)
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  },
                }))
            },
          },
        ]
      : [],
  })
}

// ─── AI actions ─────────────────────────────────────────────────────────────

function pageText(limit = 16000): string {
  const main = document.querySelector('main, [role=main], article') ?? document.body
  return (main as HTMLElement).innerText.replace(/\n{3,}/g, '\n\n').trim().slice(0, limit)
}

/** AI commands that work on the current page or selected text. Requires `ai` to be configured. */
export function aiActions(): Extension {
  let bar: QikbarInstance | undefined
  let selection = ''
  const needsAI = (ctx: Context) => {
    if (!ctx.ai) {
      ctx.toast({ title: 'AI is not configured', style: 'failure' })
      return true
    }
    return false
  }
  const streamDetail = (ctx: Context, title: string, prompt: string) => {
    if (needsAI(ctx)) return false
    const answer = ctx.ai!.stream(prompt, { signal: ctx.signal })
    return {
      type: 'detail' as const,
      title,
      markdown: answer,
      actions: [action.ask(`${prompt}\n\nLet's discuss.`, { title: 'Continue in Chat' })],
    }
  }
  return defineExtension({
    name: 'ai-actions',
    title: 'AI',
    icon: 'sparkles',
    setup({ bar: b }) {
      bar = b
      // Capture the text selection before focus moves into the bar.
      return b.on('open', () => {
        selection = typeof window !== 'undefined' ? (window.getSelection()?.toString() ?? '').trim() : ''
      })
    },
    commands: [
      {
        name: 'summarize-page',
        title: 'Summarize This Page',
        icon: 'sparkles',
        keywords: ['tldr', 'summary', 'ai'],
        when: () => !!bar?.ai,
        run: (ctx) =>
          streamDetail(
            ctx,
            'Summary',
            `Summarize this web page in a few bullet points, then one sentence on what the reader should do next.\n\nTitle: ${document.title}\n\n${pageText()}`,
          ),
      },
      {
        name: 'explain-selection',
        title: 'Explain Selected Text',
        icon: 'wand',
        keywords: ['ai', 'selection', 'what does this mean'],
        when: () => !!bar?.ai && !!selection,
        run: (ctx) => streamDetail(ctx, 'Explanation', `Explain this clearly and briefly:\n\n${selection}`),
      },
      {
        name: 'translate',
        title: 'Translate',
        subtitle: 'Selection or page',
        icon: 'languages',
        keywords: ['ai', 'language'],
        when: () => !!bar?.ai,
        arguments: [{ name: 'language', placeholder: 'Language', required: true }],
        run: (ctx) =>
          streamDetail(
            ctx,
            `Translation (${ctx.arguments.language})`,
            `Translate the following into ${ctx.arguments.language}. Reply with only the translation, keeping Markdown formatting.\n\n${selection || pageText(6000)}`,
          ),
      },
    ],
  })
}

// ─── Keyboard shortcuts ─────────────────────────────────────────────────────

/** A "Keyboard Shortcuts" command listing every shortcut in your app. */
export function shortcuts(): Extension {
  return defineExtension({
    name: 'shortcuts',
    title: 'Help',
    icon: 'keyboard',
    commands: [
      {
        name: 'list',
        title: 'Keyboard Shortcuts',
        icon: 'keyboard',
        keywords: ['hotkeys', 'keys', 'help', 'cheatsheet'],
        view: (ctx) => {
          const commands = ctx.bar
            .commands()
            .filter((c) => c.shortcut)
            .map((c) => ({ ...c, section: c.section ?? 'Commands', accessories: [{ kbd: c.shortcut! }] }))
          const builtIn: Item[] = [
            ['Open command bar', 'mod+k'],
            ['Move selection', 'arrowdown'],
            ['Run selected', 'enter'],
            ['Secondary action', 'mod+enter'],
            ['Show actions', 'mod+.'],
            ['Ask AI', 'tab'],
            ['Go back', 'escape'],
          ].map(([title, kbd]) => ({ title: title!, section: 'Command bar', accessories: [{ kbd: kbd! }], icon: 'command' }))
          return {
            type: 'list',
            title: 'Keyboard Shortcuts',
            placeholder: 'Search shortcuts…',
            items: [...commands, ...builtIn],
            actions: [],
          }
        },
      },
    ],
  })
}

/** Format a shortcut for display outside the bar, e.g. in a button: `"⌘K"`. */
export function shortcutLabel(hotkey: string): string {
  return formatHotkey(hotkey)
    .map((c) => c.join(isMac ? '' : '+'))
    .join(' ')
}
