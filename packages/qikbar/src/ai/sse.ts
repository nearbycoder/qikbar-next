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
      let start = 0
      let nl: number
      while ((nl = buffer.indexOf('\n', start)) >= 0) {
        const end = nl > start && buffer.charCodeAt(nl - 1) === 13 ? nl - 1 : nl
        yield buffer.slice(start, end)
        start = nl + 1
      }
      if (start > 0) buffer = buffer.slice(start)
    }
    buffer += decoder.decode()
    if (buffer) yield buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer
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
