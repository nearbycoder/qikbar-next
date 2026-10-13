import type { APIRoute, GetStaticPaths } from 'astro'
import { catalog } from '../../data/extensions'

const sources = import.meta.glob<string>('../../extensions/*.ts', { query: '?raw', import: 'default', eager: true })

/** Raw extension sources: /registry/weather.ts */
export const getStaticPaths: GetStaticPaths = () =>
  catalog.map((c) => ({ params: { name: c.file.replace(/\.ts$/, '') }, props: { source: sources[`../../extensions/${c.file}`] ?? '' } }))

export const GET: APIRoute = ({ props }) => new Response(props.source as string, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
