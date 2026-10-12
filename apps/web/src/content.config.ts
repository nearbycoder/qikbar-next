import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const docs = defineCollection({
  loader: glob({ base: './src/content/docs', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Sidebar group. */
    group: z.string(),
    /** Order within the group. */
    order: z.number(),
    /** Optional short label for the sidebar. */
    label: z.string().optional(),
  }),
})

export const collections = { docs }
