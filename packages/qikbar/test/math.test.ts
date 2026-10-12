import { describe, expect, it } from 'vitest'
import { convert, evaluate } from '../src/extensions/math'

describe('calculator', () => {
  it.each([
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['2 ^ 10', 1024],
    ['2 ** 3 ** 2', 512],
    ['-3 + 5', 2],
    ['10 / 4', 2.5],
    ['15% of 80', 12],
    ['200 + 10%', 220],
    ['200 - 10%', 180],
    ['50%', 0.5],
    ['sqrt(16) + abs(-2)', 6],
    ['2pi', Math.PI * 2],
    ['3(4 + 1)', 15],
    ['max(1, 5, 3)', 5],
    ['1_000 * 2', 2000],
  ])('%s = %d', (expr, value) => {
    expect(evaluate(expr)).toBeCloseTo(value as number, 10)
  })

  it('rejects code', () => {
    expect(() => evaluate('alert(1)')).toThrow()
    expect(() => evaluate('constructor')).toThrow()
  })

  it('converts units', () => {
    expect(convert('5 km in mi')!.value).toBeCloseTo(3.10686, 4)
    expect(convert('100 c to f')).toMatchObject({ value: 212, unit: '°F' })
    expect(convert('1 gb in mb')!.value).toBe(1024)
    expect(convert('5 km in kg')).toBeUndefined()
  })
})
