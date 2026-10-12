import { Bar } from '../src/ui/bar'
import type { QikbarConfig } from '../src/core/types'
import { memoryStorage } from '../src/core/storage'

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
/** Flush microtasks + animation frames. */
export const settle = async () => {
  await tick()
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  await tick()
}

export function setup(config: QikbarConfig = {}) {
  document.body.innerHTML = ''
  const bar = new Bar({ storage: memoryStorage(), ...config })
  const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T | null
  const $$ = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)]
  const input = () => $<HTMLInputElement>('.qb-input')!
  const type = async (text: string) => {
    const el = input()
    el.value = text
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
  }
  const press = async (key: string, opts: KeyboardEventInit = {}, target?: Element) => {
    const t = target ?? document.activeElement ?? input()
    t.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }))
    await settle()
  }
  const titles = () => $$('.qb-item .qb-item-title').map((e) => e.textContent)
  const sections = () => $$('.qb-section').map((e) => e.textContent)
  const selected = () => $('.qb-item[aria-selected=true] .qb-item-title')?.textContent
  return { bar, $, $$, input, type, press, titles, sections, selected }
}
