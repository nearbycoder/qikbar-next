import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

export const C = {
  bg: '#06070a',
  text: '#eceef1',
  muted: '#9aa1ab',
  subtle: '#636a74',
  brand: '#34d399',
  brand2: '#22d3ee',
  border: 'rgba(255,255,255,0.09)',
}

export const FONT = "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace"

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
export const ease = Easing.bezier(0.16, 1, 0.3, 1)

/** 0 → 1 over [from, to] with a smooth ease-out. */
export const t01 = (f: number, from: number, to: number, easing = ease) => interpolate(f, [from, to], [0, 1], { ...clamp, easing })

export function useSpring(start: number, config: Partial<{ damping: number; mass: number; stiffness: number }> = {}) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: f - start, fps, config: { damping: 14, mass: 0.7, stiffness: 140, ...config } })
}

/** Ambient background: deep black, a faint grid, drifting brand glows and a vignette. */
export function Background({ accent }: { accent?: string }) {
  const f = useCurrentFrame()
  const a = accent ?? C.brand
  const g1x = 70 + Math.sin(f / 90) * 8
  const g1y = 22 + Math.cos(f / 110) * 6
  const g2x = 18 + Math.cos(f / 120) * 7
  const g2y = 85 + Math.sin(f / 100) * 5
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          backgroundPosition: `${-f * 0.15}px ${-f * 0.3}px`,
          maskImage: 'radial-gradient(ellipse 75% 70% at 50% 45%, #000 20%, transparent 80%)',
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(900px 600px at ${g1x}% ${g1y}%, ${a}38, transparent 60%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(800px 520px at ${g2x}% ${g2y}%, ${C.brand2}26, transparent 60%)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 120% 90% at 50% 40%, transparent 55%, rgba(0,0,0,0.65))' }} />
    </AbsoluteFill>
  )
}

/** Word-by-word kinetic reveal: blur + rise + fade with a spring. */
export function Reveal({ text, start, stagger = 3, style, wordStyle }: { text: string; start: number; stagger?: number; style?: CSSProperties; wordStyle?: (i: number) => CSSProperties }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(' ')
  return (
    <span style={{ display: 'inline', ...style }}>
      {words.map((w, i) => {
        const s = spring({ frame: f - start - i * stagger, fps, config: { damping: 16, stiffness: 120, mass: 0.6 } })
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: s,
              transform: `translateY(${(1 - s) * 34}px)`,
              filter: `blur(${(1 - s) * 10}px)`,
              marginRight: '0.26em',
              ...wordStyle?.(i),
            }}
          >
            {w}
          </span>
        )
      })}
    </span>
  )
}

/** Left-hand caption for a feature scene. */
export function Caption({
  index,
  label,
  title,
  body,
  chips,
  len,
  activeChip,
}: {
  index: string
  label: string
  title: string
  body: string
  chips?: string[]
  len: number
  activeChip?: number
}) {
  const f = useCurrentFrame()
  const exit = t01(f, len - 14, len, Easing.in(Easing.cubic))
  const line = t01(f, 2, 22)
  const bodyIn = t01(f, 18, 38)
  return (
    <div
      style={{
        position: 'absolute',
        left: 120,
        top: 0,
        bottom: 0,
        width: 600,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        fontFamily: FONT,
        opacity: 1 - exit,
        transform: `translateY(${-exit * 24}px)`,
        filter: `blur(${exit * 6}px)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: C.brand, fontSize: 20, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: line }}>
        <span style={{ fontFamily: MONO, fontWeight: 500 }}>{index}</span>
        <span style={{ height: 2, width: 48 * line, background: `linear-gradient(90deg, ${C.brand}, ${C.brand2})`, borderRadius: 2 }} />
        <span>{label}</span>
      </div>
      <div style={{ fontSize: 76, lineHeight: 1.04, fontWeight: 700, letterSpacing: '-0.045em', color: C.text, marginTop: 26 }}>
        <Reveal text={title} start={6} />
      </div>
      <div style={{ fontSize: 27, lineHeight: 1.45, color: C.muted, marginTop: 26, opacity: bodyIn, transform: `translateY(${(1 - bodyIn) * 16}px)`, maxWidth: 560 }}>{body}</div>
      {chips && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 34 }}>
          {chips.map((c, i) => {
            const s = t01(f, 30 + i * 4, 46 + i * 4)
            const active = activeChip === i
            return (
              <span
                key={c}
                style={{
                  padding: '9px 16px',
                  borderRadius: 999,
                  border: `1.5px solid ${active ? C.brand : 'rgba(255,255,255,0.12)'}`,
                  background: active ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.03)',
                  color: active ? C.text : '#c9cdd3',
                  fontSize: 20,
                  fontFamily: c.includes('(') || c.includes('.') ? MONO : FONT,
                  opacity: s,
                  transform: `scale(${0.85 + s * 0.15})`,
                }}
              >
                {c}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** On-screen keystroke, like a screencast key overlay. */
export function KeyHint({ at, keys, label, x = 1302, y = 950 }: { at: number; keys: string[]; label?: string; x?: number; y?: number }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (f < at - 2 || f > at + 40) return null
  const s = spring({ frame: f - at, fps, config: { damping: 12, stiffness: 220, mass: 0.5 } })
  const out = t01(f, at + 26, at + 38)
  const press = interpolate(f - at, [0, 3, 8], [1, 0.9, 1], clamp)
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${(0.7 + s * 0.3) * press})`,
        opacity: s * (1 - out),
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px 10px 12px',
        borderRadius: 16,
        background: 'rgba(20,22,26,0.88)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 20px 50px -10px rgba(0,0,0,0.6)',
        fontFamily: FONT,
      }}
    >
      {keys.map((k, i) => (
        <span
          key={i}
          style={{
            minWidth: 44,
            height: 44,
            padding: '0 12px',
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(180deg, #2b2f36, #1d2026)',
            borderBottom: '3px solid #0d0f12',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
            color: C.text,
            fontSize: 22,
            fontWeight: 600,
          }}
        >
          {k}
        </span>
      ))}
      {label && <span style={{ color: C.muted, fontSize: 20, marginLeft: 4 }}>{label}</span>}
    </div>
  )
}

export const Logo = ({ size, style }: { size: number; style?: CSSProperties }) => <img src={staticFile('logo.svg')} width={size} height={size} style={style} />

/** Places the bar on the right half of the frame, scaled for 1080p. */
export function Stage({ children, x = 770, y = 540, scale = 1.4, style }: { children: ReactNode; x?: number; y?: number; scale?: number; style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translateY(-50%) scale(${scale})`, transformOrigin: 'left center', ...style }}>{children}</div>
  )
}
