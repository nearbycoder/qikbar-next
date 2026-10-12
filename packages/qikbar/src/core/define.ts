/**
 * Helpers for building views, actions and extensions.
 * They only add the `type` field and give you type inference — everything is plain data.
 */

import type {
  Action,
  ChatView,
  Command,
  Context,
  DetailView,
  Extension,
  FormView,
  GridView,
  ListView,
  Source,
  Tool,
  View,
} from './types.js'

type Without<T, K extends keyof T> = Omit<T, K>

/** A searchable list of items. */
export function list(view: Without<ListView, 'type'>): ListView {
  return { ...view, type: 'list' }
}

/** A grid of images. */
export function grid(view: Without<GridView, 'type'>): GridView {
  return { ...view, type: 'grid' }
}

/** A markdown document, optionally streamed. */
export function detail(view: Without<DetailView, 'type'>): DetailView {
  return { ...view, type: 'detail' }
}

/** A form. */
export function form(view: Without<FormView, 'type'>): FormView {
  return { ...view, type: 'form' }
}

/** An AI chat. */
export function chat(view: Without<ChatView, 'type'> = {}): ChatView {
  return { ...view, type: 'chat' }
}

/** Ready-made actions. */
export const action = {
  /** Copy text to the clipboard. */
  copy(content: string | (() => string), options: Partial<Action> = {}): Action {
    return {
      title: 'Copy to Clipboard',
      icon: 'copy',
      shortcut: 'mod+c',
      ...options,
      async run(ctx: Context) {
        const ok = await ctx.copy(typeof content === 'function' ? content() : content)
        ctx.toast({ title: ok ? 'Copied to clipboard' : 'Copy failed', style: ok ? 'success' : 'failure' })
      },
    }
  },
  /** Open an external URL in a new tab. */
  open(url: string, options: Partial<Action> = {}): Action {
    return {
      title: 'Open in Browser',
      icon: 'external',
      ...options,
      run: (ctx) => ctx.openUrl(url),
    }
  },
  /** Navigate within your app. */
  navigate(href: string, options: Partial<Action> = {}): Action {
    return {
      title: 'Open',
      icon: 'arrow-right',
      ...options,
      run: (ctx) => ctx.navigate(href),
    }
  },
  /** Navigate in a new tab. */
  navigateNewTab(href: string, options: Partial<Action> = {}): Action {
    return {
      title: 'Open in New Tab',
      icon: 'external',
      shortcut: 'mod+enter',
      ...options,
      run: (ctx) => ctx.navigate(href, { newTab: true }),
    }
  },
  /** Push a view. */
  push(title: string, view: View | ((ctx: Context) => View | Promise<View>), options: Partial<Action> = {}): Action {
    return {
      title,
      icon: 'chevron-right',
      ...options,
      run: (ctx) => (typeof view === 'function' ? view(ctx) : view),
    }
  },
  /** Ask the AI about something. */
  ask(prompt: string, options: Partial<Action> = {}): Action {
    return {
      title: 'Ask AI',
      icon: 'sparkles',
      shortcut: 'mod+j',
      ...options,
      run: () => ({ type: 'chat', prompt }) satisfies ChatView,
    }
  },
}

/** Define an extension (identity function with type inference). */
export function defineExtension<T extends Extension>(extension: T): T {
  return extension
}

/** Define a set of commands. */
export function defineCommands<T extends Command[]>(commands: T): T {
  return commands
}

/** Define a search source. */
export function defineSource(source: Source): Source {
  return source
}

/** Define an AI tool. */
export function defineTool<Args = Record<string, unknown>>(tool: Tool<Args>): Tool<Args> {
  return tool
}
