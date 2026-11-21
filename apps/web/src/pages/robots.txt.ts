import type { APIRoute } from 'astro'

export const GET: APIRoute = ({ site }) => {
  const base = (site?.href ?? 'https://qikbar.com/').replace(/\/$/, '')
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
