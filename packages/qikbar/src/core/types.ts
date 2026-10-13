/**
 * Public types for Qikbar.
 *
 * Everything in Qikbar is plain data: commands, items, actions and views are
 * objects you can create in any framework (or none) and that an AI model can
 * reason about.
 */

import type { Labels } from './labels.js'

export type { Labels } from './labels.js'

export type Awaitable<T> = T | Promise<T>

/**
 * What `run`, actions and form submissions may return:
 * a `View` to push it, `false` to keep the bar open, anything else to close.
 */
export type RunResult = View | false | void | undefined | null | (object & {})

/**
 * An icon. Strings are interpreted as:
 * - a built-in icon name (`"search"`, `"settings"`, …, see `icons`)
 * - an image URL (`https://…`, `/…`, `./…`, `data:…`)
 * - inline SVG markup (`<svg …>`; treated as trusted HTML)
 * - anything else is rendered as text (emoji, a letter, …)
 *
 * Pass a DOM `Node` (or a function returning one) for full control.
 */
export type Icon = string | Node | (() => Node) | { url: string; alt?: string } | { color: string; icon?: string }

export type Color = 'default' | 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'pink' | (string & {})

export interface Accessory {
  text?: string
  icon?: Icon
  /** Rendered as a colored pill. */
  tag?: string | { value: string; color?: Color }
  /** Rendered as keyboard keys, e.g. `"mod+shift+p"`. */
  kbd?: string
  /** Rendered relative ("3h ago"). */
  date?: Date | number | string
  tooltip?: string
}

/** Context available to every `run`, action and dynamic view. */
export interface Context {
  /** The Qikbar instance. */
  readonly bar: QikbarInstance
  /** Current search text of the active view. */
  readonly query: string
  /** Aborted when the view is popped, the bar closes or the query changes. */
  readonly signal: AbortSignal
  /** Values from the extension's `preferences` (empty for app commands). */
  readonly preferences: Record<string, any>
  /** Values entered for the command's `arguments`. */
  readonly arguments: Record<string, string>
  /** Namespaced persistent storage (localStorage by default). */
  readonly storage: ScopedStorage
  /** The configured AI client, if any. */
  readonly ai: AIClient | undefined
  /** Push a view onto the navigation stack. */
  push(view: View): void
  /** Go back one view. */
  pop(): void
  /** Replace the current view (use to re-render a view with new data). */
  render(view: View): void
  /** Close the bar. */
  close(): void
  /** Navigate within your app using the configured router. */
  navigate(href: string, options?: { newTab?: boolean }): void
  /** Open an external URL in a new tab. */
  openUrl(url: string): void
  /** Copy text to the clipboard. Resolves to `true` on success. */
  copy(text: string): Promise<boolean>
  /** Show a toast. Shown in the footer while open, or as a floating HUD when closed. */
  toast(options: ToastOptions | string): ToastHandle
  /** Ask the user to confirm something. */
  confirm(options: ConfirmOptions | string): Promise<boolean>
  /** Set the search text. */
  setQuery(query: string): void
  /** Items the user marked in a `multiSelect` list (empty otherwise). */
  readonly selection: Item[]
  /** The bar's labels (after `labels` overrides), for translated messages. */
  readonly labels: Labels
}

export interface ToastOptions {
  title: string
  message?: string
  style?: 'success' | 'failure' | 'loading' | 'info'
  /** Milliseconds before the toast hides. `0` keeps it. Default 2600, or 6000 with an action (loading toasts persist). */
  duration?: number
  /** A button in the toast, e.g. "View" or "Retry". */
  action?: ToastAction
  /** Shorthand for an "Undo" action bound to ⌘Z / Ctrl+Z while the toast is visible. */
  undo?: () => Awaitable<void>
}

export interface ToastAction {
  title: string
  /** Shortcut that triggers the action while the toast is visible, e.g. `"mod+z"`. */
  shortcut?: string
  run(): Awaitable<void>
}

export interface ToastHandle {
  update(options: Partial<ToastOptions>): void
  hide(): void
}

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export interface Action {
  id?: string
  title: string
  icon?: Icon
  /** Shortcut that triggers the action while the bar is open, e.g. `"mod+c"`. */
  shortcut?: string
  /** Groups actions in the action panel. */
  section?: string
  style?: 'default' | 'destructive'
  /**
   * Called when the action runs. Return a `View` to push it.
   * By default the bar closes afterwards; return `false` (or set `keepOpen`) to keep it open.
   */
  run(ctx: Context): Awaitable<RunResult>
  keepOpen?: boolean
  /**
   * Run the action on several items at once. When the user has marked items in a
   * `multiSelect` list, only actions with `runMany` are offered.
   */
  runMany?(items: Item[], ctx: Context): Awaitable<RunResult>
  /** @internal Label used for the title of built-in actions, so `labels` can translate it. */
  labelKey?: keyof Labels
}

/** A row in a list or grid, or a command at the root. */
export interface Item {
  id?: string
  title: string
  subtitle?: string
  /** Longer description. Shown in detail panes and given to AI models. */
  description?: string
  icon?: Icon
  /** Extra search terms. */
  keywords?: string[]
  /** Section heading the item is grouped under. */
  section?: string
  accessories?: Accessory[]
  /** Image URL used by grid views. */
  image?: string
  /** Markdown shown in the side panel when the list has `detail: true`. */
  detail?: string | (() => Awaitable<string>)

  /** Shorthand primary action: navigate to an in-app route. */
  href?: string
  /** Shorthand primary action: open an external URL in a new tab. */
  url?: string
  /** Shorthand primary action: run code. Return a `View` to push it. */
  run?: (ctx: Context) => Awaitable<RunResult>
  /** Shorthand primary action: push a view. */
  view?: View | ((ctx: Context) => Awaitable<View>)
  /** Additional actions. The first action is the primary action (↵), the second is secondary (⌘↵). */
  actions?: Action[]

  /** Global keyboard shortcut that runs this item even when the bar is closed, e.g. `"mod+shift+d"` or `"g s"`. */
  shortcut?: string
  /** Hide the item unless this returns true (evaluated on open). */
  when?: () => boolean
  /** Only show this item when the user has typed something. */
  searchOnly?: boolean
  /** Ranking boost (0–1). */
  priority?: number
  /** Arguments asked for inline before running (like Raycast arguments). */
  arguments?: Argument[]
  /** Disable frecency tracking for this item. */
  noHistory?: boolean
}

/** Commands are items that live at the root of the bar. */
export type Command = Item

export interface Argument {
  name: string
  placeholder?: string
  type?: 'text' | 'password' | 'dropdown'
  required?: boolean
  options?: { title: string; value: string }[]
}

// ─── Views ──────────────────────────────────────────────────────────────────

export interface LoadArgs {
  query: string
  signal: AbortSignal
  ctx: Context
}

export type ItemsLoader = (args: LoadArgs) => Awaitable<Item[]> | AsyncIterable<Item[]>

interface BaseView {
  /** Shown in the breadcrumb. */
  title?: string
  /** Placeholder for the search input. */
  placeholder?: string
  /** Actions available for every item in this view. */
  actions?: Action[]
  /** Called when the view is removed. */
  onClose?: () => void
}

export interface EmptyView {
  title: string
  description?: string
  icon?: Icon
}

export interface ListView extends BaseView {
  type: 'list'
  /** Static items, or a loader called with the search text (debounced). */
  items: Item[] | ItemsLoader
  /**
   * Fuzzy-filter items locally. Defaults to `true` for static arrays and `false`
   * for loaders (the loader is expected to filter on `query`).
   */
  filter?: boolean
  /** Debounce for loaders, in ms. Default 120. */
  debounce?: number
  /** Show a markdown side panel for the selected item (`item.detail`). */
  detail?: boolean
  emptyView?: EmptyView
  /** Initial search text. */
  query?: string
  /**
   * Let the user mark several items (Shift/⌘-click, Shift+↑↓, or "Select" in the
   * action panel) and run an action with `runMany` on all of them.
   */
  multiSelect?: boolean
}

export interface GridView extends Omit<ListView, 'type' | 'detail'> {
  type: 'grid'
  columns?: number
  /** Aspect ratio of each cell, e.g. `"1"`, `"16/9"`. Default `"1"`. */
  aspectRatio?: string
  /** How images fill their cell. */
  fit?: 'cover' | 'contain'
}

export interface MetadataEntry {
  label: string
  value?: string
  icon?: Icon
  href?: string
  tag?: string | { value: string; color?: Color }
}

export interface DetailView extends BaseView {
  type: 'detail'
  /** Markdown. Pass an async iterable (e.g. an AI stream) to stream text in. */
  markdown: string | AsyncIterable<string> | (() => Awaitable<string | AsyncIterable<string>>)
  metadata?: MetadataEntry[]
}

export interface FormField {
  name: string
  label?: string
  type?: 'text' | 'textarea' | 'password' | 'number' | 'email' | 'url' | 'checkbox' | 'select' | 'date'
  placeholder?: string
  description?: string
  required?: boolean
  defaultValue?: string | number | boolean
  options?: { title: string; value: string }[]
  /** Return an error message to block submission. */
  validate?: (value: any, values: Record<string, any>) => string | undefined | void
}

export interface FormView extends BaseView {
  type: 'form'
  fields: FormField[]
  submitLabel?: string
  onSubmit(values: Record<string, any>, ctx: Context): Awaitable<RunResult>
}

export interface ChatView extends BaseView {
  type: 'chat'
  /** First user message, sent immediately. */
  prompt?: string
  /** Override the system prompt. */
  system?: string
  /** Let the model run app commands and tools. Default `true`. */
  tools?: boolean
}

export type View = ListView | GridView | DetailView | FormView | ChatView

// ─── Sources ────────────────────────────────────────────────────────────────

/** A dynamic provider of root search results (records from your API, docs, …). */
export interface Source {
  id: string
  /** Section heading for results. */
  title?: string
  search(args: LoadArgs): Awaitable<Item[]>
  /** Minimum query length before `search` runs. Default 1. */
  minQueryLength?: number
  /** Debounce in ms. Default 150. */
  debounce?: number
  /** Maximum results shown. Default 8. */
  limit?: number
  /** Re-rank returned items with the local fuzzy matcher. Default `false`. */
  filter?: boolean
  /** Show results above (`"top"`) or below (`"bottom"`, default) matching commands. */
  position?: 'top' | 'bottom'
}

// ─── Extensions ─────────────────────────────────────────────────────────────

export interface Preference {
  name: string
  title: string
  description?: string
  type: 'text' | 'password' | 'checkbox' | 'select' | 'number'
  required?: boolean
  default?: string | number | boolean
  placeholder?: string
  options?: { title: string; value: string }[]
}

export interface ExtensionCommand extends Omit<Item, 'id'> {
  /** Unique within the extension. */
  name: string
}

/** A function the AI model may call. */
export interface Tool<Args = any> {
  name: string
  description: string
  /** JSON schema for the arguments object. */
  parameters?: JSONSchema
  /** Ask the user before running. */
  confirm?: boolean | ((args: Args) => string)
  run(args: Args, ctx: Context): Awaitable<unknown>
}

export type JSONSchema = {
  type?: string | string[]
  properties?: Record<string, JSONSchema>
  required?: string[]
  items?: JSONSchema
  enum?: unknown[]
  description?: string
  [key: string]: unknown
}

export interface Extension {
  /** Unique id, e.g. `"github"`. */
  name: string
  title: string
  description?: string
  icon?: Icon
  author?: string
  version?: string
  /** Settings the extension needs. Missing required values are asked for on first run. */
  preferences?: Preference[]
  commands?: ExtensionCommand[]
  sources?: Source[]
  tools?: Tool[]
  /** Called once when the extension is installed. Return a cleanup function. */
  setup?(ctx: ExtensionSetupContext): void | (() => void)
}

export interface ExtensionSetupContext {
  bar: QikbarInstance
  preferences: Record<string, any>
  storage: ScopedStorage
}

// ─── AI ────────────────────────────────────────────────────────────────────

export interface AIToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  /** Set when the model produced arguments that could not be parsed. The call is not executed. */
  error?: string
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: AIToolCall[]
  /** For `role: 'tool'`. */
  toolCallId?: string
  toolName?: string
  isError?: boolean
  /** Provider-native payload, replayed verbatim on the next request (e.g. thinking blocks). */
  raw?: { provider: string; data: unknown }
}

export interface AIToolDefinition {
  name: string
  description: string
  parameters: JSONSchema
}

export interface AIRequest {
  messages: AIMessage[]
  system?: string
  tools?: AIToolDefinition[]
  signal?: AbortSignal
  maxTokens?: number
}

export type AIEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; call: AIToolCall }
  | { type: 'done'; message: AIMessage; stopReason?: string }
  | { type: 'error'; error: string }

/** Implement this to plug in any model. */
export interface AIProvider {
  readonly id: string
  readonly model?: string
  /** Whether the provider supports tool calling. Default true. */
  readonly tools?: boolean
  stream(request: AIRequest): AsyncIterable<AIEvent>
}

export interface AIClient {
  readonly provider: AIProvider
  /** Ask a one-shot question and get the full answer. */
  ask(prompt: string, options?: { system?: string; signal?: AbortSignal }): Promise<string>
  /** Ask a one-shot question and stream the answer. */
  stream(prompt: string, options?: { system?: string; signal?: AbortSignal }): AsyncIterable<string>
}

// ─── Storage ───────────────────────────────────────────────────────────────

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface ScopedStorage {
  get<T = unknown>(key: string): T | undefined
  set(key: string, value: unknown): void
  remove(key: string): void
}

// ─── Theme ─────────────────────────────────────────────────────────────────

export interface ThemeVars {
  font?: string
  fontMono?: string
  fontSize?: string
  bg?: string
  bgElevated?: string
  fg?: string
  fgMuted?: string
  fgSubtle?: string
  border?: string
  selection?: string
  selectionFg?: string
  hover?: string
  accent?: string
  accentFg?: string
  highlight?: string
  overlay?: string
  backdropBlur?: string
  shadow?: string
  radius?: string
  radiusItem?: string
  width?: string
  listHeight?: string
  rowHeight?: string
  sectionHeight?: string
  inputHeight?: string
  inputFontSize?: string
  top?: string
  kbdBg?: string
  kbdFg?: string
  danger?: string
  success?: string
  warning?: string
  /** Any other custom property, without the `--qb-` prefix. */
  [key: string]: string | undefined
}

export type ThemePresetName =
  | 'light'
  | 'dark'
  | 'raycast'
  | 'linear'
  | 'vercel'
  | 'github'
  | 'nord'
  | 'dracula'
  | 'catppuccin'
  | 'tokyo-night'
  | 'rose-pine'
  | 'solarized'
  | 'midnight'
  | 'paper'

export interface ThemeConfig {
  /** Preset to start from. */
  preset?: ThemePresetName
  /** Variable overrides for both appearances. */
  vars?: ThemeVars
  /** Overrides for light appearance. */
  light?: ThemeVars
  /** Overrides for dark appearance. */
  dark?: ThemeVars
}

export type Appearance = 'light' | 'dark' | 'auto' | (() => 'light' | 'dark')

export type ClassNameSlot =
  | 'root'
  | 'overlay'
  | 'dialog'
  | 'header'
  | 'input'
  | 'list'
  | 'section'
  | 'item'
  | 'footer'
  | 'actions'
  | 'detail'
  | 'form'
  | 'grid'
  | 'chat'
  | 'toast'

// ─── Config ────────────────────────────────────────────────────────────────

export interface Route {
  path: string
  title: string
  subtitle?: string
  icon?: Icon
  keywords?: string[]
  section?: string
  shortcut?: string
}

export type Navigate = (href: string, options: { newTab: boolean }) => void

export interface QikbarConfig {
  /** Commands shown at the root. */
  commands?: Command[]
  /** Routes in your app; each becomes a "go to" command. */
  routes?: Route[]
  /** Dynamic search providers. */
  sources?: Source[]
  /** Installed extensions. */
  extensions?: (Extension | [Extension, Record<string, any>])[]
  /** Items shown at the bottom when the query has no good matches. `{query}` is replaced in titles. */
  fallbacks?: Item[]

  /** Your router's navigate function. Defaults to clicking a matching link (works with most frameworks). */
  navigate?: Navigate

  /** Hotkey that toggles the bar. Default `"mod+k"`. Set `false` to disable. */
  hotkey?: string | string[] | false
  /** Hotkey that opens the action panel for the selected item. Default `"mod+."`. */
  actionsHotkey?: string
  /** Enable items' global `shortcut`s while the bar is closed. Default true. */
  shortcuts?: boolean
  placeholder?: string
  /** Show "Recent" items at the top when the query is empty. Default true. */
  recents?: boolean | number
  /** Index links in your page automatically (`nav a`, `[data-qikbar]`). */
  autoIndex?: boolean | AutoIndexOptions

  /** AI provider. Unlocks Ask AI, natural-language commands and `ctx.ai`. */
  ai?: AIProvider | AIOptions
  /** Functions the AI may call, in addition to running commands. */
  tools?: Tool[]

  theme?: ThemePresetName | ThemeConfig
  appearance?: Appearance
  /** Extra classes per UI slot (works great with Tailwind). */
  classNames?: Partial<Record<ClassNameSlot, string>>
  /** Don't inject default styles. */
  unstyled?: boolean
  /** CSP nonce for the injected `<style>` tag. */
  nonce?: string

  /** Render into this element instead of a modal (always open). */
  inline?: HTMLElement | string
  /** Where the modal is mounted. Default `document.body`. */
  container?: HTMLElement
  /** Namespace for persistent storage. Default `"qikbar"`. */
  namespace?: string
  storage?: StorageAdapter
  /** Text direction. */
  dir?: 'ltr' | 'rtl'
  /** Show the "Powered by qikbar" footer mark. Default false. */
  branding?: boolean
  /** Footer hint shown at the left when idle. */
  footer?: string

  /** Translate or reword the UI. See `@qikbar/qikbar/locales` for ready-made translations. */
  labels?: Partial<Labels>

  /** Let users pin commands to the top and give them aliases. Default true. */
  personalize?: boolean
  /** Search by meaning as well as by spelling, with embeddings you provide. */
  semantic?: SemanticOptions

  /** Touch-friendly layout: hides keyboard hints and enables long-press. Default `"auto"` (detects touch screens). */
  touch?: boolean | 'auto'
  /** A floating button that opens the bar, for touch devices and mouse users. */
  launcher?: boolean | 'touch' | LauncherOptions

  /** Expose your commands to AI agents in the browser through WebMCP (`document.modelContext`). */
  webmcp?: boolean | WebMCPOptions

  onOpen?: () => void
  onClose?: () => void
  /** Called whenever an item or action runs. Useful for analytics. */
  onRun?: (item: Item, action: Action) => void
  /** Usage events (open, search, run, no results, …) for analytics. */
  onEvent?: (event: QikbarEvent) => void
}

export interface SemanticOptions {
  /** Turn texts into embedding vectors. Use `openaiEmbeddings()`, `ollamaEmbeddings()` or your own. */
  embed(texts: string[], options: { signal: AbortSignal }): Promise<number[][]>
  /** Minimum cosine similarity for a result (0–1). Default 0.35. */
  threshold?: number
  /** Maximum "Related" results. Default 5. */
  limit?: number
  /** Minimum query length. Default 3. */
  minQueryLength?: number
  /** Debounce in ms. Default 250. */
  debounce?: number
  /** Also embed results from sources. Default false (only commands, routes and extension commands). */
  sources?: boolean
}

export interface LauncherOptions {
  /** Default `"bottom-right"`. */
  position?: 'bottom-right' | 'bottom-left'
  /** Accessible label. Default `labels.openCommandBar`. */
  label?: string
  /** Only show on touch devices. Default false. */
  touchOnly?: boolean
  /** Icon name or SVG. Default `"search"`. */
  icon?: string
  /** Distance from the edges in px. Default 20. */
  offset?: number
}

export interface WebMCPOptions {
  /** Prefix for tool names. Default `"qikbar"`. */
  prefix?: string
  /** Also expose `ai.tools` and extension tools. Default true. */
  tools?: boolean
  /** Let agents run commands (otherwise only search/list). Default true. */
  run?: boolean
}

/** A usage event, for analytics. Item details are limited to id, title and section. */
export type QikbarEvent =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'search'; query: string; results: number; view: string }
  | { type: 'no_results'; query: string; view: string }
  | { type: 'run'; item: EventItem; action: string; via: 'keyboard' | 'click' | 'shortcut' | 'panel' | 'ai' | 'agent'; count?: number }
  | { type: 'ask_ai'; prompt: string }
  | { type: 'pin' | 'unpin'; item: EventItem }
  | { type: 'alias'; item: EventItem; alias: string | null }
  | { type: 'undo'; title: string }
  | { type: 'error'; message: string }

export interface EventItem {
  id: string
  title: string
  section?: string
}

export interface AutoIndexOptions {
  /** CSS selector for links to index. Default `"nav a[href], header a[href], aside a[href], [data-qikbar-index] a[href]"`. */
  links?: string | false
  /** Index elements with a `data-qikbar` attribute as commands that click them. Default true. */
  elements?: boolean
  /** Section title for indexed links. Default `"Pages"`. */
  section?: string
}

export interface AIOptions {
  provider: AIProvider
  /** System prompt prepended to every conversation. */
  system?: string
  /** Show the "Ask AI" fallback when the query has text. Default true. */
  fallback?: boolean
  /** Let the AI run commands/navigate/tools from chat. Default true. */
  tools?: boolean
  /** Name shown in the UI. Default "AI". */
  name?: string
  /** Max tool-calling steps per message. Default 6. */
  maxSteps?: number
  /** Example prompts shown in an empty chat. */
  suggestions?: string[]
  /** Remote tools from MCP servers, e.g. `[mcp({ url: '/api/mcp' })]`. */
  mcp?: ToolProvider[]
  /** Let the AI read the current page's text when asked about it. Default true. */
  pageContext?: boolean
}

// ─── Instance ──────────────────────────────────────────────────────────────

export interface QikbarState {
  open: boolean
  query: string
  depth: number
  loading: boolean
}

export interface QikbarEvents {
  open: void
  close: void
  change: QikbarState
  run: { item: Item; action: Action }
  event: QikbarEvent
}

/** Something that supplies AI tools asynchronously, like an MCP server. */
export interface ToolProvider {
  readonly name: string
  /** Load (or reload) the tools. Called before each chat turn; cache inside. */
  tools(signal?: AbortSignal): Promise<Tool[]>
}

export interface QikbarInstance {
  open(options?: { query?: string; view?: View }): void
  close(): void
  toggle(): void
  readonly isOpen: boolean
  /** Register commands. Returns an unregister function. */
  register(commands: Command | Command[]): () => void
  /** Add a source. Returns a remove function. */
  addSource(source: Source): () => void
  /** Install an extension. Returns an uninstall function. */
  use(extension: Extension, preferences?: Record<string, any>): () => void
  /** Update configuration. */
  configure(config: Partial<QikbarConfig>): void
  push(view: View): void
  pop(): void
  setQuery(query: string): void
  readonly query: string
  toast(options: ToastOptions | string): ToastHandle
  /** Run an AI chat with an optional prompt. */
  ask(prompt?: string): void
  readonly ai: AIClient | undefined
  /** Every root command currently registered (after `when` filtering). */
  commands(): Item[]
  on<K extends keyof QikbarEvents>(event: K, handler: (payload: QikbarEvents[K]) => void): () => void
  /** Load the UI ahead of time (it otherwise loads when the browser is idle). */
  preload(): Promise<void>
  /** Pinned item ids, most recent first. */
  pins(): string[]
  /** Pin or unpin an item by id. */
  pin(id: string, pinned?: boolean): void
  /** Aliases, as `{ alias: itemId }`. */
  aliases(): Record<string, string>
  /** Set (or with `null`, remove) the alias for an item. */
  setAlias(id: string, alias: string | null): void
  destroy(): void
}
