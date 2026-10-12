import type { ScopedStorage, StorageAdapter } from './types.js'

/** In-memory storage, used during SSR or when localStorage is unavailable. */
export function memoryStorage(): StorageAdapter {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

export function defaultStorage(): StorageAdapter {
  try {
    const ls = globalThis.localStorage
    const probe = '__qikbar__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return ls
  } catch {
    return memoryStorage()
  }
}

export function scopedStorage(adapter: StorageAdapter, prefix: string): ScopedStorage {
  return {
    get<T>(key: string): T | undefined {
      try {
        const raw = adapter.getItem(`${prefix}:${key}`)
        return raw == null ? undefined : (JSON.parse(raw) as T)
      } catch {
        return undefined
      }
    },
    set(key, value) {
      try {
        if (value === undefined) adapter.removeItem(`${prefix}:${key}`)
        else adapter.setItem(`${prefix}:${key}`, JSON.stringify(value))
      } catch {
        // Quota exceeded or storage disabled — ignore.
      }
    },
    remove(key) {
      try {
        adapter.removeItem(`${prefix}:${key}`)
      } catch {
        // ignore
      }
    },
  }
}
