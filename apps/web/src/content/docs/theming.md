---
title: Theming
description: Presets, CSS variables, light and dark appearance, and matching your design system.
group: Customization
order: 1
---

Qikbar's look is driven entirely by `--qb-*` CSS custom properties. You can choose a preset, override a few variables, or both. To try them live, open the [theme builder](/themes).

```ts
createQikbar({
  theme: {
    preset: 'linear',
    vars: { accent: '#e11d48', radius: '16px', font: 'inherit' },
    dark: { bg: 'rgba(12, 12, 14, .9)' },
  },
  appearance: 'auto',
})
```

## Presets

`light`, `dark`, `raycast`, `linear`, `vercel`, `github`, `nord`, `dracula`, `catppuccin`, `tokyo-night`, `rose-pine`, `solarized`, `midnight` and `paper`.

```ts
createQikbar({ theme: 'catppuccin' })
```

Most presets have a light and a dark variant. `dracula`, `tokyo-night` and `midnight` are always dark, and `paper` is always light.

## Appearance

| `appearance` | Behavior |
| --- | --- |
| `'auto'` (default) | Follows your app. It checks for a `dark` or `light` class on `<html>`/`<body>`, `data-theme`, `data-mode`, `data-color-scheme`, `data-bs-theme`, and `color-scheme`, then falls back to the OS setting. Changes are tracked live. |
| `'light'` / `'dark'` | Fixed |
| `() => 'light' \| 'dark'` | Your own logic, checked on each open |

## Variables

Pass these as camelCase keys in `vars`, `light` or `dark`. In CSS they're `--qb-kebab-case`.

| Key | CSS variable | Purpose |
| --- | --- | --- |
| `font` | `--qb-font` | Font family |
| `fontMono` | `--qb-font-mono` | Code font |
| `fontSize` | `--qb-font-size` | Base size (14px) |
| `bg` | `--qb-bg` | Dialog background (translucent by default) |
| `bgElevated` | `--qb-bg-elevated` | Action panel, toasts, confirm dialog |
| `fg` | `--qb-fg` | Primary text |
| `fgMuted` | `--qb-fg-muted` | Secondary text, icons |
| `fgSubtle` | `--qb-fg-subtle` | Section headings, placeholders, accessories |
| `border` | `--qb-border` | Hairlines |
| `selection` | `--qb-selection` | Selected row background |
| `selectionFg` | `--qb-selection-fg` | Selected row text |
| `hover` | `--qb-hover` | Hover background |
| `accent` | `--qb-accent` | Caret, focus rings, primary buttons, progress bar |
| `accentFg` | `--qb-accent-fg` | Text on the accent color |
| `highlight` | `--qb-highlight` | Matched characters |
| `overlay` | `--qb-overlay` | Backdrop color |
| `backdropBlur` | `--qb-backdrop-blur` | Dialog blur (20px) |
| `shadow` | `--qb-shadow` | Dialog shadow |
| `radius` | `--qb-radius` | Dialog radius |
| `radiusItem` | `--qb-radius-item` | Row radius |
| `width` | `--qb-width` | Dialog width (680px) |
| `listHeight` | `--qb-list-height` | Results height (380px) |
| `rowHeight` | `--qb-row-height` | Row height (42px) |
| `sectionHeight` | `--qb-section-height` | Section heading height |
| `inputHeight` | `--qb-input-height` | Search bar height |
| `inputFontSize` | `--qb-input-font-size` | Search text size |
| `top` | `--qb-top` | Distance from the top of the viewport (14vh) |
| `kbdBg` / `kbdFg` | `--qb-kbd-bg` / `--qb-kbd-fg` | Keyboard key chips |
| `danger` / `success` / `warning` | `--qb-danger` … | Status colors |

There's one more variable you can set in CSS: `--qb-z` (z-index, default `2147483000`).

## Use your design tokens

Variables accept any CSS value, including your own variables. Your theme and Qikbar's then stay in sync, with no JavaScript:

```ts
createQikbar({
  theme: {
    vars: {
      font: 'inherit',
      accent: 'var(--color-primary)',
      bg: 'var(--color-popover)',
      fg: 'var(--color-popover-foreground)',
      border: 'var(--color-border)',
      radius: 'var(--radius-lg)',
    },
  },
})
```

> [!TIP]
> This example maps Qikbar onto **shadcn/ui** tokens. Any design system with CSS variables works the same way.

## Pure CSS

You can also theme without any config:

```css
.qb-root {
  --qb-accent: hotpink;
  --qb-radius: 20px;
}
.qb-root[data-qb-appearance='dark'] {
  --qb-bg: #0b0b10;
}
```

## Change at runtime

```ts
bar.configure({ theme: 'nord' })
bar.configure({ theme: { vars: { accent: userColor } } })
```

## Export a theme

```ts
import { resolveThemeVars, themeToCss } from 'qikbar/theme'

const { vars } = resolveThemeVars('dracula', 'dark')
console.log(themeToCss(vars))
```
