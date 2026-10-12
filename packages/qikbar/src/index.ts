/**
 * Qikbar — the open-source command bar for any web app.
 *
 * ```ts
 * import { createQikbar } from 'qikbar'
 *
 * const bar = createQikbar({
 *   routes: [{ path: '/settings', title: 'Settings' }],
 *   commands: [{ title: 'Toggle dark mode', run: () => toggleTheme() }],
 * })
 * ```
 */

import { LazyQikbar } from './core/lazy'
import type { QikbarConfig, QikbarInstance } from './core/types'

/**
 * Create a command bar. Press ⌘K / Ctrl+K to open it.
 *
 * Boots a tiny shell that listens for the hotkey; the UI loads when the
 * browser is idle or on first use, so it never slows down your page load.
 */
export function createQikbar(config: QikbarConfig = {}): QikbarInstance {
  return new LazyQikbar(config, () => import('./ui/bar'))
}

export * from './core/types'
export { action, chat, defineCommands, defineExtension, defineSource, defineTool, detail, form, grid, list } from './core/define'
export { formatHotkey, isMac, matchesHotkey, parseHotkey } from './core/hotkeys'
export { memoryStorage } from './core/storage'
export { anthropic, browserAI, byok, gemini, ollama, openai, openaiCompatible, proxy } from './ai/index'
export type { AnthropicOptions, ByokOptions, GeminiOptions, OpenAIOptions, ProxyOptions } from './ai/index'

// Theme helpers live in `qikbar/theme`; search, markdown and icons in `qikbar/utils`.
// Keeping them out of this entry keeps the initial download tiny.

export const version = '1.0.0'
