/**
 * Tiny, dependency-free Markdown plugins for the docs.
 */

const KINDS = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' }

/** GitHub-style alerts: `> [!TIP]` → <div class="callout" data-callout="tip">. A Sätteri hast plugin. */
export const callouts = {
  name: 'callouts',
  element: {
    filter: ['blockquote'],
    visit(node, ctx) {
      const p = node.children.find((c) => c.type === 'element')
      const t = p?.children?.[0]
      const m = t?.type === 'text' ? t.value.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/) : null
      if (!m) return
      const rest = t.value.slice(m[0].length)
      const pChildren = rest ? [{ type: 'text', value: rest }, ...p.children.slice(1)] : p.children.slice(1)
      const children = node.children.map((c) => (c === p ? { ...p, children: pChildren } : c))
      ctx.replaceNode(node, {
        type: 'element',
        tagName: 'div',
        properties: { className: ['callout'], dataCallout: m[1].toLowerCase(), dataLabel: KINDS[m[1]] },
        children,
      })
    },
  },
}

/** ```ts title="app.ts" → data-title on the <pre>. */
export const codeTitle = {
  name: 'code-title',
  pre(node) {
    const raw = this.options.meta?.__raw ?? ''
    const m = raw.match(/title="([^"]+)"/)
    if (m) node.properties['data-title'] = m[1]
  },
}
