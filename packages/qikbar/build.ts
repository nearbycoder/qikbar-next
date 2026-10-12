import { build } from 'esbuild'
import { gzipSync } from 'node:zlib'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

rmSync('dist', { recursive: true, force: true })
mkdirSync('dist', { recursive: true })

const common = { bundle: true, target: 'es2020', legalComments: 'none', sourcemap: true } as const

// ESM with shared chunks so `qikbar` and `qikbar/react` share one copy.
await build({
  ...common,
  entryPoints: {
    index: 'src/index.ts',
    ai: 'src/ai/index.ts',
    react: 'src/react/index.tsx',
    server: 'src/server/index.ts',
    extensions: 'src/extensions/index.ts',
    theme: 'src/theme.ts',
    utils: 'src/utils.ts',
  },
  outdir: 'dist',
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  external: ['react', 'react-dom', 'node:*'],
  jsx: 'automatic',
  minifySyntax: true,
  banner: { js: '' },
})

// Script-tag build: window.Qikbar
await build({
  ...common,
  entryPoints: ['src/global.ts'],
  outfile: 'dist/qikbar.global.js',
  format: 'iife',
  globalName: 'Qikbar',
  minify: true,
})

// Standalone stylesheet.
const { css } = await import('./src/ui/styles')
writeFileSync('dist/styles.css', css.trim() + '\n')

// Keep "use client" at the top of the React entry for RSC frameworks.
const reactFile = 'dist/react.js'
const reactSrc = readFileSync(reactFile, 'utf8')
if (!reactSrc.startsWith('"use client"')) writeFileSync(reactFile, `"use client";\n${reactSrc.replace(/^["']use client["'];?\n?/m, '')}`)

const size = (f: string) => {
  const buf = readFileSync(f)
  return `${(buf.length / 1024).toFixed(1)} kB (${(gzipSync(buf).length / 1024).toFixed(1)} kB gzip)`
}
console.log('qikbar.global.js', size('dist/qikbar.global.js'))
console.log('styles.css', size('dist/styles.css'))
