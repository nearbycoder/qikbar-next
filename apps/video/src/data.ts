import type { RowData } from './components/qb'

export const COMMANDS: RowData[] = [
  { title: 'Dashboard', icon: 'layout-dashboard', section: 'Navigation', kind: 'Page' },
  { title: 'Inbox', icon: 'inbox', section: 'Navigation', accessories: [{ tag: { value: '3 new', color: 'blue' } }] },
  { title: 'Invoices', icon: 'file-text', section: 'Navigation', kind: 'Page', keywords: ['billing'] },
  { title: 'Billing', icon: 'credit-card', section: 'Navigation', kind: 'Page' },
  { title: 'Settings', icon: 'settings', section: 'Navigation', kind: 'Page' },
  { title: 'Create issue', icon: 'plus', section: 'Actions', accessories: [{ kbd: ['C', 'I'] }] },
  { title: 'Invite teammate', icon: 'users', section: 'Actions', kind: 'Command' },
  { title: 'Toggle dark mode', icon: 'moon', section: 'Actions', accessories: [{ kbd: ['⌘', '⇧', 'L'] }] },
  { title: 'Switch workspace', icon: 'layers', section: 'Actions', kind: 'Command' },
  { title: 'Export CSV', icon: 'download', section: 'Actions', kind: 'Command' },
  { title: 'Sign out', icon: 'log-out', section: 'Account', kind: 'Command' },
]

export const ROOT: RowData[] = [
  { title: 'Acme Rocket', subtitle: 'ACME-128', icon: { color: '#a78bfa', icon: 'folder' }, section: 'Recent', kind: 'Project' },
  ...COMMANDS.filter((c) => ['Dashboard', 'Inbox', 'Billing', 'Settings', 'Create issue', 'Invite teammate', 'Toggle dark mode'].includes(c.title)),
]

export const ACME: RowData[] = [
  { title: 'Acme Rocket', subtitle: 'ACME-128', icon: { color: '#a78bfa', icon: 'folder' }, section: 'Projects', accessories: [{ tag: { value: 'In progress', color: 'blue' } }, { text: '2h ago' }] },
  { title: 'Acme Website', subtitle: 'ACME-091', icon: { color: '#34d399', icon: 'folder' }, section: 'Projects', accessories: [{ tag: { value: 'Shipped', color: 'green' } }, { text: '1d ago' }] },
  { title: 'Acme Billing v2', subtitle: 'ACME-140', icon: { color: '#fb923c', icon: 'folder' }, section: 'Projects', accessories: [{ tag: { value: 'Review', color: 'yellow' } }, { text: '3d ago' }] },
  { title: 'Acme Corp', subtitle: 'acme.com', icon: { color: '#60a5fa', icon: 'users' }, section: 'Customers', accessories: [{ tag: { value: 'Enterprise', color: 'purple' } }] },
]

export const PEOPLE = [
  ['Ada Lovelace', 'Engineering', '#a78bfa'],
  ['Grace Hopper', 'Platform', '#34d399'],
  ['Linus Park', 'Design', '#f472b6'],
  ['Maya Chen', 'Product', '#60a5fa'],
  ['Sam Rivera', 'Support', '#fb923c'],
  ['Kenji Ito', 'Engineering', '#22d3ee'],
  ['Nora Diaz', 'Marketing', '#facc15'],
  ['Omar Haddad', 'Sales', '#4ade80'],
] as const
