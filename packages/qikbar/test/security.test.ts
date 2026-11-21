import { afterEach, describe, expect, it, vi } from 'vitest'
import { byok } from '../src/ai/byok'
import { Frecency } from '../src/core/frecency'
import { formatHotkey, parseHotkey } from '../src/core/hotkeys'
import { mountLauncher } from '../src/core/launcher'
import { memoryStorage, scopedStorage } from '../src/core/storage'
import { evaluate } from '../src/extensions/math'
import { createEmbeddingsHandler, createHandler, toNodeHandler } from '../src/server/index'
import { isSafeUrl, renderIcon } from '../src/ui/dom'
import { defaultNavigate } from '../src/ui/nav'
import { detail, grid } from '../src/core/define'
import { setup, settle, tick } from './helpers'

let current: ReturnType<typeof setup> | undefined
afterEach(() => {
  current?.bar.destroy()
  current = undefined
  document.body.innerHTML = ''
  document.getElementById('qikbar-launcher-styles')?.remove()
})

describe('SVG & URL sanitization', () => {
  it('strips scripts, event handlers, foreignObject and javascript: hrefs from inline SVGs', () => {
    const dirty =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><a href="javascript:alert(4)"><rect width="10" height="10" onclick="alert(5)" fill="#22d3ee"/></a><foreignObject><div>hi</div></foreignObject><script>alert(2)</script></svg>'
    const icon = renderIcon(dirty)!
    const html = icon.innerHTML
    expect(html).toContain('<rect')
    expect(html).toContain('#22d3ee')
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/<foreignobject/i)
    expect(html).not.toMatch(/\bonload\b/i)
    expect(html).not.toMatch(/\bonclick\b/i)
    expect(html).not.toMatch(/javascript:/i)

    const remove = mountLauncher({ icon: dirty }, 'Open', () => {})
    const btn = document.querySelector('.qb-launcher')!
    expect(btn.innerHTML).toContain('<rect')
    expect(btn.innerHTML).not.toMatch(/<script|onload|onclick|javascript:|foreignobject/i)
    remove()
  })

  it('blocks unsafe URL schemes including control-char obfuscation', () => {
    expect(isSafeUrl('https://qikbar.com')).toBe(true)
    expect(isSafeUrl('/docs/api')).toBe(true)
    expect(isSafeUrl('mailto:hi@qikbar.com')).toBe(true)
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('java\tscript:alert(1)')).toBe(false)
    expect(isSafeUrl('java\nscript:alert(1)')).toBe(false)
    expect(isSafeUrl('\u0000javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false)
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeUrl('data:image/png;base64,AAAA', false)).toBe(false)
    expect(isSafeUrl('data:image/png;base64,AAAA', true)).toBe(true)
  })

  it('refuses unsafe URLs in defaultNavigate, detail metadata, grid images and openUrl', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    try {
      defaultNavigate('javascript:alert(1)', true)
      expect(openSpy).not.toHaveBeenCalled()

      current = setup({
        commands: [
          { title: 'Bad link', url: 'javascript:alert(1)' },
          { title: 'Meta', view: detail({ title: 'D', markdown: 'hi', metadata: [{ label: 'Site', value: 'bad', href: 'javascript:alert(1)' }] }) },
          { title: 'Pics', view: grid({ title: 'G', items: [{ title: 'X', image: 'javascript:alert(1)' }] }) },
        ],
      })
      current.bar.open()
      await settle()
      await current.press('Enter')
      await tick()
      expect(openSpy).not.toHaveBeenCalled()

      current.bar.open({ view: detail({ title: 'D', markdown: 'hi', metadata: [{ label: 'Site', value: 'bad', href: 'javascript:alert(1)' }] }) })
      await settle()
      expect(current.$('.qb-meta a')).toBeNull()
      expect(current.$('.qb-meta-value')?.textContent).toContain('bad')

      current.bar.push(grid({ title: 'G', items: [{ title: 'X', image: 'javascript:alert(1)' }] }))
      await settle()
      expect(current.$('.qb-cell-media img')).toBeNull()
    } finally {
      openSpy.mockRestore()
    }
  })
})

describe('prototype pollution & parser DoS protection', () => {
  it('handles Object.prototype key names in Frecency, aliases and hotkeys', async () => {
    const f = new Frecency(scopedStorage(memoryStorage(), 'test'))
    expect(f.score('constructor')).toBe(0)
    expect(f.score('toString')).toBe(0)
    f.record('constructor')
    expect(f.score('constructor')).toBeGreaterThan(0)

    expect(parseHotkey('mod+constructor')[0]!.key).toBe('constructor')
    expect(formatHotkey('mod+toString')[0]!.at(-1)).toBe('Tostring')

    current = setup({ commands: [{ id: 'a', title: 'Alpha' }] })
    current.bar.open()
    await current.type('constructor')
    expect(current.titles()).toEqual([])
    current.bar.setAlias('a', 'constructor')
    expect(current.bar.aliases().constructor).toBe('a')
  })

  it('rejects prototype identifiers, deeply nested input and oversized math expressions', () => {
    expect(() => evaluate('constructor')).toThrow()
    expect(() => evaluate('toString')).toThrow()
    expect(() => evaluate('('.repeat(200) + '1' + ')'.repeat(200))).toThrow(/deeply nested/i)
    expect(() => evaluate('1+'.repeat(400) + '1')).toThrow(/too long/i)
  })
})

describe('server handlers & BYOK hardening', () => {
  it('rejects oversized bodies before JSON.parse, invalid fields and adds nosniff', async () => {
    const handler = createHandler({
      provider: { id: 'mock', async *stream() {} },
      maxChars: 100,
    })
    const big = new Request('https://x/api', {
      method: 'POST',
      body: 'x'.repeat(6000),
    })
    const bigRes = await handler(big)
    expect(bigRes.status).toBe(413)
    expect(bigRes.headers.get('x-content-type-options')).toBe('nosniff')

    expect((await handler(new Request('https://x', { method: 'POST', body: 'null' }))).status).toBe(400)
    expect((await handler(new Request('https://x', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], system: 123 }) }))).status).toBe(400)
    expect((await handler(new Request('https://x', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], maxTokens: -5 }) }))).status).toBe(400)
    expect((await handler(new Request('https://x', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], tools: 'bad' }) }))).status).toBe(400)

    const emb = createEmbeddingsHandler({ embed: async () => [], maxChars: 50 })
    const embBig = await emb(new Request('https://x', { method: 'POST', body: 'x'.repeat(6000) }))
    expect(embBig.status).toBe(413)
    expect(embBig.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('aborts upstream AI provider when response stream is cancelled', async () => {
    let aborted = false
    const handler = createHandler({
      provider: {
        id: 'slow',
        async *stream(req) {
          req.signal?.addEventListener('abort', () => (aborted = true))
          yield { type: 'text', text: 'first' }
          await new Promise((r) => setTimeout(r, 200))
        },
      },
    })
    const res = await handler(new Request('https://x', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }) }))
    const reader = res.body!.getReader()
    await reader.read()
    await reader.cancel()
    expect(aborted).toBe(true)
  })

  it('caps request body size and sanitizes Host in toNodeHandler', async () => {
    const inner = createHandler({ provider: { id: 'mock', async *stream() {} } })
    const node = toNodeHandler(inner, { maxBodyBytes: 32 })
    let status = 0
    const res = {
      on: () => {},
      writeHead: (s: number) => (status = s),
      write: () => {},
      end: () => {},
    }
    const bigReq = {
      method: 'POST',
      url: '/api/ai',
      headers: { host: 'evil host\r\n' },
      async *[Symbol.asyncIterator]() {
        yield 'x'.repeat(64)
      },
    }
    await node(bigReq, res)
    expect(status).toBe(413)
  })

  it('blocks non-HTTPS remote baseURL in BYOK', async () => {
    const storage = memoryStorage()
    storage.setItem('qikbar:byok', JSON.stringify({ vendor: 'openai-compatible', apiKey: 'sk-test', baseURL: 'http://remote.example.com/v1' }))
    const p = byok({ storage })
    const events = []
    for await (const ev of p.stream({ messages: [{ role: 'user', content: 'hi' }] })) events.push(ev)
    expect(events[0]).toMatchObject({ type: 'error' })
    expect((events[0] as any).error).toContain('https://')
  })
})
