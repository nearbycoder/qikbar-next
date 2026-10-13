---
title: Mobile & touch
description: A touch-friendly bar on phones and tablets, with long-press actions, a floating launcher and keyboard-aware sizing.
group: Customization
order: 4
label: Mobile & touch
---

Qikbar works on phones out of the box. On touch screens it switches to a touch layout automatically:

- **No keyboard hints.** Shortcut keys (↵, ⌘K) are hidden, since there's no keyboard to press them on.
- **Bigger targets.** Rows are at least 48px tall, and footer buttons are easier to tap.
- **Long-press for actions.** Press and hold a row to open its action panel, the touch version of ⌘K. On desktop, right-click does the same.
- **No zoom on focus.** Inputs use at least 16px text, so iOS Safari doesn't zoom in when the bar opens.
- **Fits above the keyboard.** The bar tracks the visible viewport, so results stay visible when the on-screen keyboard is open.

Detection uses `(hover: none) and (pointer: coarse)`. Force it either way with `touch`:

```ts
createQikbar({ touch: true }) // always touch layout
createQikbar({ touch: false }) // never
```

## A launcher button

Touch devices have no ⌘K, so give people a button. `launcher` adds a floating round button that opens the bar:

```ts
createQikbar({ launcher: 'touch' }) // only on touch screens
createQikbar({ launcher: true }) // everywhere
createQikbar({
  launcher: {
    position: 'bottom-left',
    offset: 24,
    label: 'Search',
    touchOnly: true,
  },
})
```

The launcher loads on demand, so it adds nothing to apps that don't use it. It respects safe areas (the iPhone home indicator and notch), follows the system light/dark setting and can be themed with CSS variables:

```css
.qb-launcher {
  --qb-launcher-bg: #4f46e5;
  --qb-launcher-fg: white;
}
```

You can also open the bar from any element with `data-qikbar-open`, which works with touch, mouse and keyboard alike:

```html
<button data-qikbar-open>Search</button>
```

## Gestures in lists

| Gesture | What it does |
| --- | --- |
| Tap a row | Runs its primary action |
| Long-press a row | Opens the action panel |
| Right-click a row (desktop) | Opens the action panel |
| Tap **Actions** in the footer | Opens the action panel for the selected row |

Moving your finger more than a few pixels cancels a long press, so scrolling never opens the panel by accident.

## Inline bars on mobile

[Inline bars](/docs/inline-mode) keep the height you give them with `--qb-list-height`. On small screens you may want a shorter list:

```css
@media (max-width: 640px) {
  #search { --qb-list-height: 320px; }
}
```
