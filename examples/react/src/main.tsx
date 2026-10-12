import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { form, list, type Command, type Route } from '@qikbar/qikbar'
import { calculator, shortcuts, themeSwitcher } from '@qikbar/qikbar/extensions'
import { Qikbar, QikbarTrigger, useCommands } from '@qikbar/qikbar/react'
import './styles.css'

type Page = 'home' | 'projects' | 'settings'

const routes: Route[] = [
  { path: 'home', title: 'Home', icon: 'home', shortcut: 'g h' },
  { path: 'projects', title: 'Projects', icon: 'folder', shortcut: 'g p' },
  { path: 'settings', title: 'Settings', icon: 'settings', shortcut: 'g s' },
]

// Create extension instances once, outside components.
const extensions = [calculator(), themeSwitcher(), shortcuts()]

const projects = ['Apollo', 'Gemini', 'Mercury', 'Artemis'].map((name, i) => ({ id: String(i), name }))

function App() {
  const [page, setPage] = useState<Page>('home')
  const [count, setCount] = useState(0)

  const commands: Command[] = [
    { title: 'Increment counter', icon: 'plus', shortcut: 'mod+i', run: () => setCount((c) => c + 1), section: 'Demo' },
    {
      title: 'Browse projects',
      icon: 'layers',
      section: 'Demo',
      view: list({
        title: 'Projects',
        items: projects.map((p) => ({ title: p.name, icon: 'folder', run: () => setPage('projects') })),
      }),
    },
    {
      title: 'Rename workspace',
      icon: 'pencil',
      section: 'Demo',
      view: form({
        title: 'Rename workspace',
        fields: [{ name: 'name', label: 'Name', required: true, defaultValue: 'Acme' }],
        onSubmit: (v, ctx) => ctx.toast({ title: `Renamed to ${v.name}`, style: 'success' }),
      }),
    },
  ]

  return (
    <div className="app">
      <Qikbar
        routes={routes}
        commands={commands}
        extensions={extensions}
        navigate={(href) => setPage(href as Page)}
        theme="linear"
      />
      <header>
        <strong>Acme</strong>
        <nav>
          {routes.map((r) => (
            <button key={r.path} onClick={() => setPage(r.path as Page)} aria-current={page === r.path ? 'page' : undefined}>
              {r.title}
            </button>
          ))}
        </nav>
        <QikbarTrigger className="trigger" label="Search…" />
      </header>
      <main>
        {page === 'home' && <Home count={count} />}
        {page === 'projects' && <Projects />}
        {page === 'settings' && <h1>Settings</h1>}
      </main>
    </div>
  )
}

function Home({ count }: { count: number }) {
  return (
    <>
      <h1>Home</h1>
      <p>
        Counter: <b>{count}</b>. Press <kbd>⌘K</kbd> and run “Increment counter”, or press <kbd>⌘I</kbd>.
      </p>
    </>
  )
}

function Projects() {
  // These commands exist only while this page is mounted.
  useCommands(
    projects.map((p) => ({ title: `Open ${p.name}`, icon: 'folder', section: 'This page', run: () => alert(p.name) })),
    [],
  )
  return (
    <>
      <h1>Projects</h1>
      <p>This page registers its own commands with <code>useCommands</code>. Open the bar to see them.</p>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
