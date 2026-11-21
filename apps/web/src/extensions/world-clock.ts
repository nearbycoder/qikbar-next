import { action, defineExtension, list, type Item } from '@qikbar/qikbar'

const CITIES: [string, string][] = [
  ['San Francisco', 'America/Los_Angeles'], ['New York', 'America/New_York'], ['São Paulo', 'America/Sao_Paulo'],
  ['London', 'Europe/London'], ['Berlin', 'Europe/Berlin'], ['Paris', 'Europe/Paris'], ['Lagos', 'Africa/Lagos'],
  ['Dubai', 'Asia/Dubai'], ['Mumbai', 'Asia/Kolkata'], ['Singapore', 'Asia/Singapore'], ['Shanghai', 'Asia/Shanghai'],
  ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'], ['Auckland', 'Pacific/Auckland'],
]

const localFmt = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
const cityFormatters = CITIES.map(([city, tz]) => ({
  city,
  tz,
  label: tz.replace(/_/g, ' '),
  timeFmt: new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' }),
  dayFmt: new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: 'short' }),
  hourFmt: new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }),
  usFmt: new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
}))

function clocks(): Item[] {
  const now = new Date()
  const localMs = Date.parse(localFmt.format(now))
  return cityFormatters.map(({ city, tz, label, timeFmt, dayFmt, hourFmt, usFmt }) => {
    const time = timeFmt.format(now)
    const day = dayFmt.format(now)
    const hour = Number(hourFmt.format(now))
    const offset = (Date.parse(usFmt.format(now)) - localMs) / 3.6e6
    const diff = Math.round(offset * 2) / 2
    return {
      title: city,
      subtitle: label,
      icon: { icon: 'clock', color: hour >= 7 && hour < 19 ? '#f59e0b' : '#6366f1' },
      keywords: [tz],
      accessories: [{ text: diff === 0 ? 'Local' : `${diff > 0 ? '+' : ''}${diff}h` }, { tag: `${day} ${time}` }],
      actions: [action.copy(`${city}: ${day} ${time}`, { title: 'Copy Time' })],
    }
  })
}

export default defineExtension({
  name: 'world-clock',
  title: 'World Clock',
  icon: 'clock',
  description: 'The current time in cities around the world.',
  commands: [
    {
      name: 'list',
      title: 'World Clock',
      icon: 'globe',
      keywords: ['time', 'timezone', 'tz'],
      view: () => list({ title: 'World Clock', placeholder: 'Search cities…', items: clocks() }),
    },
  ],
  sources: [
    {
      id: 'time-in',
      title: 'World Clock',
      debounce: 0,
      position: 'top',
      search: ({ query }) => {
        const m = query.match(/^(?:time in|what time is it in)\s+(.+)$/i)
        if (!m) return []
        const q = m[1]!.toLowerCase()
        return clocks().filter((c) => c.title.toLowerCase().includes(q) || c.subtitle!.toLowerCase().includes(q))
      },
    },
  ],
})
