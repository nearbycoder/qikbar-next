import { action, defineExtension, type Item } from '@qikbar/qikbar'

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

export default defineExtension({
  name: 'colors',
  title: 'Colors',
  icon: 'palette',
  description: 'Convert colors between hex, RGB and HSL as you type.',
  sources: [
    {
      id: 'color',
      title: 'Color',
      debounce: 0,
      position: 'top',
      search: ({ query }) => {
        const rgb = parse(query)
        if (!rgb) return []
        const hex = `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
        const [h, s, l] = rgbToHsl(rgb)
        const formats: [string, string][] = [
          ['HEX', hex],
          ['RGB', `rgb(${rgb.join(' ')})`],
          ['HSL', `hsl(${h} ${s}% ${l}%)`],
        ]
        return formats.map<Item>(([label, value]) => ({
          id: `color:${label}`,
          title: value,
          subtitle: label,
          noHistory: true,
          icon: { color: hex, icon: 'circle' },
          accessories: [{ kbd: 'enter', text: 'Copy' }],
          actions: [action.copy(value, { title: `Copy ${label}`, shortcut: undefined })],
        }))
      },
    },
  ],
})
