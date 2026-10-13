---
title: Web component
description: <qik-bar> works in plain HTML, HTMX, Rails, Django, Laravel and any framework that renders tags.
group: Frameworks
order: 7
label: Web component
---

Import the element once, then write markup:

```html
<script type="module" src="https://unpkg.com/@qikbar/qikbar/dist/element.js"></script>

<qik-bar placeholder="Search Acme…" launcher="touch">
  <qik-command href="/projects" section="Navigation" icon="folder" keywords="work, repos">Projects</qik-command>
  <qik-command href="/settings" section="Navigation" icon="settings">Settings</qik-command>
  <qik-command id="theme" icon="moon" shortcut="mod+shift+l">Toggle theme</qik-command>
</qik-bar>

<script>
  document.getElementById('theme').addEventListener('run', () => document.documentElement.classList.toggle('dark'))
</script>
```

With a bundler: `import '@qikbar/qikbar/element'`.

## `<qik-command>`

| Attribute | |
| --- | --- |
| text content or `title` | The command's title |
| `href` | Navigate within your app |
| `url` | Open an external page in a new tab |
| `section`, `subtitle`, `description`, `icon`, `keywords` (comma-separated), `shortcut` | As in [commands](/docs/commands) |
| `keep-open` | Keep the bar open after the `run` event |

Commands without `href` or `url` fire a `run` event on the element (cancelable, bubbling). Group commands with `<qik-commands section="…">`. Adding, removing or changing `<qik-command>` elements updates the bar, so server-rendered and HTMX-swapped markup just works.

## `<qik-bar>` attributes

| Attribute | |
| --- | --- |
| `placeholder` | Search box placeholder |
| `hotkey` | e.g. `mod+k`, a comma-separated list, or `false` |
| `theme` | A [preset](/docs/theming#presets) name |
| `appearance` | `light`, `dark` or `auto` |
| `inline` | Render inline (always open) inside the element |
| `launcher` | `true`, `false` or `touch` ([mobile](/docs/mobile)) |
| `touch` | `true`, `false` or `auto` |
| `webmcp` | Expose commands to browser agents ([WebMCP](/docs/webmcp)) |
| `namespace`, `footer` | As in [config](/docs/api#config) |

## The `config` property

Everything attributes can't express (sources, extensions, AI, a router's navigate function) goes in `config`. It's merged over the attributes:

```js
const el = document.querySelector('qik-bar')
el.config = {
  navigate: (href) => htmx.ajax('GET', href, { target: 'main', swap: 'innerHTML' }),
  sources: [projectSource],
  ai: { provider: proxy({ url: '/api/ai' }) },
}
```

## Methods and events

```js
el.open()
el.close()
el.toggle()
el.ask('summarize this page')
el.bar // the full Qikbar instance
```

| Event | `detail` |
| --- | --- |
| `qikbar-open` / `qikbar-close` | |
| `qikbar-run` | `{ item, action }` |
| `qikbar-event` | A [usage event](/docs/recipes-analytics) |

Removing the element destroys the bar.

## A different tag name

```js
import { defineQikbarElement } from '@qikbar/qikbar/element'
defineQikbarElement('acme-search')
```
