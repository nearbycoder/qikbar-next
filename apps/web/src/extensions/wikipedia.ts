import { action, defineExtension, list, type Item } from '@qikbar/qikbar'

interface Hit {
  title: string
  snippet: string
  pageid: number
  wordcount: number
  timestamp: string
}

const strip = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'")

async function summary(title: string): Promise<string> {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
  if (!res.ok) return `# ${title}\n\nNo summary available.`
  const s = await res.json()
  const image = s.thumbnail?.source ? `![${title}](${s.thumbnail.source})\n\n` : ''
  return `${image}# ${s.title}\n\n${s.description ? `*${s.description}*\n\n` : ''}${s.extract ?? ''}`
}

export default defineExtension({
  name: 'wikipedia',
  title: 'Wikipedia',
  icon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
  description: 'Search Wikipedia with a live article summary next to the results.',
  preferences: [
    { name: 'lang', title: 'Language', type: 'text', default: 'en', placeholder: 'en, de, fr, ja…', description: 'Wikipedia language code for links.' },
  ],
  commands: [
    {
      name: 'search',
      title: 'Search Wikipedia',
      icon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
      keywords: ['wiki', 'encyclopedia', 'lookup'],
      view: (ctx) =>
        list({
          title: 'Wikipedia',
          placeholder: 'Search Wikipedia…',
          detail: true,
          debounce: 250,
          emptyView: { title: 'Search Wikipedia', description: 'Start typing to search 6 million articles', icon: 'book' },
          items: async ({ query, signal }) => {
            if (query.trim().length < 2) return []
            const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=20&srsearch=${encodeURIComponent(query)}`
            const data = await fetch(url, { signal }).then((r) => r.json())
            const lang = ctx.preferences.lang || 'en'
            return (data.query?.search as Hit[]).map<Item>((h) => {
              const href = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}`
              return {
                id: String(h.pageid),
                title: h.title,
                subtitle: strip(h.snippet),
                icon: 'book',
                url: href,
                detail: () => summary(h.title),
                accessories: [{ text: `${h.wordcount.toLocaleString()} words` }],
                actions: [
                  action.ask(`Explain the Wikipedia article “${h.title}” in simple terms, with the key facts.`, { title: 'Ask AI About This' }),
                ],
              }
            })
          },
        }),
    },
  ],
})
