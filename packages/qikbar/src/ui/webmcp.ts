/**
 * WebMCP: expose the bar's commands to AI agents running in the browser
 * (Chrome's built-in agent, extensions, the @mcp-b polyfill, …).
 *
 * Tools are registered with `document.modelContext.registerTool()` (or the
 * older `navigator.modelContext`) and unregistered with an AbortSignal.
 */

import type { Item, WebMCPOptions } from '../core/types.js'
import type { Bar } from './bar.js'

interface WebMCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean; consequentialHint?: boolean; untrustedContentHint?: boolean }
  execute(args: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>
}

interface ModelContext {
  registerTool(tool: WebMCPTool, options?: { signal?: AbortSignal }): unknown
  unregisterTool?(name: string): void
}

/** The browser's model context, if WebMCP is available. */
export function modelContext(): ModelContext | undefined {
  const doc = typeof document !== 'undefined' ? (document as unknown as { modelContext?: ModelContext }).modelContext : undefined
  const nav = typeof navigator !== 'undefined' ? (navigator as unknown as { modelContext?: ModelContext }).modelContext : undefined
  const ctx = doc ?? nav
  return ctx && typeof ctx.registerTool === 'function' ? ctx : undefined
}

const safeName = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)

/** Register the bar's tools. Returns a function that unregisters them. */
export function exposeWebMCP(bar: Bar, options: WebMCPOptions = {}): () => void {
  const mc = modelContext()
  if (!mc) return () => {}
  const prefix = safeName(options.prefix ?? 'qikbar')
  const controller = new AbortController()
  const names: string[] = []
  const found = new Map<string, Item>()
  const lookup = (id: string) => found.get(id) ?? bar.rootItems().find((i) => bar.idOf(i) === id)

  const register = (tool: WebMCPTool) => {
    try {
      mc.registerTool(tool, { signal: controller.signal })
      names.push(tool.name)
    } catch (err) {
      console.warn(`[qikbar] could not register WebMCP tool "${tool.name}"`, err)
    }
  }

  register({
    name: `${prefix}_list_commands`,
    description: `List the commands and pages available in this app's command bar (${typeof document !== 'undefined' ? document.title : 'this app'}). Returns ids you can pass to ${prefix}_run.`,
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () =>
      JSON.stringify(
        bar
          .rootItems()
          .filter((i) => !bar.idOf(i).startsWith('qikbar.'))
          .map((i) => ({ id: bar.idOf(i), title: i.title, subtitle: i.subtitle, section: i.section, description: i.description, href: i.href ?? i.url })),
      ),
  })

  register({
    name: `${prefix}_search`,
    description: "Search this app's commands, pages and records (including live data sources). Returns matching items with ids you can pass to " + `${prefix}_run.`,
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'What to look for' } }, required: ['query'] },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (args, opts) => {
      const results = await bar.searchForAgent(String(args.query ?? ''), undefined, opts?.signal ?? new AbortController().signal, found)
      return results.length ? JSON.stringify(results) : 'No results.'
    },
  })

  if (options.run !== false) {
    register({
      name: `${prefix}_run`,
      description: 'Open a page or run a command in this app by id (from list_commands or search). Destructive commands ask the user first.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          arguments: { type: 'object', description: 'Values for the command arguments, if it has any.', additionalProperties: { type: 'string' } },
        },
        required: ['id'],
      },
      execute: async (args) => {
        const item = lookup(String(args.id ?? ''))
        if (!item) return `No item with id "${String(args.id)}". Call ${prefix}_search or ${prefix}_list_commands first.`
        try {
          return await bar.runForAgent(item, args.arguments as Record<string, unknown> | undefined, undefined, 'agent')
        } catch (err) {
          return `Error: ${err instanceof Error ? err.message : String(err)}`
        }
      },
    })
  }

  if (options.tools !== false) {
    for (const { tool, rt, prefix: ext } of bar.toolList()) {
      register({
        name: safeName(`${prefix}_${ext ? `${ext}_` : ''}${tool.name}`),
        description: tool.description,
        inputSchema: (tool.parameters as Record<string, unknown>) ?? { type: 'object', properties: {} },
        annotations: tool.confirm ? { consequentialHint: true } : undefined,
        execute: async (args) => {
          if (tool.confirm) {
            const msg = typeof tool.confirm === 'function' ? tool.confirm(args) : bar.t('allowTool', { tool: tool.name })
            if (!(await bar.confirm({ title: msg, confirmLabel: bar.t('allow') }))) return 'The user declined.'
          }
          const result = await tool.run(args, bar.toolContext(rt))
          return typeof result === 'string' ? result : JSON.stringify(result ?? 'Done.')
        },
      })
    }
  }

  return () => {
    controller.abort()
    // Older implementations don't support the signal; unregister by name.
    if (typeof mc.unregisterTool === 'function') {
      for (const name of names) {
        try {
          mc.unregisterTool(name)
        } catch {
          // already gone
        }
      }
    }
  }
}
