---
title: API reference
description: Every configuration option, instance method, event and export.
group: Reference
order: 1
---

## `createQikbar(config)`

Creates a command bar and returns an [instance](#instance). It's safe to call during SSR, where it does nothing until it runs in a browser.

```ts
import { createQikbar } from '@qikbar/qikbar'
const bar = createQikbar({ /* config */ })
```

## Config

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `commands` | `Command[]` | `[]` | Root [commands](/docs/commands) |
| `routes` | `Route[]` | `[]` | `{ path, title, subtitle?, icon?, keywords?, section?, shortcut? }`. See [Routing](/docs/routing). |
| `sources` | `Source[]` | `[]` | Async [search providers](/docs/sources) |
| `extensions` | `(Extension \| [Extension, prefs])[]` | `[]` | [Extensions](/docs/extensions), optionally with preference values |
| `fallbacks` | `Item[]` | `[]` | Shown when the user has typed something. `{query}` is substituted. |
| `navigate` | `(href, { newTab }) => void` | Clicks a link | Your router |
| `hotkey` | `string \| string[] \| false` | `'mod+k'` | Toggles the bar |
| `actionsHotkey` | `string` | `'mod+.'` | Opens the action panel |
| `shortcuts` | `boolean` | `true` | Enables global command shortcuts |
| `placeholder` | `string` | `'Search for commands, pages and more…'` | Root input placeholder |
| `recents` | `boolean \| number` | `4` | How many recent items to show with an empty query |
| `autoIndex` | `boolean \| AutoIndexOptions` | `false` | Indexes page links and `[data-qikbar]` elements |
| `ai` | `AIProvider \| AIOptions` | — | See [AI](/docs/ai) |
| `tools` | `Tool[]` | `[]` | [AI tools](/docs/ai-tools) |
| `theme` | `ThemePresetName \| ThemeConfig` | — | See [Theming](/docs/theming) |
| `appearance` | `'auto' \| 'light' \| 'dark' \| () => …` | `'auto'` | Light or dark mode |
| `classNames` | `Partial<Record<Slot, string>>` | — | See [Styling](/docs/styling) |
| `unstyled` | `boolean` | `false` | Don't inject CSS |
| `nonce` | `string` | — | CSP nonce for the injected `<style>` |
| `inline` | `HTMLElement \| string` | — | Renders [inline](/docs/inline-mode) |
| `container` | `HTMLElement` | `document.body` | Where the modal mounts |
| `namespace` | `string` | `'qikbar'` | Storage namespace |
| `storage` | `StorageAdapter` | `localStorage` | `{ getItem, setItem, removeItem }` |
| `dir` | `'ltr' \| 'rtl'` | — | Text direction |
| `footer` | `string` | — | Footer text when idle |
| `branding` | `boolean` | `false` | Shows a small “qikbar” link in the footer |
| `onOpen` / `onClose` | `() => void` | — | Lifecycle callbacks |
| `onRun` | `(item, action) => void` | — | Called for every run, for example for analytics |

## Instance

| Member | Description |
| --- | --- |
| `open(options?)` | Open. Options: `{ query?, view? }`. |
| `close()` / `toggle()` | Close or toggle |
| `isOpen` | Whether the bar is open |
| `query` | Current search text |
| `setQuery(text)` | Set the search text |
| `push(view)` / `pop()` | Navigate views |
| `ask(prompt?)` | Open an AI chat, optionally sending a prompt |
| `register(commands)` | Add commands. Returns an unregister function. |
| `addSource(source)` | Add a source. Returns a remove function. |
| `use(extension, prefs?)` | Install an extension. Returns an uninstall function. |
| `configure(partial)` | Update any config option at runtime |
| `toast(options)` | Show a toast, or a HUD when closed |
| `commands()` | All root items currently registered |
| `ai` | The AI client (`ask`, `stream`), if configured |
| `on(event, handler)` | Subscribe to `open`, `close`, `change` or `run`. Returns an unsubscribe function. |
| `preload()` | Load the UI chunk now instead of waiting for idle time |
| `destroy()` | Remove listeners and DOM |

### Events

```ts
bar.on('open', () => analytics.track('command_bar_opened'))
bar.on('run', ({ item, action }) => analytics.track('command_run', { id: item.id, action: action.title }))
bar.on('change', ({ open, query, depth, loading }) => {})
```

## Exports

### `@qikbar/qikbar`

`createQikbar`, `list`, `grid`, `detail`, `form`, `chat`, `action`, `defineExtension`, `defineCommands`, `defineSource`, `defineTool`, `anthropic`, `openai`, `openaiCompatible`, `ollama`, `gemini`, `browserAI`, `proxy`, `byok`, `formatHotkey`, `parseHotkey`, `matchesHotkey`, `isMac`, `memoryStorage`, `version`, and all types.

### `@qikbar/qikbar/react`

`Qikbar`, `QikbarProvider`, `QikbarTrigger`, `useQikbar`, `useCommands`, `useSource`, `useExtension`.

### `@qikbar/qikbar/server`

`createHandler`, `toNodeHandler`, `anthropic`, `openai`, `openaiCompatible`, `ollama`, `gemini`.

### `@qikbar/qikbar/extensions`

`calculator`, `themeSwitcher`, `page`, `aiActions`, `shortcuts`, `shortcutLabel`, `evaluate`, `convert`, `formatNumber`.

### `@qikbar/qikbar/theme`

`presets`, `baseLight`, `baseDark`, `resolveThemeVars`, `themeToCss`, `cssVarName`, `css`.

### `@qikbar/qikbar/utils`

`rank`, `matchItem`, `fuzzyMatch`, `normalize`, `renderMarkdown`, `escapeHtml`, `icons`, `iconSvg`, `Frecency`, `SequenceMatcher`, `copyText`, `defaultNavigate`, and the storage and hotkey helpers. Use these to build your own UI on Qikbar's ranking.

## Types

All types are exported from `@qikbar/qikbar`: `QikbarConfig`, `QikbarInstance`, `Command`, `Item`, `Action`, `Accessory`, `Icon`, `View`, `ListView`, `GridView`, `DetailView`, `FormView`, `FormField`, `ChatView`, `Source`, `Extension`, `ExtensionCommand`, `Preference`, `Argument`, `Tool`, `Context`, `AIProvider`, `AIEvent`, `AIMessage`, `ThemeVars`, `ThemeConfig` and more.
