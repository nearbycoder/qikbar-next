#!/usr/bin/env node
/**
 * qikbar CLI — add extensions from the registry to your project.
 *
 *   npx @qikbar/qikbar add weather currency
 *   npx @qikbar/qikbar list
 *   npx @qikbar/qikbar info weather
 *
 * Extensions are copied into your codebase as source (like shadcn/ui), so you
 * own them: read them, change them, delete what you don't need.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REGISTRY = (process.env.QIKBAR_REGISTRY || 'https://qikbar.com/registry').replace(/\/$/, '')
const SAFE_NAME = /^[a-z0-9][a-z0-9_-]*$/i
const SAFE_FILE = /^[a-z0-9][a-z0-9._-]*\.ts$/i
const FETCH_TIMEOUT_MS = 15_000
const color = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code) => (s) => (color ? `\x1b[${code}m${s}\x1b[0m` : String(s))
const bold = paint(1)
const dim = paint(2)
const green = paint(32)
const red = paint(31)
const cyan = paint(36)

function validateRegistry(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid registry URL "${url}".`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Unsupported registry protocol "${parsed.protocol}". Use http:// or https://.`)
  }
  return url.replace(/\/$/, '')
}

function version() {
  try {
    const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'))
    return pkg.version
  } catch {
    return 'unknown'
  }
}

function parseArgs(argv) {
  const args = { _: [], flags: Object.create(null) }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') {
      args._.push(...argv.slice(i + 1))
      break
    }
    if (a.startsWith('--')) {
      const [key, inline] = a.slice(2).split('=', 2)
      if (!key) continue
      if (inline !== undefined) args.flags[key] = inline
      else if (['dir', 'registry', 'cwd'].includes(key)) args.flags[key] = argv[++i]
      else args.flags[key] = true
    } else if (a.startsWith('-') && a.length > 1) {
      for (const c of a.slice(1)) args.flags[{ f: 'force', h: 'help', v: 'version', d: 'dir', y: 'yes' }[c] ?? c] = c === 'd' ? argv[++i] : true
    } else args._.push(a)
  }
  return args
}

async function get(path, registry) {
  if (path !== 'index.json' && !SAFE_FILE.test(path)) {
    throw new Error(`Refusing unsafe registry file path "${path}".`)
  }
  const url = `${registry}/${path}`
  let res
  try {
    res = await fetch(url, { headers: { 'user-agent': `qikbar-cli/${version()}` }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  } catch (err) {
    throw new Error(`Couldn't reach ${url} (${err.cause?.code ?? err.message})`)
  }
  if (!res.ok) throw new Error(`${url} responded ${res.status}`)
  return res
}

async function loadIndex(registry) {
  const data = await (await get('index.json', registry)).json()
  if (!data || !Array.isArray(data.extensions)) throw new Error('The registry index is malformed.')
  return data
}

/** Levenshtein distance, for "did you mean". */
function distance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

function suggest(name, names) {
  const best = names.map((n) => [n, distance(name, n)]).sort((x, y) => x[1] - y[1])[0]
  return best && best[1] <= Math.max(2, Math.floor(name.length / 3)) ? best[0] : undefined
}

function defaultDir(cwd) {
  try {
    const cfg = JSON.parse(readFileSync(join(cwd, 'qikbar.json'), 'utf8'))
    if (cfg.extensionsDir) return cfg.extensionsDir
  } catch {
    // no config
  }
  return existsSync(join(cwd, 'src')) ? 'src/qikbar/extensions' : 'qikbar/extensions'
}

function identifier(name) {
  return name.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^[^a-zA-Z_$]/, '_$&')
}

function hasPackage(cwd) {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
    return !!({ ...pkg.dependencies, ...pkg.devDependencies }['@qikbar/qikbar'])
  } catch {
    return true // not a node project — don't nag
  }
}

async function cmdList(flags, registry) {
  const index = await loadIndex(registry)
  if (flags.json) return console.log(JSON.stringify(index.extensions, null, 2))
  const width = index.extensions.reduce((m, e) => Math.max(m, String(e.name ?? '').length), 0)
  console.log(bold(`${index.extensions.length} extensions`) + dim(`  ${registry}`))
  for (const e of index.extensions) console.log(`  ${cyan(String(e.name).padEnd(width))}  ${e.description ?? e.title}`)
  console.log(dim(`\nAdd one with: npx @qikbar/qikbar add <name>`))
}

async function cmdInfo(names, registry) {
  const index = await loadIndex(registry)
  for (const name of names) {
    const e = index.extensions.find((x) => x.name === name)
    if (!e) throw new Error(`Unknown extension "${name}".`)
    console.log(`${bold(e.title)} ${dim(`(${e.name}${e.version ? `@${e.version}` : ''})`)}`)
    if (e.description) console.log(e.description)
    if (e.author) console.log(dim(`by ${e.author}`))
    if (e.uses) console.log(dim(`Uses: ${e.uses}`))
    if (e.tags?.length) console.log(dim(`Shows off: ${e.tags.join(', ')}`))
    if (e.try) console.log(dim(`Try: “${e.try}”`))
    console.log(dim(`Source: ${registry}/${e.file ?? `${e.name}.ts`}`))
  }
}

async function cmdAdd(names, flags, registry) {
  if (!names.length) throw new Error('Name at least one extension, e.g. `qikbar add weather`. Run `qikbar list` to see them all.')
  const cwd = resolve(flags.cwd ?? process.cwd())
  const dir = resolve(cwd, flags.dir ?? defaultDir(cwd))
  const index = await loadIndex(registry)
  const known = index.extensions.map((e) => e.name)
  const wanted = names.includes('all') ? known : names
  const unknown = wanted.filter((n) => !known.includes(n))
  if (unknown.length) {
    throw new Error(
      unknown.map((n) => `Unknown extension "${n}".${suggest(n, known) ? ` Did you mean "${suggest(n, known)}"?` : ''}`).join('\n') +
        '\nRun `qikbar list` to see them all.',
    )
  }
  mkdirSync(dir, { recursive: true })
  const added = []
  for (const name of wanted) {
    if (typeof name !== 'string' || !SAFE_NAME.test(name)) {
      throw new Error(`Refusing unsafe extension name "${name}".`)
    }
    const entry = index.extensions.find((e) => e.name === name)
    const file = resolve(dir, `${name}.ts`)
    const relToDir = relative(dir, file)
    if (relToDir.startsWith('..') || isAbsolute(relToDir)) {
      throw new Error(`Refusing to write outside target directory: "${file}".`)
    }
    const remoteFile = entry.file ?? `${name}.ts`
    if (typeof remoteFile !== 'string' || !SAFE_FILE.test(remoteFile)) {
      throw new Error(`Refusing unsafe extension source path "${remoteFile}".`)
    }
    if (existsSync(file) && !flags.force) {
      console.log(`${dim('skip')}  ${relative(cwd, file)} ${dim('(exists — use --force to overwrite)')}`)
      continue
    }
    const source = await (await get(remoteFile, registry)).text()
    const cleanTitle = String(entry.title ?? name).replace(/[\r\n]+/g, ' ')
    const cleanUrl = `${registry}/${remoteFile}`.replace(/[\r\n]+/g, '')
    writeFileSync(file, source.startsWith('//') ? source : `// ${cleanTitle} — from ${cleanUrl}\n${source}`)
    console.log(`${green('add')}   ${relative(cwd, file)}`)
    added.push({ name, file })
  }
  if (!added.length) return
  const rel = relative(cwd, dir).replace(/\\/g, '/')
  const prefix = rel.startsWith('.') ? rel : `./${rel}`
  console.log(`\n${bold('Use it:')}\n`)
  for (const { name } of added) console.log(`  ${cyan(`import ${identifier(name)} from '${prefix}/${name}'`)}`)
  console.log(`\n  createQikbar({ extensions: [${added.map((a) => identifier(a.name)).join(', ')}] })`)
  if (!hasPackage(cwd)) console.log(`\n${dim('Extensions import from @qikbar/qikbar — install it with')} npm install @qikbar/qikbar`)
}

const HELP = `${bold('qikbar')} ${dim(version())} — add Qikbar extensions to your project

${bold('Usage')}
  npx @qikbar/qikbar add <name...>   Copy extensions into your project (or "all")
  npx @qikbar/qikbar list            List available extensions
  npx @qikbar/qikbar info <name>     Show details about an extension

${bold('Options')}
  -d, --dir <path>      Where to put extensions (default: src/qikbar/extensions,
                        or "extensionsDir" in qikbar.json)
  -f, --force           Overwrite existing files
      --registry <url>  Use another registry (or set QIKBAR_REGISTRY)
      --json            Machine-readable output for list
  -h, --help            Show this help
  -v, --version         Show the version

${dim('Registry: https://qikbar.com/extensions')}`

async function main() {
  const { _: [command, ...rest], flags } = parseArgs(process.argv.slice(2))
  if (flags.version) return console.log(version())
  if (flags.help || !command || command === 'help') return console.log(HELP)
  const registry = validateRegistry(flags.registry ?? REGISTRY)
  if (command === 'add' || command === 'install') return cmdAdd(rest, flags, registry)
  if (command === 'list' || command === 'ls') return cmdList(flags, registry)
  if (command === 'info' || command === 'show') return cmdInfo(rest, registry)
  throw new Error(`Unknown command "${command}". Run \`qikbar --help\`.`)
}

main().catch((err) => {
  console.error(red('error'), err.message)
  process.exit(1)
})
