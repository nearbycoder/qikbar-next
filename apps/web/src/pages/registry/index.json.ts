import type { APIRoute } from 'astro'
import { catalog } from '../../data/extensions'

/** The extension registry index, read by `npx @qikbar/qikbar add`. */
export const GET: APIRoute = () => {
  const extensions = catalog.map((c) => ({
    name: c.extension.name,
    title: c.extension.title,
    description: c.extension.description,
    author: c.extension.author,
    version: c.extension.version,
    icon: typeof c.extension.icon === 'string' && !c.extension.icon.trimStart().startsWith('<') ? c.extension.icon : undefined,
    category: c.category,
    tags: c.tags,
    uses: c.uses,
    try: c.try,
    file: c.file,
  }))
  return new Response(JSON.stringify({ version: 1, extensions }, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' } })
}
