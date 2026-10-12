/**
 * Synthesizes the video soundtrack: an original 120 BPM track plus UI sound
 * effects placed from the shared timeline. No samples, no dependencies.
 *
 *   bun run audio  →  public/soundtrack.wav
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { allCues, BAR, DURATION, FPS, type SfxType } from '../src/timeline'

const SR = 44100
const TAIL = 2.5
const N = Math.ceil((DURATION / FPS + TAIL) * SR)
const BAR_S = BAR / FPS // 2 s
const STEP16 = BAR_S / 16
const TAU = Math.PI * 2

// ─── Buses ──────────────────────────────────────────────────────────────────

const mk = () => new Float32Array(N)
const drums = { L: mk(), R: mk() }
const music = { L: mk(), R: mk() } // ducked by the kick
const lead = { L: mk(), R: mk() }
const sfx = { L: mk(), R: mk() }
const verbSend = { L: mk(), R: mk() }
const delaySend = { L: mk(), R: mk() }
const duck = new Float32Array(N).fill(1)

// ─── Utilities ──────────────────────────────────────────────────────────────

let seed = 1337
const rand = () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const noise = () => rand() * 2 - 1
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)
const sec = (s: number) => Math.round(s * SR)

function polyblep(t: number, dt: number) {
  if (t < dt) {
    t /= dt
    return t + t - t * t - 1
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt
    return t * t + t + t + 1
  }
  return 0
}

/** Zero-delay-feedback state variable filter. */
class SVF {
  ic1 = 0
  ic2 = 0
  constructor(public k = 1.4) {}
  run(x: number, fc: number) {
    const g = Math.tan((Math.PI * Math.min(fc, SR * 0.45)) / SR)
    const a1 = 1 / (1 + g * (g + this.k))
    const a2 = g * a1
    const a3 = g * a2
    const v3 = x - this.ic2
    const v1 = a1 * this.ic1 + a2 * v3
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3
    this.ic1 = 2 * v1 - this.ic1
    this.ic2 = 2 * v2 - this.ic2
    return { lp: v2, bp: v1, hp: x - this.k * v1 - v2 }
  }
}

/** Mix a mono signal into a stereo bus with equal-power panning. */
function add(bus: { L: Float32Array; R: Float32Array }, at: number, sig: Float32Array, gain = 1, pan = 0) {
  const l = Math.cos(((pan + 1) * Math.PI) / 4) * gain
  const r = Math.sin(((pan + 1) * Math.PI) / 4) * gain
  for (let i = 0; i < sig.length; i++) {
    const j = at + i
    if (j < 0 || j >= N) continue
    bus.L[j] += sig[i]! * l
    bus.R[j] += sig[i]! * r
  }
}

function addStereo(bus: { L: Float32Array; R: Float32Array }, at: number, L: Float32Array, R: Float32Array, gain = 1) {
  for (let i = 0; i < L.length; i++) {
    const j = at + i
    if (j < 0 || j >= N) continue
    bus.L[j] += L[i]! * gain
    bus.R[j] += R[i]! * gain
  }
}

// ─── Drums ──────────────────────────────────────────────────────────────────

function kick(): Float32Array {
  const n = sec(0.42)
  const out = new Float32Array(n)
  let ph = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const f = 46 + 120 * Math.exp(-t * 32)
    ph += (TAU * f) / SR
    const body = Math.sin(ph) * Math.exp(-t * 6.5)
    const click = noise() * Math.exp(-t * 400) * 0.35
    out[i] = Math.tanh((body + click) * 1.6)
  }
  return out
}

function clap(): Float32Array {
  const n = sec(0.3)
  const out = new Float32Array(n)
  const f = new SVF(1.2)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    let env = 0
    for (const o of [0, 0.011, 0.022]) if (t >= o) env = Math.max(env, Math.exp(-(t - o) * 170))
    env = Math.max(env, Math.exp(-t * 16) * 0.55)
    out[i] = f.run(noise(), 1500).bp * env * 2.2
  }
  return out
}

function hat(open: boolean): Float32Array {
  const n = sec(open ? 0.32 : 0.06)
  const out = new Float32Array(n)
  const f = new SVF(0.9)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    out[i] = f.run(noise(), 8500).hp * Math.exp(-t * (open ? 11 : 75))
  }
  return out
}

function crash(): Float32Array {
  const n = sec(2.6)
  const out = new Float32Array(n)
  const f = new SVF(0.7)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    out[i] = f.run(noise(), 6000).hp * Math.exp(-t * 1.7) * (1 - Math.exp(-t * 400))
  }
  return out
}

function subBoom(): Float32Array {
  const n = sec(1.6)
  const out = new Float32Array(n)
  let ph = 0
  const f = new SVF(1)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    ph += (TAU * (34 + 36 * Math.exp(-t * 3))) / SR
    out[i] = Math.sin(ph) * Math.exp(-t * 2.4) + f.run(noise(), 900).lp * Math.exp(-t * 9) * 0.6
  }
  return out
}

function riser(len: number): Float32Array {
  const n = sec(len)
  const out = new Float32Array(n)
  const f = new SVF(0.5)
  let ph = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const p = t / len
    const fc = 300 * Math.pow(25, p)
    ph += (TAU * (180 * Math.pow(6, p))) / SR
    out[i] = (f.run(noise(), fc).bp * 1.4 + Math.sin(ph) * 0.12) * p * p
  }
  return out
}

// ─── Tonal voices ───────────────────────────────────────────────────────────

function saw(phase: number, dt: number) {
  return 2 * phase - 1 - polyblep(phase, dt)
}

function bass(midi: number, dur: number, open = 1): Float32Array {
  const n = sec(dur + 0.04)
  const out = new Float32Array(n)
  const f0 = hz(midi)
  const dt = f0 / SR
  const flt = new SVF(0.7)
  let ph = 0
  let sub = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    ph = (ph + dt) % 1
    sub += (TAU * f0) / SR
    const env = Math.min(1, t / 0.004) * (t > dur ? Math.exp(-(t - dur) * 120) : 0.75 + 0.25 * Math.exp(-t * 10))
    const fc = (140 + 850 * Math.exp(-t * 11)) * open
    out[i] = (flt.run(saw(ph, dt), fc).lp * 0.9 + Math.sin(sub) * 0.55) * env
  }
  return out
}

function pad(midis: number[], dur: number, cutoff = 1500, attack = 0.18): [Float32Array, Float32Array] {
  const n = sec(dur + 0.9)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const detunes = [-0.11, -0.04, 0.04, 0.11]
  for (const m of midis) {
    for (let d = 0; d < detunes.length; d++) {
      const f0 = hz(m + detunes[d]!)
      const dt = f0 / SR
      let ph = rand()
      const flt = new SVF(1.1)
      const side = d % 2 === 0 ? L : R
      const other = d % 2 === 0 ? R : L
      for (let i = 0; i < n; i++) {
        const t = i / SR
        ph = (ph + dt) % 1
        const env = Math.min(1, t / attack) * (t > dur ? Math.exp(-(t - dur) * 5) : 1)
        const fc = cutoff * (1 + 0.15 * Math.sin(TAU * 0.25 * t))
        const v = flt.run(saw(ph, dt), fc).lp * env
        side[i] += v * 0.7
        other[i] += v * 0.3
      }
    }
  }
  const norm = 1 / (midis.length * 2.2)
  for (let i = 0; i < n; i++) {
    L[i] *= norm
    R[i] *= norm
  }
  return [L, R]
}

function pluck(midi: number, dur = 0.3): Float32Array {
  const n = sec(dur)
  const out = new Float32Array(n)
  const f0 = hz(midi)
  const dt = f0 / SR
  const flt = new SVF(1.0)
  let ph = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    ph = (ph + dt) % 1
    const osc = saw(ph, dt) * 0.6 + (ph < 0.5 ? 0.4 : -0.4)
    out[i] = flt.run(osc, 400 + 5200 * Math.exp(-t * 16)).lp * Math.exp(-t * 8.5) * Math.min(1, t / 0.002)
  }
  return out
}

function leadNote(midi: number, dur: number): Float32Array {
  const n = sec(dur + 0.12)
  const out = new Float32Array(n)
  const f0 = hz(midi)
  const flt = new SVF(1.2)
  let ph = 0
  let ph2 = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const vib = 1 + (t > 0.14 ? 0.0045 * Math.sin(TAU * 5.6 * t) : 0)
    const f = f0 * vib
    ph = (ph + f / SR) % 1
    ph2 += (TAU * f) / SR
    const env = Math.min(1, t / 0.008) * (t > dur ? Math.exp(-(t - dur) * 30) : 0.85 + 0.15 * Math.exp(-t * 6))
    const osc = saw(ph, f / SR) * 0.55 + Math.sin(ph2) * 0.6
    out[i] = flt.run(osc, 3200).lp * env
  }
  return out
}

function bell(midi: number, dur = 1.8): Float32Array {
  const n = sec(dur)
  const out = new Float32Array(n)
  const f0 = hz(midi)
  const partials: [number, number, number][] = [
    [1, 1, 2.2],
    [2.0, 0.45, 3.5],
    [3.01, 0.22, 5],
    [4.2, 0.12, 8],
  ]
  for (let i = 0; i < n; i++) {
    const t = i / SR
    let v = 0
    for (const [r, a, d] of partials) v += Math.sin(TAU * f0 * r * t) * a * Math.exp(-t * d)
    out[i] = v * Math.min(1, t / 0.002) * 0.6
  }
  return out
}

// ─── UI sound effects ───────────────────────────────────────────────────────

function sfxClick(pitch = 1): Float32Array {
  const n = sec(0.035)
  const out = new Float32Array(n)
  const f = new SVF(1.6)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    out[i] = (f.run(noise(), 4200 * pitch).bp * 1.6 + Math.sin(TAU * 1900 * pitch * t) * 0.35) * Math.exp(-t * 230)
  }
  return out
}

function sfxThock(): Float32Array {
  const n = sec(0.22)
  const out = new Float32Array(n)
  const f = new SVF(1)
  let ph = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    ph += (TAU * (95 + 140 * Math.exp(-t * 28))) / SR
    out[i] = Math.sin(ph) * Math.exp(-t * 20) + f.run(noise(), 2400).lp * Math.exp(-t * 90) * 0.7
  }
  return out
}

function sfxWhoosh(len = 0.6, lo = 500, hi = 3200): [Float32Array, Float32Array] {
  const n = sec(len)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const f = new SVF(0.8)
  for (let i = 0; i < n; i++) {
    const p = i / n
    const shape = Math.sin(Math.PI * Math.pow(p, 0.7))
    const fc = lo + (hi - lo) * Math.sin(Math.PI * p)
    const v = f.run(noise(), fc).bp * shape * shape * 1.6
    L[i] = v * (1 - p * 0.7)
    R[i] = v * (0.3 + p * 0.7)
  }
  return [L, R]
}

function sfxPop(): Float32Array {
  const n = sec(0.14)
  const out = new Float32Array(n)
  let ph = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    ph += (TAU * (520 + 620 * (1 - Math.exp(-t * 60)))) / SR
    out[i] = (Math.sin(ph) + Math.sin(ph * 2) * 0.2) * Math.exp(-t * 32) * Math.min(1, t / 0.001)
  }
  return out
}

function sfxTick(): Float32Array {
  const n = sec(0.05)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    out[i] = (Math.sin(TAU * 2350 * t) * 0.7 + Math.sin(TAU * 4700 * t) * 0.25) * Math.exp(-t * 95)
  }
  return out
}

function sfx_(type: SfxType, at: number, gain: number) {
  switch (type) {
    case 'click':
    case 'backspace': {
      const s = sfxClick(type === 'backspace' ? 0.55 : 0.85 + rand() * 0.35)
      add(sfx, at, s, 0.24 * gain, (rand() - 0.5) * 0.3)
      break
    }
    case 'thock':
      add(sfx, at, sfxThock(), 0.5 * gain)
      break
    case 'whoosh': {
      const [L, R] = sfxWhoosh(0.65, 400, 2600)
      addStereo(sfx, at - sec(0.18), L, R, 0.22 * gain)
      break
    }
    case 'swoosh': {
      const [L, R] = sfxWhoosh(0.32, 1200, 5200)
      addStereo(sfx, at - sec(0.06), L, R, 0.16 * gain)
      break
    }
    case 'pop':
      add(sfx, at, sfxPop(), 0.28 * gain)
      add(verbSend, at, sfxPop(), 0.08 * gain)
      break
    case 'tick':
      add(sfx, at, sfxTick(), 0.09 * gain, (rand() - 0.5) * 0.4)
      break
    case 'chime':
      for (const [m, d] of [
        [88, 0],
        [95, 0.09],
        [100, 0.18],
      ] as const) {
        const b = bell(m)
        add(sfx, at + sec(d), b, 0.11 * gain, (m - 95) / 12)
        add(verbSend, at + sec(d), b, 0.12 * gain)
      }
      break
    case 'success':
      for (const [m, d] of [
        [84, 0],
        [91, 0.07],
      ] as const) {
        const b = bell(m, 0.6)
        add(sfx, at + sec(d), b, 0.1 * gain)
        add(verbSend, at + sec(d), b, 0.08 * gain)
      }
      break
    case 'impact':
      add(sfx, at, subBoom(), 0.55 * gain)
      break
  }
}

// ─── Arrangement ────────────────────────────────────────────────────────────

const CHORDS = [
  { root: 36, notes: [60, 64, 67, 74] }, // C add9
  { root: 31, notes: [59, 62, 67, 74] }, // G/B
  { root: 33, notes: [57, 60, 64, 72] }, // Am
  { root: 29, notes: [57, 60, 65, 72] }, // F/A
]

// The hook: four bars of 8th notes. null = rest, -1 = hold the previous note.
const HOOK: (number | null | -1)[][] = [
  [76, 79, 81, 79, 76, 74, 72, 74],
  [74, -1, 79, -1, 83, 81, 79, -1],
  [84, 83, 81, 79, 76, -1, 81, -1],
  [81, 79, 77, 76, 72, -1, 74, -1],
]

const TOTAL_BARS = Math.ceil(DURATION / BAR)
const kickSig = kick()
const clapSig = clap()
const hatC = hat(false)
const hatO = hat(true)

function addKick(at: number, gain = 1) {
  add(drums, at, kickSig, 0.7 * gain)
  // Sidechain: duck the music bus right after each kick.
  const n = sec(0.42)
  for (let i = 0; i < n && at + i < N; i++) {
    const t = i / SR
    const d = 1 - 0.58 * Math.exp(-t * 9) * Math.min(1, t / 0.004 + 0.4)
    duck[at + i] = Math.min(duck[at + i]!, d)
  }
}

for (let b = 0; b < TOTAL_BARS; b++) {
  const t0 = b * BAR_S
  const at = sec(t0)
  const chord = CHORDS[b % 4]!

  const intro = b <= 2
  const breakdown = b >= 20 && b <= 23
  const build = b === 24 || b === 25
  const finale = b === 36
  const tail = b >= 37
  const groove = !intro && !breakdown && !finale && !tail
  const withLead = (b >= 26 && b <= 32) || b === 35

  if (tail) continue

  // Pads
  if (finale) {
    const [L, R] = pad([...chord.notes, 79, 84].map((m) => m), BAR_S * 1.5, 2600, 0.01)
    addStereo(music, at, L, R, 0.55)
    addStereo(verbSend, at, L, R, 0.35)
  } else {
    const cutoff = intro ? 500 + b * 450 : breakdown ? 900 : build ? 1100 + (b - 24) * 900 : 1700
    const [L, R] = pad(chord.notes, BAR_S, cutoff, intro && b === 0 ? 0.9 : 0.15)
    addStereo(music, at, L, R, intro ? 0.62 + b * 0.08 : breakdown ? 0.72 : 0.5)
    addStereo(verbSend, at, L, R, 0.25)
  }

  // Arp (16ths)
  if (!finale && (b >= 1 || intro)) {
    const order = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2]
    for (let s = 0; s < 16; s++) {
      if (b === 0 && s < 8) continue
      const m = chord.notes[order[s]!]! + 12
      const p = pluck(m, 0.28)
      const g = (intro ? 0.1 + b * 0.02 : breakdown ? 0.13 : 0.09) * (s % 4 === 0 ? 1.15 : 1)
      const pos = at + sec(s * STEP16)
      add(music, pos, p, g, s % 2 ? 0.35 : -0.35)
      add(delaySend, pos, p, g * 0.6)
      add(verbSend, pos, p, g * 0.25)
    }
  }

  // Bass
  if (groove || build || (breakdown && b >= 22)) {
    const pattern = breakdown ? [0, null, null, null, 0, null, null, null] : [0, 0, 12, 0, 0, 12, 0, 12]
    for (let s = 0; s < 8; s++) {
      const off = pattern[s]
      if (off == null) continue
      const dur = breakdown ? BAR_S / 2 - 0.05 : BAR_S / 8 - 0.03
      add(music, at + sec((s * BAR_S) / 8), bass(chord.root + 12 + off, dur, breakdown ? 0.6 : 1), 0.34 * (s % 2 ? 0.85 : 1))
    }
  }

  // Drums
  if (groove || (build && b === 25)) {
    for (let k = 0; k < 4; k++) addKick(at + sec((k * BAR_S) / 4))
  }
  if (groove) {
    for (const k of [1, 3]) add(drums, at + sec((k * BAR_S) / 4), clapSig, 0.32, 0.05)
    for (let s = 0; s < 8; s++) {
      if (s % 2 === 1) add(drums, at + sec((s * BAR_S) / 8), hatO, 0.11, 0.25)
      else add(drums, at + sec((s * BAR_S) / 8), hatC, 0.08, -0.2)
    }
    if (b >= 30 && b <= 32) for (let s = 0; s < 16; s++) if (s % 2) add(drums, at + sec(s * STEP16), hatC, 0.05, 0.4)
  }
  if (breakdown) {
    for (let s = 0; s < 8; s++) add(drums, at + sec((s * BAR_S) / 8), hatC, 0.06, s % 2 ? 0.3 : -0.3)
    if (b >= 22) for (const k of [1, 3]) add(drums, at + sec((k * BAR_S) / 4), clapSig, 0.14, 0.05)
  }
  if (build) {
    // Snare roll: 8ths, then 16ths, getting louder.
    const steps = b === 24 ? 8 : 16
    for (let s = 0; s < steps; s++) {
      const p = (b - 24 + s / steps) / 2
      add(drums, at + sec((s * BAR_S) / steps), clapSig, 0.1 + 0.28 * p, (s % 2 ? 0.2 : -0.2) * p)
    }
  }

  // Lead hook
  if (withLead) {
    const bar = HOOK[b % 4]!
    for (let s = 0; s < 8; s++) {
      const m = bar[s]
      if (m == null || m === -1) continue
      let len = 1
      while (s + len < 8 && bar[s + len] === -1) len++
      const note = leadNote(m, (len * BAR_S) / 8 - 0.04)
      const pos = at + sec((s * BAR_S) / 8)
      add(lead, pos, note, 0.13)
      add(delaySend, pos, note, 0.06)
      add(verbSend, pos, note, 0.07)
    }
  }

  // Ear candy: risers into drops, crashes on drops
  if (b === 2) add(music, at, riser(BAR_S), 0.22)
  if (b === 24) add(music, at, riser(BAR_S * 2), 0.2)
  if ([3, 26].includes(b)) {
    add(drums, at, crash(), 0.2, 0.15)
    add(drums, at, subBoom(), 0.3)
  }
  if ([12, 18, 30, 35].includes(b)) add(drums, at, crash(), 0.1, -0.15)
  if (finale) {
    add(drums, at, crash(), 0.24, 0)
    add(drums, at, subBoom(), 0.4)
    addKick(at, 1.1)
    const [L, R] = pad([60, 64, 67, 72, 76, 79], BAR_S * 1.2, 4200, 0.005)
    addStereo(lead, at, L, R, 0.35)
    add(lead, at, leadNote(84, BAR_S * 1.1), 0.12)
    add(verbSend, at, leadNote(84, BAR_S * 1.1), 0.1)
  }
}

for (const cue of allCues()) sfx_(cue.type, sec(cue.frame / FPS), cue.gain)

// ─── Effects ────────────────────────────────────────────────────────────────

function reverb(input: Float32Array, offset: number): Float32Array {
  const out = new Float32Array(N)
  const combs = [1116, 1188, 1277, 1356, 1422, 1491].map((d) => ({ buf: new Float32Array(d + offset), i: 0, store: 0 }))
  const allpasses = [556, 441, 341].map((d) => ({ buf: new Float32Array(d + offset), i: 0 }))
  const feedback = 0.86
  const damp = 0.22
  for (let n = 0; n < N; n++) {
    const x = input[n]! * 0.02
    let acc = 0
    for (const c of combs) {
      const y = c.buf[c.i]!
      c.store = y * (1 - damp) + c.store * damp
      c.buf[c.i] = x + c.store * feedback
      c.i = (c.i + 1) % c.buf.length
      acc += y
    }
    for (const a of allpasses) {
      const y = a.buf[a.i]!
      a.buf[a.i] = acc + y * 0.5
      acc = y - acc
      a.i = (a.i + 1) % a.buf.length
    }
    out[n] = acc
  }
  return out
}

function pingPong(L: Float32Array, R: Float32Array) {
  const d = sec(0.375)
  const outL = new Float32Array(N)
  const outR = new Float32Array(N)
  const fb = 0.38
  for (let n = 0; n < N; n++) {
    const dl = n >= d ? outR[n - d]! * fb : 0
    const dr = n >= d ? outL[n - d]! * fb : 0
    outL[n] = (n >= d ? L[n - d]! : 0) + dl * 0.9
    outR[n] = dr * 0.95 + (n >= d ? R[n - d]! * 0.3 : 0)
  }
  return [outL, outR] as const
}

const verbL = reverb(verbSend.L, 0)
const verbR = reverb(verbSend.R, 23)
const [dlyL, dlyR] = pingPong(delaySend.L, delaySend.R)

// ─── Mix & master ───────────────────────────────────────────────────────────

const outL = new Float32Array(N)
const outR = new Float32Array(N)
const endFade = sec(DURATION / FPS - 0.5)
for (let n = 0; n < N; n++) {
  const d = duck[n]!
  let l = drums.L[n]! + (music.L[n]! + dlyL[n]! * 0.55) * d + lead.L[n]! * (0.85 + 0.15 * d) + verbL[n]! * 1.1 + sfx.L[n]!
  let r = drums.R[n]! + (music.R[n]! + dlyR[n]! * 0.55) * d + lead.R[n]! * (0.85 + 0.15 * d) + verbR[n]! * 1.1 + sfx.R[n]!
  // Fade in over 40 ms, fade out after the picture ends.
  const fade = Math.min(1, n / sec(0.04)) * (n > endFade ? Math.max(0, 1 - (n - endFade) / sec(TAIL + 0.5)) : 1)
  l *= fade
  r *= fade
  outL[n] = Math.tanh(l * 1.25) / Math.tanh(1.25)
  outR[n] = Math.tanh(r * 1.25) / Math.tanh(1.25)
}

let peak = 0
for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(outL[n]!), Math.abs(outR[n]!))
const norm = 0.8 / peak

// ─── WAV ────────────────────────────────────────────────────────────────────

const bytes = N * 4
const wav = Buffer.alloc(44 + bytes)
wav.write('RIFF', 0)
wav.writeUInt32LE(36 + bytes, 4)
wav.write('WAVE', 8)
wav.write('fmt ', 12)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(2, 22)
wav.writeUInt32LE(SR, 24)
wav.writeUInt32LE(SR * 4, 28)
wav.writeUInt16LE(4, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(bytes, 40)
for (let n = 0; n < N; n++) {
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, outL[n]! * norm)) * 32767), 44 + n * 4)
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, outR[n]! * norm)) * 32767), 46 + n * 4)
}
const file = join(import.meta.dir, '..', 'public', 'soundtrack.wav')
writeFileSync(file, wav)
console.log(`soundtrack.wav: ${(N / SR).toFixed(1)}s, peak before normalize ${peak.toFixed(2)}, ${allCues().length} sound effects`)
