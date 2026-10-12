import { defineConfig } from 'astro/config'
import { satteri } from '@astrojs/markdown-satteri'
import { callouts, codeTitle } from './src/lib/markdown-plugins.mjs'

export default defineConfig({
  site: process.env.SITE_URL || 'https://qikbar.com',
  trailingSlash: 'ignore',
  markdown: {
    processor: satteri({ hastPlugins: [callouts] }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      defaultColor: false,
      wrap: false,
      transformers: [codeTitle],
    },
  },
  vite: {
    server: { fs: { allow: ['../..'] } },
  },
})
