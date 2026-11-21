import type { ScopedStorage } from './types.js'

interface Entry {
  /** Use count. */
  c: number
  /** Last used (ms). */
  t: number
}

const HALF_LIFE = 1000 * 60 * 60 * 24 * 3 // 3 days
const NEG_LN2_OVER_HALF_LIFE = -Math.LN2 / HALF_LIFE
const MAX_ENTRIES = 200

/**
 * Tracks how often and how recently items are used, to rank them higher
 * and show them as "Recent".
 */
export class Frecency {
  private entries: Record<string, Entry>
  private size = 0

  constructor(private storage: ScopedStorage) {
    this.entries = Object.create(null) as Record<string, Entry>
    const raw = storage.get<Record<string, Entry>>('frecency')
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw)) {
        if (v && typeof v === 'object' && Number.isFinite(v.c) && Number.isFinite(v.t)) {
          this.entries[k] = { c: v.c, t: v.t }
          this.size++
        }
      }
    }
  }

  record(id: string) {
    let e = this.entries[id]
    if (!e) {
      e = { c: 0, t: 0 }
      this.entries[id] = e
      this.size++
    }
    e.c++
    e.t = Date.now()
    if (this.size > MAX_ENTRIES) {
      const keys = Object.keys(this.entries)
      keys.sort((a, b) => this.entries[a]!.t - this.entries[b]!.t)
      const drop = keys.length - MAX_ENTRIES
      for (let i = 0; i < drop; i++) delete this.entries[keys[i]!]
      this.size = MAX_ENTRIES
    }
    this.storage.set('frecency', this.entries)
  }

  /** A score in [0, 1). */
  score(id: string, now = Date.now()): number {
    const e = this.entries[id]
    if (!e) return 0
    const decay = Math.exp((now - e.t) * NEG_LN2_OVER_HALF_LIFE)
    const raw = Math.log2(1 + e.c) * decay
    return raw / (1 + raw)
  }

  /** Ids sorted by score, best first. */
  top(limit: number): string[] {
    const now = Date.now()
    const scored: [string, number][] = []
    for (const id in this.entries) {
      const s = this.score(id, now)
      if (s > 0.02) scored.push([id, s])
    }
    scored.sort((a, b) => b[1] - a[1])
    return scored.slice(0, limit).map(([id]) => id)
  }

  clear() {
    this.entries = Object.create(null) as Record<string, Entry>
    this.size = 0
    this.storage.remove('frecency')
  }
}
