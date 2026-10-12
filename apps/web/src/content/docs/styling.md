---
title: Styling
description: Class names per slot, Tailwind, fully custom CSS, and Content Security Policy.
group: Customization
order: 2
---

## Class names

Add classes to any part of the UI with `classNames`. This works well with Tailwind:

```ts
createQikbar({
  classNames: {
    dialog: 'ring-1 ring-black/5',
    input: 'font-medium',
    item: 'aria-selected:bg-indigo-50',
    footer: 'hidden sm:flex',
  },
})
```

Slots: `root`, `overlay`, `dialog`, `header`, `input`, `list`, `section`, `item`, `footer`, `actions`, `detail`, `form`, `grid`, `chat` and `toast`.

## Stable selectors

Every element has a `qb-` class you can target from your own CSS:

| Selector | Element |
| --- | --- |
| `.qb-root` | Wrapper. Has `data-qb-appearance`, `data-qb-theme`, `data-qb-state` and `data-qb-inline`. |
| `.qb-overlay` | Backdrop |
| `.qb-dialog` | The panel |
| `.qb-header`, `.qb-input`, `.qb-back`, `.qb-crumb`, `.qb-hint` | Search bar |
| `.qb-list`, `.qb-section`, `.qb-item[aria-selected=true]` | Results |
| `.qb-item-icon`, `.qb-item-title`, `.qb-item-subtitle`, `.qb-item-accessories`, `.qb-match` | Row parts |
| `.qb-footer`, `.qb-footer-btn`, `.qb-toast` | Footer |
| `.qb-actions`, `.qb-action` | Action panel |
| `.qb-detail`, `.qb-md`, `.qb-meta` | Detail views |
| `.qb-form`, `.qb-field-input` | Forms |
| `.qb-grid`, `.qb-cell` | Grids |
| `.qb-chat`, `.qb-msg-user`, `.qb-msg-ai`, `.qb-tool` | Chat |
| `.qb-hud` | Floating toast while closed |

Qikbar's base reset uses `:where()`, so it has zero specificity. A single class in your CSS overrides it.

```css
/* Show a left accent bar on the selected row */
.qb-root { --qb-indicator: 1; }

/* Bigger, bolder search */
.qb-root .qb-input { font-size: 20px; font-weight: 500; }
```

## Unstyled

Skip the default styles completely and write your own:

```ts
createQikbar({ unstyled: true })
```

You can start from the default stylesheet with `import '@qikbar/qikbar/styles.css'` (or copy it), then edit it.

## Content Security Policy

Qikbar injects a single `<style id="qikbar-styles">` tag. If your CSP blocks inline styles:

```ts
createQikbar({ nonce: window.__CSP_NONCE__ })
```

Or link the stylesheet yourself:

```ts
import '@qikbar/qikbar/styles.css'
createQikbar({ unstyled: true })
```

Qikbar also sets a few inline `style` properties for theme variables and virtualization. If you use `style-src-attr 'none'`, allow `'unsafe-hashes'` for them or theme with your own CSS only.

## RTL

```ts
createQikbar({ dir: 'rtl' })
```

## Mobile

Under 640px wide, the dialog sits at the top with a full-width layout. The footer hints and the detail and metadata panels are hidden, and forms switch to a single column.
