import { action, defineExtension, list, type Item } from 'qikbar'

const CITIES: [string, string][] = [
  ['San Francisco', 'America/Los_Angeles'], ['New York', 'America/New_York'], ['São Paulo', 'America/Sao_Paulo'],
  ['London', 'Europe/London'], ['Berlin', 'Europe/Berlin'], ['Paris', 'Europe/Paris'], ['Lagos', 'Africa/Lagos'],
  ['Dubai', 'Asia/Dubai'], ['Mumbai', 'Asia/Kolkata'], ['Singapore', 'Asia/Singapore'], ['Shanghai', 'Asia/Shanghai'],
  ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'], ['Auckland', 'Pacific/Auckland'],
]

function clocks(): Item[] {
  const now = new Date()
  return CITIES.map(([city, tz]) => {
    const time = new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(now)
    const day = new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: 'short' }).format(now)
    const offset = (Date.parse(now.toLocaleString('en-US', { timeZone: tz })) - Date.parse(now.toLocaleString('en-US'))) / 3.6e6
    const diff = Math.round(offset * 2) / 2
    return {
      title: city,
      subtitle: tz.replace(/_/g, ' '),
      icon: { icon: 'clock', color: Number(time.split(':')[0]) >= 7 && Number(time.split(':')[0]) < 19 ? '#f59e0b' : '#6366f1' },
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
