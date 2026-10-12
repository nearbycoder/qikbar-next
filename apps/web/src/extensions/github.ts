import { action, defineExtension, list, type Item } from 'qikbar'

interface Repo {
  full_name: string
  description: string | null
  html_url: string
  stargazers_count: number
  language: string | null
  owner: { avatar_url: string }
  pushed_at: string
}

export default defineExtension({
  name: 'github',
  title: 'GitHub',
  icon: 'github',
  description: 'Search public repositories. Add a token for higher rate limits.',
  preferences: [
    { name: 'token', title: 'Access token', type: 'password', description: 'Optional. Raises the rate limit from 10 to 30 searches a minute.' },
  ],
  commands: [
    {
      name: 'search-repos',
      title: 'Search Repositories',
      icon: 'github',
      keywords: ['git', 'code', 'repo'],
      view: (ctx) =>
        list({
          title: 'Repositories',
          placeholder: 'Search GitHub repositories…',
          debounce: 300,
          emptyView: { title: 'Search GitHub', description: 'Type a repository name or topic', icon: 'github' },
          items: async ({ query, signal }): Promise<Item[]> => {
            if (query.trim().length < 2) return []
            const res = await fetch(`https://api.github.com/search/repositories?per_page=20&q=${encodeURIComponent(query)}`, {
              signal,
              headers: ctx.preferences.token ? { authorization: `Bearer ${ctx.preferences.token}` } : {},
            })
            if (!res.ok) throw new Error(res.status === 403 ? 'Rate limited. Add a token in Configure GitHub.' : `GitHub error ${res.status}`)
            const { items } = (await res.json()) as { items: Repo[] }
            return items.map((r) => ({
              id: r.full_name,
              title: r.full_name,
              subtitle: r.description ?? undefined,
              icon: { url: r.owner.avatar_url },
              url: r.html_url,
              accessories: [...(r.language ? [{ tag: r.language }] : []), { text: `★ ${r.stargazers_count.toLocaleString()}` }],
              actions: [action.copy(`git clone ${r.html_url}.git`, { title: 'Copy Clone Command', shortcut: 'mod+shift+.' })],
            }))
          },
        }),
    },
  ],
})
