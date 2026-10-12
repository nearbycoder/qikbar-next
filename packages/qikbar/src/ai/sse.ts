/** Read a fetch body as lines. */
async function* lines(response: Response): AsyncIterable<string> {
  if (!response.body) return
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        yield line
      }
    }
    buffer += decoder.decode()
    if (buffer) yield buffer
  } finally {
    reader.releaseLock()
  }
}

export interface SSEMessage {
  event?: string
  data: string
}

/** Parse a Server-Sent Events stream. */
export async function* parseSSE(response: Response): AsyncIterable<SSEMessage> {
  let event: string | undefined
  let data: string[] = []
  for await (const line of lines(response)) {
    if (line === '') {
      if (data.length) yield { event, data: data.join('\n') }
      event = undefined
      data = []
    } else if (line.startsWith('data:')) {
      data.push(line.slice(line[5] === ' ' ? 6 : 5))
    } else if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    }
  }
  if (data.length) yield { event, data: data.join('\n') }
}

/** Parse a newline-delimited JSON stream. */
export async function* parseNDJSON<T = unknown>(response: Response): AsyncIterable<T> {
  for await (const line of lines(response)) {
    if (line.trim()) yield JSON.parse(line) as T
  }
}

export async function errorFromResponse(response: Response, provider: string): Promise<Error> {
  let detail = ''
  try {
    const text = await response.text()
    try {
      const json = JSON.parse(text)
      detail = json?.error?.message ?? json?.message ?? json?.error ?? text
    } catch {
      detail = text
    }
  } catch {
    // ignore
  }
  return new Error(`${provider} ${response.status}: ${String(detail || response.statusText).slice(0, 300)}`)
}
