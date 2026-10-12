/**
 * One timeline drives both the picture and the soundtrack.
 * 30 fps, 120 BPM: one beat = 15 frames, one bar = 60 frames.
 * Scene cuts land on bar lines so they hit the music.
 */
export const FPS = 30
export const BEAT = 15
export const BAR = 60

export const SCENES = {
  intro: { start: 0, len: 180 },
  hotkey: { start: 180, len: 120 },
  search: { start: 300, len: 240 },
  sources: { start: 540, len: 180 },
  actions: { start: 720, len: 180 },
  views: { start: 900, len: 300 },
  ai: { start: 1200, len: 360 },
  extensions: { start: 1560, len: 240 },
  themes: { start: 1800, len: 180 },
  stats: { start: 1980, len: 120 },
  outro: { start: 2100, len: 180 },
} as const

export type SceneName = keyof typeof SCENES
export const DURATION = 2280

export type SfxType = 'click' | 'thock' | 'whoosh' | 'swoosh' | 'pop' | 'chime' | 'tick' | 'impact' | 'success' | 'backspace'

export interface Cue {
  scene: SceneName
  /** Frame within the scene. */
  f: number
  type: SfxType
  gain?: number
}

/** A typing animation: which text is visible at each frame, plus a click per keystroke. */
export interface Typing {
  scene: SceneName
  text: string
  start: number
  speed: number
  end: number
  at(frame: number): string
}

export function typing(scene: SceneName, text: string, start: number, speed = 3): Typing {
  return {
    scene,
    text,
    start,
    speed,
    end: start + text.length * speed,
    at(frame) {
      if (frame < start) return ''
      return text.slice(0, Math.min(text.length, Math.floor((frame - start) / speed) + 1))
    },
  }
}

// ─── Typing schedules (frames are local to their scene) ─────────────────────

export const TYPE = {
  searchInv: typing('search', 'inv', 24, 5),
  searchTdm: typing('search', 'tdm', 112, 5),
  sourcesAcme: typing('sources', 'acme', 10, 4),
  formTitle: typing('views', 'Checkout button misaligned', 222, 2),
  aiPrompt: typing('ai', 'take me to billing for acme', 10, 2),
  extUsd: typing('extensions', '100 usd to eur', 120, 2),
  extWeather: typing('extensions', 'weather in tokyo', 176, 2),
  outroInstall: typing('outro', 'npm install @qikbar/qikbar', 40, 2),
} as const

/** Backspacing: visible text shrinks one char per `speed` frames. */
export function erase(text: string, start: number, speed: number, frame: number): string {
  if (frame < start) return text
  return text.slice(0, Math.max(0, text.length - Math.floor((frame - start) / speed) - 1))
}

// ─── Hand-placed cues ───────────────────────────────────────────────────────

export const CUES: Cue[] = [
  // Intro
  { scene: 'intro', f: 4, type: 'whoosh', gain: 0.8 },
  { scene: 'intro', f: 27, type: 'thock', gain: 1 },
  { scene: 'intro', f: 38, type: 'pop', gain: 0.6 },
  { scene: 'intro', f: 72, type: 'swoosh', gain: 0.7 },
  { scene: 'intro', f: 126, type: 'tick' },
  { scene: 'intro', f: 132, type: 'tick' },
  { scene: 'intro', f: 138, type: 'tick' },
  // ⌘K
  { scene: 'hotkey', f: 0, type: 'impact', gain: 1 },
  { scene: 'hotkey', f: 16, type: 'thock', gain: 1 },
  { scene: 'hotkey', f: 26, type: 'thock', gain: 1 },
  { scene: 'hotkey', f: 36, type: 'whoosh', gain: 0.9 },
  // Search
  { scene: 'search', f: 92, type: 'backspace' },
  { scene: 'search', f: 96, type: 'backspace' },
  { scene: 'search', f: 100, type: 'backspace' },
  { scene: 'search', f: 178, type: 'click', gain: 1.2 },
  { scene: 'search', f: 182, type: 'success' },
  // Sources
  { scene: 'sources', f: 52, type: 'pop', gain: 0.5 },
  { scene: 'sources', f: 58, type: 'pop', gain: 0.45 },
  { scene: 'sources', f: 64, type: 'pop', gain: 0.4 },
  { scene: 'sources', f: 112, type: 'tick' },
  { scene: 'sources', f: 132, type: 'tick' },
  // Actions
  { scene: 'actions', f: 22, type: 'pop', gain: 0.8 },
  { scene: 'actions', f: 60, type: 'tick' },
  { scene: 'actions', f: 76, type: 'tick' },
  { scene: 'actions', f: 98, type: 'click', gain: 1.2 },
  { scene: 'actions', f: 102, type: 'success' },
  // Views
  { scene: 'views', f: 0, type: 'swoosh', gain: 0.8 },
  { scene: 'views', f: 40, type: 'tick' },
  { scene: 'views', f: 52, type: 'tick' },
  { scene: 'views', f: 64, type: 'tick' },
  { scene: 'views', f: 100, type: 'swoosh', gain: 0.8 },
  { scene: 'views', f: 200, type: 'swoosh', gain: 0.8 },
  { scene: 'views', f: 280, type: 'click', gain: 1.2 },
  { scene: 'views', f: 284, type: 'success' },
  // AI
  { scene: 'ai', f: 82, type: 'click', gain: 1.2 },
  { scene: 'ai', f: 84, type: 'swoosh', gain: 0.8 },
  { scene: 'ai', f: 92, type: 'pop', gain: 0.5 },
  { scene: 'ai', f: 130, type: 'tick' },
  { scene: 'ai', f: 168, type: 'tick' },
  { scene: 'ai', f: 268, type: 'chime' },
  { scene: 'ai', f: 330, type: 'whoosh', gain: 0.7 },
  // Extensions
  { scene: 'extensions', f: 0, type: 'impact', gain: 0.9 },
  { scene: 'extensions', f: 10, type: 'swoosh', gain: 0.7 },
  { scene: 'extensions', f: 104, type: 'whoosh', gain: 0.6 },
  { scene: 'extensions', f: 152, type: 'pop', gain: 0.8 },
  { scene: 'extensions', f: 166, type: 'backspace' },
  { scene: 'extensions', f: 212, type: 'pop', gain: 0.8 },
  // Themes (a tick on every theme change)
  ...Array.from({ length: 9 }, (_, i): Cue => ({ scene: 'themes', f: 30 + i * 16, type: 'tick', gain: 0.9 })),
  // Stats
  { scene: 'stats', f: 8, type: 'thock', gain: 0.9 },
  { scene: 'stats', f: 20, type: 'thock', gain: 0.9 },
  { scene: 'stats', f: 32, type: 'thock', gain: 0.9 },
  { scene: 'stats', f: 44, type: 'thock', gain: 0.9 },
  // Outro
  { scene: 'outro', f: 4, type: 'whoosh', gain: 0.8 },
  { scene: 'outro', f: 26, type: 'thock', gain: 0.9 },
  { scene: 'outro', f: 100, type: 'click', gain: 1.1 },
  { scene: 'outro', f: 120, type: 'chime', gain: 1 },
]

/** Every cue in absolute frames, including a click per typed character. */
export function allCues(): { frame: number; type: SfxType; gain: number }[] {
  const out: { frame: number; type: SfxType; gain: number }[] = []
  for (const c of CUES) out.push({ frame: SCENES[c.scene].start + c.f, type: c.type, gain: c.gain ?? 1 })
  for (const t of Object.values(TYPE)) {
    for (let i = 0; i < t.text.length; i++) {
      if (t.text[i] === ' ' && i % 2) continue
      out.push({ frame: SCENES[t.scene].start + t.start + i * t.speed, type: 'click', gain: 0.55 + ((i * 7) % 5) * 0.06 })
    }
  }
  return out.sort((a, b) => a.frame - b.frame)
}
