import { createQikbar, list, grid, detail, form, action } from '../../packages/qikbar/dist/index.js'
import { calculator, themeSwitcher, page, shortcuts, aiActions } from '../../packages/qikbar/dist/extensions.js'

const projects = ['Acme Rocket', 'Acme Website', 'Billing v2', 'Mobile app', 'Data pipeline', 'Design system', 'Onboarding flow'].map((name, i) => ({
  id: `project-${i}`,
  title: name,
  subtitle: ['Active', 'Paused', 'Shipped'][i % 3],
  icon: { color: ['#8b5cf6', '#22c55e', '#f97316', '#3b82f6'][i % 4], icon: 'folder' },
  accessories: [{ tag: { value: ['Active', 'Paused', 'Shipped'][i % 3], color: ['green', 'yellow', 'blue'][i % 3] } }, { date: Date.now() - i * 36e5 * 7 }],
  detail: `## ${name}\n\nOwner: **Ada Lovelace**\n\n- 12 open issues\n- Last deploy 2h ago\n\n\`\`\`bash\nnpm run deploy -- --project ${i}\n\`\`\``,
  href: `#/projects/${i}`,
}))

// A scripted "AI" so the demo works without an API key.
const demoAI = {
  id: 'demo',
  async *stream({ messages }) {
    const last = messages.at(-1)
    if (last.role === 'tool') {
      yield* words('Done! I opened it for you. Anything else?')
      return yield { type: 'done', message: { role: 'assistant', content: 'Done' } }
    }
    const text = last.content.toLowerCase()
    const target = text.match(/(?:go to|open|take me to|show)\s+(.+)/)?.[1]
    if (target) {
      const call = { id: 'c1', name: 'search', args: { query: target } }
      if (!messages.some((m) => m.role === 'tool')) {
        yield { type: 'tool_call', call }
        return yield { type: 'done', message: { role: 'assistant', content: '', toolCalls: [call] } }
      }
    }
    yield* words(`You asked: **${last.content}**.\n\nThis is a demo model. Plug in \`anthropic()\`, \`openai()\`, \`gemini()\` or your own provider to get real answers.\n\n- Try "go to settings"\n- Or "open acme rocket"`)
    yield { type: 'done', message: { role: 'assistant', content: '' } }
  },
}
async function* words(s) {
  for (const w of s.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 18))
    yield { type: 'text', text: w }
  }
}

const bar = createQikbar({
  autoIndex: true,
  ai: { provider: demoAI, suggestions: ['Go to settings', 'Open Acme Rocket', 'What can you do?'] },
  navigate: (href) => (location.hash = href.replace(/^#/, '')),
  branding: true,
  commands: [
    { title: 'Create Project', icon: 'plus', section: 'Projects', shortcut: 'c p', view: form({
      title: 'New Project',
      fields: [
        { name: 'name', label: 'Name', required: true, placeholder: 'Apollo' },
        { name: 'visibility', label: 'Visibility', type: 'select', options: [{ title: 'Private', value: 'private' }, { title: 'Public', value: 'public' }] },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'notify', label: 'Notify my team', type: 'checkbox', defaultValue: true },
      ],
      onSubmit: (values, ctx) => ctx.toast({ title: `Created ${values.name}`, style: 'success' }),
    }) },
    { title: 'Browse Projects', icon: 'folder', section: 'Projects', view: list({ title: 'Projects', items: projects, detail: true, placeholder: 'Filter projects…' }) },
    { title: 'Team Avatars', icon: 'users', section: 'Team', view: grid({ title: 'Team', columns: 5, items: Array.from({ length: 20 }, (_, i) => ({ title: `Teammate ${i + 1}`, subtitle: 'Engineer', image: `https://i.pravatar.cc/150?img=${i + 1}`, actions: [action.copy(`teammate${i + 1}@acme.co`, { title: 'Copy Email' })] })) }) },
    { title: 'Release Notes', icon: 'file-text', section: 'Help', view: detail({ title: 'Release Notes', markdown: '# v2.4\n\n- **New**: command bar\n- Faster search\n\n> Thanks for using Acme!', metadata: [{ label: 'Version', value: '2.4.0' }, { label: 'Status', tag: { value: 'Stable', color: 'green' } }] }) },
    { title: 'Delete Workspace', icon: 'trash', section: 'Danger', searchOnly: true, actions: [{ title: 'Delete Workspace', style: 'destructive', run: async (ctx) => { if (await ctx.confirm({ title: 'Delete workspace?', message: 'This cannot be undone.', destructive: true, confirmLabel: 'Delete' })) ctx.toast({ title: 'Deleted (not really)', style: 'success' }); else return false } }] },
    { title: 'Send Feedback', icon: 'message', section: 'Help', arguments: [{ name: 'message', placeholder: 'Your feedback', required: true }], run: (ctx) => ctx.toast({ title: 'Thanks!', message: ctx.arguments.message, style: 'success' }) },
  ],
  sources: [],
  extensions: [calculator(), themeSwitcher(), page(), shortcuts(), aiActions()],
})

bar.addSource({
  id: 'projects-api',
  title: 'Projects',
  async search({ query, signal }) {
    await new Promise((r) => setTimeout(r, 120))
    if (signal.aborted) return []
    return projects.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
  },
})

window.bar = bar
