import type { ScopedStorage } from './types.js'

interface Entry {
  /** Use count. */
  c: number
  /** Last used (ms). */
  t: number
}

const HALF_LIFE = 1000 * 60 * 60 * 24 * 3 // 3 days
const MAX_ENTRIES = 200

/**
 * Tracks how often and how recently items are used, to rank them higher
 * and show them as "Recent".
 */
export class Frecency {
  private entries: Record<string, Entry>

  constructor(private storage: ScopedStorage) {
    this.entries = storage.get<Record<string, Entry>>('frecency') ?? {}
  }

  record(id: string) {
    const e = this.entries[id] ?? { c: 0, t: 0 }
    e.c++
    e.t = Date.now()
    this.entries[id] = e
    const keys = Object.keys(this.entries)
    if (keys.length > MAX_ENTRIES) {
      keys.sort((a, b) => this.entries[a]!.t - this.entries[b]!.t)
      for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete this.entries[k]
    }
    this.storage.set('frecency', this.entries)
  }

  /** A score in [0, 1). */
  score(id: string): number {
    const e = this.entries[id]
    if (!e) return 0
    const decay = Math.pow(0.5, (Date.now() - e.t) / HALF_LIFE)
    const raw = Math.log2(1 + e.c) * decay
    return raw / (1 + raw)
  }

  /** Ids sorted by score, best first. */
  top(limit: number): string[] {
    return Object.keys(this.entries)
      .map((id) => [id, this.score(id)] as const)
      .filter(([, s]) => s > 0.02)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id)
  }

  clear() {
    this.entries = {}
    this.storage.remove('frecency')
  }
}
