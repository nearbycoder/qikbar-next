import type { APIRoute } from 'astro'
import { allDocs, toMarkdown } from '../lib/docs'

export const GET: APIRoute = async ({ site }) => {
  const docs = await allDocs()
  const body = [
    '# Qikbar documentation (full)',
    '',
    '> The complete Qikbar documentation in one file, for AI assistants and coding agents.',
    '',
    ...docs.map((d) => toMarkdown(d, site).replace(/^# /, '# ')),
  ].join('\n\n---\n\n')
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
