import type { APIRoute } from 'astro'
import { allDocs, hrefOf } from '../lib/docs'

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

export const GET: APIRoute = async () => {
  const docs = await allDocs()
  const entries: { title: string; href: string; group: string; page?: string; description?: string }[] = []
  for (const d of docs) {
    const href = hrefOf(d)
    entries.push({ title: d.data.title, href, group: d.data.group, description: d.data.description })
    for (const m of (d.body ?? '').matchAll(/^(##|###)\s+(.+)$/gm)) {
      const text = m[2]!.replace(/`/g, '').trim()
      entries.push({ title: text, href: `${href}#${slugify(text)}`, group: d.data.group, page: d.data.title })
    }
  }
  return new Response(JSON.stringify(entries), { headers: { 'content-type': 'application/json' } })
}
