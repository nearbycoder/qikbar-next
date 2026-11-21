/**
 * A small, fast fuzzy matcher tuned for command palettes.
 *
 * It favours matches at word boundaries, camelCase humps and consecutive runs
 * ("gs" → "**G**it **S**tatus", "set" → "**Set**tings"), runs in linear time
 * per field and needs no index build step.
 */

import type { Item } from './types.js'

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

// ASCII character class bitmask table: 1 = separator, 2 = digit, 4 = lower, 8 = upper.
const CHAR_SEP = 1
const CHAR_DIGIT = 2
const CHAR_LOWER = 4
const CHAR_UPPER = 8
const CHAR_TYPE = new Uint8Array(128)
for (const ch of ' -_./:\\([{},@#"\'>|+&') CHAR_TYPE[ch.charCodeAt(0)] = CHAR_SEP
for (let c = 48; c <= 57; c++) CHAR_TYPE[c] = CHAR_DIGIT
for (let c = 97; c <= 122; c++) CHAR_TYPE[c] = CHAR_LOWER
for (let c = 65; c <= 90; c++) CHAR_TYPE[c] = CHAR_UPPER

// eslint-disable-next-line no-control-regex
const NON_ASCII_RE = /[^\u0000-\u007f]/
const DIACRITICS_RE = /[\u0300-\u036f]/g

/** Lowercase and strip diacritics, keeping indices aligned with the original string. */
export function normalize(text: string): string {
  const lower = text.toLowerCase()
  // Fast path for ASCII.
  if (!NON_ASCII_RE.test(lower)) return lower
  const stripped = lower.normalize('NFD').replace(DIACRITICS_RE, '')
  return stripped.length === lower.length ? stripped : lower
}

function charBonus(target: string, index: number): number {
  if (index === 0) return BONUS_FIRST
  const prevCode = target.charCodeAt(index - 1)
  const prevType = prevCode < 128 ? CHAR_TYPE[prevCode]! : 0
  if (prevType & CHAR_SEP) return BONUS_BOUNDARY
  const chCode = target.charCodeAt(index)
  const chType = chCode < 128 ? CHAR_TYPE[chCode]! : 0
  if (prevCode < 128 && chCode < 128) {
    if (prevType & CHAR_LOWER && chType & CHAR_UPPER) return BONUS_CAMEL
    if (chType & CHAR_DIGIT && !(prevType & CHAR_DIGIT)) return BONUS_BOUNDARY / 2
    return 0
  }
  const prev = target[index - 1]!
  const ch = target[index]!
  if (prev !== prev.toUpperCase() && ch !== ch.toLowerCase()) return BONUS_CAMEL
  if (chType & CHAR_DIGIT && !(prevType & CHAR_DIGIT)) return BONUS_BOUNDARY / 2
  return 0
}

function scorePositions(query: string, target: string, positions: ArrayLike<number>, len = positions.length): number {
  let score = 0
  let prev = -2
  let streak = 0
  for (let k = 0; k < len; k++) {
    const p = positions[k]!
    let s = SCORE_MATCH + charBonus(target, p)
    if (p === prev + 1) {
      streak++
      s += BONUS_CONSECUTIVE + (streak < 3 ? streak : 3)
    } else {
      streak = 0
      if (k > 0) {
        const gap = p - prev - 1
        s -= PENALTY_GAP_START + PENALTY_GAP_EXTENSION * (gap - 1 < 12 ? gap - 1 : 12)
      }
    }
    if (target.charCodeAt(p) === query.charCodeAt(k)) s += 1
    score += s
    prev = p
  }
  return score
}

function scoreContiguous(query: string, target: string, start: number, len: number): number {
  let score = 0
  for (let k = 0; k < len; k++) {
    const p = start + k
    let s = SCORE_MATCH + charBonus(target, p)
    if (k > 0) s += BONUS_CONSECUTIVE + (k < 3 ? k : 3)
    if (target.charCodeAt(p) === query.charCodeAt(k)) s += 1
    score += s
  }
  return score
}

function rangeArray(start: number, len: number): number[] {
  const out = new Array<number>(len)
  for (let i = 0; i < len; i++) out[i] = start + i
  return out
}

const EMPTY_POSITIONS: number[] = []
const SCRATCH_CAP = 64
const scratchA = new Int32Array(SCRATCH_CAP)
const scratchB = new Int32Array(SCRATCH_CAP)

/**
 * Match `query` against `target`.
 * `query` must already be normalized (see `normalize`); `targetNorm` defaults to `normalize(target)`.
 */
export function fuzzyMatch(query: string, target: string, targetNorm: string = normalize(target)): FuzzyMatch | null {
  const m = query.length
  const n = targetNorm.length
  if (m === 0) return { score: 0, positions: EMPTY_POSITIONS }
  if (m > n) return null

  if (m === n && targetNorm === query) {
    return { score: 1, positions: rangeArray(0, m) }
  }

  // Fast path for single-character queries (the first keystroke of every search).
  if (m === 1) {
    const q0 = query.charCodeAt(0)
    let bestIdx = -1
    let bestScore = -1
    let bestBonus = 0
    for (let i = 0; i < n; i++) {
      if (targetNorm.charCodeAt(i) !== q0) continue
      const bonus = charBonus(target, i)
      const s = SCORE_MATCH + bonus + (target.charCodeAt(i) === q0 ? 1 : 0)
      if (s > bestScore) {
        bestScore = s
        bestIdx = i
        bestBonus = bonus
        if (bonus === BONUS_FIRST && s === SCORE_MATCH + BONUS_FIRST + 1) break
      }
    }
    if (bestIdx < 0) return null
    const lengthPenalty = Math.min((n - 1) * 0.15, 6)
    let score = (bestScore - lengthPenalty) / MAX_PER_CHAR
    if (bestBonus === 0) score *= 0.72
    score = Math.max(0.01, Math.min(0.99, score))
    return { score, positions: [bestIdx] }
  }

  // 1. Forward pass: is the query a subsequence? Find the earliest end.
  let qi = 0
  let qch = query.charCodeAt(0)
  let end = -1
  for (let i = 0; i < n; i++) {
    if (targetNorm.charCodeAt(i) === qch) {
      qi++
      if (qi === m) {
        end = i
        break
      }
      qch = query.charCodeAt(qi)
    }
  }
  if (end < 0) return null

  // 2. Backward pass from `end` to find the tightest start.
  qi = m - 1
  qch = query.charCodeAt(qi)
  let start = end
  for (let i = end; i >= 0; i--) {
    if (targetNorm.charCodeAt(i) === qch) {
      qi--
      if (qi < 0) {
        start = i
        break
      }
      qch = query.charCodeAt(qi)
    }
  }

  // 3. Greedy forward passes from the tight window and from word boundaries,
  //    preferring boundary characters. Keep the best without per-try array allocations.
  const useScratch = m <= SCRATCH_CAP
  let bestBuf: Int32Array | number[] = useScratch ? scratchA : new Array<number>(m)
  let candBuf: Int32Array | number[] = useScratch ? scratchB : new Array<number>(m)
  let hasBest = greedyFrom(query, target, targetNorm, start, bestBuf)
  let best = hasBest ? scorePositions(query, target, bestBuf, m) : -Infinity
  let tries = 0
  const q0 = query.charCodeAt(0)
  const limit = n - m + 1
  for (let i = 0; i < limit && tries < 4; i++) {
    if (i === start || targetNorm.charCodeAt(i) !== q0 || charBonus(target, i) === 0) continue
    tries++
    if (!greedyFrom(query, target, targetNorm, i, candBuf)) continue
    const s = scorePositions(query, target, candBuf, m)
    if (s > best) {
      best = s
      hasBest = true
      const tmp = bestBuf
      bestBuf = candBuf
      candBuf = tmp
    }
  }
  if (!hasBest) return null

  // 4. Contiguous substring matches often beat scattered ones; check the first few without allocating.
  let bestContigStart = -1
  let idx = targetNorm.indexOf(query)
  for (let t = 0; idx >= 0 && t < 4; t++) {
    const s = scoreContiguous(query, target, idx, m)
    if (s > best) {
      best = s
      bestContigStart = idx
    }
    idx = targetNorm.indexOf(query, idx + 1)
  }

  let bestPositions: number[]
  if (bestContigStart >= 0) {
    bestPositions = rangeArray(bestContigStart, m)
  } else if (useScratch) {
    bestPositions = new Array<number>(m)
    for (let k = 0; k < m; k++) bestPositions[k] = bestBuf[k]!
  } else {
    bestPositions = bestBuf as number[]
  }

  // Prefer shorter targets slightly.
  const lengthPenalty = Math.min((n - m) * 0.15, 6)
  let score = (best - lengthPenalty) / (m * MAX_PER_CHAR)
  // Each run of matched characters that starts mid-word is a weak signal
  // ("set" in "Use SysTEm Theme"); acronyms and word prefixes are not.
  for (let k = 0; k < m; k++) {
    const p = bestPositions[k]!
    if ((k === 0 || p !== bestPositions[k - 1]! + 1) && charBonus(target, p) === 0) score *= 0.72
  }
  score = Math.max(0.01, Math.min(0.99, score))
  return { score, positions: bestPositions }
}

function greedyFrom(query: string, target: string, targetNorm: string, start: number, positions: Int32Array | number[]): boolean {
  const m = query.length
  const n = targetNorm.length
  let qi = 0
  let qch = query.charCodeAt(0)
  for (let i = start; i < n && qi < m; i++) {
    if (targetNorm.charCodeAt(i) !== qch) continue
    // Not at a boundary and not continuing a run: jump to a later boundary match if one fits.
    if (qi > 0 && charBonus(target, i) === 0 && i !== positions[qi - 1]! + 1) {
      const better = findBoundary(targetNorm, target, query, qi, i + 1)
      if (better >= 0) i = better
    }
    positions[qi] = i
    qi++
    if (qi < m) qch = query.charCodeAt(qi)
  }
  return qi === m
}

function findBoundary(targetNorm: string, target: string, query: string, qi: number, from: number): number {
  const ch = query.charCodeAt(qi)
  const m = query.length
  const n = targetNorm.length
  const maxJ = n - (m - qi)
  for (let j = from; j <= maxJ; j++) {
    if (targetNorm.charCodeAt(j) === ch && charBonus(target, j) > 0) {
      // Ensure the rest of the query still fits after j.
      let k = qi + 1
      if (k === m) return j
      let kch = query.charCodeAt(k)
      for (let t = j + 1; t < n; t++) {
        if (targetNorm.charCodeAt(t) === kch) {
          k++
          if (k === m) return j
          kch = query.charCodeAt(k)
        }
      }
      return -1
    }
  }
  return -1
}

// ─── Item ranking ───────────────────────────────────────────────────────────

/** Bitmask of the letters/digits in a string, for fast rejection. */
function charMask(s: string, m = 0): number {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c >= 97 && c <= 122) m |= 1 << (c - 97)
    else if (c >= 48 && c <= 57) m |= 1 << 26
  }
  return m
}

interface Prepared {
  mask: number
  titleMask: number
  subtitleMask: number
  sectionMask: number
  keywordMasks: number[]
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
    const titleNorm = normalize(item.title)
    const subtitle = item.subtitle ? normalize(item.subtitle) : ''
    const section = item.section ? normalize(item.section) : ''
    const description = item.description ? normalize(item.description) : ''
    const rawKw = item.keywords
    const kwLen = rawKw ? rawKw.length : 0
    const keywords = kwLen ? new Array<string>(kwLen) : []
    const keywordMasks = kwLen ? new Array<number>(kwLen) : []
    const titleMask = charMask(titleNorm)
    const subtitleMask = subtitle ? charMask(subtitle) : 0
    const sectionMask = section ? charMask(section) : 0
    let mask = titleMask | subtitleMask | sectionMask
    for (let i = 0; i < kwLen; i++) {
      const kw = normalize(rawKw![i]!)
      keywords[i] = kw
      const km = charMask(kw)
      keywordMasks[i] = km
      mask |= km
    }
    if (description) mask = charMask(description, mask)
    p = {
      mask,
      titleMask,
      subtitleMask,
      sectionMask,
      keywordMasks,
      title: item.title,
      titleNorm,
      subtitle,
      keywords,
      section,
      description,
    }
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
  if (!q) return { score: 0, positions: EMPTY_POSITIONS }
  const tokens = q.split(/\s+/).filter(Boolean)
  const tokenMasks = tokens.map((t) => charMask(t))
  return matchPrepared(item, q, tokens, charMask(q), tokenMasks)
}

function mergePositions(a: number[], b: number[]): number[] {
  const out: number[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const x = a[i]!
    const y = b[j]!
    if (x < y) {
      out.push(x)
      i++
    } else if (y < x) {
      out.push(y)
      j++
    } else {
      out.push(x)
      i++
      j++
    }
  }
  while (i < a.length) out.push(a[i++]!)
  while (j < b.length) out.push(b[j++]!)
  return out
}

function matchPrepared(item: Item, q: string, tokens: string[], qm: number, tokenMasks: number[]): ItemMatch | null {
  const p = prepare(item)
  if ((qm & p.mask) !== qm) return null

  // Whole-query title match first (handles spaces naturally).
  const whole = (qm & p.titleMask) === qm ? fuzzyMatch(q, p.title, p.titleNorm) : null
  const multi = tokens.length > 1

  let tokenScore = 0
  let positions: number[] | undefined
  let tokensMatched = true
  if (multi || !whole) {
    for (let ti = 0; ti < tokens.length; ti++) {
      const token = tokens[ti]!
      const tm = tokenMasks[ti]!
      let best = 0
      // For single-token queries we already know whole === null, so skip re-matching title.
      if (multi && (tm & p.titleMask) === tm) {
        const t = fuzzyMatch(token, p.title, p.titleNorm)
        if (t) {
          best = t.score
          positions = positions ? mergePositions(positions, t.positions) : t.positions
        }
      }
      if (best < 0.88) {
        const kws = p.keywords
        const kmasks = p.keywordMasks
        for (let ki = 0; ki < kws.length; ki++) {
          if ((tm & kmasks[ki]!) !== tm) continue
          const kw = kws[ki]!
          const k = fuzzyMatch(token, kw, kw)
          if (k && k.score * 0.88 > best) {
            best = k.score * 0.88
            if (best >= 0.88) break
          }
        }
      }
      if (best < 0.7 && p.subtitle && (tm & p.subtitleMask) === tm) {
        const s = fuzzyMatch(token, p.subtitle, p.subtitle)
        if (s && s.score * 0.7 > best) best = s.score * 0.7
      }
      if (best < 0.5 && p.section && (tm & p.sectionMask) === tm) {
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
  let finalPositions: number[] = EMPTY_POSITIONS
  if (whole && whole.score >= tokenScore) {
    score = whole.score
    finalPositions = whole.positions
  } else if (tokensMatched && tokenScore > 0) {
    score = tokenScore * 0.95
    if (positions) finalPositions = positions
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

const heapLess = (sA: number, iA: number, sB: number, iB: number) => sA < sB || (sA === sB && iA > iB)

/** Filter and sort items by relevance to `query`. Stable for equal scores. */
export function rank<T extends Item>(items: readonly T[], query: string, options: RankOptions = {}): RankedItem<T>[] {
  const { boost, limit, threshold = 0.05 } = options
  const q = normalize(query.trim())
  if (!q) {
    const out: RankedItem<T>[] = []
    let needSort = false
    let firstScore = 0
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      let score = (item.priority ?? 0) * 0.1
      if (boost) score += boost(item)
      if (i === 0) firstScore = score
      else if (score !== firstScore) needSort = true
      out.push({ item, score, positions: EMPTY_POSITIONS })
    }
    if (needSort) out.sort((a, b) => b.score - a.score)
    return limit ? out.slice(0, limit) : out
  }

  const tokens = q.split(/\s+/).filter(Boolean)
  const qm = charMask(q)
  const tokenMasks = tokens.length === 1 ? [qm] : tokens.map((t) => charMask(t))
  const useHeap = !!limit && limit > 0 && items.length > limit * 2
  const out: RankedItem<T>[] = []
  const hIdx = useHeap ? new Int32Array(limit) : undefined
  let topScore = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    const m = matchPrepared(item, q, tokens, qm, tokenMasks)
    if (!m || m.score < threshold) continue
    let score = m.score + (item.priority ?? 0) * 0.1
    if (boost) score += boost(item)
    if (score > topScore) topScore = score
    if (!useHeap) {
      out.push({ item, score, positions: m.positions })
    } else if (out.length < limit) {
      const entry: RankedItem<T> = { item, score, positions: m.positions }
      let pos = out.length
      out.push(entry)
      while (pos > 0) {
        const parent = (pos - 1) >> 1
        if (!heapLess(score, i, out[parent]!.score, hIdx![parent]!)) break
        out[pos] = out[parent]!
        hIdx![pos] = hIdx![parent]!
        pos = parent
      }
      out[pos] = entry
      hIdx![pos] = i
    } else if (score > out[0]!.score) {
      const entry: RankedItem<T> = { item, score, positions: m.positions }
      let pos = 0
      for (;;) {
        const left = (pos << 1) + 1
        if (left >= limit) break
        const right = left + 1
        const child = right < limit && heapLess(out[right]!.score, hIdx![right]!, out[left]!.score, hIdx![left]!) ? right : left
        if (!heapLess(out[child]!.score, hIdx![child]!, score, i)) break
        out[pos] = out[child]!
        hIdx![pos] = hIdx![child]!
        pos = child
      }
      out[pos] = entry
      hIdx![pos] = i
    }
  }

  const minKeep = q.length >= 3 && topScore >= 0.6 ? topScore * 0.55 : -Infinity
  if (useHeap) {
    const order: number[] = []
    for (let i = 0; i < out.length; i++) if (out[i]!.score >= minKeep) order.push(i)
    order.sort((a, b) => out[b]!.score - out[a]!.score || hIdx![a]! - hIdx![b]!)
    return order.map((k) => out[k]!)
  }
  if (minKeep > 0) {
    let w = 0
    for (let i = 0; i < out.length; i++) if (out[i]!.score >= minKeep) out[w++] = out[i]!
    out.length = w
  }
  out.sort((a, b) => b.score - a.score)
  return limit ? out.slice(0, limit) : out
}
