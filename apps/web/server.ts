/**
 * High-performance static server for the built site (used on Railway and in Docker).
 * Pre-indexes apps/web/dist at startup for O(1) routing, pre-warms Brotli/Gzip
 * compression asynchronously with inflight deduplication, serves per-encoding strong
 * ETags (304 Not Modified), byte ranges for video streaming, immutable asset caching,
 * strict CSP and hardened security headers.
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompress, constants } from 'node:zlib'

const root = join(import.meta.dir, 'dist')
const port = Number(process.env.PORT ?? 3000)

let canonicalHost: string | null = null
if (process.env.SITE_URL) {
  try {
    canonicalHost = new URL(process.env.SITE_URL).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    canonicalHost = null
  }
}

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
const ACCEPT_BR = /(?:^|,\s*)br(?:\s*;\s*q=([0-9.]+))?/i
const ACCEPT_GZIP = /(?:^|,\s*)gzip(?:\s*;\s*q=([0-9.]+))?/i
const WWW_HOST_RE = /^www\.([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)(?::\d{1,5})?$/i

const CSP_MAIN =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; media-src 'self'; font-src 'self' data:; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; frame-src 'self'; frame-ancestors 'self'; form-action 'self'; object-src 'none'; base-uri 'self'"
const CSP_PLAYGROUND_FRAME =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; frame-ancestors 'self'; form-action 'self'; object-src 'none'; base-uri 'self'"

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
  isHtml: boolean
  isSandboxFrame: boolean
  etag: string
  etagBr: string
  etagGz: string
  contentType: string
  cacheControl: string
  cors: boolean
  compressible: boolean
  br?: Uint8Array | null
  gz?: Uint8Array | null
  brPending?: Promise<Uint8Array | null>
  gzPending?: Promise<Uint8Array | null>
}

const routes = new Map<string, Entry>()
const uniqueEntries: Entry[] = []

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
    const tagBase = `${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}`
    const entry: Entry = {
      full,
      rel,
      size: info.size,
      isHtml: ext === '.html',
      isSandboxFrame: rel === '/playground-frame/index.html' || rel === '/playground-frame.html',
      etag: `"${tagBase}"`,
      etagBr: `"${tagBase}-br"`,
      etagGz: `"${tagBase}-gz"`,
      contentType,
      cacheControl,
      // Allow CORS for the extension registry and static Astro assets (needed by sandboxed opaque-origin playground frame).
      cors: rel.startsWith('/registry/') || rel.startsWith('/_astro/'),
      compressible: COMPRESSIBLE.has(ext) && info.size >= 256,
    }
    uniqueEntries.push(entry)
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

function acceptsEncoding(header: string | null, re: RegExp): boolean {
  if (!header) return false
  const m = header.match(re)
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

function brotliAsync(raw: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    brotliCompress(raw, BROTLI_OPTS, (err, out) => {
      if (err) reject(err)
      else resolve(new Uint8Array(out.buffer, out.byteOffset, out.byteLength))
    })
  })
}

async function getCompressed(entry: Entry, enc: 'br' | 'gzip'): Promise<Uint8Array | null> {
  if (enc === 'br') {
    if (entry.br !== undefined) return entry.br
    entry.brPending ??= (async () => {
      const raw = await Bun.file(entry.full).bytes()
      const compressed = await brotliAsync(raw)
      const out = compressed.byteLength < raw.byteLength ? compressed : null
      entry.br = out
      entry.brPending = undefined
      return out
    })()
    return entry.brPending
  }
  if (entry.gz !== undefined) return entry.gz
  entry.gzPending ??= (async () => {
    const raw = await Bun.file(entry.full).bytes()
    const compressed = Bun.gzipSync(raw, { level: 6 })
    const out = compressed.byteLength < raw.byteLength ? compressed : null
    entry.gz = out
    entry.gzPending = undefined
    return out
  })()
  return entry.gzPending
}

function securityHeaders(req: Request, entry?: Entry): Record<string, string> {
  const headers: Record<string, string> = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'SAMEORIGIN',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  }
  if (!entry?.isSandboxFrame) headers['cross-origin-opener-policy'] = 'same-origin'
  if (req.headers.get('x-forwarded-proto') === 'https') {
    headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains'
  }
  if (entry?.isHtml) {
    headers['content-security-policy'] = entry.isSandboxFrame ? CSP_PLAYGROUND_FRAME : CSP_MAIN
  }
  return headers
}

function baseHeaders(req: Request, entry: Entry, is404 = false): Record<string, string> {
  const headers: Record<string, string> = {
    ...securityHeaders(req, entry),
    'content-type': entry.contentType,
    'cache-control': is404 ? 'no-cache' : entry.cacheControl,
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
  const headers = baseHeaders(req, entry, is404)

  // Byte ranges, so browsers can stream and seek video (Safari requires this).
  const range = !is404 ? req.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/) : null
  if (range && (range[1] || range[2])) {
    const size = entry.size
    let start = range[1] ? Number(range[1]) : size - Number(range[2])
    let end = range[1] && range[2] ? Number(range[2]) : size - 1
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      return new Response(null, { status: 416, headers: { ...securityHeaders(req), 'content-range': `bytes */${size}` } })
    }
    start = Math.max(0, start)
    end = Math.min(end, size - 1)
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...securityHeaders(req), 'content-range': `bytes */${size}` } })
    }
    headers['content-range'] = `bytes ${start}-${end}/${size}`
    headers['content-length'] = String(end - start + 1)
    return new Response(isHead ? null : Bun.file(entry.full).slice(start, end + 1), { status: 206, headers })
  }

  const inm = !is404 ? req.headers.get('if-none-match') : null
  if (entry.compressible) {
    const ae = req.headers.get('accept-encoding')
    const enc = acceptsEncoding(ae, ACCEPT_BR) ? 'br' : acceptsEncoding(ae, ACCEPT_GZIP) ? 'gzip' : null
    if (enc) {
      const compressed = await getCompressed(entry, enc)
      if (compressed) {
        const encTag = enc === 'br' ? entry.etagBr : entry.etagGz
        if (!is404) headers.etag = encTag
        if (inm && etagMatches(inm, encTag)) return new Response(null, { status: 304, headers })
        headers['content-encoding'] = enc
        headers['content-length'] = String(compressed.byteLength)
        return new Response(isHead ? null : compressed, { status, headers })
      }
    }
  }

  if (inm && etagMatches(inm, entry.etag)) {
    return new Response(null, { status: 304, headers })
  }

  headers['content-length'] = String(entry.size)
  return new Response(isHead ? null : Bun.file(entry.full), { status, headers })
}

Bun.serve({
  port,
  async fetch(req) {
    let url: URL
    try {
      url = new URL(req.url)
    } catch {
      return new Response('Bad Request', { status: 400, headers: securityHeaders(req) })
    }
    if (url.pathname === '/healthz') {
      return new Response('ok', { headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { ...securityHeaders(req), allow: 'GET, HEAD' } })
    }

    // One canonical host: www.example.com → example.com (strictly validated against Host header injection).
    const host = (req.headers.get('host') ?? '').trim().toLowerCase()
    const wwwMatch = host.match(WWW_HOST_RE)
    if (wwwMatch) {
      const bareHost = wwwMatch[1]!
      if (!canonicalHost || bareHost === canonicalHost) {
        const dest = new URL(`https://${bareHost}/`)
        dest.pathname = url.pathname
        dest.search = url.search
        return new Response(null, { status: 301, headers: { ...securityHeaders(req), location: dest.href } })
      }
    }

    let pathname: string
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return new Response('Bad Request', { status: 400, headers: securityHeaders(req) })
    }

    const hit = routes.get(pathname) ?? (pathname.length > 1 && pathname.endsWith('/') ? routes.get(pathname.slice(0, -1)) : undefined)
    if (!hit) {
      if (notFoundEntry) return serveEntry(req, notFoundEntry, 404)
      return new Response('Not Found', { status: 404, headers: securityHeaders(req) })
    }
    return serveEntry(req, hit, 200)
  },
})

// Pre-warm Brotli compression asynchronously in the background so first requests serve straight from RAM.
queueMicrotask(async () => {
  for (const entry of uniqueEntries) {
    if (entry.compressible) await getCompressed(entry, 'br').catch(() => {})
  }
})

console.log(`qikbar site on http://localhost:${port} (${routes.size} routes indexed)`)
