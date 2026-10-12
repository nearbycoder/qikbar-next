/**
 * Pixel-accurate stand-ins for Qikbar's UI, built from the library's own
 * stylesheet, icons, fuzzy matcher and Markdown renderer. Everything is
 * driven by the current frame, so renders are fully deterministic.
 */
import type { CSSProperties, ReactNode } from 'react'
import { css } from '@qikbar/qikbar/theme'
import { iconSvg, matchItem, renderMarkdown } from '@qikbar/qikbar/utils'

export const QikbarStyles = () => (
  <style>{`${css}
.qb-root *, .qb-root *::before, .qb-root *::after { animation: none !important; transition: none !important; }
.qb-root { font-family: 'Inter Variable', sans-serif; --qb-font: 'Inter Variable', sans-serif; --qb-font-mono: 'JetBrains Mono Variable', monospace; }
.qb-root[data-qb-inline] .qb-body { height: var(--qb-list-height); }
.qb-dialog { box-shadow: 0 50px 120px -30px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.04), 0 0 120px -40px rgba(52,211,153,.35) !important; }
`}</style>
)

export type IconLike = string | { color: string; icon?: string }

export function QIcon({ icon, size = 16 }: { icon?: IconLike; size?: number }) {
  if (!icon) return null
  if (typeof icon === 'object') {
    return <span className="qb-icon qb-icon-tinted" style={{ ['--qb-tint' as string]: icon.color }} dangerouslySetInnerHTML={{ __html: iconSvg(icon.icon ?? 'dot', size) ?? '' }} />
  }
  const svg = iconSvg(icon, size)
  if (svg) return <span className="qb-icon" dangerouslySetInnerHTML={{ __html: svg }} />
  if (icon.startsWith('<svg')) return <span className="qb-icon" dangerouslySetInnerHTML={{ __html: icon }} />
  return <span className="qb-icon qb-icon-text">{icon}</span>
}

export const Kbds = ({ keys }: { keys: string[] }) => (
  <span className="qb-kbds">
    {keys.map((k, i) => (
      <kbd key={i} className="qb-kbd">
        {k}
      </kbd>
    ))}
  </span>
)

export function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>
  const m = matchItem({ title: text }, query)
  if (!m || !m.positions.length) return <>{text}</>
  const set = new Set(m.positions)
  const out: ReactNode[] = []
  let buf = ''
  let mark = false
  const flush = (k: number) => {
    if (!buf) return
    out.push(mark ? <mark key={k} className="qb-match">{buf}</mark> : <span key={k}>{buf}</span>)
    buf = ''
  }
  ;[...text].forEach((ch, i) => {
    const isMark = set.has(i)
    if (isMark !== mark) {
      flush(i)
      mark = isMark
    }
    buf += ch
  })
  flush(text.length)
  return <>{out}</>
}

export interface Accessory {
  text?: string
  tag?: { value: string; color?: string }
  kbd?: string[]
  icon?: string
}

const TAG_COLORS: Record<string, string> = { blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', red: '#ef4444', purple: '#a855f7', orange: '#f97316', pink: '#ec4899' }

export function Accessories({ items }: { items: Accessory[] }) {
  return (
    <span className="qb-item-accessories">
      {items.map((a, i) => (
        <span key={i} className="qb-accessory">
          {a.icon && <QIcon icon={a.icon} size={14} />}
          {a.tag && (
            <span className="qb-tag" style={a.tag.color ? { ['--qb-tint' as string]: TAG_COLORS[a.tag.color] ?? a.tag.color } : undefined}>
              {a.tag.value}
            </span>
          )}
          {a.text && <span>{a.text}</span>}
          {a.kbd && <Kbds keys={a.kbd} />}
        </span>
      ))}
    </span>
  )
}

export interface RowData {
  title: string
  subtitle?: string
  icon?: IconLike
  section?: string
  accessories?: Accessory[]
  kind?: string
  keywords?: string[]
}

export function Row({ row, selected, query, style }: { row: RowData; selected?: boolean; query?: string; style?: CSSProperties }) {
  return (
    <div className="qb-item" aria-selected={selected ? 'true' : 'false'} style={style}>
      <span className="qb-item-icon">
        <QIcon icon={row.icon ?? 'command'} />
      </span>
      <span className="qb-item-text">
        <span className="qb-item-title">
          <Highlight text={row.title} query={query} />
        </span>
        {row.subtitle && <span className="qb-item-subtitle">{row.subtitle}</span>}
      </span>
      {row.accessories?.length ? <Accessories items={row.accessories} /> : row.kind ? <span className="qb-item-kind">{row.kind}</span> : null}
    </div>
  )
}

export const Section = ({ title, style }: { title: string; style?: CSSProperties }) => (
  <div className="qb-section" style={style}>
    {title}
  </div>
)

/** A list body. Entries are rows or section titles; `reveal` lets callers animate individual rows. */
export function List({
  entries,
  selected,
  query,
  reveal,
  scroll = 0,
}: {
  entries: (RowData | { section: string; isSection: true })[]
  selected: number
  query?: string
  reveal?: (index: number) => CSSProperties | undefined
  scroll?: number
}) {
  let itemIndex = -1
  return (
    <div className="qb-scroll qb-list" style={{ overflow: 'hidden' }}>
      <div className="qb-list-inner" style={{ transform: `translateY(${-scroll}px)` }}>
        {entries.map((e, i) => {
          if ('isSection' in e) return <Section key={`s${i}`} title={e.section} style={reveal?.(i)} />
          itemIndex++
          return <Row key={i} row={e} selected={itemIndex === selected} query={query} style={reveal?.(i)} />
        })}
      </div>
    </div>
  )
}

/** Group rows into sections in first-appearance order (what the real bar does). */
export function grouped(rows: RowData[]): (RowData | { section: string; isSection: true })[] {
  const order: string[] = []
  const by = new Map<string, RowData[]>()
  for (const r of rows) {
    const s = r.section ?? 'Commands'
    if (!by.has(s)) {
      by.set(s, [])
      order.push(s)
    }
    by.get(s)!.push(r)
  }
  return order.flatMap((s) => [{ section: s, isSection: true as const }, ...by.get(s)!])
}

const Caret = ({ on }: { on: boolean }) => (
  <span style={{ display: 'inline-block', width: 2, height: 22, margin: '0 1px', background: 'var(--qb-accent)', opacity: on ? 1 : 0 }} />
)

export function Header({
  query = '',
  placeholder = 'Search for commands, pages and more…',
  caret = true,
  crumb,
  hint = true,
  progress,
  frame = 0,
}: {
  query?: string
  placeholder?: string
  caret?: boolean
  crumb?: { label: string; icon?: IconLike }
  hint?: boolean
  progress?: number | null
  frame?: number
}) {
  const showCaret = caret && Math.floor(frame / 15) % 2 === 0
  return (
    <div className="qb-header">
      {crumb ? (
        <>
          <button className="qb-back" type="button" dangerouslySetInnerHTML={{ __html: iconSvg('arrow-left', 15) ?? '' }} />
          <div className="qb-crumb">
            <QIcon icon={crumb.icon} size={13} />
            <span>{crumb.label}</span>
          </div>
        </>
      ) : (
        <span className="qb-header-icon">
          <QIcon icon="search" size={18} />
        </span>
      )}
      <div className="qb-input" style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--qb-input-font-size)', whiteSpace: 'pre' }}>
        {!query && caret && <Caret on={showCaret} />}
        <span style={{ color: query ? 'var(--qb-fg)' : 'var(--qb-fg-subtle)' }}>{query || placeholder}</span>
        {query && caret && <Caret on={showCaret} />}
      </div>
      {hint && !crumb && (
        <div className="qb-hint">
          <span>Ask AI</span>
          <Kbds keys={['Tab']} />
        </div>
      )}
      <div className="qb-progress" data-active={progress != null ? '' : undefined} style={{ opacity: progress != null ? 1 : 0 }}>
        {progress != null && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '35%',
              left: `${-35 + progress * 135}%`,
              background: 'linear-gradient(90deg, transparent, var(--qb-accent), transparent)',
            }}
          />
        )}
      </div>
    </div>
  )
}

export interface Toast {
  title: string
  message?: string
  style?: 'success' | 'failure' | 'loading' | 'info'
}

export function Footer({
  left,
  toast,
  primary = 'Open',
  primaryKeys = ['↵'],
  actions = true,
}: {
  left?: ReactNode
  toast?: Toast | null
  primary?: string
  primaryKeys?: string[]
  actions?: boolean
}) {
  const toastIcon = toast?.style === 'success' ? 'check-circle' : toast?.style === 'failure' ? 'x-circle' : toast?.style === 'loading' ? 'loader' : 'info'
  return (
    <div className="qb-footer">
      <div className="qb-footer-left">
        {toast ? (
          <div className="qb-toast" data-style={toast.style ?? 'info'}>
            <QIcon icon={toastIcon} size={14} />
            <span className="qb-toast-title">{toast.title}</span>
            {toast.message && <span className="qb-toast-msg">{toast.message}</span>}
          </div>
        ) : (
          left
        )}
      </div>
      <div className="qb-footer-right">
        <button className="qb-footer-btn qb-primary" type="button">
          <span>{primary}</span>
          <Kbds keys={primaryKeys} />
        </button>
        {actions && (
          <>
            <span className="qb-footer-sep" />
            <button className="qb-footer-btn" type="button">
              <span>Actions</span>
              <Kbds keys={['⌘', '.']} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** The bar shell. `vars` are theme CSS variables (from resolveThemeVars). */
export function Bar({
  vars,
  appearance = 'dark',
  children,
  style,
  overlay,
}: {
  vars?: Record<string, string>
  appearance?: 'light' | 'dark'
  children: ReactNode
  style?: CSSProperties
  overlay?: ReactNode
}) {
  return (
    <div className="qb-root" data-qb-inline="" data-qb-appearance={appearance} style={{ ['--qb-font-size' as string]: '15px', ['--qb-input-font-size' as string]: '18px', ['--qb-row-height' as string]: '45px', ['--qb-section-height' as string]: '32px', ...vars, ['--qb-list-height' as string]: '440px', width: 760, ...style }}>
      <div className="qb-dialog" style={{ position: 'relative' }}>
        {children}
        {overlay}
      </div>
    </div>
  )
}

export const Body = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="qb-body" style={style}>
    {children}
  </div>
)

export interface PanelAction {
  title: string
  icon: string
  keys?: string[]
  destructive?: boolean
  section?: string
}

export function ActionPanel({ title, actions, selected, style }: { title: string; actions: PanelAction[]; selected: number; style?: CSSProperties }) {
  let last: string | undefined
  return (
    <div className="qb-actions" style={style}>
      <div className="qb-actions-title">{title}</div>
      <div className="qb-actions-list">
        {actions.map((a, i) => {
          const header = a.section && a.section !== last ? <div className="qb-section">{a.section}</div> : null
          last = a.section
          return (
            <div key={i}>
              {header}
              <div className="qb-action" aria-selected={i === selected ? 'true' : 'false'} data-style={a.destructive ? 'destructive' : 'default'}>
                <QIcon icon={a.icon} size={15} />
                <span className="qb-action-title">{a.title}</span>
                {a.keys && <Kbds keys={a.keys} />}
              </div>
            </div>
          )
        })}
      </div>
      <div className="qb-actions-input" style={{ display: 'flex', alignItems: 'center', color: 'var(--qb-fg-subtle)' }}>
        Search for actions…
      </div>
    </div>
  )
}

export const Markdown = ({ md, caret }: { md: string; caret?: boolean }) => (
  <div className="qb-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(md) + (caret ? '<span class="qb-caret" style="animation:none"></span>' : '') }} />
)

export { iconSvg }
