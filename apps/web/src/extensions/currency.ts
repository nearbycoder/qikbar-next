import { action, defineExtension, list, type Item } from 'qikbar'

const API = 'https://api.frankfurter.dev/v1'
let names: Promise<Record<string, string>> | undefined
const currencies = () => (names ??= fetch(`${API}/currencies`).then((r) => r.json()))

const fmt = (value: number, code: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: value < 1 ? 4 : 2 }).format(value)
  } catch {
    return `${value.toFixed(2)} ${code}`
  }
}

export default defineExtension({
  name: 'currency',
  title: 'Currency',
  icon: '💱',
  description: 'Convert between 30+ currencies with daily ECB rates. Type “100 usd to eur”.',
  sources: [
    {
      id: 'currency-convert',
      title: 'Currency',
      position: 'top',
      debounce: 200,
      async search({ query, signal }) {
        const m = query.trim().match(/^([\d.,]+)\s*([a-z]{3})\s+(?:to|in|=)\s+([a-z]{3})$/i)
        if (!m) return []
        const amount = Number(m[1]!.replace(/,/g, ''))
        const from = m[2]!.toUpperCase()
        const to = m[3]!.toUpperCase()
        if (!Number.isFinite(amount) || from === to) return []
        const res = await fetch(`${API}/latest?base=${from}&symbols=${to}`, { signal })
        if (!res.ok) return []
        const data = await res.json()
        const rate: number | undefined = data.rates?.[to]
        if (!rate) return []
        const result = amount * rate
        const all = await currencies()
        return [
          {
            id: 'currency:result',
            title: fmt(result, to),
            subtitle: `${fmt(amount, from)} · 1 ${from} = ${rate} ${to}`,
            icon: '💱',
            noHistory: true,
            accessories: [{ text: `${all[to] ?? to}` }, { tag: data.date }],
            actions: [
              action.copy(result.toFixed(2), { title: 'Copy Amount', shortcut: undefined }),
              action.copy(`${fmt(amount, from)} = ${fmt(result, to)}`, { title: 'Copy Conversion', shortcut: 'mod+shift+c' }),
            ],
          },
        ]
      },
    },
  ],
  commands: [
    {
      name: 'rates',
      title: 'Exchange Rates',
      icon: '💱',
      keywords: ['currency', 'forex', 'fx', 'money'],
      arguments: [{ name: 'base', placeholder: 'Base (USD)' }],
      view: (ctx) => {
        const base = (ctx.arguments.base || 'USD').toUpperCase()
        return list({
          title: `Rates for ${base}`,
          placeholder: 'Filter currencies…',
          filter: true,
          items: async ({ signal }) => {
            const [data, all] = await Promise.all([fetch(`${API}/latest?base=${base}`, { signal }).then((r) => r.json()), currencies()])
            if (!data.rates) throw new Error(`Unknown currency “${base}”`)
            return Object.entries(data.rates as Record<string, number>).map<Item>(([code, rate]) => ({
              id: code,
              title: code,
              subtitle: all[code],
              keywords: [all[code] ?? ''],
              icon: '💱',
              accessories: [{ text: `1 ${base} = ${rate}` }],
              actions: [action.copy(String(rate), { title: 'Copy Rate' })],
            }))
          },
        })
      },
    },
  ],
})
