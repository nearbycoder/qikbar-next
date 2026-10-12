---
title: Accessibility
description: Keyboard support, screen readers, focus management and reduced motion.
group: Reference
order: 3
---

Qikbar follows the WAI-ARIA **combobox with listbox popup** pattern:

- The search input has `role="combobox"`, `aria-expanded`, `aria-controls` and `aria-activedescendant`, which point at the selected option.
- Results are a `role="listbox"` with `role="option"` rows and `aria-selected`. Section headings are presentational.
- The modal is a `role="dialog"` with `aria-modal="true"` and a label.
- The action panel and confirmation dialogs have their own dialog roles and keyboard handling.
- Toasts are announced through `aria-live="polite"` regions.

## Focus

- Opening the bar saves the focused element. Closing it restores focus.
- While the modal is open, focus is trapped inside it.
- Inline mode never steals focus on load.

## Keyboard

Everything works without a mouse. See [Keyboard](/docs/keyboard). Letter shortcuts use physical keys, so they work on any keyboard layout.

## Motion

With `prefers-reduced-motion: reduce`, all animations are disabled, and the loading indicator moves more slowly.

## Color

The default themes meet WCAG AA contrast for body text. If you customize colors, check the contrast of `fg`, `fgMuted` and `selection` against `bg`.
