/**
 * Embedding functions for `semantic` search. Each returns an `embed(texts)`
 * function you pass as `semantic: { embed }`.
 *
 * Calling a provider straight from the browser exposes its key. In production,
 * use `proxyEmbeddings()` with `createEmbeddingsHandler()` from `@qikbar/qikbar/server`.
 */

import type { SemanticOptions } from '../core/types.js'

export type Embed = SemanticOptions['embed']

async function postJSON(url: string, body: unknown, headers: Record<string, string>, signal: AbortSignal, f: typeof fetch = globalThis.fetch) {
  const res = await f(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Embeddings request failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  return res.json()
}

export interface OpenAIEmbeddingsOptions {
  apiKey?: string
  /** Default `"text-embedding-3-small"`. */
  model?: string
  /** For OpenAI-compatible APIs (Together, Mistral, LM Studio, …). Default `"https://api.openai.com/v1"`. */
  baseURL?: string
  /** Shorter vectors are faster to compare. Default 256. */
  dimensions?: number | null
  headers?: Record<string, string>
  fetch?: typeof fetch
}

/** OpenAI (or any OpenAI-compatible) embeddings. */
export function openaiEmbeddings(options: OpenAIEmbeddingsOptions = {}): Embed {
  const base = (options.baseURL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const dimensions = options.dimensions === undefined ? 256 : options.dimensions
  return async (texts, { signal }) => {
    const data = await postJSON(
      `${base}/embeddings`,
      { model: options.model ?? 'text-embedding-3-small', input: texts, ...(dimensions ? { dimensions } : {}) },
      { ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}), ...options.headers },
      signal,
      options.fetch,
    )
    return (data.data as { index: number; embedding: number[] }[]).sort((a, b) => a.index - b.index).map((d) => d.embedding)
  }
}

export interface OllamaEmbeddingsOptions {
  /** Default `"nomic-embed-text"`. */
  model?: string
  /** Default `"http://localhost:11434"`. */
  host?: string
  fetch?: typeof fetch
}

/** Local embeddings with Ollama. */
export function ollamaEmbeddings(options: OllamaEmbeddingsOptions = {}): Embed {
  const host = (options.host ?? 'http://localhost:11434').replace(/\/$/, '')
  return async (texts, { signal }) => {
    const data = await postJSON(`${host}/api/embed`, { model: options.model ?? 'nomic-embed-text', input: texts }, {}, signal, options.fetch)
    return data.embeddings as number[][]
  }
}

export interface GeminiEmbeddingsOptions {
  apiKey: string
  /** Default `"gemini-embedding-001"`. */
  model?: string
  /** Default 256. */
  dimensions?: number
  fetch?: typeof fetch
}

/** Google Gemini embeddings. */
export function geminiEmbeddings(options: GeminiEmbeddingsOptions): Embed {
  const model = options.model ?? 'gemini-embedding-001'
  return async (texts, { signal }) => {
    const data = await postJSON(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`,
      {
        requests: texts.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          outputDimensionality: options.dimensions ?? 256,
        })),
      },
      { 'x-goog-api-key': options.apiKey },
      signal,
      options.fetch,
    )
    return (data.embeddings as { values: number[] }[]).map((e) => e.values)
  }
}

export interface ProxyEmbeddingsOptions {
  /** Your endpoint made with `createEmbeddingsHandler()`. */
  url: string
  headers?: Record<string, string>
  fetch?: typeof fetch
}

/** Embeddings through your own server, so API keys never reach the browser. */
export function proxyEmbeddings(options: ProxyEmbeddingsOptions): Embed {
  return async (texts, { signal }) => {
    const data = await postJSON(options.url, { texts }, options.headers ?? {}, signal, options.fetch)
    return data.embeddings as number[][]
  }
}

/** Wrap an embed function with a cache, so repeated texts aren't re-embedded. */
export function cachedEmbeddings(embed: Embed, maxEntries = 2000): Embed {
  const cache = new Map<string, number[]>()
  return async (texts, opts) => {
    const missing = [...new Set(texts.filter((t) => !cache.has(t)))]
    if (missing.length) {
      const vecs = await embed(missing, opts)
      missing.forEach((t, i) => {
        if (vecs[i]) cache.set(t, vecs[i]!)
      })
      while (cache.size > maxEntries) cache.delete(cache.keys().next().value!)
    }
    return texts.map((t) => cache.get(t) ?? [])
  }
}
