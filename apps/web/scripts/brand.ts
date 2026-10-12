/**
 * Regenerates every brand asset from assets/logo.svg and assets/logo-square.svg:
 *   bun run brand
 *
 * Outputs: favicons, app icons and the web manifest icons in apps/web/public,
 * plus PNG and wordmark variants in /assets for the README and social profiles.
 */
import { Resvg } from '@resvg/resvg-js'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import satori from 'satori'

const root = join(import.meta.dir, '..', '..', '..')
const assets = join(root, 'assets')
const pub = join(import.meta.dir, '..', 'public')

const logo = readFileSync(join(assets, 'logo.svg'), 'utf8')
const square = readFileSync(join(assets, 'logo-square.svg'), 'utf8')

const png = (svg: string, size: number) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()

/** A PNG-compressed .ico with several sizes. */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const entries: Buffer[] = []
  let offset = 6 + images.length * 16
  for (const { size, data } of images) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2)
    e.writeUInt8(0, 3)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    entries.push(e)
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

// Favicons and app icons
copyFileSync(join(assets, 'logo.svg'), join(pub, 'favicon.svg'))
copyFileSync(join(assets, 'logo.svg'), join(pub, 'logo.svg'))
writeFileSync(join(pub, 'favicon.ico'), ico([16, 32, 48].map((size) => ({ size, data: png(logo, size) }))))
writeFileSync(join(pub, 'apple-touch-icon.png'), png(square, 180))
writeFileSync(join(pub, 'icon-192.png'), png(logo, 192))
writeFileSync(join(pub, 'icon-512.png'), png(logo, 512))
writeFileSync(join(pub, 'icon-maskable-512.png'), png(square, 512))
writeFileSync(join(assets, 'logo.png'), png(logo, 512))

// Wordmarks with the text converted to paths, so they render identically everywhere.
const font = (w: number) => readFileSync(join(import.meta.dir, '..', 'node_modules', '@fontsource', 'inter', 'files', `inter-latin-${w}-normal.woff`))
const logoUri = `data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}`
for (const [name, color] of [
  ['logo-wordmark-dark', '#eceef1'],
  ['logo-wordmark-light', '#0b0c0e'],
] as const) {
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: { display: 'flex', alignItems: 'center', gap: 22, width: 420, height: 96, fontFamily: 'Inter' },
        children: [
          { type: 'img', props: { src: logoUri, width: 88, height: 88 } },
          { type: 'div', props: { style: { fontSize: 72, fontWeight: 700, letterSpacing: -2.6, color, marginTop: -6 }, children: 'qikbar' } },
        ],
      },
    } as any,
    { width: 420, height: 96, fonts: [{ name: 'Inter', data: font(700), weight: 700, style: 'normal' }] },
  )
  writeFileSync(join(assets, `${name}.svg`), svg)
  writeFileSync(join(assets, `${name}.png`), png(svg, 840))
}

console.log('Brand assets written to apps/web/public and assets/')
