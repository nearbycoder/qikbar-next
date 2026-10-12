import type { Extension } from 'qikbar'
import colors from '../extensions/colors'
import emoji from '../extensions/emoji'
import generators from '../extensions/generators'
import github from '../extensions/github'
import hackerNews from '../extensions/hacker-news'
import worldClock from '../extensions/world-clock'

export interface CatalogEntry {
  extension: Extension
  /** Source shown on the extensions page. */
  file: string
  /** Query that shows it off. */
  try: string
  tags: string[]
}

export const catalog: CatalogEntry[] = [
  { extension: hackerNews, file: 'hacker-news.ts', try: 'top stories', tags: ['list', 'fetch', 'actions'] },
  { extension: github, file: 'github.ts', try: 'search repositories', tags: ['preferences', 'async list', 'errors'] },
  { extension: emoji, file: 'emoji.ts', try: 'emoji', tags: ['grid', 'keepOpen'] },
  { extension: colors, file: 'colors.ts', try: '#22d3ee', tags: ['source', 'position: top'] },
  { extension: worldClock, file: 'world-clock.ts', try: 'time in tokyo', tags: ['list', 'source'] },
  { extension: generators, file: 'generators.ts', try: 'generate', tags: ['run', 'arguments', 'toast'] },
]

export const INSTALLED_KEY = 'qikbar-site:installed'

export function installedNames(): string[] {
  try {
    return JSON.parse(localStorage.getItem(INSTALLED_KEY) ?? '[]')
  } catch {
    return []
  }
}
