import type { Extension } from '@qikbar/qikbar'
import bookmarks from '../extensions/bookmarks'
import colors from '../extensions/colors'
import currency from '../extensions/currency'
import emoji from '../extensions/emoji'
import generators from '../extensions/generators'
import github from '../extensions/github'
import hackerNews from '../extensions/hacker-news'
import npm from '../extensions/npm'
import weather from '../extensions/weather'
import wikipedia from '../extensions/wikipedia'
import worldClock from '../extensions/world-clock'

export const CATEGORIES = ['Developer', 'Productivity', 'Reference', 'Utilities'] as const
export type Category = (typeof CATEGORIES)[number]

export interface CatalogEntry {
  extension: Extension
  /** Source shown on the extensions page. */
  file: string
  /** Query that shows it off. */
  try: string
  category: Category
  /** API features the example demonstrates. */
  tags: string[]
  /** Short description of what the extension uses from the outside world. */
  uses?: string
}

export const catalog: CatalogEntry[] = [
  { extension: weather, file: 'weather.ts', try: 'weather in tokyo', category: 'Utilities', tags: ['source', 'detail', 'metadata', 'arguments', 'preferences'], uses: 'Open-Meteo API' },
  { extension: currency, file: 'currency.ts', try: '100 usd to eur', category: 'Utilities', tags: ['source', 'position: top', 'arguments', 'async list'], uses: 'Frankfurter API' },
  { extension: npm, file: 'npm.ts', try: 'search npm packages', category: 'Developer', tags: ['async list', 'detail panel', 'preferences', 'action sections'], uses: 'npm registry' },
  { extension: wikipedia, file: 'wikipedia.ts', try: 'search wikipedia', category: 'Reference', tags: ['async list', 'lazy detail', 'action.ask'], uses: 'Wikipedia API' },
  { extension: bookmarks, file: 'bookmarks.ts', try: 'bookmarks', category: 'Productivity', tags: ['storage', 'form', 'ctx.render', 'confirm', 'source'] },
  { extension: github, file: 'github.ts', try: 'search repositories', category: 'Developer', tags: ['preferences', 'async list', 'errors'], uses: 'GitHub API' },
  { extension: hackerNews, file: 'hacker-news.ts', try: 'top stories', category: 'Reference', tags: ['list', 'fetch', 'actions'], uses: 'Hacker News API' },
  { extension: colors, file: 'colors.ts', try: '#22d3ee', category: 'Developer', tags: ['source', 'position: top', 'arguments', 'SVG icons'] },
  { extension: generators, file: 'generators.ts', try: 'generate', category: 'Developer', tags: ['run', 'arguments', 'toast'] },
  { extension: emoji, file: 'emoji.ts', try: 'emoji', category: 'Utilities', tags: ['grid', 'keepOpen'] },
  { extension: worldClock, file: 'world-clock.ts', try: 'time in tokyo', category: 'Utilities', tags: ['list', 'source', 'Intl'] },
]

export const INSTALLED_KEY = 'qikbar-site:installed'

export function installedNames(): string[] {
  try {
    return JSON.parse(localStorage.getItem(INSTALLED_KEY) ?? '[]')
  } catch {
    return []
  }
}
