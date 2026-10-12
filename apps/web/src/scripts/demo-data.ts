import { action, detail, form, grid, list, type Command, type Item, type Source } from '@qikbar/qikbar'

const statuses = [
  { value: 'In progress', color: 'blue' },
  { value: 'Shipped', color: 'green' },
  { value: 'Blocked', color: 'red' },
  { value: 'Review', color: 'yellow' },
] as const

const names = ['Apollo launch', 'Billing v2', 'Onboarding revamp', 'Mobile app', 'Data warehouse', 'Design system', 'Search infra', 'Acme website', 'Q4 planning', 'Customer portal']
const colors = ['#8b5cf6', '#22c55e', '#f97316', '#3b82f6', '#ec4899', '#14b8a6']

export const projects: Item[] = names.map((name, i) => {
  const s = statuses[i % statuses.length]!
  return {
    id: `project-${i}`,
    title: name,
    subtitle: `ACME-${120 + i * 7}`,
    icon: { color: colors[i % colors.length]!, icon: 'folder' },
    keywords: ['project', s.value],
    accessories: [{ tag: { value: s.value, color: s.color } }, { date: Date.now() - (i + 1) * 3.6e6 * (i + 2) }],
    detail: `## ${name}\n\n**Status:** ${s.value}  \n**Lead:** ${['Ada', 'Grace', 'Linus', 'Margaret'][i % 4]}\n\n- ${3 + i} open issues\n- Last deploy ${i + 1}h ago\n\n\`\`\`bash\nacme deploy ${name.toLowerCase().replace(/\s+/g, '-')}\n\`\`\``,
    actions: [
      action.copy(`https://acme.app/projects/${i}`, { title: 'Copy Link' }),
      { title: 'Archive Project', icon: 'trash', style: 'destructive', shortcut: 'mod+backspace', run: async (ctx) => {
        if (!(await ctx.confirm({ title: `Archive ${name}?`, destructive: true, confirmLabel: 'Archive' }))) return false
        ctx.toast({ title: `Archived ${name}`, style: 'success' })
        return false
      } },
    ],
    run: (ctx) => ctx.toast({ title: `Opened ${name}`, message: '(demo)', style: 'success' }),
  }
})

const people = ['Ada Lovelace', 'Grace Hopper', 'Linus Torvalds', 'Margaret Hamilton', 'Alan Turing', 'Katherine Johnson', 'Dennis Ritchie', 'Barbara Liskov', 'Ken Thompson', 'Radia Perlman', 'Tim Berners-Lee', 'Frances Allen']

export const projectSource: Source = {
  id: 'demo-projects',
  title: 'Projects',
  debounce: 60,
  async search({ query, signal }) {
    await new Promise((r) => setTimeout(r, 90))
    if (signal.aborted) return []
    const q = query.toLowerCase()
    return projects.filter((p) => p.title.toLowerCase().includes(q) || p.subtitle?.toLowerCase().includes(q))
  },
}

export const demoCommands: Command[] = [
  {
    title: 'Create Issue',
    icon: 'plus',
    section: 'Issues',
    shortcut: 'c i',
    view: form({
      title: 'New Issue',
      submitLabel: 'Create Issue',
      fields: [
        { name: 'title', label: 'Title', required: true, placeholder: 'Checkout button is misaligned' },
        { name: 'project', label: 'Project', type: 'select', options: names.slice(0, 5).map((n) => ({ title: n, value: n })) },
        { name: 'priority', label: 'Priority', type: 'select', options: ['Urgent', 'High', 'Medium', 'Low'].map((p) => ({ title: p, value: p })), defaultValue: 'Medium' },
        { name: 'body', label: 'Description', type: 'textarea', placeholder: 'Steps to reproduce…' },
      ],
      onSubmit: (v, ctx) => {
        ctx.toast({ title: `Created “${v.title}”`, style: 'success' })
        return false
      },
    }),
  },
  { title: 'Browse Projects', icon: 'folder', section: 'Issues', view: list({ title: 'Projects', items: projects, detail: true, placeholder: 'Filter projects…' }) },
  {
    title: 'Team Directory',
    icon: 'users',
    section: 'Team',
    view: grid({
      title: 'Team',
      columns: 4,
      items: people.map((p, i) => ({
        title: p,
        subtitle: ['Engineering', 'Design', 'Product'][i % 3],
        image: `https://i.pravatar.cc/240?img=${i + 3}`,
        actions: [action.copy(`${p.split(' ')[0]!.toLowerCase()}@acme.app`, { title: 'Copy Email' })],
      })),
    }),
  },
  {
    title: 'Release Notes',
    icon: 'file-text',
    section: 'Help',
    view: detail({
      title: 'Release Notes',
      markdown: '# Acme 4.2\n\n- **New:** a command bar, powered by Qikbar\n- Search across projects and people\n- Ask AI to do things for you\n\n> Press `⌘K` anywhere to try it.',
      metadata: [
        { label: 'Version', value: '4.2.0' },
        { label: 'Status', tag: { value: 'Stable', color: 'green' } },
        { label: 'Released', value: 'Oct 2026' },
      ],
    }),
  },
  {
    title: 'Send Feedback',
    icon: 'message',
    section: 'Help',
    arguments: [{ name: 'message', placeholder: 'Your feedback', required: true }],
    run: (ctx) => ctx.toast({ title: 'Thanks for the feedback!', message: ctx.arguments.message, style: 'success' }),
  },
  { title: 'Go to Billing', icon: 'credit-card', section: 'Navigation', keywords: ['plan', 'invoice', 'payment'], run: (ctx) => ctx.toast({ title: 'Navigated to /billing', message: '(demo)', style: 'success' }) },
  { title: 'Go to Settings', icon: 'settings', section: 'Navigation', keywords: ['preferences', 'account'], run: (ctx) => ctx.toast({ title: 'Navigated to /settings', message: '(demo)', style: 'success' }) },
  { title: 'Go to Inbox', icon: 'inbox', section: 'Navigation', accessories: [{ tag: { value: '3 new', color: 'blue' } }], run: (ctx) => ctx.toast({ title: 'Navigated to /inbox', message: '(demo)', style: 'success' }) },
]
