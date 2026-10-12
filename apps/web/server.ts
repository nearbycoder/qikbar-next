/**
 * Minimal static server for the built site (used on Railway and in Docker).
 * Serves apps/web/dist with clean URLs, correct content types and caching.
 */
import { stat } from 'node:fs/promises'
import { join, normalize } from 'node:path'

const root = join(import.meta.dir, 'dist')
const port = Number(process.env.PORT ?? 3000)

const TYPES: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

async function find(pathname: string) {
  const safe = normalize(decodeURIComponent(pathname))
  for (const c of [safe, join(safe, 'index.html'), `${safe.replace(/\/$/, '')}.html`]) {
    const full = join(root, c)
    if (!full.startsWith(root)) return undefined
    const info = await stat(full).catch(() => undefined)
    if (info?.isFile()) return { file: Bun.file(full), path: c }
  }
  return undefined
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/healthz') return new Response('ok')
    // One canonical host: www.example.com → example.com
    const host = req.headers.get('host') ?? ''
    if (host.startsWith('www.')) return Response.redirect(`https://${host.slice(4)}${url.pathname}${url.search}`, 301)
    const hit = await find(url.pathname)
    if (!hit) {
      const notFound = Bun.file(join(root, '404.html'))
      return new Response(notFound, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } })
    }
    const ext = hit.path.match(/\.[a-z0-9]+$/i)?.[0] ?? ''
    const headers: Record<string, string> = {}
    if (TYPES[ext]) headers['content-type'] = TYPES[ext]
    headers['cache-control'] = hit.path.includes('/_astro/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
    headers['accept-ranges'] = 'bytes'
    // Byte ranges, so browsers can stream and seek video (Safari requires this)
    const range = req.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/)
    if (range && (range[1] || range[2])) {
      const size = hit.file.size
      let start = range[1] ? Number(range[1]) : size - Number(range[2])
      let end = range[1] && range[2] ? Number(range[2]) : size - 1
      start = Math.max(0, start)
      end = Math.min(end, size - 1)
      if (start > end) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
      headers['content-range'] = `bytes ${start}-${end}/${size}`
      headers['content-type'] ??= hit.file.type
      return new Response(hit.file.slice(start, end + 1), { status: 206, headers })
    }
    return new Response(hit.file, { headers })
  },
})

console.log(`qikbar site on http://localhost:${port}`)
