// @vitest-environment node
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { libraryBuild } from '../build.config'

/**
 * The size claims on qikbar.com ("about 4 KB to boot", "about 42 KB for the UI")
 * are checked here: build the library exactly like `build.ts`, then bundle a
 * minimal app against that output the way a user's bundler would. (Bundling
 * from source hides problems, because the published chunks are pre-split.)
 */
async function measure() {
  const dir = mkdtempSync(join(tmpdir(), 'qikbar-size-'))
  await build({ ...libraryBuild, absWorkingDir: resolve(__dirname, '..'), outdir: join(dir, 'dist'), logLevel: 'silent' })
  const entry = join(dir, 'dist', 'index.js')
  writeFileSync(join(dir, 'app.js'), `import { createQikbar } from ${JSON.stringify(entry)}\ncreateQikbar({ commands: [{ title: 'Hi', run() {} }] })\n`)
  const result = await build({
    entryPoints: [join(dir, 'app.js')],
    bundle: true,
    minify: true,
    format: 'esm',
    splitting: true,
    outdir: join(dir, 'out'),
    metafile: true,
    write: false,
    logLevel: 'silent',
  })
  const outputs = result.metafile!.outputs
  const contents = new Map(result.outputFiles.map((f) => [f.path, f.contents]))
  const abs = (p: string) => resolve(p)
  const closure = (start: string) => {
    const seen = new Set<string>()
    const walk = (p: string) => {
      if (seen.has(p)) return
      seen.add(p)
      for (const i of outputs[p]!.imports) if (i.kind === 'import-statement') walk(i.path)
    }
    walk(start)
    return seen
  }
  const gz = (files: Iterable<string>) => gzipSync(Buffer.concat([...files].map((f) => Buffer.from(contents.get(abs(f))!)))).length / 1024
  const app = Object.keys(outputs).find((k) => k.endsWith('app.js'))!
  const bar = Object.keys(outputs).find((k) => /\/bar-[^/]+\.js$/.test(k))!
  const boot = closure(app)
  const ui = [...closure(bar)].filter((f) => !boot.has(f))
  const bootCode = [...boot].map((f) => Buffer.from(contents.get(abs(f))!).toString()).join('\n')
  return { boot: gz(boot), ui: gz(ui), bootCode }
}

describe('bundle size', () => {
  it('boots in about 4 KB and loads the UI in about 42 KB (gzip)', async () => {
    const { boot, ui, bootCode } = await measure()
    expect(boot, `boot is ${boot.toFixed(2)} KB`).toBeLessThan(4.2)
    expect(ui, `UI is ${ui.toFixed(2)} KB`).toBeLessThan(45)
    // UI-only code (labels, styles, the launcher) must stay out of the boot path.
    for (const marker of ['Search for commands, pages and more', '.qb-dialog{', '.qb-launcher{']) {
      expect(bootCode.includes(marker), `"${marker}" is loaded at boot`).toBe(false)
    }
  }, 30_000)
})
