import { getCollection, type CollectionEntry } from 'astro:content'
import promptText from '../../public/prompt.txt?raw'

export const GROUPS = ['Getting Started', 'Core Concepts', 'AI', 'Extensions', 'Customization', 'Frameworks', 'Recipes', 'Reference'] as const

export type Doc = CollectionEntry<'docs'>

export const slugOf = (doc: Doc) => (doc.id === 'index' ? '' : doc.id)
export const hrefOf = (doc: Doc) => (doc.id === 'index' ? '/docs' : `/docs/${doc.id}`)

export async function allDocs(): Promise<Doc[]> {
  const docs = await getCollection('docs')
  return docs.sort((a, b) => {
    const ga = GROUPS.indexOf(a.data.group as (typeof GROUPS)[number])
    const gb = GROUPS.indexOf(b.data.group as (typeof GROUPS)[number])
    return ga - gb || a.data.order - b.data.order
  })
}

export async function sidebar() {
  const docs = await allDocs()
  return GROUPS.map((group) => ({ group, items: docs.filter((d) => d.data.group === group) })).filter((g) => g.items.length)
}

/** Markdown for AI consumption: title + description + body. */
export function toMarkdown(doc: Doc, site: URL | undefined): string {
  const url = new URL(hrefOf(doc), site ?? 'https://qikbar.com').href
  const body = (doc.body ?? '').trim().replace(/<div class="prompt-embed" data-prompt-embed><\/div>/, () => '```text\n' + setupPrompt().trim() + '\n```')
  return `# ${doc.data.title}\n\n> ${doc.data.description}\n\nSource: ${url}\n\n${body}\n`
}

export function setupPrompt(): string {
  return promptText
}
