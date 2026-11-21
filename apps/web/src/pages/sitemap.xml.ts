import type { APIRoute } from 'astro'
import { allDocs, hrefOf } from '../lib/docs'

export const GET: APIRoute = async ({ site }) => {
  const base = (site?.href ?? 'https://qikbar.com/').replace(/\/$/, '')
  const docs = await allDocs()
  const paths = ['/', '/extensions', '/themes', '/playground', ...docs.map(hrefOf)]
  const urls = paths.map((p) => `  <url><loc>${base}${p}</loc></url>`).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
}
