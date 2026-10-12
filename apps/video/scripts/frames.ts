/** Render selected frames as stills for review: bun run scripts/frames.ts 30 420 1350 */
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const frames = process.argv.slice(2).map(Number)
const out = join(import.meta.dir, '..', 'out', 'frames')
mkdirSync(out, { recursive: true })
const serveUrl = await bundle({ entryPoint: join(import.meta.dir, '..', 'src', 'index.ts') })
const composition = await selectComposition({ serveUrl, id: 'Main' })
for (const frame of frames) {
  await renderStill({ composition, serveUrl, frame, output: join(out, `f${String(frame).padStart(4, '0')}.jpg`), imageFormat: 'jpeg', jpegQuality: 85, scale: 0.5 })
  console.log('rendered', frame)
}
