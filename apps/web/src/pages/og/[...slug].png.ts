import type { APIRoute, GetStaticPaths } from 'astro'
import { allDocs } from '../../lib/docs'
import { renderOg, type OgInput } from '../../lib/og'

export const getStaticPaths: GetStaticPaths = async () => {
  const pages: { slug: string; og: OgInput }[] = [
    { slug: 'index', og: { title: 'The command bar your app deserves.', variant: 'home' } },
    { slug: 'extensions', og: { title: 'Extend the bar with anything.', description: 'Weather, currency, npm, Wikipedia, bookmarks, GitHub and more. One file each.', kicker: 'Extensions', path: '/extensions' } },
    { slug: 'themes', og: { title: 'Theme builder', description: '14 presets and 30+ CSS variables. Design a theme visually and copy the config.', kicker: 'Themes', path: '/themes' } },
    { slug: 'playground', og: { title: 'Playground', description: 'Edit a Qikbar config and watch the command bar update live.', kicker: 'Playground', path: '/playground' } },
    { slug: '404', og: { title: 'Page not found', description: 'Press ⌘K to search for what you were looking for.'.replace('⌘K', 'Ctrl K'), path: '' } },
  ]
  for (const doc of await allDocs()) {
    const path = doc.id === 'index' ? '/docs' : `/docs/${doc.id}`
    pages.push({ slug: `docs/${doc.id}`, og: { title: doc.data.title, description: doc.data.description, kicker: `Docs · ${doc.data.group}`, path } })
  }
  return pages.map((p) => ({ params: { slug: p.slug }, props: { og: p.og } }))
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await renderOg(props.og as OgInput)), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
  })
