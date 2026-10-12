/**
 * Build-time Open Graph images: satori (layout → SVG) + resvg (SVG → PNG).
 * Every page gets a 1200×630 PNG at /og/<path>.png.
 */
import { Resvg } from '@resvg/resvg-js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import satori from 'satori'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } }
// resvg panics on zero-size masked shapes, so falsy children are dropped rather than rendered as empty divs.
const h = (type: string, style: Record<string, unknown>, ...kids: unknown[]): Node => {
  const children = kids.filter((k) => k !== null && k !== undefined && k !== false)
  return { type, props: { style, children: children.length === 1 ? children[0] : children } }
}

function asset(...candidates: string[]): Buffer {
  for (const c of candidates) {
    const p = join(process.cwd(), c)
    if (existsSync(p)) return readFileSync(p)
  }
  throw new Error(`OG asset not found: ${candidates[0]}`)
}

const font = (weight: number) => asset(`node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff`, `../../node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff`)

let fonts: { name: string; data: Buffer; weight: 400 | 500 | 600 | 700; style: 'normal' }[] | undefined
const loadFonts = () =>
  (fonts ??= ([400, 500, 600, 700] as const).map((weight) => ({ name: 'Inter', data: font(weight), weight, style: 'normal' as const })))

let logoUri: string | undefined
const logo = () => (logoUri ??= `data:image/svg+xml;base64,${asset('public/logo.svg').toString('base64')}`)

const SEARCH_ICON = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6b717b" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>').toString('base64')}`

const C = {
  bg: '#08090b',
  text: '#eceef1',
  muted: '#a0a6af',
  subtle: '#6b717b',
  brand: '#34d399',
  brand2: '#22d3ee',
  border: 'rgba(255,255,255,0.10)',
}

function background(): Node[] {
  return [
    h('div', {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundImage: 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
      backgroundSize: '48px 48px',
    }),
    h('div', { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(circle at 82% 18%, rgba(52,211,153,0.30), transparent 42%)' }),
    h('div', { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(circle at 8% 100%, rgba(34,211,238,0.20), transparent 40%)' }),
  ]
}

function brand(kicker?: string): Node {
  return h(
    'div',
    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
    h(
      'div',
      { display: 'flex', alignItems: 'center', gap: 18 },
      { type: 'img', props: { src: logo(), width: 64, height: 64 } },
      h('div', { fontSize: 40, fontWeight: 700, letterSpacing: -1.2, color: C.text }, 'qikbar'),
    ),
    kicker
      ? h(
          'div',
          {
            display: 'flex',
            padding: '10px 20px',
            borderRadius: 999,
            border: `1.5px solid rgba(52,211,153,0.35)`,
            background: 'rgba(52,211,153,0.10)',
            color: C.brand,
            fontSize: 24,
            fontWeight: 600,
          },
          kicker,
        )
      : null,
  )
}

function chips(items: string[]): Node {
  return h(
    'div',
    { display: 'flex', gap: 12 },
    ...items.map((t) => h('div', { display: 'flex', padding: '8px 18px', borderRadius: 999, border: `1.5px solid ${C.border}`, color: '#cfd3d8', fontSize: 22 }, t)),
  )
}

function miniBar(): Node {
  const row = (icon: string, title: string, kind: string, selected = false) =>
    h(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 54,
        margin: '0 10px',
        padding: '0 16px',
        borderRadius: 12,
        background: selected ? 'rgba(255,255,255,0.08)' : 'transparent',
      },
      h('div', { display: 'flex', width: 26, height: 26, borderRadius: 7, background: icon, opacity: 0.9 }),
      h('div', { fontSize: 22, fontWeight: 500, color: C.text }, title),
      h('div', { marginLeft: 'auto', fontSize: 18, color: C.subtle }, kind),
    )
  const key = (t: string) => h('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 28, padding: '0 8px', borderRadius: 7, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 15, color: C.muted }, t)
  return h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: 480,
      borderRadius: 22,
      background: 'rgba(22,24,28,0.94)',
      border: '1.5px solid rgba(255,255,255,0.12)',
      paddingBottom: 8,
    },
    h(
      'div',
      { display: 'flex', alignItems: 'center', gap: 14, height: 76, padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
      { type: 'img', props: { src: SEARCH_ICON, width: 24, height: 24 } },
      h('div', { fontSize: 26, color: C.text }, 'acme'),
      h('div', { width: 3, height: 30, background: C.brand, marginLeft: -8 }),
    ),
    h('div', { display: 'flex', fontSize: 16, fontWeight: 600, color: C.subtle, padding: '16px 26px 8px' }, 'Results'),
    row('#8b5cf6', 'Acme Rocket', 'Project', true),
    row('#3b82f6', 'Go to Billing', 'Page'),
    row('#34d399', 'Ask AI “invite sam as admin”', 'AI'),
    row('#f59e0b', '12 × 7 = 84', 'Calculator'),
    h(
      'div',
      { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, height: 56, marginTop: 10, padding: '0 20px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 17, color: C.muted },
      'Open',
      key('Enter'),
      h('div', { width: 1, height: 18, background: 'rgba(255,255,255,0.14)', margin: '0 8px' }),
      'Actions',
      key('Ctrl'),
      key('.'),
    ),
  )
}

export interface OgInput {
  title: string
  description?: string
  kicker?: string
  path?: string
  variant?: 'home' | 'page'
}

function layout({ title, description, kicker, path, variant = 'page' }: OgInput): Node {
  if (variant === 'home') {
    return h(
      'div',
      { display: 'flex', width: OG_WIDTH, height: OG_HEIGHT, background: C.bg, fontFamily: 'Inter', position: 'relative', overflow: 'hidden' },
      ...background(),
      h(
        'div',
        { position: 'absolute', top: 0, left: 72, right: 72, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
        h(
          'div',
          { display: 'flex', flexDirection: 'column', width: 540, flexShrink: 0 },
          brand(),
          h(
            'div',
            { display: 'flex', flexDirection: 'column', fontSize: 60, fontWeight: 700, letterSpacing: -2.6, lineHeight: 1.06, marginTop: 40, color: C.text },
            h('div', { whiteSpace: 'nowrap' }, 'The command bar'),
            // resvg can't paint background-clip: text, so color the words instead.
            h('div', { display: 'flex', gap: 16, whiteSpace: 'nowrap' }, h('div', { color: '#a7f3d0' }, 'your app'), h('div', { color: C.brand }, 'deserves.')),
          ),
          h('div', { fontSize: 25, color: C.muted, marginTop: 22, lineHeight: 1.4 }, 'Open-source search, navigation, actions and AI for any web app.'),
          h('div', { display: 'flex', marginTop: 30 }, chips(['MIT', 'Zero deps', '3.5 KB boot'])),
        ),
        // resvg can't render satori's box-shadow filter; a gradient layer stands in for the glow.
        h(
          'div',
          { display: 'flex', position: 'relative' },
          h('div', { position: 'absolute', top: -80, left: -80, right: -80, bottom: -80, backgroundImage: 'radial-gradient(closest-side, rgba(52,211,153,0.28), transparent)' }),
          miniBar(),
        ),
      ),
    )
  }
  const size = title.length <= 22 ? 92 : title.length <= 34 ? 76 : 62
  return h(
    'div',
    { display: 'flex', width: OG_WIDTH, height: OG_HEIGHT, background: C.bg, fontFamily: 'Inter', position: 'relative', overflow: 'hidden' },
    ...background(),
    { type: 'img', props: { src: logo(), width: 420, height: 420, style: { position: 'absolute', right: -70, bottom: -90, opacity: 0.12 } } },
    // Satori adds padding outside fixed sizes, so content is placed with absolute offsets instead.
    h(
      'div',
      { position: 'absolute', top: 64, left: 72, right: 72, bottom: 64, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
      brand(kicker),
      h(
        'div',
        { display: 'flex', flexDirection: 'column', maxWidth: 940 },
        h('div', { fontSize: size, fontWeight: 700, letterSpacing: -size * 0.035, lineHeight: 1.04, color: C.text }, title),
        description
          ? h('div', { fontSize: 28, color: C.muted, marginTop: 22, lineHeight: 1.4 }, description.length > 150 ? `${description.slice(0, 147)}…` : description)
          : null,
      ),
      h(
        'div',
        { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
        h('div', { fontSize: 24, color: C.subtle, fontWeight: 500 }, `qikbar.com${path ?? ''}`),
        chips(['Open source', 'MIT']),
      ),
    ),
  )
}

export async function renderOg(input: OgInput): Promise<Buffer> {
  const svg = await satori(layout(input) as any, { width: OG_WIDTH, height: OG_HEIGHT, fonts: loadFonts() })
  return new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH }, font: { loadSystemFonts: false } }).render().asPng()
}
