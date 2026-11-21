import { describe, expect, it, vi } from 'vitest'
import { LazyQikbar } from '../src/core/lazy'
import { memoryStorage } from '../src/core/storage'
import { settle } from './helpers'

describe('lazy shell', () => {
  it('queues calls until the UI loads', async () => {
    document.body.innerHTML = ''
    let loaded = false
    const bar = new LazyQikbar({ storage: memoryStorage() }, async () => {
      loaded = true
      return import('../src/ui/bar')
    })
    const off = bar.register([{ title: 'Queued command' }])
    bar.register([{ title: 'Another' }])()
    expect(bar.commands()).toEqual([])
    bar.open()
    await bar.preload()
    await settle()
    expect(loaded).toBe(true)
    expect(bar.isOpen).toBe(true)
    expect(bar.commands().map((c) => c.title)).toEqual(['Queued command'])
    off()
    expect(bar.commands()).toEqual([])
    bar.destroy()
  })

  it('opens on the hotkey before the UI has loaded', async () => {
    document.body.innerHTML = ''
    const bar = new LazyQikbar({ storage: memoryStorage() }, () => import('../src/ui/bar'))
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true }))
    await bar.preload()
    await settle()
    expect(bar.isOpen).toBe(true)
    bar.destroy()
  })

  it('recovers when a transient load error occurs', async () => {
    document.body.innerHTML = ''
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let attempts = 0
    const bar = new LazyQikbar({ storage: memoryStorage() }, async () => {
      attempts++
      if (attempts === 1) throw new Error('network flake')
      return import('../src/ui/bar')
    })
    await expect(bar.preload()).rejects.toThrow('network flake')
    await bar.preload()
    bar.open()
    await settle()
    expect(bar.isOpen).toBe(true)
    expect(attempts).toBe(2)
    bar.destroy()
    errSpy.mockRestore()
  })

  it('cancels the idle warmup when destroyed early', async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      const bar = new LazyQikbar({ storage: memoryStorage() }, async () => {
        calls++
        return import('../src/ui/bar')
      })
      bar.destroy()
      vi.advanceTimersByTime(5000)
      expect(calls).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
