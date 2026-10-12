/**
 * A small, fast fuzzy matcher tuned for command palettes.
 *
 * It favours matches at word boundaries, camelCase humps and consecutive runs
 * ("gs" → "**G**it **S**tatus", "set" → "**Set**tings"), runs in linear time
 * per field and needs no index build step.
 */

import type { Item } from './types'

export interface FuzzyMatch {
  /** 0 (bad) … 1 (exact). */
  score: number
  /** Indices of matched characters in the target. */
  positions: number[]
}

const SCORE_MATCH = 16
const BONUS_FIRST = 14
const BONUS_BOUNDARY = 10
const BONUS_CAMEL = 8
const BONUS_CONSECUTIVE = 6
const PENALTY_GAP_START = 3
const PENALTY_GAP_EXTENSION = 1
const MAX_PER_CHAR = SCORE_MATCH + BONUS_FIRST + BONUS_CONSECUTIVE + 1

const SEPARATORS = new Set([' ', '-', '_', '.', '/', ':', '\\', '(', '[', '{', ',', '@', '#', '"', "'", '>', '|', '+', '&'])

/** Lowercase and strip diacritics, keeping indices aligned with the original string. */
export function normalize(text: string): string {
  const lower = text.toLowerCase()
  // Fast path for ASCII.
  // eslint-disable-next-line no-control-regex
  if (!/[^\u0000-\u007f]/.test(lower)) return lower
  const stripped = lower.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return stripped.length === lower.length ? stripped : lower
}

function charBonus(target: string, index: number): number {
  if (index === 0) return BONUS_FIRST
  const prev = target[index - 1]!
  if (SEPARATORS.has(prev)) return BONUS_BOUNDARY
  const ch = target[index]!
  if (prev !== prev.toUpperCase() && ch !== ch.toLowerCase()) return BONUS_CAMEL
  if (/[0-9]/.test(ch) && !/[0-9]/.test(prev)) return BONUS_BOUNDARY / 2
  return 0
}

function scorePositions(query: string, target: string, positions: number[]): number {
  let score = 0
  let prev = -2
  let streak = 0
  for (let k = 0; k < positions.length; k++) {
    const p = positions[k]!
    let s = SCORE_MATCH + charBonus(target, p)
    if (p === prev + 1) {
      streak++
      s += BONUS_CONSECUTIVE + Math.min(streak, 3)
    } else {
      streak = 0
      if (k > 0) {
        const gap = p - prev - 1
        s -= PENALTY_GAP_START + PENALTY_GAP_EXTENSION * Math.min(gap - 1, 12)
      }
    }
    if (target[p] === query[k]) s += 1
    score += s
    prev = p
  }
  return score
}

/**
 * Match `query` against `target`.
 * `query` must already be normalized (see `normalize`); `targetNorm` defaults to `normalize(target)`.
 */
export function fuzzyMatch(query: string, target: string, targetNorm: string = normalize(target)): FuzzyMatch | null {
  const m = query.length
  const n = targetNorm.length
  if (m === 0) return { score: 0, positions: [] }
  if (m > n) return null

  if (targetNorm === query) {
    return { score: 1, positions: Array.from({ length: m }, (_, i) => i) }
  }

  // 1. Forward pass: is the query a subsequence? Find the earliest end.
  let qi = 0
  let end = -1
  for (let i = 0; i < n; i++) {
    if (targetNorm[i] === query[qi]) {
      qi++
      if (qi === m) {
        end = i
        break
      }
    }
  }
  if (end < 0) return null

  // 2. Backward pass from `end` to find the tightest start.
  qi = m - 1
  let start = end
  for (let i = end; i >= 0; i--) {
    if (targetNorm[i] === query[qi]) {
      qi--
      if (qi < 0) {
        start = i
        break
      }
    }
  }

  // 3. Greedy forward passes from the tight window and from word boundaries,
  //    preferring boundary characters. Keep the best.
  let bestPositions = greedyFrom(query, target, targetNorm, start)
  let best = bestPositions ? scorePositions(query, target, bestPositions) : -Infinity
  let tries = 0
  for (let i = 0; i < n - m + 1 && tries < 4; i++) {
    if (i === start || targetNorm[i] !== query[0] || charBonus(target, i) === 0) continue
    tries++
    const candidate = greedyFrom(query, target, targetNorm, i)
    if (!candidate) continue
    const s = scorePositions(query, target, candidate)
    if (s > best) {
      best = s
      bestPositions = candidate
    }
  }
  if (!bestPositions) return null

  // 4. Contiguous substring matches often beat scattered ones; check the first few.
  let idx = targetNorm.indexOf(query)
  for (let t = 0; idx >= 0 && t < 4; t++) {
    const sub = Array.from({ length: m }, (_, i) => idx + i)
    const s = scorePositions(query, target, sub)
    if (s > best) {
      best = s
      bestPositions = sub
    }
    idx = targetNorm.indexOf(query, idx + 1)
  }

  // Prefer shorter targets slightly.
  const lengthPenalty = Math.min((n - m) * 0.15, 6)
  let score = (best - lengthPenalty) / (m * MAX_PER_CHAR)
  // Each run of matched characters that starts mid-word is a weak signal
  // ("set" in "Use SysTEm Theme"); acronyms and word prefixes are not.
  for (let k = 0; k < bestPositions.length; k++) {
    const p = bestPositions[k]!
    if ((k === 0 || p !== bestPositions[k - 1]! + 1) && charBonus(target, p) === 0) score *= 0.72
  }
  score = Math.max(0.01, Math.min(0.99, score))
  return { score, positions: bestPositions }
}

function greedyFrom(query: string, target: string, targetNorm: string, start: number): number[] | null {
  const m = query.length
  const positions: number[] = []
  let qi = 0
  for (let i = start; i < targetNorm.length && qi < m; i++) {
    if (targetNorm[i] !== query[qi]) continue
    // Not at a boundary and not continuing a run: jump to a later boundary match if one fits.
    if (qi > 0 && charBonus(target, i) === 0 && i !== positions[positions.length - 1]! + 1) {
      const better = findBoundary(targetNorm, target, query, qi, i + 1)
      if (better >= 0) i = better
    }
    positions.push(i)
    qi++
  }
  return qi === m ? positions : null
}

function findBoundary(targetNorm: string, target: string, query: string, qi: number, from: number): number {
  const ch = query[qi]
  const remaining = query.length - qi
  for (let j = from; j <= targetNorm.length - remaining; j++) {
    if (targetNorm[j] === ch && charBonus(target, j) > 0) {
      // Ensure the rest of the query still fits after j.
      let k = qi + 1
      for (let t = j + 1; t < targetNorm.length && k < query.length; t++) if (targetNorm[t] === query[k]) k++
      if (k === query.length) return j
      return -1
    }
  }
  return -1
}

// ─── Item ranking ───────────────────────────────────────────────────────────

/** Bitmask of the letters/digits in a string, for fast rejection. */
function charMask(s: string): number {
  let m = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c >= 97 && c <= 122) m |= 1 << (c - 97)
    else if (c >= 48 && c <= 57) m |= 1 << 26
  }
  return m
}

interface Prepared {
  mask: number
  title: string
  titleNorm: string
  subtitle: string
  keywords: string[]
  section: string
  description: string
}

const prepared = new WeakMap<Item, Prepared>()

function prepare(item: Item): Prepared {
  let p = prepared.get(item)
  if (!p || p.title !== item.title) {
    p = {
      mask: 0,
      title: item.title,
      titleNorm: normalize(item.title),
      subtitle: item.subtitle ? normalize(item.subtitle) : '',
      keywords: item.keywords ? item.keywords.map(normalize) : [],
      section: item.section ? normalize(item.section) : '',
      description: item.description ? normalize(item.description) : '',
    }
    p.mask = charMask(`${p.titleNorm} ${p.subtitle} ${p.keywords.join(' ')} ${p.section} ${p.description}`)
    prepared.set(item, p)
  }
  return p
}

export interface ItemMatch {
  score: number
  /** Matched character indices in the title, for highlighting. */
  positions: number[]
}

/** Score an item against a query. Returns null when it doesn't match. */
export function matchItem(item: Item, query: string): ItemMatch | null {
  const q = normalize(query.trim())
  if (!q) return { score: 0, positions: [] }
  return matchPrepared(item, q, q.split(/\s+/).filter(Boolean), charMask(q))
}

function matchPrepared(item: Item, q: string, tokens: string[], qm: number): ItemMatch | null {
  const p = prepare(item)
  if ((qm & p.mask) !== qm) return null

  // Whole-query title match first (handles spaces naturally).
  const whole = fuzzyMatch(q, p.title, p.titleNorm)

  let tokenScore = 0
  const positions = new Set<number>()
  let tokensMatched = true
  if (tokens.length > 1 || !whole) {
    for (const token of tokens) {
      let best = 0
      const t = fuzzyMatch(token, p.title, p.titleNorm)
      if (t) {
        best = t.score
        for (const pos of t.positions) positions.add(pos)
      }
      for (const kw of p.keywords) {
        const k = fuzzyMatch(token, kw, kw)
        if (k && k.score * 0.88 > best) best = k.score * 0.88
      }
      if (p.subtitle) {
        const s = fuzzyMatch(token, p.subtitle, p.subtitle)
        if (s && s.score * 0.7 > best) best = s.score * 0.7
      }
      if (p.section) {
        const s = fuzzyMatch(token, p.section, p.section)
        if (s && s.score * 0.5 > best) best = s.score * 0.5
      }
      if (best === 0 && p.description && token.length > 2 && p.description.includes(token)) best = 0.3
      if (best === 0) {
        tokensMatched = false
        break
      }
      tokenScore += best
    }
    tokenScore /= tokens.length
  }

  let score = 0
  let finalPositions: number[] = []
  if (whole && whole.score >= tokenScore) {
    score = whole.score
    finalPositions = whole.positions
  } else if (tokensMatched && tokenScore > 0) {
    score = tokenScore * 0.95
    finalPositions = [...positions].sort((a, b) => a - b)
  } else if (whole) {
    score = whole.score
    finalPositions = whole.positions
  } else {
    return null
  }

  // Strong prefix bonus.
  if (p.titleNorm.startsWith(q)) score = Math.min(0.995, score + 0.15)
  return { score, positions: finalPositions }
}

export interface RankedItem<T extends Item = Item> {
  item: T
  score: number
  positions: number[]
}

export interface RankOptions {
  /** Extra score per item (e.g. frecency), added after matching. */
  boost?: (item: Item) => number
  limit?: number
  /** Drop matches below this score. Default 0.05. */
  threshold?: number
}

/** Filter and sort items by relevance to `query`. Stable for equal scores. */
export function rank<T extends Item>(items: readonly T[], query: string, options: RankOptions = {}): RankedItem<T>[] {
  const { boost, limit, threshold = 0.05 } = options
  const out: RankedItem<T>[] = []
  const q = normalize(query.trim())
  const tokens = q.split(/\s+/).filter(Boolean)
  const qm = charMask(q)
  for (const item of items) {
    const m = q ? matchPrepared(item, q, tokens, qm) : { score: 0, positions: [] }
    if (!m || (q && m.score < threshold)) continue
    let score = m.score + (item.priority ?? 0) * 0.1
    if (boost) score += boost(item)
    out.push({ item, score, positions: m.positions })
  }
  // Index-stable sort.
  const indexed = out.map((r, i) => [r, i] as const)
  indexed.sort((a, b) => b[0].score - a[0].score || a[1] - b[1])
  let sorted = indexed.map((x) => x[0])
  // With a strong match present, drop scattered low-quality matches.
  const top = sorted[0]?.score ?? 0
  if (q.length >= 3 && top >= 0.6) sorted = sorted.filter((r) => r.score >= top * 0.55)
  return limit ? sorted.slice(0, limit) : sorted
}
