import { defineExtension } from '../core/define.js'
import { defaultStorage } from '../core/storage.js'
import type { AIEvent, AIProvider, AIRequest, Extension, StorageAdapter } from '../core/types.js'
import { anthropic, gemini, openai } from './providers.js'

export type ByokVendor = 'anthropic' | 'openai' | 'gemini' | 'openai-compatible'

export interface ByokSettings {
  vendor: ByokVendor
  apiKey: string
  model?: string
  baseURL?: string
}

export interface ByokOptions {
  /** Vendors offered in settings. Default: all. */
  vendors?: ByokVendor[]
  /** Storage key. Default `"qikbar:byok"`. */
  key?: string
  storage?: StorageAdapter
}

const LABELS: Record<ByokVendor, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  'openai-compatible': 'OpenAI-compatible (OpenRouter, Groq, Ollama…)',
}

function read(storage: StorageAdapter, key: string): ByokSettings | undefined {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as ByokSettings) : undefined
  } catch {
    return undefined
  }
}

/**
 * "Bring your own key": your users paste their own API key, stored only in their
 * browser. Pair with `byok.settings()` so they can configure it from the bar.
 *
 * ```ts
 * createQikbar({ ai: byok(), extensions: [byok.settings()] })
 * ```
 */
export const byok = /* @__PURE__ */ Object.assign(function byok(options: ByokOptions = {}): AIProvider {
  const storage = options.storage ?? defaultStorage()
  const key = options.key ?? 'qikbar:byok'
  return {
    id: 'byok',
    get model() {
      return read(storage, key)?.model
    },
    async *stream(req: AIRequest): AsyncIterable<AIEvent> {
      const s = read(storage, key)
      if (!s?.apiKey && s?.vendor !== 'openai-compatible') {
        yield { type: 'error', error: 'Add your AI API key first: search for “AI Settings” in the command bar.' }
        yield { type: 'done', message: { role: 'assistant', content: '' } }
        return
      }
      const provider =
        s.vendor === 'anthropic'
          ? anthropic({ apiKey: s.apiKey, model: s.model || undefined })
          : s.vendor === 'gemini'
            ? gemini({ apiKey: s.apiKey, model: s.model || undefined })
            : openai({ apiKey: s.apiKey || undefined, model: s.model || undefined, baseURL: s.baseURL || undefined })
      yield* provider.stream(req)
    },
  }
}, {
  /** An extension with an "AI Settings" command where users enter their own key. */
  settings: settingsExtension,
})

function settingsExtension(options: ByokOptions = {}): Extension {
  const storage = options.storage ?? defaultStorage()
  const key = options.key ?? 'qikbar:byok'
  const vendors = options.vendors ?? (Object.keys(LABELS) as ByokVendor[])
  return defineExtension({
    name: 'qikbar-ai-settings',
    title: 'AI',
    icon: 'key',
    commands: [
      {
        name: 'settings',
        title: 'AI Settings',
        subtitle: 'Use your own API key',
        keywords: ['api key', 'openai', 'anthropic', 'claude', 'gemini', 'model', 'byok'],
        icon: 'key',
        view: () => {
          const current = read(storage, key)
          return {
            type: 'form',
            title: 'AI Settings',
            submitLabel: 'Save',
            fields: [
              {
                name: 'vendor',
                label: 'Provider',
                type: 'select',
                options: vendors.map((v) => ({ title: LABELS[v], value: v })),
                defaultValue: current?.vendor ?? vendors[0],
              },
              {
                name: 'apiKey',
                label: 'API key',
                type: 'password',
                placeholder: 'Stored only in this browser',
                defaultValue: current?.apiKey ?? '',
                description: 'Your key never leaves your browser except to call the provider directly.',
              },
              { name: 'model', label: 'Model', placeholder: 'Leave empty for the default', defaultValue: current?.model ?? '' },
              { name: 'baseURL', label: 'Base URL', placeholder: 'Only for OpenAI-compatible APIs', defaultValue: current?.baseURL ?? '' },
            ],
            onSubmit(values, ctx) {
              storage.setItem(key, JSON.stringify(values))
              ctx.toast({ title: 'AI settings saved', style: 'success' })
            },
          }
        },
      },
      {
        name: 'clear',
        title: 'Remove AI API Key',
        icon: 'trash',
        keywords: ['byok', 'api key'],
        searchOnly: true,
        async run(ctx) {
          if (!(await ctx.confirm({ title: 'Remove your API key?', destructive: true, confirmLabel: 'Remove' }))) return false
          storage.removeItem(key)
          ctx.toast({ title: 'API key removed', style: 'success' })
        },
      },
    ],
  })
}
