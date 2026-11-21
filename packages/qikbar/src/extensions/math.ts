/**
 * A safe arithmetic evaluator (no `eval`). Supports + - * / % ^ **, parentheses,
 * implicit multiplication ("2pi", "3(4+1)"), percentages ("15% of 80", "200 + 10%"),
 * constants, common functions and unit conversions ("5 km in miles").
 */

const CONSTANTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 }

const FUNCTIONS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
  floor: Math.floor,
  ceil: Math.ceil,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  log: Math.log10,
  log2: Math.log2,
  ln: Math.log,
  exp: Math.exp,
  min: Math.min,
  max: Math.max,
}

type Token = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'id'; v: string } | { t: '(' } | { t: ')' } | { t: ',' } | { t: '%' }

const hasOwn = Object.prototype.hasOwnProperty
const MAX_EXPR_LENGTH = 512
const MAX_PARSE_DEPTH = 64
const NUM_RE = /(\d[\d_]*(\.\d+)?|\.\d+)(e[+-]?\d+)?/iy
const ID_RE = /[a-zπ][a-z0-9_]*/iy

function tokenize(src: string): Token[] {
  if (src.length > MAX_EXPR_LENGTH) throw new Error('Expression too long')
  const out: Token[] = []
  let i = 0
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
  while (i < s.length) {
    const c = s[i]!
    if (/\s/.test(c)) {
      i++
      continue
    }
    NUM_RE.lastIndex = i
    const num = NUM_RE.exec(s)
    if (num) {
      out.push({ t: 'num', v: parseFloat(num[0].replace(/_/g, '')) })
      i += num[0].length
      continue
    }
    if (s.startsWith('**', i)) {
      out.push({ t: 'op', v: '^' })
      i += 2
      continue
    }
    if ('+-*/^'.includes(c)) {
      out.push({ t: 'op', v: c })
      i++
      continue
    }
    if (c === '%') {
      out.push({ t: '%' })
      i++
      continue
    }
    if (c === '(' || c === ')' || c === ',') {
      out.push({ t: c } as Token)
      i++
      continue
    }
    ID_RE.lastIndex = i
    const id = ID_RE.exec(s)
    if (id) {
      out.push({ t: 'id', v: id[0].toLowerCase() })
      i += id[0].length
      continue
    }
    throw new Error(`Unexpected "${c}"`)
  }
  return out
}

/** Recursive-descent parser. Returns NaN-free numbers or throws. */
class Parser {
  i = 0
  private depth = 0
  constructor(private tokens: Token[]) {}

  private enter() {
    if (++this.depth > MAX_PARSE_DEPTH) throw new Error('Expression too deeply nested')
  }
  private leave() {
    this.depth--
  }

  peek() {
    return this.tokens[this.i]
  }
  next() {
    return this.tokens[this.i++]
  }

  parse(): number {
    const v = this.expr()
    if (this.i < this.tokens.length) throw new Error('Unexpected input')
    return v
  }

  // expr := term (('+'|'-') term ['%'])*
  expr(): number {
    let v = this.term()
    for (;;) {
      const t = this.peek()
      if (t?.t === 'op' && (t.v === '+' || t.v === '-')) {
        this.next()
        const start = this.i
        let rhs = this.term()
        // "200 + 10%" means "200 plus 10% of 200".
        if (this.isBarePercent(start)) rhs = v * rhs
        v = t.v === '+' ? v + rhs : v - rhs
      } else return v
    }
  }

  private isBarePercent(start: number): boolean {
    return this.tokens[start]?.t === 'num' && this.tokens[start + 1]?.t === '%' && this.i === start + 2
  }

  // term := power (('*'|'/'|implicit) power)*
  term(): number {
    let v = this.power()
    for (;;) {
      const t = this.peek()
      if (t?.t === 'op' && (t.v === '*' || t.v === '/')) {
        this.next()
        const rhs = this.power()
        v = t.v === '*' ? v * rhs : v / rhs
      } else if (t && (t.t === 'num' || t.t === '(' || (t.t === 'id' && t.v !== 'of'))) {
        v *= this.power()
      } else if (t?.t === 'id' && t.v === 'of') {
        this.next()
        v *= this.power()
      } else return v
    }
  }

  // power := unary ('^' power)?
  power(): number {
    this.enter()
    try {
      const base = this.unary()
      const t = this.peek()
      if (t?.t === 'op' && t.v === '^') {
        this.next()
        return base ** this.power()
      }
      return base
    } finally {
      this.leave()
    }
  }

  unary(): number {
    const t = this.peek()
    if (t?.t === 'op' && (t.v === '-' || t.v === '+')) {
      this.next()
      this.enter()
      try {
        const v = this.unary()
        return t.v === '-' ? -v : v
      } finally {
        this.leave()
      }
    }
    return this.postfix()
  }

  postfix(): number {
    let v = this.primary()
    while (this.peek()?.t === '%') {
      this.next()
      v /= 100
    }
    return v
  }

  primary(): number {
    const t = this.next()
    if (!t) throw new Error('Unexpected end')
    if (t.t === 'num') return t.v
    if (t.t === '(') {
      this.enter()
      try {
        const v = this.expr()
        if (this.next()?.t !== ')') throw new Error('Missing )')
        return v
      } finally {
        this.leave()
      }
    }
    if (t.t === 'id') {
      if (hasOwn.call(CONSTANTS, t.v)) return CONSTANTS[t.v]!
      const fn = hasOwn.call(FUNCTIONS, t.v) ? FUNCTIONS[t.v] : undefined
      if (fn) {
        if (this.peek()?.t !== '(') return fn(this.power())
        this.next()
        this.enter()
        try {
          const args = [this.expr()]
          while (this.peek()?.t === ',') {
            this.next()
            args.push(this.expr())
          }
          if (this.next()?.t !== ')') throw new Error('Missing )')
          return fn(...args)
        } finally {
          this.leave()
        }
      }
      throw new Error(`Unknown "${t.v}"`)
    }
    throw new Error('Unexpected token')
  }
}

export function evaluate(expression: string): number {
  const v = new Parser(tokenize(expression)).parse()
  if (!Number.isFinite(v)) throw new Error('Not a finite number')
  return v
}

// ─── Units ──────────────────────────────────────────────────────────────────

type Unit = { dim: string; factor: number; label: string }
const U = (dim: string, factor: number, label: string, ...names: string[]) => names.map((n) => [n, { dim, factor, label }] as const)

const UNITS = new Map<string, Unit>([
  ...U('length', 1, 'm', 'm', 'meter', 'meters', 'metre', 'metres'),
  ...U('length', 1000, 'km', 'km', 'kilometer', 'kilometers', 'kilometre', 'kilometres'),
  ...U('length', 0.01, 'cm', 'cm', 'centimeter', 'centimeters'),
  ...U('length', 0.001, 'mm', 'mm', 'millimeter', 'millimeters'),
  ...U('length', 1609.344, 'mi', 'mi', 'mile', 'miles'),
  ...U('length', 0.3048, 'ft', 'ft', 'foot', 'feet'),
  ...U('length', 0.0254, 'in', 'inch', 'inches'),
  ...U('length', 0.9144, 'yd', 'yd', 'yard', 'yards'),
  ...U('mass', 1, 'kg', 'kg', 'kilogram', 'kilograms', 'kilo', 'kilos'),
  ...U('mass', 0.001, 'g', 'g', 'gram', 'grams'),
  ...U('mass', 0.45359237, 'lb', 'lb', 'lbs', 'pound', 'pounds'),
  ...U('mass', 0.028349523125, 'oz', 'oz', 'ounce', 'ounces'),
  ...U('mass', 6.35029318, 'st', 'st', 'stone', 'stones'),
  ...U('data', 1, 'B', 'b', 'byte', 'bytes'),
  ...U('data', 1024, 'KB', 'kb', 'kib', 'kilobyte', 'kilobytes'),
  ...U('data', 1024 ** 2, 'MB', 'mb', 'mib', 'megabyte', 'megabytes'),
  ...U('data', 1024 ** 3, 'GB', 'gb', 'gib', 'gigabyte', 'gigabytes'),
  ...U('data', 1024 ** 4, 'TB', 'tb', 'tib', 'terabyte', 'terabytes'),
  ...U('time', 1, 's', 's', 'sec', 'second', 'seconds'),
  ...U('time', 60, 'min', 'min', 'mins', 'minute', 'minutes'),
  ...U('time', 3600, 'h', 'h', 'hr', 'hrs', 'hour', 'hours'),
  ...U('time', 86400, 'd', 'd', 'day', 'days'),
  ...U('time', 604800, 'wk', 'wk', 'week', 'weeks'),
  ...U('volume', 1, 'L', 'l', 'liter', 'liters', 'litre', 'litres'),
  ...U('volume', 0.001, 'mL', 'ml', 'milliliter', 'milliliters'),
  ...U('volume', 3.785411784, 'gal', 'gal', 'gallon', 'gallons'),
  ...U('volume', 0.2365882365, 'cup', 'cup', 'cups'),
  ...U('temp', 1, '°C', 'c', '°c', 'celsius'),
  ...U('temp', 1, '°F', 'f', '°f', 'fahrenheit'),
  ...U('temp', 1, 'K', 'k', 'kelvin'),
])

function toKelvin(v: number, label: string) {
  return label === '°C' ? v + 273.15 : label === '°F' ? ((v - 32) * 5) / 9 + 273.15 : v
}
function fromKelvin(v: number, label: string) {
  return label === '°C' ? v - 273.15 : label === '°F' ? ((v - 273.15) * 9) / 5 + 32 : v
}

/** "5 km in miles" → { value, unit } or undefined. */
export function convert(input: string): { value: number; unit: string } | undefined {
  const m = input.trim().match(/^(.+?)\s*([a-z°]+)\s+(?:in|to|as|=)\s+([a-z°]+)$/i)
  if (!m) return undefined
  const from = UNITS.get(m[2]!.toLowerCase())
  const to = UNITS.get(m[3]!.toLowerCase())
  if (!from || !to || from.dim !== to.dim) return undefined
  const amount = evaluate(m[1]!)
  if (from.dim === 'temp') return { value: fromKelvin(toKelvin(amount, from.label), to.label), unit: to.label }
  return { value: (amount * from.factor) / to.factor, unit: to.label }
}

export function formatNumber(v: number): string {
  if (Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-6 && v !== 0)) return v.toExponential(6).replace(/\.?0+e/, 'e')
  const rounded = Math.round(v * 1e10) / 1e10
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 10 })
}

/** Heuristic: does the query look like something to calculate? */
export function looksLikeMath(q: string): boolean {
  const s = q.trim()
  if (!s || !/\d|pi|π/.test(s)) return false
  if (/^\d+(\.\d+)?$/.test(s)) return false
  return /[+\-*/^%×÷()]|\b(in|to)\b|\b(sqrt|sin|cos|tan|log|ln|abs|round|of)\b/i.test(s)
}
