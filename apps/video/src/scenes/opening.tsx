import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion'
import { Bar, Body, Footer, grouped, Header, List } from '../components/qb'
import { C, Caption, clamp, FONT, Logo, Reveal, Stage, t01, useSpring } from '../components/motion'
import { ROOT } from '../data'
import { SCENES } from '../timeline'

/** Scene 1: logo drop, wordmark, headline. */
export function Intro() {
  const f = useCurrentFrame()
  const drop = useSpring(8, { damping: 11, stiffness: 120, mass: 0.9 })
  const land = interpolate(f, [26, 29, 34, 40], [0, 1, 0.3, 0], clamp)
  const lift = t01(f, 62, 86)
  const exit = t01(f, 160, 180)
  const letters = 'qikbar'.split('')
  const chips = ['Open source', 'Zero dependencies', 'AI-native', 'Any framework']
  return (
    <AbsoluteFill style={{ fontFamily: FONT, opacity: 1 - exit, transform: `scale(${1 - exit * 0.04})`, filter: `blur(${exit * 8}px)` }}>
      {/* Logo + wordmark, which move up to make room for the headline */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: interpolate(lift, [0, 1], [430, 210]),
          transform: `translate(-50%, -50%) scale(${interpolate(lift, [0, 1], [1, 0.62])})`,
          display: 'flex',
          alignItems: 'center',
          gap: 36,
        }}
      >
        <div
          style={{
            transform: `translateY(${(1 - drop) * -420}px) scale(${1 + land * 0.08}, ${1 - land * 0.1})`,
            transformOrigin: 'bottom center',
            filter: `drop-shadow(0 30px 60px rgba(52,211,153,${0.25 + land * 0.3}))`,
          }}
        >
          <Logo size={190} />
        </div>
        <div style={{ display: 'flex', fontSize: 168, fontWeight: 700, letterSpacing: '-0.05em', color: C.text }}>
          {letters.map((l, i) => {
            const s = t01(f, 32 + i * 3, 46 + i * 3)
            return (
              <span key={i} style={{ display: 'inline-block', opacity: s, transform: `translateY(${(1 - s) * 50}px)`, filter: `blur(${(1 - s) * 8}px)` }}>
                {l}
              </span>
            )
          })}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 420, textAlign: 'center', fontSize: 104, fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1.05, color: C.text }}>
        <div>
          <Reveal text="The command bar" start={70} stagger={4} />
        </div>
        <div>
          <Reveal
            text="your app deserves."
            start={82}
            stagger={4}
            wordStyle={(i) => ({ color: i === 2 ? C.brand : '#a7f3d0' })}
          />
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 720, display: 'flex', justifyContent: 'center', gap: 14 }}>
        {chips.map((c, i) => {
          const s = useSpringLocal(f, 124 + i * 6)
          return (
            <span
              key={c}
              style={{
                padding: '12px 22px',
                borderRadius: 999,
                border: '1.5px solid rgba(255,255,255,0.13)',
                background: 'rgba(255,255,255,0.03)',
                color: '#d4d8dd',
                fontSize: 26,
                opacity: s,
                transform: `translateY(${(1 - s) * 20}px) scale(${0.9 + s * 0.1})`,
              }}
            >
              {c}
            </span>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function useSpringLocal(f: number, start: number) {
  return t01(f, start, start + 14)
}

/** Shared default bar content. */
export function RootBar({ frame, query = '' }: { frame: number; query?: string }) {
  return (
    <Bar>
      <Header query={query} frame={frame} />
      <Body>
        <List entries={grouped(ROOT)} selected={0} />
      </Body>
      <Footer left={<span style={{ color: 'var(--qb-fg-subtle)' }}>Acme · 12 shortcuts</span>} />
    </Bar>
  )
}

function Keycap({ label, pressAt, enterAt }: { label: string; pressAt: number; enterAt: number }) {
  const f = useCurrentFrame()
  const enter = useSpring(enterAt, { damping: 12, stiffness: 160 })
  const pressed = interpolate(f, [pressAt, pressAt + 3, pressAt + 9, pressAt + 14], [0, 1, 1, 0.35], clamp)
  return (
    <div style={{ position: 'relative', width: 230, height: 230, opacity: enter, transform: `scale(${0.6 + enter * 0.4})` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 48, background: 'linear-gradient(180deg, #15171c, #0b0c0f)', top: 18 }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: pressed * 14,
          height: 212,
          borderRadius: 48,
          background: `linear-gradient(160deg, #2f333b, #1c1f25)`,
          border: '1.5px solid rgba(255,255,255,0.1)',
          boxShadow: `inset 0 2px 0 rgba(255,255,255,0.12), 0 0 ${pressed * 80}px rgba(52,211,153,${pressed * 0.45})`,
          display: 'grid',
          placeItems: 'center',
          fontSize: 110,
          fontWeight: 600,
          color: pressed > 0.5 ? C.brand : C.text,
          fontFamily: FONT,
        }}
      >
        {label}
      </div>
    </div>
  )
}

/** Scene 2: ⌘K keycaps, then the bar springs open and slides into place. */
export function Hotkey() {
  const f = useCurrentFrame()
  const keysOut = t01(f, 34, 50)
  const open = useSpring(36, { damping: 13, stiffness: 130 })
  const slide = t01(f, 62, 96)
  const len = SCENES.hotkey.len
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 470,
          display: 'flex',
          gap: 40,
          transform: `translate(-50%, -50%) translateY(${-keysOut * 140}px)`,
          opacity: 1 - keysOut,
          filter: `blur(${keysOut * 12}px)`,
        }}
      >
        <Keycap label="⌘" enterAt={0} pressAt={16} />
        <Keycap label="K" enterAt={4} pressAt={26} />
      </div>
      {f >= 34 && (
        <Stage x={interpolate(slide, [0, 1], [428, 770])} scale={interpolate(open, [0, 1], [1.15, 1.4])} style={{ opacity: open }}>
          <RootBar frame={f} />
        </Stage>
      )}
      <Sequence from={70} layout="none">
        <Caption index="01" label="One shortcut" title="Press ⌘K. Anywhere." body="Search, navigation, actions and AI, one keystroke away in any web app." len={len - 70} />
      </Sequence>
    </AbsoluteFill>
  )
}
