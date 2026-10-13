import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion'
import { presets, resolveThemeVars, cssVarName } from '@qikbar/qikbar/theme'
import type { ThemePresetName } from '@qikbar/qikbar'
import { Bar, Body, Footer, grouped, Header, List, QIcon, type RowData } from '../components/qb'
import { Background, C, Caption, clamp, FONT, KeyHint, Logo, MONO, Reveal, Stage, t01, useSpring } from '../components/motion'
import { ROOT } from '../data'
import { erase, SCENES, TYPE } from '../timeline'

// ─── 07 Extensions ──────────────────────────────────────────────────────────

const EXTENSIONS: [icon: string, title: string, body: string][] = [
  ['⛅', 'Weather', '7-day forecasts, inline'],
  ['💱', 'Currency', '“100 usd to eur”'],
  ['package', 'npm', 'Search and copy installs'],
  ['book', 'Wikipedia', 'Live article summaries'],
  ['bookmark', 'Bookmarks', 'Saved links, searchable'],
  ['github', 'GitHub', 'Search repositories'],
  ['calculator', 'Calculator', 'Math and unit conversions'],
  ['😀', 'Emoji', 'Search and copy emoji'],
]

function ExtCard({ i, icon, title, body, out }: { i: number; icon: string; title: string; body: string; out: number }) {
  const s = useSpring(10 + i * 5, { damping: 13, stiffness: 150 })
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '22px 22px',
        borderRadius: 20,
        border: '1.5px solid rgba(255,255,255,0.09)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))',
        opacity: s * (1 - out),
        transform: `translateY(${(1 - s) * 50 - out * 30}px) scale(${0.9 + s * 0.1 - out * 0.05})`,
        fontFamily: FONT,
      }}
    >
      <div
        className="qb-root"
        data-qb-appearance="dark"
        style={{ width: 62, height: 62, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg, rgba(52,211,153,0.22), rgba(255,255,255,0.04))', border: '1px solid rgba(52,211,153,0.3)', color: C.brand, fontSize: 30 }}
      >
        <QIcon icon={icon} size={28} />
      </div>
      <div>
        <div style={{ color: C.text, fontSize: 25, fontWeight: 650 }}>{title}</div>
        <div style={{ color: C.muted, fontSize: 18, marginTop: 4 }}>{body}</div>
      </div>
    </div>
  )
}

export function Extensions() {
  const f = useCurrentFrame()
  const out = t01(f, 100, 116)
  const barIn = t01(f, 108, 124)
  const query = f < 166 ? TYPE.extUsd.at(f) : f < 176 ? erase('100 usd to eur', 166, 1, f) : TYPE.extWeather.at(f)
  const currency: RowData[] = [{ title: '€89.44', subtitle: '$100.00 · 1 USD = 0.8944 EUR', icon: '💱', section: 'Currency', accessories: [{ text: 'Euro' }, { tag: { value: 'ECB', color: 'green' } }] }]
  const weather: RowData[] = [
    { title: 'Tokyo, Japan', subtitle: '17°C · Clear sky', icon: '☀️', section: 'Weather', accessories: [{ text: 'H 21° · L 12°' }] },
    { title: 'Tomorrow', subtitle: '19°C · Partly cloudy', icon: '⛅', section: 'Weather', accessories: [{ text: 'H 22° · L 14°' }] },
    { title: 'Wednesday', subtitle: '14°C · Light rain', icon: '🌧️', section: 'Weather', accessories: [{ text: 'H 16° · L 11°' }] },
  ]
  const rows: RowData[] =
    f >= 210 && query.startsWith('weather') ? weather : f >= 150 && query.startsWith('100') ? currency : []
  const appear = f >= 210 ? 210 : 150
  const reveal = (i: number) => {
    const s = t01(f, appear + i * 3, appear + i * 3 + 10)
    return { opacity: s, transform: `translateY(${(1 - s) * 10}px)` }
  }
  return (
    <AbsoluteFill>
      <Caption
        index="07"
        label="Extensions"
        title="Extend it with anything"
        body="Commands, live sources, AI tools and settings in one file. Install it with one line."
        chips={['bar.use(weather)', 'defineExtension()']}
        len={SCENES.extensions.len}
      />
      {out < 1 && (
        <div style={{ position: 'absolute', left: 770, top: 220, width: 1064, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {EXTENSIONS.map(([icon, title, body], i) => (
            <ExtCard key={title} i={i} icon={icon} title={title} body={body} out={out} />
          ))}
        </div>
      )}
      {f >= 108 && (
        <Stage style={{ opacity: barIn, transform: `translateY(-50%) scale(${1.32 + barIn * 0.08})` }}>
          <Bar>
            <Header query={query} frame={f} />
            <Body>
              <List entries={rows.length ? [...grouped(rows), ...grouped([{ title: 'Ask AI', subtitle: `“${query}”`, icon: 'sparkles', section: `Use “${query}” with…`, accessories: [{ kbd: ['Tab'] }] }])] : grouped(ROOT.slice(1, 6))} query={rows.length ? undefined : undefined} selected={0} reveal={rows.length ? reveal : undefined} />
            </Body>
            <Footer left={<span>{rows.length ? `${rows[0]!.section} extension` : 'Acme · 12 shortcuts'}</span>} primary={rows.length ? 'Copy' : 'Open'} />
          </Bar>
        </Stage>
      )}
    </AbsoluteFill>
  )
}

// ─── 08 Themes ──────────────────────────────────────────────────────────────

const THEMES: (ThemePresetName | 'default')[] = ['default', 'raycast', 'linear', 'vercel', 'dracula', 'catppuccin', 'tokyo-night', 'nord', 'midnight', 'paper']

function themeVars(name: ThemePresetName | 'default') {
  const { vars, appearance } = resolveThemeVars(name === 'default' ? undefined : name, 'dark')
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(vars)) if (v) out[cssVarName(k)] = v
  return { vars: out, appearance }
}

function ThemedBar({ name, f }: { name: ThemePresetName | 'default'; f: number }) {
  const { vars, appearance } = themeVars(name)
  return (
    <Bar vars={vars} appearance={appearance}>
      <Header query="" frame={f} />
      <Body>
        <List entries={grouped(ROOT)} selected={0} />
      </Body>
      <Footer left={<span style={{ color: 'var(--qb-fg-subtle)' }}>Acme · 12 shortcuts</span>} />
    </Bar>
  )
}

export function Themes() {
  const f = useCurrentFrame()
  const step = 16
  const idx = Math.max(0, Math.min(THEMES.length - 1, Math.floor((f - 30) / step) + 1))
  const prev = Math.max(0, idx - 1)
  const local = f - (30 + (idx - 1) * step)
  const mix = idx === 0 ? 1 : t01(local, 0, 7)
  const name = THEMES[idx]!
  const label = name === 'default' ? 'Default' : presets[name].label
  const accent = name === 'default' ? C.brand : (resolveThemeVars(name, 'dark').vars.accent ?? C.brand)
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: 0.6 }}>
        <Background accent={accent} />
      </AbsoluteFill>
      <Caption
        index="08"
        label="Theming"
        title="Looks native in every app"
        body="14 presets and 30+ CSS variables. Light and dark follow your app automatically."
        chips={['CSS variables', 'Tailwind classes', 'Unstyled']}
        len={SCENES.themes.len}
      />
      <Stage>
        <div style={{ position: 'relative' }}>
          <ThemedBar name={THEMES[prev]!} f={f} />
          <div style={{ position: 'absolute', inset: 0, opacity: mix }}>
            <ThemedBar name={name} f={f} />
          </div>
        </div>
      </Stage>
      <div
        style={{
          position: 'absolute',
          left: 1302,
          top: 960,
          transform: `translate(-50%, -50%) scale(${1 + (1 - mix) * 0.12})`,
          padding: '12px 26px',
          borderRadius: 999,
          background: 'rgba(20,22,26,0.9)',
          border: `1.5px solid ${accent}`,
          color: C.text,
          fontFamily: FONT,
          fontSize: 26,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ width: 14, height: 14, borderRadius: 7, background: accent, boxShadow: `0 0 20px ${accent}` }} />
        {label}
        <span style={{ color: C.subtle, fontFamily: MONO, fontSize: 20 }}>
          {idx + 1}/{THEMES.length}
        </span>
      </div>
    </AbsoluteFill>
  )
}

// ─── 09 Stats ───────────────────────────────────────────────────────────────

export function Stats() {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const exit = t01(f, 106, 120)
  const stats: { value: (p: number) => string; label: string; at: number }[] = [
    { value: (p) => `${(3.9 * p).toFixed(1)} KB`, label: 'to boot', at: 8 },
    { value: () => '0', label: 'dependencies', at: 20 },
    { value: (p) => `${Math.round(100 * p)}k`, label: 'rows, virtualized', at: 32 },
    { value: (p) => `~${Math.max(1, Math.round(3 * p))} ms`, label: 'to rank 10,000 items', at: 44 },
  ]
  return (
    <AbsoluteFill style={{ fontFamily: FONT, opacity: 1 - exit, filter: `blur(${exit * 8}px)` }}>
      <div style={{ position: 'absolute', top: 250, left: 0, right: 0, textAlign: 'center', fontSize: 92, fontWeight: 700, letterSpacing: '-0.045em', color: C.text }}>
        <Reveal text="Small. Fast. Free." start={56} stagger={6} wordStyle={(i) => ({ color: i === 2 ? C.brand : C.text })} />
      </div>
      <div style={{ position: 'absolute', top: 470, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 28 }}>
        {stats.map((s) => {
          const pop = spring({ frame: f - s.at, fps, config: { damping: 11, stiffness: 180, mass: 0.6 } })
          const count = t01(f, s.at, s.at + 22)
          return (
            <div
              key={s.label}
              style={{
                width: 360,
                padding: '38px 34px',
                borderRadius: 26,
                border: '1.5px solid rgba(255,255,255,0.09)',
                background: 'linear-gradient(180deg, rgba(52,211,153,0.08), rgba(255,255,255,0.02))',
                opacity: pop,
                transform: `translateY(${(1 - pop) * 60}px) scale(${0.85 + pop * 0.15})`,
              }}
            >
              <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: '-0.05em', color: C.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value(count)}</div>
              <div style={{ fontSize: 26, color: C.muted, marginTop: 14 }}>{s.label}</div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ─── 10 Outro ───────────────────────────────────────────────────────────────

export function Outro() {
  const f = useCurrentFrame()
  const drop = useSpring(4, { damping: 11, stiffness: 120, mass: 0.9 })
  const land = interpolate(f, [24, 27, 32, 38], [0, 1, 0.3, 0], clamp)
  const word = t01(f, 18, 34)
  const pill = useSpring(34, { damping: 14 })
  const cmd = TYPE.outroInstall.at(f)
  const installed = f >= 102
  const tail = t01(f, 118, 136)
  const fade = t01(f, 160, 180)
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div style={{ position: 'absolute', left: '50%', top: 330, transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', gap: 34 }}>
        <div style={{ transform: `translateY(${(1 - drop) * -360}px) scale(${1 + land * 0.08}, ${1 - land * 0.1})`, transformOrigin: 'bottom center', filter: 'drop-shadow(0 30px 60px rgba(52,211,153,0.4))' }}>
          <Logo size={150} />
        </div>
        <div style={{ fontSize: 140, fontWeight: 700, letterSpacing: '-0.05em', color: C.text, opacity: word, transform: `translateX(${(1 - word) * -30}px)` }}>qikbar</div>
      </div>
      <div style={{ position: 'absolute', top: 470, left: 0, right: 0, textAlign: 'center', fontSize: 40, color: C.muted }}>
        <Reveal text="The open-source command bar for any web app." start={26} stagger={2} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 610,
          transform: `translate(-50%, -50%) scale(${0.9 + pill * 0.1})`,
          opacity: pill,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '24px 34px',
          borderRadius: 22,
          border: `1.5px solid ${installed ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.12)'}`,
          background: 'rgba(14,16,19,0.92)',
          boxShadow: installed ? '0 0 80px -10px rgba(52,211,153,0.45)' : '0 30px 60px -20px rgba(0,0,0,0.6)',
          fontFamily: MONO,
          fontSize: 38,
          color: C.text,
          minWidth: 760,
        }}
      >
        <span style={{ color: C.brand }}>$</span>
        <span>{cmd}</span>
        {!installed && <span style={{ width: 3, height: 40, background: C.brand, opacity: Math.floor(f / 12) % 2 ? 0 : 1 }} />}
        {installed && (
          <span style={{ marginLeft: 'auto', color: C.brand, display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT, fontSize: 28, fontWeight: 600 }}>
            <span className="qb-root" data-qb-appearance="dark" style={{ color: C.brand }}>
              <QIcon icon="check-circle" size={30} />
            </span>
            installed
          </span>
        )}
      </div>
      <div style={{ position: 'absolute', top: 790, left: 0, right: 0, textAlign: 'center', opacity: tail, transform: `translateY(${(1 - tail) * 20}px)` }}>
        <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.03em', background: `linear-gradient(90deg, ${C.text}, ${C.brand}, ${C.brand2})`, WebkitBackgroundClip: 'text', color: 'transparent' }}>qikbar.com</div>
        <div style={{ fontSize: 28, color: C.muted, marginTop: 12 }}>MIT licensed · Free forever · Built for the AI era</div>
      </div>
      <AbsoluteFill style={{ background: '#000', opacity: fade }} />
    </AbsoluteFill>
  )
}

export { KeyHint }
