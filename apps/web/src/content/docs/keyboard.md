---
title: Keyboard
description: Every keyboard shortcut in Qikbar, and how to define your own.
group: Core Concepts
order: 8
---

## Built-in keys

| Key | Action |
| --- | --- |
| <kbd>⌘</kbd><kbd>K</kbd> / <kbd>Ctrl</kbd><kbd>K</kbd> | Open or close the bar (`hotkey`) |
| <kbd>↑</kbd> <kbd>↓</kbd>, <kbd>Ctrl</kbd><kbd>N</kbd> / <kbd>Ctrl</kbd><kbd>P</kbd> | Move the selection (wraps around) |
| <kbd>⌘</kbd><kbd>↑</kbd> / <kbd>⌘</kbd><kbd>↓</kbd> | Jump to the first or last item |
| <kbd>PgUp</kbd> / <kbd>PgDn</kbd> | Move by 8 |
| <kbd>↵</kbd> | Run the primary action |
| <kbd>⌘</kbd><kbd>↵</kbd> | Run the secondary action |
| <kbd>⌘</kbd><kbd>.</kbd> | Open the action panel (`actionsHotkey`) |
| <kbd>Tab</kbd> | Ask AI, or fill in a command's arguments |
| <kbd>Esc</kbd> | Close the panel, stop the AI, go back, clear the search, then close the bar |
| <kbd>⌫</kbd> on an empty input | Go back |
| <kbd>←</kbd> <kbd>→</kbd> | Move within a grid |

## Shortcut syntax

```
mod+k            ⌘K on Mac, Ctrl+K elsewhere
shift+mod+p      modifiers in any order: mod, cmd/meta, ctrl, alt/option, shift
alt+enter        named keys: enter, escape/esc, tab, space, backspace, delete, up, down, left, right
g s              a sequence: press G, then S (within 900 ms)
?                a single character
```

Letter shortcuts use the **physical key** (`KeyboardEvent.code`), so <kbd>⌥</kbd> combinations work on macOS and on non-QWERTY layouts.

## Where shortcuts apply

| Defined on | Works |
| --- | --- |
| `hotkey` (config) | Everywhere, always |
| Command `shortcut` | Globally while the bar is closed. Combos with modifiers also work inside text fields. Single keys and sequences don't. |
| Action `shortcut` | While the bar is open and the item is selected |
| Accessory `kbd` | Display only |

## Changing defaults

```ts
createQikbar({
  hotkey: ['mod+k', '/'],     // several hotkeys, or false to disable
  actionsHotkey: 'mod+j',
  shortcuts: false,           // turn off global command shortcuts
})
```

## Display helpers

```ts
import { formatHotkey } from '@qikbar/qikbar'
formatHotkey('mod+shift+p') // [['⌘', '⇧', 'P']] on Mac, [['Ctrl', 'Shift', 'P']] elsewhere
```

The `shortcuts()` extension adds a searchable **Keyboard Shortcuts** cheat sheet that lists every command with a shortcut.
