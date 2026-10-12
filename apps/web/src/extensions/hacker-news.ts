import { action, defineExtension, list, type Item } from '@qikbar/qikbar'

interface Story {
  id: number
  title: string
  url?: string
  score: number
  by: string
  time: number
  descendants?: number
}

const API = 'https://hacker-news.firebaseio.com/v0'

async function stories(kind: 'top' | 'new' | 'best', signal: AbortSignal): Promise<Item[]> {
  const ids: number[] = await fetch(`${API}/${kind}stories.json`, { signal }).then((r) => r.json())
  const items: Story[] = await Promise.all(ids.slice(0, 30).map((id) => fetch(`${API}/item/${id}.json`, { signal }).then((r) => r.json())))
  return items.filter(Boolean).map((s) => {
    const comments = `https://news.ycombinator.com/item?id=${s.id}`
    return {
      id: String(s.id),
      title: s.title,
      subtitle: s.url ? new URL(s.url).hostname.replace(/^www\./, '') : 'news.ycombinator.com',
      icon: `https://icons.duckduckgo.com/ip3/${s.url ? new URL(s.url).hostname : 'news.ycombinator.com'}.ico`,
      url: s.url ?? comments,
      accessories: [{ text: `▲ ${s.score}` }, { text: `${s.descendants ?? 0}`, icon: 'message' }, { date: s.time * 1000 }],
      actions: [action.open(comments, { title: 'Open Comments', shortcut: 'mod+o' }), action.copy(s.url ?? comments, { title: 'Copy Link' })],
    }
  })
}

export default defineExtension({
  name: 'hacker-news',
  title: 'Hacker News',
  icon: 'https://news.ycombinator.com/favicon.ico',
  description: 'Browse top, new and best stories.',
  author: 'qikbar',
  commands: (['top', 'new', 'best'] as const).map((kind) => ({
    name: kind,
    title: `${kind[0]!.toUpperCase()}${kind.slice(1)} Stories`,
    subtitle: 'Hacker News',
    keywords: ['hn', 'news', 'ycombinator'],
    view: list({ title: `${kind[0]!.toUpperCase()}${kind.slice(1)} Stories`, filter: true, items: ({ signal }) => stories(kind, signal) }),
  })),
})
