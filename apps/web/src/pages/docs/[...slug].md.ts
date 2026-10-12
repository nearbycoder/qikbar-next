import type { APIRoute, GetStaticPaths } from 'astro'
import { allDocs, toMarkdown, type Doc } from '../../lib/docs'

export const getStaticPaths: GetStaticPaths = async () => {
  const docs = await allDocs()
  return docs.map((doc) => ({ params: { slug: doc.id }, props: { doc } }))
}

export const GET: APIRoute = ({ props, site }) =>
  new Response(toMarkdown(props.doc as Doc, site), { headers: { 'content-type': 'text/markdown; charset=utf-8' } })
