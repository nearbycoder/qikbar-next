import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { rank } from '@qikbar/qikbar/utils'
import { ActionPanel, Bar, Body, Footer, grouped, Header, iconSvg, List, Markdown, QIcon, type RowData, type Toast } from '../components/qb'
import { C, Caption, clamp, KeyHint, Stage, t01, useSpring } from '../components/motion'
import { ACME, COMMANDS, PEOPLE } from '../data'
import { erase, SCENES, TYPE } from '../timeline'

const footerHint = <span style={{ color: 'var(--qb-fg-subtle)' }}>Acme · 12 shortcuts</span>

function searchRows(query: string): RowData[] {
  if (!query.trim()) return []
  const items = COMMANDS.map((c) => ({ title: c.title, keywords: c.keywords, section: c.section }))
  return rank(items, query).map((r) => COMMANDS.find((c) => c.title === r.item.title)!)
}

const askAI = (q: string): RowData => ({ title: 'Ask AI', subtitle: `“${q}”`, icon: 'sparkles', section: `Use “${q.length > 22 ? `${q.slice(0, 22)}…` : q}” with…`, accessories: [{ kbd: ['Tab'] }] })

// ─── 02 Search ──────────────────────────────────────────────────────────────

export function Search() {
  const f = useCurrentFrame()
  const query = f < 92 ? TYPE.searchInv.at(f) : f < 112 ? erase('inv', 92, 4, f) : TYPE.searchTdm.at(f)
  const rows = query ? [...searchRows(query), askAI(query)] : []
  const toast: Toast | null = f >= 180 ? { title: 'Dark mode on', style: 'success' } : null
  return (
    <AbsoluteFill>
      <Caption
        index="02"
        label="Search"
        title="Instant fuzzy search"
        body="Word starts, acronyms and typos. The things you use most rise to the top."
        chips={['~3 ms for 10k items', 'Frecency', 'Highlights']}
        len={SCENES.search.len}
      />
      <Stage>
        <Bar>
          <Header query={query} frame={f} />
          <BodyList entries={query ? grouped(rows) : grouped(COMMANDS.slice(0, 8))} query={query} selected={0} />
          <Footer toast={toast} left={footerHint} primary={query.startsWith('t') ? 'Run Command' : 'Open'} />
        </Bar>
      </Stage>
      <KeyHint at={92} keys={['⌫']} label="Clear" />
      <KeyHint at={112} keys={['T', 'D', 'M']} label="Acronyms work" />
      <KeyHint at={176} keys={['↵']} label="Run" />
    </AbsoluteFill>
  )
}

function BodyList({ entries, query, selected, reveal }: { entries: ReturnType<typeof grouped>; query?: string; selected: number; reveal?: (i: number) => React.CSSProperties | undefined }) {
  return (
    <Body>
      <List entries={entries} query={query} selected={selected} reveal={reveal} />
    </Body>
  )
}

// ─── 03 Sources ─────────────────────────────────────────────────────────────

function acmeEntries(f: number, showSources: boolean) {
  const q = 'acme'
  const local = searchRows(q)
  const rows: RowData[] = [...local, ...(showSources ? ACME : []), askAI(q)]
  return grouped(rows)
}

export function Sources() {
  const f = useCurrentFrame()
  const query = TYPE.sourcesAcme.at(f)
  const loading = f >= 24 && f < 54
  const showSources = f >= 52
  const entries = query.length >= 4 ? acmeEntries(f, showSources) : query ? grouped([askAI(query)]) : grouped(COMMANDS.slice(0, 8))
  const selected = f >= 132 ? 0 : f >= 112 ? 1 : 0
  // Stagger rows in as results arrive.
  const reveal = (i: number) => {
    if (!showSources) return undefined
    const appear = 52 + i * 4
    const s = t01(f, appear, appear + 10)
    return { opacity: s, transform: `translateX(${(1 - s) * 18}px)` }
  }
  return (
    <AbsoluteFill>
      <Caption
        index="03"
        label="Live data"
        title="Search your API as you type"
        body="Sources are debounced and cancelled for you. Results stream into their own sections."
        chips={['REST', 'Supabase', 'Algolia', 'tRPC', 'GraphQL']}
        len={SCENES.sources.len}
      />
      <Stage>
        <Bar>
          <Header query={query} frame={f} progress={loading ? ((f - 24) % 20) / 20 : null} />
          <BodyList entries={entries} query={query} selected={selected} reveal={reveal} />
          <Footer left={footerHint} />
        </Bar>
      </Stage>
      <KeyHint at={110} keys={['↓']} />
      <KeyHint at={130} keys={['↑']} />
    </AbsoluteFill>
  )
}

// ─── 04 Actions ─────────────────────────────────────────────────────────────

export function Actions() {
  const f = useCurrentFrame()
  const open = useSpring(22, { damping: 13, stiffness: 200, mass: 0.5 })
  const closing = t01(f, 98, 106)
  const sel = f >= 76 ? 2 : f >= 60 ? 1 : 0
  const toast: Toast | null = f >= 100 ? { title: 'Copied link', message: 'acme.app/projects/128', style: 'success' } : null
  return (
    <AbsoluteFill>
      <Caption
        index="04"
        label="Actions"
        title="An action for everything"
        body="↵ opens. ⌘↵ runs the second action. ⌘. shows them all, each with its own shortcut."
        chips={['Primary', 'Secondary', 'Shortcuts', 'Confirm']}
        len={SCENES.actions.len}
      />
      <Stage>
        <Bar
          overlay={
            f >= 20 && closing < 1 ? (
              <ActionPanel
                title="Acme Rocket"
                selected={sel}
                style={{ opacity: open * (1 - closing), transform: `scale(${0.92 + open * 0.08 - closing * 0.04})`, transformOrigin: '100% 100%' }}
                actions={[
                  { title: 'Open', icon: 'chevron-right', keys: ['↵'] },
                  { title: 'Open in New Tab', icon: 'external', keys: ['⌘', '↵'] },
                  { title: 'Copy Link', icon: 'link', keys: ['⌘', '⇧', 'C'] },
                  { title: 'Assign to Me', icon: 'user', keys: ['⌘', 'I'] },
                  { title: 'Archive Project', icon: 'trash', keys: ['⌘', '⌫'], destructive: true, section: 'Danger zone' },
                ]}
              />
            ) : null
          }
        >
          <Header query="acme" frame={f} caret={false} />
          <BodyList entries={acmeEntries(f, true)} query="acme" selected={0} />
          <Footer left={footerHint} toast={toast} />
        </Bar>
      </Stage>
      <KeyHint at={18} keys={['⌘', '.']} label="Actions" />
      <KeyHint at={58} keys={['↓']} />
      <KeyHint at={74} keys={['↓']} />
      <KeyHint at={96} keys={['↵']} />
    </AbsoluteFill>
  )
}

// ─── 05 Views ───────────────────────────────────────────────────────────────

const RELEASE = `# Acme 4.2

- **New:** a command bar, powered by Qikbar
- Search across every project and person
- Ask AI to do things for you

\`\`\`bash
npm install @qikbar/qikbar
\`\`\``

function ViewSlide({ f, at, children }: { f: number; at: number; children: React.ReactNode }) {
  const s = t01(f, at, at + 12)
  return <div style={{ display: 'flex', flex: 1, minWidth: 0, opacity: s, transform: `translateX(${(1 - s) * 60}px)` }}>{children}</div>
}

export function Views() {
  const f = useCurrentFrame()
  const sub = f < 100 ? 0 : f < 200 ? 1 : 2
  const gridSel = f >= 64 ? 3 : f >= 52 ? 2 : f >= 40 ? 1 : 0
  const streamed = RELEASE.slice(0, Math.floor(interpolate(f, [110, 182], [0, RELEASE.length], clamp)))
  const title = TYPE.formTitle.at(f)
  const crumbs = [
    { label: 'Team', icon: 'users' },
    { label: 'Release notes', icon: 'file-text' },
    { label: 'New issue', icon: 'plus' },
  ] as const
  const toast: Toast | null = f >= 282 ? { title: 'Issue created', message: 'ACME-152', style: 'success' } : null
  return (
    <AbsoluteFill>
      <Caption
        index="05"
        label="Views"
        title="Lists, grids, docs and forms"
        body="Commands push views onto a stack, like pages. Esc goes back. Detail views can stream."
        chips={['grid()', 'detail()', 'form()', 'list()', 'chat()']}
        activeChip={sub}
        len={SCENES.views.len}
      />
      <Stage>
        <Bar>
          <Header query="" placeholder={sub === 0 ? 'Search team…' : sub === 1 ? '' : ''} caret={sub === 0} frame={f} crumb={crumbs[sub]} hint={false} />
          <div className="qb-body" style={{ display: 'flex' }}>
            {sub === 0 && (
              <ViewSlide f={f} at={0}>
                <div className="qb-scroll qb-grid" style={{ ['--qb-columns' as string]: 4, overflow: 'hidden' }}>
                  {PEOPLE.map(([name, role, color], i) => (
                    <div key={name} className="qb-cell" aria-selected={i === gridSel ? 'true' : 'false'}>
                      <div className="qb-cell-media" style={{ background: `linear-gradient(140deg, ${color}, ${color}55)`, fontSize: 30, fontWeight: 700, color: '#0b0c0e' }}>
                        {name
                          .split(' ')
                          .map((p) => p[0])
                          .join('')}
                      </div>
                      <div className="qb-cell-title">{name}</div>
                      <div className="qb-cell-subtitle">{role}</div>
                    </div>
                  ))}
                </div>
              </ViewSlide>
            )}
            {sub === 1 && (
              <ViewSlide f={f} at={100}>
                <div className="qb-detail">
                  <Markdown md={streamed} caret={streamed.length < RELEASE.length} />
                </div>
                <div className="qb-meta">
                  {[
                    ['Version', '4.2.0'],
                    ['Released', 'Oct 2026'],
                    ['Author', 'Maya Chen'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="qb-meta-label">{k}</div>
                      <div className="qb-meta-value">{v}</div>
                    </div>
                  ))}
                  <div>
                    <div className="qb-meta-label">Status</div>
                    <div className="qb-meta-value">
                      <span className="qb-tag" style={{ ['--qb-tint' as string]: '#22c55e' }}>
                        Stable
                      </span>
                    </div>
                  </div>
                </div>
              </ViewSlide>
            )}
            {sub === 2 && (
              <ViewSlide f={f} at={200}>
                <div className="qb-form">
                  <label className="qb-form-label" data-required="">
                    Title
                  </label>
                  <div className="qb-field">
                    <div className="qb-field-input" style={{ display: 'flex', alignItems: 'center', borderColor: 'var(--qb-accent)', boxShadow: '0 0 0 3px color-mix(in srgb, var(--qb-accent) 22%, transparent)' }}>
                      {title || <span style={{ color: 'var(--qb-fg-subtle)' }}>Short summary</span>}
                      <span style={{ width: 2, height: 18, background: 'var(--qb-accent)', marginLeft: 1, opacity: Math.floor(f / 15) % 2 ? 0 : 1 }} />
                    </div>
                  </div>
                  <label className="qb-form-label">Project</label>
                  <div className="qb-field">
                    <div className="qb-field-input" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <QIcon icon={{ color: '#a78bfa', icon: 'folder' }} size={14} /> Acme Rocket
                    </div>
                  </div>
                  <label className="qb-form-label">Priority</label>
                  <div className="qb-field">
                    <div className="qb-field-input" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: '#ef4444' }} /> High
                    </div>
                  </div>
                  <label className="qb-form-label">Description</label>
                  <div className="qb-field">
                    <div className="qb-field-input" style={{ height: 92, paddingTop: 8, color: 'var(--qb-fg-subtle)' }}>
                      Steps to reproduce…
                    </div>
                  </div>
                </div>
              </ViewSlide>
            )}
          </div>
          <Footer
            toast={toast}
            left={<span>{crumbs[sub].label}</span>}
            primary={sub === 0 ? 'Copy Email' : sub === 1 ? 'Copy Content' : 'Create Issue'}
            primaryKeys={sub === 2 ? ['⌘', '↵'] : ['↵']}
          />
        </Bar>
      </Stage>
      <KeyHint at={38} keys={['→']} />
      <KeyHint at={50} keys={['→']} />
      <KeyHint at={62} keys={['→']} />
      <KeyHint at={278} keys={['⌘', '↵']} label="Submit" />
    </AbsoluteFill>
  )
}

// ─── 06 AI ──────────────────────────────────────────────────────────────────

const ANSWER = "Done! You're on **Acme Corp → Billing**.\n\nThe latest invoice, **#1042 for $1,200**, was paid on Oct 2. Want me to email a copy to finance?"

function ToolChip({ f, label, start, done }: { f: number; label: string; start: number; done: number }) {
  if (f < start) return null
  const s = t01(f, start, start + 8)
  const state = f >= done ? 'done' : 'running'
  const spin = ((f - start) * 18) % 360
  return (
    <span className="qb-tool" data-state={state} style={{ opacity: s, transform: `translateY(${(1 - s) * 6}px)` }}>
      <span className="qb-icon" style={{ transform: state === 'running' ? `rotate(${spin}deg)` : undefined }} dangerouslySetInnerHTML={{ __html: iconSvg(state === 'running' ? 'loader' : 'check', 12) ?? '' }} />
      {label}
    </span>
  )
}

export function AI() {
  const f = useCurrentFrame()
  const len = SCENES.ai.len
  const query = TYPE.aiPrompt.at(f)
  const chat = f >= 84
  const answer = ANSWER.slice(0, Math.floor(interpolate(f, [172, 262], [0, ANSWER.length], clamp)))
  const streaming = f >= 172 && answer.length < ANSWER.length
  const exit = t01(f, 326, 352)
  const userIn = t01(f, 86, 96)
  const headIn = t01(f, 94, 104)
  const toast: Toast | null = f >= 166 && f < 300 ? { title: 'Navigated', message: '/customers/acme/billing', style: 'success' } : null
  return (
    <AbsoluteFill>
      <Caption
        index="06"
        label="AI"
        title="Type what you want. It does it."
        body="Press Tab to ask. The model searches and runs your commands, and asks before anything destructive."
        chips={['Claude', 'GPT', 'Gemini', 'Ollama', 'Your own key']}
        len={len}
      />
      <Stage style={{ opacity: 1 - exit, transform: `translateY(-50%) scale(${1.4 - exit * 0.08})`, filter: `blur(${exit * 8}px)` }}>
        <Bar>
          {!chat ? (
            <>
              <Header query={query} frame={f} />
              <BodyList entries={grouped(query ? [askAI(query)] : COMMANDS.slice(0, 8))} selected={0} />
              <Footer left={footerHint} primary="Ask AI" primaryKeys={['Tab']} />
            </>
          ) : (
            <>
              <Header query="" placeholder="Ask a follow-up…" frame={f} crumb={{ label: 'AI', icon: 'sparkles' }} hint={false} />
              <div className="qb-body">
                <div className="qb-chat" style={{ overflow: 'hidden' }}>
                  <div className="qb-msg-user" style={{ opacity: userIn, transform: `translateY(${(1 - userIn) * 12}px)` }}>
                    take me to billing for acme
                  </div>
                  {f >= 94 && (
                    <div className="qb-msg-ai" style={{ opacity: headIn }}>
                      <div className="qb-msg-head">
                        <QIcon icon="sparkles" size={13} /> AI
                      </div>
                      <div className="qb-tools">
                        <ToolChip f={f} label="Searching “acme”" start={100} done={130} />
                        <ToolChip f={f} label="Opening Acme Corp · Billing" start={134} done={168} />
                      </div>
                      {answer && <Markdown md={answer} caret={streaming} />}
                    </div>
                  )}
                </div>
              </div>
              <Footer toast={toast} primary={streaming || f < 172 ? 'Stop' : 'Send'} primaryKeys={streaming || f < 172 ? ['esc'] : ['↵']} />
            </>
          )}
        </Bar>
      </Stage>
      <KeyHint at={80} keys={['Tab']} label="Ask AI" />
    </AbsoluteFill>
  )
}

export const _c = C
