import { action, defineExtension, list, type Item } from '@qikbar/qikbar'

function parse(input: string): [number, number, number] | undefined {
  const s = input.trim().toLowerCase()
  let m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (m) {
    const hex = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
  }
  m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])]
  m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/)
  if (m) return hslToRgb(Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100)
  return undefined
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as [number, number, number]
}

function rgbToHsl([r, g, b]: [number, number, number]) {
  ;[r, g, b] = [r / 255, g / 255, b / 255]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, Math.round(l * 100)]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)]
}

/** Every format for a color, as list items (empty if the input isn't a color). */
function formats(input: string): Item[] {
  const rgb = parse(input)
  if (!rgb) return []
  const hex = `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
  const [h, s, l] = rgbToHsl(rgb)
  const values: [string, string][] = [
    ['HEX', hex],
    ['RGB', `rgb(${rgb.join(' ')})`],
    ['HSL', `hsl(${h} ${s}% ${l}%)`],
    ['CSS var', `--color: ${hex};`],
  ]
  return values.map<Item>(([label, value]) => ({
    id: `color:${label}`,
    title: value,
    subtitle: label,
    noHistory: true,
    // A filled swatch. SVG strings are rendered as trusted markup, so only use values you control.
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><rect x="1" y="1" width="16" height="16" rx="5" fill="${hex}" stroke="rgba(127,127,127,.35)"/></svg>`,
    accessories: [{ kbd: 'enter', text: 'Copy' }],
    actions: [action.copy(value, { title: `Copy ${label}`, shortcut: undefined })],
  }))
}

const randomHex = () => `#${[...crypto.getRandomValues(new Uint8Array(3))].map((v) => v.toString(16).padStart(2, '0')).join('')}`

export default defineExtension({
  name: 'colors',
  title: 'Colors',
  icon: 'palette',
  description: 'Convert colors between hex, RGB and HSL. Type a color like “#22d3ee”, or run Convert Color.',
  commands: [
    {
      name: 'convert',
      title: 'Convert Color',
      subtitle: 'Hex, RGB, HSL',
      icon: 'palette',
      keywords: ['color', 'colour', 'hex', 'rgb', 'hsl', 'css'],
      arguments: [{ name: 'color', placeholder: '#22d3ee or rgb(…)', required: true }],
      run(ctx) {
        const items = formats(ctx.arguments.color ?? '')
        if (!items.length) {
          ctx.toast({ title: 'Not a color', message: 'Try #22d3ee, rgb(34 211 238) or hsl(188 86% 53%)', style: 'failure' })
          return false
        }
        return list({ title: items[0]!.title, items, filter: false })
      },
    },
    {
      name: 'random',
      title: 'Random Color',
      icon: 'palette',
      keywords: ['color', 'colour', 'generate', 'random'],
      view: () => {
        const items = formats(randomHex())
        return list({ title: items[0]!.title, items, filter: false })
      },
    },
  ],
  sources: [
    {
      id: 'color',
      title: 'Color',
      debounce: 0,
      position: 'top',
      search: ({ query }) => formats(query),
    },
  ],
})
