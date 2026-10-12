/**
 * A small, safe Markdown renderer for detail views and AI answers.
 * All input is escaped; raw HTML is never passed through.
 * Supports headings, paragraphs, emphasis, inline code, fenced code blocks,
 * links, images, block quotes, ordered/unordered/task lists, tables and rules.
 */

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]!)
}

function safeUrl(url: string): string | null {
  const u = url.trim()
  if (/^(https?:|mailto:|tel:|#|\/|\.\.?\/)/i.test(u)) return u
  if (/^data:image\/(png|jpe?g|gif|webp|avif);/i.test(u)) return u
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) return u // relative
  return null
}

function inline(src: string): string {
  // Protect code spans first.
  const codes: string[] = []
  let s = src.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, __, code: string) => {
    codes.push(`<code>${escapeHtml(code.trim())}</code>`)
    return `\u0000${codes.length - 1}\u0000`
  })
  s = escapeHtml(s)
  // Images ![alt](src)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (m, alt: string, url: string) => {
    const safe = safeUrl(unescape(url))
    return safe ? `<img src="${escapeHtml(safe)}" alt="${alt}" loading="lazy">` : m
  })
  // Links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (m, text: string, url: string) => {
    const safe = safeUrl(unescape(url))
    if (!safe) return text
    const external = /^https?:/i.test(safe)
    return `<a href="${escapeHtml(safe)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`
  })
  // Autolinks
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?'"])/g, (_, pre: string, url: string) => `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
  // Bold, italic, strikethrough
  s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`)
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
  s = s.replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>')
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  // Hard line breaks
  s = s.replace(/ {2,}\n|\\\n/g, '<br>')
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]!)
}

function unescape(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

interface ListFrame {
  type: 'ul' | 'ol'
  indent: number
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let para: string[] = []
  const lists: ListFrame[] = []
  let i = 0

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join('\n'))}</p>`)
      para = []
    }
  }
  const closeLists = (toIndent = -1) => {
    while (lists.length && lists[lists.length - 1]!.indent > toIndent) {
      out.push(`</li></${lists.pop()!.type}>`)
    }
  }

  while (i < lines.length) {
    const line = lines[i]!

    // Fenced code
    const fence = line.match(/^\s*(```+|~~~+)\s*([\w+#.-]*)/)
    if (fence) {
      flushPara()
      closeLists()
      const marker = fence[1]!
      const lang = fence[2] ?? ''
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i]!.trim().startsWith(marker)) body.push(lines[i++]!)
      i++
      out.push(
        `<div class="qb-code"><div class="qb-code-head"><span>${escapeHtml(lang)}</span><button type="button" class="qb-code-copy" data-qb-copy>Copy</button></div><pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(body.join('\n'))}</code></pre></div>`,
      )
      continue
    }

    if (!line.trim()) {
      flushPara()
      // A blank line inside a list keeps the list open if the next line continues it.
      const next = lines[i + 1] ?? ''
      if (!/^\s*([-*+]|\d+[.)])\s+/.test(next) && !/^\s{2,}\S/.test(next)) closeLists()
      i++
      continue
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/)
    if (heading) {
      flushPara()
      closeLists()
      const level = heading[1]!.length
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`)
      i++
      continue
    }

    // Horizontal rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara()
      closeLists()
      out.push('<hr>')
      i++
      continue
    }

    // Block quote
    if (/^\s*>/.test(line)) {
      flushPara()
      closeLists()
      const body: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i]!)) body.push(lines[i++]!.replace(/^\s*>\s?/, ''))
      out.push(`<blockquote>${renderMarkdown(body.join('\n'))}</blockquote>`)
      continue
    }

    // Table
    if (line.includes('|') && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1] ?? '')) {
      flushPara()
      closeLists()
      const split = (l: string) =>
        l
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim())
      const head = split(line)
      const aligns = split(lines[i + 1]!).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : ''))
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i]!.includes('|') && lines[i]!.trim()) rows.push(split(lines[i++]!))
      const cell = (tag: string, c: string, j: number) => `<${tag}${aligns[j] ? ` style="text-align:${aligns[j]}"` : ''}>${inline(c)}</${tag}>`
      out.push(
        `<div class="qb-table"><table><thead><tr>${head.map((c, j) => cell('th', c, j)).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c, j) => cell('td', c, j)).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      )
      continue
    }

    // List item
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/)
    if (li) {
      flushPara()
      const indent = li[1]!.length
      const type: 'ul' | 'ol' = /\d/.test(li[2]!) ? 'ol' : 'ul'
      const top = lists[lists.length - 1]
      if (!top || indent > top.indent) {
        const start = type === 'ol' && parseInt(li[2]!, 10) !== 1 ? ` start="${parseInt(li[2]!, 10)}"` : ''
        out.push(`<${type}${start}><li>`)
        lists.push({ type, indent })
      } else {
        closeLists(indent)
        const current = lists[lists.length - 1]
        if (current && current.type !== type) {
          out.push(`</li></${lists.pop()!.type}><${type}><li>`)
          lists.push({ type, indent })
        } else if (current) {
          out.push('</li><li>')
        } else {
          out.push(`<${type}><li>`)
          lists.push({ type, indent })
        }
      }
      let text = li[3]!
      const task = text.match(/^\[([ xX])\]\s+(.*)$/)
      if (task) text = `<input type="checkbox" disabled${task[1] !== ' ' ? ' checked' : ''}> ${inline(task[2]!)}`
      else text = inline(text)
      // Continuation lines
      i++
      const cont: string[] = []
      while (i < lines.length && /^\s{2,}\S/.test(lines[i]!) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]!)) cont.push(lines[i++]!.trim())
      out.push(text + (cont.length ? ` ${inline(cont.join('\n'))}` : ''))
      continue
    }

    closeLists()
    para.push(line)
    i++
  }
  flushPara()
  closeLists()
  return out.join('')
}
