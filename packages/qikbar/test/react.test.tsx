import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createElement as h, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Qikbar, useCommands, useQikbar } from '../src/react/index'
import { memoryStorage } from '../src/core/storage'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms))

async function waitFor(fn: () => boolean, timeout = 2000) {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error('timeout')
    await act(() => wait(10))
  }
}

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  document.body.innerHTML = ''
})

describe('react bindings', () => {
  it('mounts, registers contextual commands, and exposes state', async () => {
    const run = vi.fn()
    let api: ReturnType<typeof useQikbar> | undefined
    function Page() {
      useCommands([{ title: 'Page command', run }], [])
      api = useQikbar()
      return null
    }
    function App() {
      const [show, setShow] = useState(true)
      ;(globalThis as any).hide = () => setShow(false)
      return h('div', null, h(Qikbar, { storage: memoryStorage(), commands: [{ title: 'Global' }] }), show ? h(Page) : null)
    }
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el)
    await act(async () => root!.render(h(App)))
    await act(async () => api!.open())
    await waitFor(() => document.querySelectorAll('.qb-item').length === 2)
    expect([...document.querySelectorAll('.qb-item-title')].map((e) => e.textContent)).toEqual(['Global', 'Page command'])
    expect(api!.isOpen).toBe(true)
    await act(async () => (globalThis as any).hide())
    await waitFor(() => document.querySelectorAll('.qb-item').length === 1)
  })

  it('applies prop changes without remounting', async () => {
    function App({ placeholder }: { placeholder: string }) {
      return h(Qikbar, { storage: memoryStorage(), placeholder, navigate: () => {} })
    }
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el)
    await act(async () => root!.render(h(App, { placeholder: 'First' })))
    let api: any
    function Grab() {
      api = useQikbar()
      return null
    }
    await act(async () => root!.render(h('div', null, h(App, { placeholder: 'Second' }), h(Grab))))
    await act(async () => api.open())
    await waitFor(() => !!document.querySelector('.qb-input'))
    expect(document.querySelectorAll('.qb-root').length).toBe(1)
    expect(document.querySelector<HTMLInputElement>('.qb-input')!.placeholder).toBe('Second')
  })
})
