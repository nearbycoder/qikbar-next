import { action, defineExtension, list, type Item } from '@qikbar/qikbar'

interface Result {
  package: {
    name: string
    version: string
    description?: string
    date: string
    links: { npm: string; homepage?: string; repository?: string }
    publisher?: { username: string }
    keywords?: string[]
  }
  downloads?: { weekly: number }
}

const compact = (n: number) => new Intl.NumberFormat(undefined, { notation: 'compact' }).format(n)

export default defineExtension({
  name: 'npm',
  title: 'npm',
  icon: 'package',
  description: 'Search the npm registry and copy install commands for npm, pnpm, yarn or bun.',
  preferences: [
    {
      name: 'pm',
      title: 'Package manager',
      type: 'select',
      default: 'npm',
      options: ['npm', 'pnpm', 'yarn', 'bun'].map((v) => ({ title: v, value: v })),
    },
  ],
  commands: [
    {
      name: 'search',
      title: 'Search npm Packages',
      icon: 'package',
      keywords: ['npm', 'node', 'package', 'library', 'install'],
      view: (ctx) =>
        list({
          title: 'npm',
          placeholder: 'Search packages…',
          detail: true,
          debounce: 200,
          emptyView: { title: 'Search npm', description: 'Find a package by name or keyword', icon: 'package' },
          items: async ({ query, signal }) => {
            if (!query.trim()) return []
            const data = await fetch(`https://registry.npmjs.org/-/v1/search?size=20&text=${encodeURIComponent(query)}`, { signal }).then((r) => r.json())
            const pm: string = ctx.preferences.pm ?? 'npm'
            const install = (name: string, tool = pm) => (tool === 'npm' ? `npm install ${name}` : tool === 'yarn' ? `yarn add ${name}` : `${tool} add ${name}`)
            return (data.objects as Result[]).map<Item>(({ package: p, downloads }) => ({
              id: p.name,
              title: p.name,
              subtitle: p.description,
              icon: 'package',
              url: p.links.npm,
              keywords: p.keywords,
              accessories: [
                ...(downloads?.weekly ? [{ text: `${compact(downloads.weekly)}/wk`, icon: 'download' }] : []),
                { tag: `v${p.version}` },
              ],
              detail: [
                `# ${p.name}`,
                p.description ?? '',
                '',
                '```bash',
                install(p.name),
                '```',
                '',
                `| | |`,
                `| --- | --- |`,
                `| Version | ${p.version} |`,
                `| Published | ${new Date(p.date).toLocaleDateString()} |`,
                downloads?.weekly ? `| Weekly downloads | ${downloads.weekly.toLocaleString()} |` : '',
                p.publisher ? `| Publisher | ${p.publisher.username} |` : '',
                p.links.repository ? `| Repository | [${p.links.repository.replace(/^https?:\/\//, '')}](${p.links.repository}) |` : '',
                p.links.homepage ? `| Homepage | [${p.links.homepage.replace(/^https?:\/\//, '')}](${p.links.homepage}) |` : '',
              ]
                .filter((l) => l !== '')
                .join('\n'),
              actions: [
                action.copy(install(p.name), { title: `Copy ${pm} Install`, shortcut: 'mod+c' }),
                ...['npm', 'pnpm', 'yarn', 'bun']
                  .filter((t) => t !== pm)
                  .map((t) => action.copy(install(p.name, t), { title: `Copy ${t} Install`, shortcut: undefined, section: 'Install' })),
                ...(p.links.repository ? [action.open(p.links.repository, { title: 'Open Repository', shortcut: 'mod+o' })] : []),
                action.open(`https://bundlephobia.com/package/${p.name}`, { title: 'Check Bundle Size', icon: 'bar-chart', shortcut: undefined }),
              ],
            }))
          },
        }),
    },
  ],
})
