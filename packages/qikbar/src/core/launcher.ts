/**
 * The floating launcher button. Lives in the lazy shell so it shows up before
 * the UI loads, with its own few lines of CSS.
 */

import type { LauncherOptions, QikbarConfig } from './types.js'

const STYLE_ID = 'qikbar-launcher-styles'

const CSS = `.qb-launcher{position:fixed;z-index:2147482999;bottom:calc(var(--qb-launcher-offset,20px) + env(safe-area-inset-bottom,0px));right:calc(var(--qb-launcher-offset,20px) + env(safe-area-inset-right,0px));width:52px;height:52px;display:grid;place-items:center;border:0;border-radius:999px;background:var(--qb-launcher-bg,#18181b);color:var(--qb-launcher-fg,#fafafa);box-shadow:0 10px 30px -8px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.08) inset;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .15s cubic-bezier(.2,.9,.3,1.3),box-shadow .15s;font:inherit}
.qb-launcher:hover{transform:scale(1.06)}
.qb-launcher:active{transform:scale(.94)}
.qb-launcher:focus-visible{outline:2px solid var(--qb-launcher-ring,#8b7dff);outline-offset:3px}
.qb-launcher[data-position=bottom-left]{right:auto;left:calc(var(--qb-launcher-offset,20px) + env(safe-area-inset-left,0px))}
.qb-launcher svg{width:22px;height:22px}
.qb-launcher[data-touch-only]{display:none}
@media (hover:none) and (pointer:coarse){.qb-launcher[data-touch-only]{display:grid}}
@media print{.qb-launcher{display:none}}
@media (prefers-color-scheme:light){:root:not(.dark):not([data-theme=dark]):not([data-mode=dark]) .qb-launcher{--qb-launcher-bg:#fff;--qb-launcher-fg:#18181b;box-shadow:0 10px 30px -10px rgba(0,0,0,.25),0 0 0 1px rgba(0,0,0,.08) inset}}
:root.light .qb-launcher,:root[data-theme=light] .qb-launcher,:root[data-mode=light] .qb-launcher{--qb-launcher-bg:#fff;--qb-launcher-fg:#18181b;box-shadow:0 10px 30px -10px rgba(0,0,0,.25),0 0 0 1px rgba(0,0,0,.08) inset}`

const SEARCH_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'

export function resolveLauncher(value: QikbarConfig['launcher']): LauncherOptions | undefined {
  if (!value) return undefined
  if (value === true) return {}
  if (value === 'touch') return { touchOnly: true }
  return value
}

/** Mount the launcher. Returns a function that removes it. */
export function mountLauncher(options: LauncherOptions, label: string, onOpen: () => void, nonce?: string): () => void {
  if (typeof document === 'undefined') return () => {}
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    if (nonce) style.nonce = nonce
    style.textContent = CSS
    document.head.append(style)
  }
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'qb-launcher'
  button.setAttribute('aria-label', options.label ?? label)
  button.title = options.label ?? label
  button.dataset.position = options.position ?? 'bottom-right'
  if (options.touchOnly) button.dataset.touchOnly = ''
  if (options.offset != null) button.style.setProperty('--qb-launcher-offset', `${options.offset}px`)
  const icon = options.icon ?? SEARCH_SVG
  if (icon.trimStart().startsWith('<svg')) button.innerHTML = icon
  else button.textContent = icon
  button.addEventListener('click', (e) => {
    e.preventDefault()
    onOpen()
  })
  document.body.append(button)
  return () => button.remove()
}
