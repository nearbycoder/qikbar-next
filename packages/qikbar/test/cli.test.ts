// @vitest-environment node
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const CLI = join(__dirname, '..', 'bin', 'qikbar.mjs')
const index = {
  version: 1,
  extensions: [
    { name: 'weather', title: 'Weather', description: 'Forecasts inline', file: 'weather.ts', author: 'qikbar', tags: ['source'], try: 'weather in tokyo' },
    { name: 'hacker-news', title: 'Hacker News', description: 'Top stories', file: 'hacker-news.ts' },
  ],
}
const files: Record<string, string> = {
  'weather.ts': "import { defineExtension } from '@qikbar/qikbar'\nexport default defineExtension({ name: 'weather', title: 'Weather' })\n",
  'hacker-news.ts': "import { defineExtension } from '@qikbar/qikbar'\nexport default defineExtension({ name: 'hacker-news', title: 'Hacker News' })\n",
}

let server: Server
let registry = ''
let cwd = ''

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = (req.url ?? '').replace(/^\/registry\//, '')
    if (path === 'index.json') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(index))
    if (files[path]) return res.writeHead(200, { 'content-type': 'text/plain' }).end(files[path])
    res.writeHead(404).end('not found')
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address() as { port: number }
  registry = `http://127.0.0.1:${addr.port}/registry`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))
beforeEach(() => {
  if (cwd) rmSync(cwd, { recursive: true, force: true })
  cwd = mkdtempSync(join(tmpdir(), 'qikbar-cli-'))
})

function run(args: string[], env: Record<string, string> = {}) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(process.execPath, [CLI, ...args], { cwd, env: { ...process.env, QIKBAR_REGISTRY: registry, NO_COLOR: '1', ...env } }, (err, stdout, stderr) =>
      resolve({ code: err ? ((err as any).code ?? 1) : 0, stdout, stderr }),
    )
  })
}

describe('qikbar CLI', () => {
  it('lists extensions', async () => {
    const { code, stdout } = await run(['list'])
    expect(code).toBe(0)
    expect(stdout).toContain('2 extensions')
    expect(stdout).toMatch(/weather\s+Forecasts inline/)
    const json = await run(['list', '--json'])
    expect(JSON.parse(json.stdout).map((e: any) => e.name)).toEqual(['weather', 'hacker-news'])
  })

  it('adds extensions into src/qikbar/extensions and prints how to use them', async () => {
    mkdirSync(join(cwd, 'src'))
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ dependencies: { '@qikbar/qikbar': '^0.2.0' } }))
    const { code, stdout } = await run(['add', 'weather', 'hacker-news'])
    expect(code).toBe(0)
    const file = join(cwd, 'src/qikbar/extensions/weather.ts')
    expect(readFileSync(file, 'utf8')).toContain("defineExtension({ name: 'weather'")
    expect(readFileSync(file, 'utf8').startsWith('// Weather — from')).toBe(true)
    expect(existsSync(join(cwd, 'src/qikbar/extensions/hacker-news.ts'))).toBe(true)
    expect(stdout).toContain("import weather from './src/qikbar/extensions/weather'")
    expect(stdout).toContain("import hackerNews from './src/qikbar/extensions/hacker-news'")
    expect(stdout).toContain('createQikbar({ extensions: [weather, hackerNews] })')
    expect(stdout).not.toContain('npm install @qikbar/qikbar')
  })

  it('respects --dir, skips existing files and overwrites with --force', async () => {
    await run(['add', 'weather', '--dir', 'lib/ext'])
    const file = join(cwd, 'lib/ext/weather.ts')
    writeFileSync(file, '// mine')
    const skipped = await run(['add', 'weather', '-d', 'lib/ext'])
    expect(skipped.stdout).toContain('skip')
    expect(readFileSync(file, 'utf8')).toBe('// mine')
    await run(['add', 'weather', '--dir=lib/ext', '--force'])
    expect(readFileSync(file, 'utf8')).toContain('defineExtension')
  })

  it('uses extensionsDir from qikbar.json and "all"', async () => {
    writeFileSync(join(cwd, 'qikbar.json'), JSON.stringify({ extensionsDir: 'app/cmdk' }))
    const { code } = await run(['add', 'all'])
    expect(code).toBe(0)
    expect(existsSync(join(cwd, 'app/cmdk/weather.ts'))).toBe(true)
    expect(existsSync(join(cwd, 'app/cmdk/hacker-news.ts'))).toBe(true)
  })

  it('suggests close names for typos and fails cleanly', async () => {
    const { code, stderr } = await run(['add', 'wether'])
    expect(code).toBe(1)
    expect(stderr).toContain('Unknown extension "wether". Did you mean "weather"?')
    expect(existsSync(join(cwd, 'qikbar'))).toBe(false)
  })

  it('reminds you to install the package when it is missing', async () => {
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ dependencies: {} }))
    const { stdout } = await run(['add', 'weather'])
    expect(stdout).toContain('npm install @qikbar/qikbar')
  })

  it('shows info, help and version, and reports an unreachable registry', async () => {
    expect((await run(['info', 'weather'])).stdout).toContain('Try: “weather in tokyo”')
    expect((await run(['--help'])).stdout).toContain('npx @qikbar/qikbar add <name...>')
    expect((await run(['-v'])).stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
    const down = await run(['list'], { QIKBAR_REGISTRY: 'http://127.0.0.1:1/registry' })
    expect(down.code).toBe(1)
    expect(down.stderr).toContain("Couldn't reach")
  })
})
