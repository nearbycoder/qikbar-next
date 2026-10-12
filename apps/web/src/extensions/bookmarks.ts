import { defineExtension, form, list, type Context, type Item, type ListView, type ScopedStorage } from '@qikbar/qikbar'

interface Bookmark {
  id: string
  title: string
  url: string
  tags: string[]
  created: number
}

const load = (storage: ScopedStorage) => storage.get<Bookmark[]>('bookmarks') ?? []
const save = (storage: ScopedStorage, bookmarks: Bookmark[]) => storage.set('bookmarks', bookmarks)
const favicon = (url: string) => {
  try {
    return `https://icons.duckduckgo.com/ip3/${new URL(url).hostname}.ico`
  } catch {
    return 'bookmark'
  }
}

function toItem(b: Bookmark, ctx: Context, refresh?: () => void): Item {
  return {
    id: `bookmark:${b.id}`,
    title: b.title,
    subtitle: b.url.replace(/^https?:\/\/(www\.)?/, ''),
    icon: favicon(b.url),
    url: b.url,
    keywords: b.tags,
    section: 'Bookmarks',
    accessories: [...b.tags.map((t) => ({ tag: t })), { date: b.created }],
    actions: [
      {
        title: 'Delete Bookmark',
        icon: 'trash',
        style: 'destructive',
        shortcut: 'mod+backspace',
        async run(c) {
          if (!(await c.confirm({ title: `Delete “${b.title}”?`, destructive: true, confirmLabel: 'Delete' }))) return false
          save(ctx.storage, load(ctx.storage).filter((x) => x.id !== b.id))
          c.toast({ title: 'Bookmark deleted', style: 'success' })
          refresh?.()
          return false
        },
      },
    ],
  }
}

function addForm(ctx: Context, initial: Partial<Bookmark> = {}) {
  return form({
    title: 'Add Bookmark',
    submitLabel: 'Save Bookmark',
    fields: [
      { name: 'url', label: 'URL', type: 'url', required: true, placeholder: 'https://…', defaultValue: initial.url ?? '' },
      { name: 'title', label: 'Title', placeholder: 'Defaults to the domain', defaultValue: initial.title ?? '' },
      { name: 'tags', label: 'Tags', placeholder: 'design, reading', description: 'Comma separated. Tags are searchable.' },
    ],
    onSubmit(values, c) {
      let url = String(values.url).trim()
      if (!/^[a-z]+:\/\//i.test(url)) url = `https://${url}`
      const bookmark: Bookmark = {
        id: crypto.randomUUID(),
        url,
        title: String(values.title).trim() || new URL(url).hostname.replace(/^www\./, ''),
        tags: String(values.tags ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        created: Date.now(),
      }
      save(ctx.storage, [bookmark, ...load(ctx.storage)])
      c.toast({ title: 'Bookmark saved', message: bookmark.title, style: 'success' })
    },
  })
}

function browse(ctx: Context): ListView {
  const refresh = () => ctx.render(browse(ctx))
  return list({
    title: 'Bookmarks',
    placeholder: 'Search bookmarks…',
    items: load(ctx.storage).map((b) => ({ ...toItem(b, ctx, refresh), section: undefined })),
    emptyView: { title: 'No bookmarks yet', description: 'Press ↵ to add your first one', icon: 'bookmark' },
    actions: [{ title: 'Add Bookmark', icon: 'plus', shortcut: 'alt+n', run: () => addForm(ctx) }],
  })
}

export default defineExtension({
  name: 'bookmarks',
  title: 'Bookmarks',
  icon: 'bookmark',
  description: 'Save links with tags. They live in your browser and show up in root search.',
  commands: [
    { name: 'browse', title: 'Browse Bookmarks', icon: 'bookmark', keywords: ['links', 'saved', 'favorites'], view: (ctx) => browse(ctx) },
    {
      name: 'add',
      title: 'Add Bookmark',
      icon: 'plus',
      keywords: ['save', 'link', 'url'],
      view: (ctx) => addForm(ctx, { url: location.href, title: document.title }),
    },
  ],
  sources: [
    {
      id: 'bookmarks',
      title: 'Bookmarks',
      debounce: 0,
      filter: true,
      limit: 5,
      search: ({ ctx }) => load(ctx.storage).map((b) => toItem(b, ctx)),
    },
  ],
})
