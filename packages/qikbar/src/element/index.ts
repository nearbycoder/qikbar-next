/**
 * `<qik-bar>`: Qikbar as a custom element. Works in plain HTML, HTMX, Angular,
 * Rails, Django, Laravel — anywhere you can write a tag.
 *
 * ```html
 * <script type="module">import '@qikbar/qikbar/element'</script>
 *
 * <qik-bar placeholder="Search Acme…" launcher="touch">
 *   <qik-command href="/settings" section="Navigation" icon="settings">Settings</qik-command>
 *   <qik-command id="theme" shortcut="mod+shift+l">Toggle theme</qik-command>
 * </qik-bar>
 *
 * <script>
 *   document.getElementById('theme').addEventListener('run', toggleTheme)
 * </script>
 * ```
 *
 * Set the `config` property for anything attributes can't express (sources,
 * extensions, AI). Events: `qikbar-open`, `qikbar-close`, `qikbar-run`, `qikbar-event`.
 */

import { createQikbar } from '../index.js'
import type { Appearance, Item, QikbarConfig, QikbarInstance, ThemePresetName } from '../core/types.js'

const Base: typeof HTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement)

const ATTRS = ['placeholder', 'hotkey', 'theme', 'appearance', 'inline', 'namespace', 'launcher', 'touch', 'webmcp', 'footer'] as const

/** Read `<qik-command>` children into commands. */
function readCommands(host: HTMLElement): Item[] {
  return [...host.querySelectorAll<HTMLElement>(':scope > qik-command, :scope > qik-commands > qik-command')].map((el, i) => {
    const attr = (name: string) => el.getAttribute(name) ?? undefined
    const title = attr('title') ?? (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    const item: Item = {
      id: el.id || attr('command-id') || `el:${i}:${title}`,
      title,
      subtitle: attr('subtitle'),
      description: attr('description'),
      section: attr('section') ?? el.closest('qik-commands')?.getAttribute('section') ?? undefined,
      icon: attr('icon'),
      keywords: attr('keywords')
        ?.split(',')
        .map((k) => k.trim())
        .filter(Boolean),
      shortcut: attr('shortcut'),
      href: attr('href'),
      url: attr('url'),
    }
    if (!item.href && !item.url) {
      item.run = () => {
        const ev = new CustomEvent('run', { bubbles: true, cancelable: true, detail: { item } })
        el.dispatchEvent(ev)
        return el.hasAttribute('keep-open') ? false : undefined
      }
    }
    return item
  })
}

export class QikbarElement extends Base {
  static get observedAttributes() {
    return [...ATTRS]
  }

  private instance?: QikbarInstance
  private extra: QikbarConfig = {}
  private unregister?: () => void
  private observer?: MutationObserver
  private offs: (() => void)[] = []

  /** The Qikbar instance (created when the element connects). */
  get bar(): QikbarInstance | undefined {
    return this.instance
  }

  /** Extra configuration: sources, extensions, ai, navigate, … Merged over attributes. */
  get config(): QikbarConfig {
    return this.extra
  }
  set config(value: QikbarConfig) {
    const prev = this.extra
    this.extra = { ...value }
    if (!this.instance) return
    const changed: Partial<QikbarConfig> = {}
    for (const key of new Set([...Object.keys(prev), ...Object.keys(this.extra)]) as Set<keyof QikbarConfig>) {
      if (!Object.is(prev[key], this.extra[key])) (changed as any)[key] = this.extra[key]
    }
    if ('inline' in changed) this.remount()
    else this.instance.configure(changed)
  }

  private attrConfig(): QikbarConfig {
    const a = (name: string) => this.getAttribute(name)
    const flag = (name: string) => {
      const v = a(name)
      return v == null ? undefined : v === '' || v === 'true' ? true : v === 'false' ? false : v
    }
    const out: QikbarConfig = {}
    if (a('placeholder') != null) out.placeholder = a('placeholder')!
    const hotkey = a('hotkey')
    if (hotkey != null) out.hotkey = hotkey === 'false' || hotkey === 'none' ? false : hotkey.split(/\s*,\s*/)
    if (a('theme')) out.theme = a('theme') as ThemePresetName
    if (a('appearance')) out.appearance = a('appearance') as Appearance
    if (a('namespace')) out.namespace = a('namespace')!
    if (a('footer')) out.footer = a('footer')!
    const launcher = flag('launcher')
    if (launcher !== undefined) out.launcher = launcher === 'touch' ? 'touch' : !!launcher
    const touch = flag('touch')
    if (touch !== undefined) out.touch = touch === 'auto' ? 'auto' : !!touch
    const webmcp = flag('webmcp')
    if (webmcp !== undefined) out.webmcp = !!webmcp
    return out
  }

  private fullConfig(): QikbarConfig {
    const config: QikbarConfig = { ...this.attrConfig(), ...this.extra }
    if (this.hasAttribute('inline')) config.inline = this.mountPoint()
    return config
  }

  /** Inline bars render into a child so `<qik-command>` markup is untouched. */
  private mountPoint(): HTMLElement {
    let el = this.querySelector<HTMLElement>(':scope > [data-qikbar-mount]')
    if (!el) {
      el = document.createElement('div')
      el.dataset.qikbarMount = ''
      this.append(el)
    }
    return el
  }

  connectedCallback() {
    if (this.instance) return
    if (!this.hasAttribute('inline')) this.style.display = 'contents'
    const bar = createQikbar(this.fullConfig())
    this.instance = bar
    const fire = (type: string, detail?: unknown) => this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
    this.offs.push(
      bar.on('open', () => fire('qikbar-open')),
      bar.on('close', () => fire('qikbar-close')),
      bar.on('run', (detail) => fire('qikbar-run', detail)),
      bar.on('event', (detail) => fire('qikbar-event', detail)),
    )
    this.syncCommands()
    this.observer = new MutationObserver((records) => {
      if (records.some((r) => !(r.target as Element).closest?.('[data-qikbar-mount], .qb-root'))) this.syncCommands()
    })
    this.observer.observe(this, { childList: true, subtree: true, attributes: true, characterData: true })
  }

  disconnectedCallback() {
    this.observer?.disconnect()
    this.observer = undefined
    for (const off of this.offs) off()
    this.offs = []
    this.unregister?.()
    this.unregister = undefined
    this.instance?.destroy()
    this.instance = undefined
    this.querySelector(':scope > [data-qikbar-mount]')?.remove()
  }

  attributeChangedCallback(name: string, oldValue: string | null, value: string | null) {
    if (!this.instance || oldValue === value) return
    if (name === 'inline') return this.remount()
    this.instance.configure(this.attrConfig())
  }

  private remount() {
    this.disconnectedCallback()
    this.connectedCallback()
  }

  private syncCommands() {
    this.unregister?.()
    const commands = readCommands(this)
    this.unregister = commands.length ? this.instance?.register(commands) : undefined
  }

  open(options?: Parameters<QikbarInstance['open']>[0]) {
    this.instance?.open(options)
  }
  close() {
    this.instance?.close()
  }
  toggle() {
    this.instance?.toggle()
  }
  ask(prompt?: string) {
    this.instance?.ask(prompt)
  }
}

/** Register the element (done automatically on import with the default tag). */
export function defineQikbarElement(tag = 'qik-bar') {
  if (typeof customElements === 'undefined' || customElements.get(tag)) return
  customElements.define(tag, class extends QikbarElement {})
}

defineQikbarElement()

declare global {
  interface HTMLElementTagNameMap {
    'qik-bar': QikbarElement
  }
}
