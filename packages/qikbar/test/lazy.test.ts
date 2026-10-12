import { describe, expect, it } from 'vitest'
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
})
