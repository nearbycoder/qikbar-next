---
title: Built-in extensions
description: Calculator, theme switcher, page tools, AI actions, keyboard shortcuts and bring-your-own-key settings.
group: Extensions
order: 2
---

```ts
import { calculator, themeSwitcher, page, aiActions, shortcuts } from 'qikbar/extensions'
import { byok } from 'qikbar'

createQikbar({ extensions: [calculator(), themeSwitcher(), page(), aiActions(), shortcuts(), byok.settings()] })
```

Each one is a short, readable file. They're a good place to learn the API before you [build your own](/docs/extensions).

## Calculator

Type math straight into the bar and press <kbd>↵</kbd> to copy the result.

| Input | Result |
| --- | --- |
| `12 * (3 + 4)` | 84 |
| `2^10` | 1,024 |
| `15% of 80` | 12 |
| `200 + 10%` | 220 |
| `sqrt(2) * pi` | 4.4428829382 |
| `5 km in mi` | 3.1068559612 mi |
| `100 f to c` | 37.7777777778 °C |
| `1.5 gb in mb` | 1,536 MB |

It supports `+ - * / ^ %`, parentheses, implicit multiplication (`2pi`), `sqrt cbrt abs round floor ceil sin cos tan log ln exp min max`, and units for length, mass, data, time, volume and temperature. It uses a safe parser, never `eval`.

## Theme switcher

`themeSwitcher(options?)` adds *Toggle Dark Mode* (<kbd>⌘</kbd><kbd>⇧</kbd><kbd>L</kbd>), plus *Use Light/Dark/System Theme*. By default it toggles the `dark` class and `color-scheme` on `<html>` and saves the choice in `localStorage.theme`. Pass `set(mode)` to use your own theme logic:

```ts
themeSwitcher({ set: (mode) => setTheme(mode), shortcut: false })
```

## Page

`page({ headings? })` adds browser actions (*Go Back*, *Go Forward*, *Reload*, *Copy Page URL*, *Scroll to Top/Bottom*, *Print*, *Share*) and an **On This Page** source that searches headings with an `id`. That makes it handy for docs and long pages.

```ts
page({ headings: 'article h2[id], article h3[id]' })
```

## AI actions

Requires [`ai`](/docs/ai). `aiActions()` adds:

- **Summarize This Page**: streams a summary into a detail view
- **Explain Selected Text**: appears only when text is selected
- **Translate**: asks for a language with an [argument](/docs/arguments), then translates the selection or the page

## Shortcuts

`shortcuts()` adds a searchable **Keyboard Shortcuts** list of every command that has a `shortcut`, plus the bar's built-in keys.

## AI settings (bring your own key)

`byok.settings()` adds *AI Settings*, a form where users choose a provider and paste their key, and *Remove AI API Key*. Use it with `ai: byok()`. See [providers](/docs/ai-providers#bring-your-own-key).
