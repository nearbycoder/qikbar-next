/** Starter snippets for the playground. Each returns a Qikbar config. */
export const examples: { name: string; code: string }[] = [
  {
    name: 'Basics',
    code: `// Return a config. Helpers like list(), form() and action are in scope.
return {
  placeholder: 'What do you want to do?',
  routes: [
    { path: '/', title: 'Home', icon: 'home' },
    { path: '/inbox', title: 'Inbox', icon: 'inbox', accessories: [{ tag: { value: '3', color: 'blue' } }] },
    { path: '/settings', title: 'Settings', icon: 'settings', keywords: ['preferences'] },
  ],
  commands: [
    { title: 'New document', icon: 'plus', section: 'Create', shortcut: 'c d', run: (ctx) => ctx.toast({ title: 'Created a document', style: 'success' }) },
    { title: 'New folder', icon: 'folder', section: 'Create', run: (ctx) => ctx.toast('Created a folder') },
    { title: 'Toggle sidebar', icon: 'layout-dashboard', section: 'View', shortcut: 'mod+b', run: (ctx) => ctx.toast('Toggled') },
    { title: 'Sign out', icon: 'log-out', section: 'Account', searchOnly: true, run: (ctx) => ctx.toast('Signed out (not really)') },
  ],
  navigate: (href) => alert('Navigate to ' + href),
}`,
  },
  {
    name: 'Views',
    code: `const people = ['Ada', 'Grace', 'Linus', 'Margaret', 'Alan', 'Barbara', 'Ken', 'Radia']

return {
  commands: [
    {
      title: 'Browse issues', icon: 'list',
      view: list({
        title: 'Issues',
        detail: true,
        items: [
          { title: 'Login fails on Safari', subtitle: '#142', accessories: [{ tag: { value: 'Bug', color: 'red' } }], detail: '## Login fails on Safari\\n\\nSteps:\\n1. Open Safari 17\\n2. Sign in\\n\\n**Expected:** dashboard' },
          { title: 'Dark mode for emails', subtitle: '#139', accessories: [{ tag: { value: 'Feature', color: 'purple' } }], detail: 'Users want dark email templates.' },
        ],
      }),
    },
    {
      title: 'Team', icon: 'users',
      view: grid({ title: 'Team', columns: 4, items: people.map((p, i) => ({ title: p, image: 'https://i.pravatar.cc/200?img=' + (i + 10) })) }),
    },
    {
      title: 'What is Qikbar?', icon: 'info',
      view: detail({
        title: 'About',
        markdown: '# Qikbar\\n\\nAn **open-source** command bar.\\n\\n| Feature | Status |\\n| --- | --- |\\n| Views | ✅ |\\n| AI | ✅ |',
        metadata: [{ label: 'License', value: 'MIT' }, { label: 'Status', tag: { value: 'Stable', color: 'green' } }],
      }),
    },
    {
      title: 'Report a bug', icon: 'alert',
      view: form({
        title: 'Report a bug',
        fields: [
          { name: 'title', label: 'Title', required: true },
          { name: 'severity', label: 'Severity', type: 'select', options: [{ title: 'Low', value: 'low' }, { title: 'High', value: 'high' }] },
          { name: 'details', label: 'Details', type: 'textarea' },
        ],
        onSubmit: (v, ctx) => ctx.toast({ title: 'Reported: ' + v.title, style: 'success' }),
      }),
    },
  ],
}`,
  },
  {
    name: 'Live search',
    code: `// A source runs as you type: debounced, cancellable, merged into results.
const cities = ['Amsterdam', 'Barcelona', 'Berlin', 'Buenos Aires', 'Cairo', 'Cape Town', 'Chicago', 'Lisbon', 'London', 'Madrid', 'Mexico City', 'Montreal', 'Mumbai', 'Nairobi', 'New York', 'Oslo', 'Paris', 'Prague', 'Rome', 'Seoul', 'Singapore', 'Stockholm', 'Sydney', 'Tokyo', 'Toronto', 'Vienna']

return {
  commands: [{ title: 'Plan a trip', icon: 'globe', section: 'Travel' }],
  sources: [{
    id: 'cities',
    title: 'Cities',
    debounce: 120,
    async search({ query, signal }) {
      await new Promise((r) => setTimeout(r, 300)) // pretend network
      if (signal.aborted) return []
      return cities
        .filter((c) => c.toLowerCase().includes(query.toLowerCase()))
        .map((c) => ({ title: c, icon: 'globe', accessories: [{ text: 'City' }], run: (ctx) => ctx.toast('Selected ' + c) }))
    },
  }],
  extensions: [extensions.calculator()],
}`,
  },
  {
    name: 'Extension',
    code: `// Extensions bundle commands, sources and preferences.
const greeter = defineExtension({
  name: 'greeter',
  title: 'Greeter',
  icon: '👋',
  preferences: [{ name: 'name', title: 'Your name', type: 'text', required: true }],
  commands: [
    {
      name: 'hello',
      title: 'Say hello',
      icon: '👋',
      run: (ctx) => ctx.toast({ title: 'Hello, ' + ctx.preferences.name + '!', style: 'success' }),
    },
    {
      name: 'shout',
      title: 'Shout something',
      icon: '📣',
      arguments: [{ name: 'text', placeholder: 'Text', required: true }],
      run: (ctx) => ctx.toast(ctx.arguments.text.toUpperCase() + '!'),
    },
  ],
})

// The first run asks for "Your name" and remembers it.
return { extensions: [greeter, extensions.shortcuts()] }`,
  },
  {
    name: 'AI',
    code: `// A scripted demo model, so this works without a key.
// Swap in anthropic({ apiKey }), openai(), gemini() or proxy('/api/qikbar').
return {
  ai: { provider: demoAI, suggestions: ['What can you do?', 'Go to billing'] },
  commands: [
    { title: 'Go to billing', icon: 'credit-card', run: (ctx) => ctx.toast('Opened billing') },
    { title: 'Go to settings', icon: 'settings', run: (ctx) => ctx.toast('Opened settings') },
  ],
}
// Type "go to billing" and press Tab.`,
  },
  {
    name: 'Theming',
    code: `return {
  theme: {
    preset: 'midnight',
    vars: { accent: '#f472b6', highlight: '#f9a8d4', radius: '20px', radiusItem: '12px', rowHeight: '46px' },
  },
  commands: ['Inbox', 'Drafts', 'Sent', 'Archive', 'Spam'].map((t, i) => ({
    title: t,
    icon: ['inbox', 'pencil', 'send', 'bookmark', 'alert'][i],
    accessories: i === 0 ? [{ tag: { value: '12', color: '#f472b6' } }] : [],
  })),
}`,
  },
]
