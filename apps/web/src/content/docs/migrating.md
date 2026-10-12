---
title: Migrating
description: Move from cmdk, kbar, ninja-keys or the original Qikbar SaaS.
group: Reference
order: 4
---

## From cmdk

cmdk is a set of unstyled React primitives. You compose `<Command.Input>`, `<Command.List>` and `<Command.Item>` yourself. Qikbar is a complete command bar driven by data.

```tsx
// cmdk
<Command.Dialog open={open} onOpenChange={setOpen}>
  <Command.Input />
  <Command.List>
    <Command.Group heading="Pages">
      <Command.Item onSelect={() => router.push('/settings')}>Settings</Command.Item>
    </Command.Group>
  </Command.List>
</Command.Dialog>

// Qikbar
<Qikbar routes={[{ path: '/settings', title: 'Settings', section: 'Pages' }]} navigate={router.push} />
```

You no longer need open state, hotkey wiring, nested-page state or a filter function. If you need total control over markup, use `rank` from `@qikbar/qikbar/utils` with your own UI.

## From kbar

| kbar | Qikbar |
| --- | --- |
| `actions: [{ id, name, shortcut, keywords, section, perform }]` | `commands: [{ id, title, shortcut, keywords, section, run }]` |
| `parent: 'theme'` (nested actions) | `view: list({ items: [...] })` |
| `useRegisterActions` | `useCommands` |
| `KBarProvider` + `KBarPortal` + `KBarPositioner` + `KBarAnimator` + `KBarSearch` + `KBarResults` | `<Qikbar />` |
| `shortcut: ['g', 's']` | `shortcut: 'g s'` |

## From ninja-keys

`hotkeys` become `commands`. `handler` becomes `run`, `children` becomes `view: list(...)`, and `mdIcon` becomes `icon`.

## From the original Qikbar

The original Qikbar was a hosted SaaS with a drop-in script and dashboard-configured links. Qikbar is now a free open-source library:

- No account or project key. Install from npm or a CDN.
- Static links from the dashboard become `routes` or `commands`.
- Dynamic content from your API becomes `sources`.
- Client-side routing becomes `navigate`.
- The drop-in script still exists: use the [script tag](/docs/vanilla) with `autoIndex: true`.
