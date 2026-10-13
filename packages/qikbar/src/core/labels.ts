/**
 * Every string Qikbar shows. Pass `labels` to `createQikbar()` to translate or
 * reword them; ready-made translations live in `@qikbar/qikbar/locales`.
 *
 * Placeholders in braces (`{query}`, `{ai}`, …) are filled in at render time.
 */
export interface Labels {
  // Search
  placeholder: string
  searchPlaceholder: string
  search: string
  commandBar: string
  results: string
  back: string
  noResults: string
  nothingMatches: string
  loadFailed: string
  startTyping: string
  useQueryWith: string

  // Sections
  recent: string
  pinned: string
  related: string
  commands: string
  navigation: string
  pages: string
  actions: string
  customize: string
  history: string
  extension: string

  // Row kinds
  kindCommand: string
  kindPage: string
  kindLink: string

  // Actions
  run: string
  runCommand: string
  runItem: string
  open: string
  openInNewTab: string
  openInBrowser: string
  copyToClipboard: string
  copyLink: string
  copyUrl: string
  copyContent: string
  configure: string
  clearHistory: string
  searchActions: string
  noMatchingActions: string

  // Pins & aliases
  pin: string
  unpin: string
  setAlias: string
  editAlias: string
  removeAlias: string
  alias: string
  aliasPlaceholder: string
  aliasDescription: string
  aliasSaved: string
  aliasRemoved: string
  aliasTaken: string

  // Multi-select
  select: string
  deselect: string
  selectAll: string
  clearSelection: string
  selected: string

  // Toasts & dialogs
  copied: string
  copyFailed: string
  somethingWentWrong: string
  undo: string
  cancel: string
  confirm: string
  allow: string
  allowTool: string

  // Forms & arguments
  submit: string
  save: string
  saveAndContinue: string
  preferencesSaved: string
  fieldRequired: string
  optional: string

  // Code blocks
  copy: string
  copiedShort: string
  failed: string

  // AI
  askAi: string
  askAiSubtitle: string
  askAnything: string
  askAnythingPlaceholder: string
  chatHint: string
  chatSuggestions: string
  followUp: string
  send: string
  stop: string
  copyAnswer: string
  copiedAnswer: string
  nothingToCopy: string
  newChat: string
  aiNotConfigured: string

  // Launcher
  openCommandBar: string
}

export const en: Labels = {
  placeholder: 'Search for commands, pages and more…',
  searchPlaceholder: 'Search…',
  search: 'Search',
  commandBar: 'Command bar',
  results: 'Results',
  back: 'Back',
  noResults: 'No results',
  nothingMatches: 'Nothing matches “{query}”',
  loadFailed: 'Couldn’t load results',
  startTyping: 'Start typing to search',
  useQueryWith: 'Use “{query}” with…',

  recent: 'Recent',
  pinned: 'Pinned',
  related: 'Related',
  commands: 'Commands',
  navigation: 'Navigation',
  pages: 'Pages',
  actions: 'Actions',
  customize: 'Customize',
  history: 'History',
  extension: 'Extension',

  kindCommand: 'Command',
  kindPage: 'Page',
  kindLink: 'Link',

  run: 'Run',
  runCommand: 'Run Command',
  runItem: 'Run {title}',
  open: 'Open',
  openInNewTab: 'Open in New Tab',
  openInBrowser: 'Open in Browser',
  copyToClipboard: 'Copy to Clipboard',
  copyLink: 'Copy Link',
  copyUrl: 'Copy URL',
  copyContent: 'Copy Content',
  configure: 'Configure {name}',
  clearHistory: 'Clear Recent History',
  searchActions: 'Search for actions…',
  noMatchingActions: 'No matching actions',

  pin: 'Pin to Top',
  unpin: 'Unpin',
  setAlias: 'Set Alias…',
  editAlias: 'Edit Alias…',
  removeAlias: 'Remove Alias',
  alias: 'Alias',
  aliasPlaceholder: 'e.g. bv2',
  aliasDescription: 'Type the alias to jump straight to “{title}”.',
  aliasSaved: 'Alias “{alias}” saved',
  aliasRemoved: 'Alias removed',
  aliasTaken: '“{alias}” is already used by {title}',

  select: 'Select',
  deselect: 'Deselect',
  selectAll: 'Select All',
  clearSelection: 'Clear Selection',
  selected: '{count} selected',

  copied: 'Copied to clipboard',
  copyFailed: 'Copy failed',
  somethingWentWrong: 'Something went wrong',
  undo: 'Undo',
  cancel: 'Cancel',
  confirm: 'Confirm',
  allow: 'Allow',
  allowTool: 'Allow {ai} to {tool}?',

  submit: 'Submit',
  save: 'Save',
  saveAndContinue: 'Save and Continue',
  preferencesSaved: 'Preferences saved',
  fieldRequired: '{field} is required',
  optional: '(optional)',

  copy: 'Copy',
  copiedShort: 'Copied',
  failed: 'Failed',

  askAi: 'Ask {ai}',
  askAiSubtitle: 'Chat, or tell it what to do',
  askAnything: 'Ask {ai} anything',
  askAnythingPlaceholder: 'Ask {ai} anything…',
  chatHint: 'Ask a question or tell it what to do, like “take me to billing”.',
  chatSuggestions: 'What can I do here?|Summarize this page',
  followUp: 'Ask a follow-up…',
  send: 'Send',
  stop: 'Stop',
  copyAnswer: 'Copy Answer',
  copiedAnswer: 'Copied answer',
  nothingToCopy: 'Nothing to copy',
  newChat: 'New Chat',
  aiNotConfigured: 'AI is not configured',

  openCommandBar: 'Open command bar',
}

/** Fill `{name}` placeholders. Unknown placeholders are left as-is. */
export function format(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

export type LabelKey = keyof Labels
