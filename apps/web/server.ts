/**
 * High-performance static server for the built site (used on Railway and in Docker).
 * Pre-indexes apps/web/dist at startup for O(1) routing, serves cached Brotli/Gzip
 * compression, strong ETags (304 Not Modified), byte ranges for video streaming,
 * immutable asset caching and security headers.
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const root = join(import.meta.dir, 'dist')
const port = Number(process.env.PORT ?? 3000)

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  // Registry sources (Bun would otherwise guess video/mp2t).
  '.ts': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
}

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.xml', '.svg', '.md', '.txt', '.ts'])
const LONG_CACHE = /^\/(?:video|og)\/|^\/(?:favicon\.(?:ico|svg)|logo\.svg|apple-touch-icon\.png|icon-[^/]+\.png)$/
const BROTLI_OPTS = {
  params: {
    [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
    [constants.BROTLI_PARAM_QUALITY]: 6,
  },
}

interface Entry {
  full: string
  rel: string
  size: number
  etag: string
  contentType: string
  cacheControl: string
  cors: boolean
  compressible: boolean
  br?: Uint8Array | null
  gz?: Uint8Array | null
}

const routes = new Map<string, Entry>()

function indexDir(dir: string, prefix = '') {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, item.name)
    const rel = `${prefix}/${item.name}`
    if (item.isDirectory()) {
      indexDir(full, rel)
      continue
    }
    if (!item.isFile()) continue
    const info = statSync(full)
    const ext = item.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? ''
    const contentType = TYPES[ext] ?? Bun.file(full).type ?? 'application/octet-stream'
    const cacheControl = rel.startsWith('/_astro/')
      ? 'public, max-age=31536000, immutable'
      : LONG_CACHE.test(rel)
        ? 'public, max-age=86400, stale-while-revalidate=604800'
        : 'public, max-age=300, stale-while-revalidate=3600'
    const etag = `"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`
    const entry: Entry = {
      full,
      rel,
      size: info.size,
      etag,
      contentType,
      cacheControl,
      cors: rel.startsWith('/registry/'),
      compressible: COMPRESSIBLE.has(ext) && info.size >= 256,
    }
    routes.set(rel, entry)
    if (item.name === 'index.html') {
      const dirPath = prefix || '/'
      routes.set(dirPath, entry)
      if (prefix) routes.set(`${prefix}/`, entry)
    } else if (ext === '.html') {
      const clean = rel.slice(0, -5)
      if (!routes.has(clean)) routes.set(clean, entry)
    }
  }
}

indexDir(root)
const notFoundEntry = routes.get('/404.html')

function acceptsEncoding(header: string | null, enc: 'br' | 'gzip'): boolean {
  if (!header) return false
  const m = header.match(new RegExp(`(?:^|,\\s*)${enc}(?:\\s*;\\s*q=([0-9.]+))?`, 'i'))
  return !!m && (m[1] === undefined || Number(m[1]) > 0)
}

function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false
  if (header.trim() === '*') return true
  for (const part of header.split(',')) {
    const token = part.trim().replace(/^W\//, '')
    if (token === etag) return true
  }
  return false
}

async function getCompressed(entry: Entry, enc: 'br' | 'gzip'): Promise<Uint8Array | null> {
  const cached = enc === 'br' ? entry.br : entry.gz
  if (cached !== undefined) return cached
  const raw = Buffer.from(await Bun.file(entry.full).arrayBuffer())
  const compressed = enc === 'br' ? brotliCompressSync(raw, BROTLI_OPTS) : gzipSync(raw, { level: 6 })
  const out = compressed.byteLength < raw.byteLength ? new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength) : null
  if (enc === 'br') entry.br = out
  else entry.gz = out
  return out
}

function baseHeaders(entry: Entry, is404 = false): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': entry.contentType,
    'cache-control': is404 ? 'no-cache' : entry.cacheControl,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'SAMEORIGIN',
  }
  if (!is404) {
    headers.etag = entry.etag
    headers['accept-ranges'] = 'bytes'
  }
  if (entry.cors) headers['access-control-allow-origin'] = '*'
  if (entry.compressible) headers.vary = 'Accept-Encoding'
  return headers
}

async function serveEntry(req: Request, entry: Entry, status = 200): Promise<Response> {
  const is404 = status === 404
  const isHead = req.method === 'HEAD'
  const headers = baseHeaders(entry, is404)

  // Byte ranges, so browsers can stream and seek video (Safari requires this).
  const range = !is404 ? req.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/) : null
  if (range && (range[1] || range[2])) {
    const size = entry.size
    let start = range[1] ? Number(range[1]) : size - Number(range[2])
    let end = range[1] && range[2] ? Number(range[2]) : size - 1
    start = Math.max(0, start)
    end = Math.min(end, size - 1)
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
    headers['content-range'] = `bytes ${start}-${end}/${size}`
    headers['content-length'] = String(end - start + 1)
    return new Response(isHead ? null : Bun.file(entry.full).slice(start, end + 1), { status: 206, headers })
  }

  if (!is404 && etagMatches(req.headers.get('if-none-match'), entry.etag)) {
    return new Response(null, { status: 304, headers })
  }

  if (entry.compressible) {
    const ae = req.headers.get('accept-encoding')
    const enc = acceptsEncoding(ae, 'br') ? 'br' : acceptsEncoding(ae, 'gzip') ? 'gzip' : null
    if (enc) {
      const compressed = await getCompressed(entry, enc)
      if (compressed) {
        headers['content-encoding'] = enc
        headers['content-length'] = String(compressed.byteLength)
        return new Response(isHead ? null : compressed, { status, headers })
      }
    }
  }

  headers['content-length'] = String(entry.size)
  return new Response(isHead ? null : Bun.file(entry.full), { status, headers })
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/healthz') return new Response('ok', { headers: { 'cache-control': 'no-store' } })
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } })
    }
    // One canonical host: www.example.com → example.com
    const host = req.headers.get('host') ?? ''
    if (host.startsWith('www.')) return Response.redirect(`https://${host.slice(4)}${url.pathname}${url.search}`, 301)

    let pathname: string
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return new Response('Bad Request', { status: 400 })
    }

    const hit = routes.get(pathname) ?? (pathname.length > 1 && pathname.endsWith('/') ? routes.get(pathname.slice(0, -1)) : undefined)
    if (!hit) {
      if (notFoundEntry) return serveEntry(req, notFoundEntry, 404)
      return new Response('Not Found', { status: 404 })
    }
    return serveEntry(req, hit, 200)
  },
})

console.log(`qikbar site on http://localhost:${port} (${routes.size} routes indexed)`)
