/**
 * Qikbar — the open-source command bar for any web app.
 *
 * ```ts
 * import { createQikbar } from '@qikbar/qikbar'
 *
 * const bar = createQikbar({
 *   routes: [{ path: '/settings', title: 'Settings' }],
 *   commands: [{ title: 'Toggle dark mode', run: () => toggleTheme() }],
 * })
 * ```
 */

import { LazyQikbar } from './core/lazy.js'
import type { QikbarConfig, QikbarInstance } from './core/types.js'

/**
 * Create a command bar. Press ⌘K / Ctrl+K to open it.
 *
 * Boots a tiny shell that listens for the hotkey; the UI loads when the
 * browser is idle or on first use, so it never slows down your page load.
 */
export function createQikbar(config: QikbarConfig = {}): QikbarInstance {
  return new LazyQikbar(config, () => import('./ui/bar.js'))
}

export * from './core/types.js'
export { action, chat, defineCommands, defineExtension, defineSource, defineTool, detail, form, grid, list } from './core/define.js'
export { formatHotkey, isMac, matchesHotkey, parseHotkey } from './core/hotkeys.js'
export { memoryStorage } from './core/storage.js'
export { anthropic, browserAI, byok, gemini, ollama, openai, openaiCompatible, proxy } from './ai/index.js'
export type { AnthropicOptions, ByokOptions, GeminiOptions, OpenAIOptions, ProxyOptions } from './ai/index.js'
export { mcp } from './ai/mcp.js'
export type { MCPOptions } from './ai/mcp.js'
export { cachedEmbeddings, geminiEmbeddings, ollamaEmbeddings, openaiEmbeddings, proxyEmbeddings } from './ai/embeddings.js'

// Theme helpers live in `@qikbar/qikbar/theme`; search, markdown and icons in `@qikbar/qikbar/utils`.
// Keeping them out of this entry keeps the initial download tiny.

export const version = '0.2.1'
