import { action, defineExtension, detail, type DetailView, type Item } from '@qikbar/qikbar'

interface Place {
  name: string
  country?: string
  admin1?: string
  latitude: number
  longitude: number
  timezone: string
}

const CODES: Record<number, [string, string]> = {
  0: ['Clear sky', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'], 51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
  61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'], 71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'],
  75: ['Heavy snow', '❄️'], 80: ['Showers', '🌦️'], 81: ['Heavy showers', '🌧️'], 82: ['Violent showers', '⛈️'], 95: ['Thunderstorm', '⛈️'],
  96: ['Thunderstorm with hail', '⛈️'], 99: ['Thunderstorm with hail', '⛈️'],
}
const describe = (code: number) => CODES[code] ?? ['Unknown', '🌡️']

async function geocode(name: string, signal?: AbortSignal): Promise<Place[]> {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=5&name=${encodeURIComponent(name)}`, { signal })
  const data = await res.json()
  return data.results ?? []
}

async function forecast(place: Place, unit: 'celsius' | 'fahrenheit', signal?: AbortSignal) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    timezone: place.timezone || 'auto',
    temperature_unit: unit,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    forecast_days: '7',
  })
  return fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal }).then((r) => r.json())
}

const label = (p: Place) => [p.name, p.admin1, p.country].filter(Boolean).join(', ')

function view(place: Place, unit: 'celsius' | 'fahrenheit'): DetailView {
  const deg = unit === 'celsius' ? '°C' : '°F'
  let summary = ''
  return detail({
    title: place.name,
    markdown: async () => {
      const f = await forecast(place, unit)
      const c = f.current
      const [text, emoji] = describe(c.weather_code)
      const days = f.daily.time.map((day: string, i: number) => {
        const [t, e] = describe(f.daily.weather_code[i])
        const name = new Date(`${day}T12:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
        return `| ${name} | ${e} ${t} | ${Math.round(f.daily.temperature_2m_max[i])}${deg} | ${Math.round(f.daily.temperature_2m_min[i])}${deg} | ${f.daily.precipitation_probability_max[i] ?? 0}% |`
      })
      summary = `${label(place)}: ${Math.round(c.temperature_2m)}${deg}, ${text.toLowerCase()}`
      return [
        `# ${emoji} ${Math.round(c.temperature_2m)}${deg}`,
        `**${text}** in ${label(place)}. Feels like ${Math.round(c.apparent_temperature)}${deg}, humidity ${c.relative_humidity_2m}%, wind ${Math.round(c.wind_speed_10m)} km/h.`,
        '',
        '| Day | Conditions | High | Low | Rain |',
        '| --- | --- | --- | --- | --- |',
        ...days,
        '',
        '_Data: [Open-Meteo](https://open-meteo.com)_',
      ].join('\n')
    },
    metadata: [
      { label: 'Location', value: label(place) },
      { label: 'Coordinates', value: `${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}` },
      { label: 'Timezone', value: place.timezone },
    ],
    actions: [
      action.copy(() => summary, { title: 'Copy Summary' }),
      action.open(`https://www.google.com/maps/@${place.latitude},${place.longitude},11z`, { title: 'Open in Maps', shortcut: 'mod+o' }),
    ],
  })
}

export default defineExtension({
  name: 'weather',
  title: 'Weather',
  icon: '⛅',
  description: 'Current conditions and a 7-day forecast for any city. Type “weather in tokyo”.',
  preferences: [
    {
      name: 'unit',
      title: 'Temperature unit',
      type: 'select',
      default: 'celsius',
      options: [
        { title: 'Celsius', value: 'celsius' },
        { title: 'Fahrenheit', value: 'fahrenheit' },
      ],
    },
  ],
  commands: [
    {
      name: 'forecast',
      title: 'Weather Forecast',
      icon: '⛅',
      keywords: ['weather', 'temperature', 'rain', 'forecast'],
      arguments: [{ name: 'city', placeholder: 'City', required: true }],
      async run(ctx) {
        const [place] = await geocode(ctx.arguments.city!, ctx.signal)
        if (!place) {
          ctx.toast({ title: `Couldn’t find “${ctx.arguments.city}”`, style: 'failure' })
          return false
        }
        return view(place, ctx.preferences.unit)
      },
    },
  ],
  sources: [
    {
      id: 'weather-in',
      title: 'Weather',
      position: 'top',
      debounce: 250,
      async search({ query, signal, ctx }) {
        const m = query.match(/^(?:weather|forecast|temperature)\s+(?:in|for|at)\s+(.{2,})$/i)
        if (!m) return []
        const places = await geocode(m[1]!, signal)
        return places.slice(0, 3).map<Item>((p) => ({
          id: `weather:${p.latitude},${p.longitude}`,
          title: `Weather in ${p.name}`,
          subtitle: [p.admin1, p.country].filter(Boolean).join(', '),
          icon: '⛅',
          noHistory: true,
          view: () => view(p, ctx.preferences.unit ?? 'celsius'),
        }))
      },
    },
  ],
})
