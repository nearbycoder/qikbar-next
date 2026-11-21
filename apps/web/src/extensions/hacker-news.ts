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

function safeHttpUrl(raw: string | undefined): URL | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null
  } catch {
    return null
  }
}

async function stories(kind: 'top' | 'new' | 'best', signal: AbortSignal): Promise<Item[]> {
  const idsRes = await fetch(`${API}/${kind}stories.json`, { signal })
  if (!idsRes.ok) throw new Error(`Hacker News error ${idsRes.status}`)
  const ids: number[] = await idsRes.json()
  const settled = await Promise.allSettled(
    ids.slice(0, 30).map((id) =>
      fetch(`${API}/item/${id}.json`, { signal }).then((r) => (r.ok ? (r.json() as Promise<Story | null>) : null)),
    ),
  )
  const items = settled
    .filter((r): r is PromiseFulfilledResult<Story | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((s): s is Story => !!s && typeof s.title === 'string')
  return items.map((s) => {
    const comments = `https://news.ycombinator.com/item?id=${s.id}`
    const parsed = safeHttpUrl(s.url)
    const link = parsed?.href ?? comments
    const host = parsed?.hostname ?? 'news.ycombinator.com'
    return {
      id: String(s.id),
      title: s.title,
      subtitle: host.replace(/^www\./, ''),
      icon: `https://icons.duckduckgo.com/ip3/${host}.ico`,
      url: link,
      accessories: [{ text: `▲ ${s.score}` }, { text: `${s.descendants ?? 0}`, icon: 'message' }, { date: s.time * 1000 }],
      actions: [action.open(comments, { title: 'Open Comments', shortcut: 'mod+o' }), action.copy(link, { title: 'Copy Link' })],
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
