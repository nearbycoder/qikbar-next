import { defineExtension, type Context } from 'qikbar'

const copy = (make: () => string, label: string) => async (ctx: Context) => {
  const value = make()
  await ctx.copy(value)
  ctx.toast({ title: `Copied ${label}`, message: value.length > 40 ? `${value.slice(0, 40)}…` : value, style: 'success' })
}

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'

function password(length: number) {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_'
  const bytes = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export default defineExtension({
  name: 'generators',
  title: 'Generators',
  icon: 'wand',
  description: 'UUIDs, passwords, timestamps and placeholder text.',
  commands: [
    { name: 'uuid', title: 'Generate UUID', icon: 'hash', keywords: ['guid', 'id', 'random'], run: copy(() => crypto.randomUUID(), 'UUID') },
    {
      name: 'password',
      title: 'Generate Password',
      icon: 'key',
      keywords: ['secret', 'random'],
      arguments: [{ name: 'length', placeholder: 'Length (20)' }],
      run: (ctx) => copy(() => password(Math.min(128, Math.max(8, Number(ctx.arguments.length) || 20))), 'password')(ctx),
    },
    { name: 'timestamp', title: 'Copy Unix Timestamp', icon: 'clock', keywords: ['epoch', 'time', 'now'], run: copy(() => String(Math.floor(Date.now() / 1000)), 'timestamp') },
    { name: 'iso', title: 'Copy ISO Date', icon: 'calendar', keywords: ['date', 'now', 'time'], run: copy(() => new Date().toISOString(), 'ISO date') },
    { name: 'lorem', title: 'Copy Lorem Ipsum', icon: 'file-text', keywords: ['placeholder', 'text', 'dummy'], run: copy(() => LOREM, 'lorem ipsum') },
  ],
})
