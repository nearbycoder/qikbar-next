---
title: Settings menus
description: Build nested, toggleable settings that update in place with ctx.render.
group: Recipes
order: 3
label: Settings menus
---

Settings are a great fit for the bar: users can change a preference without visiting a settings page. The trick is `ctx.render`, which re-renders the current view after a change so the checkmarks stay accurate.

```ts title="command-bar/settings.ts"
import { grid, list, type ListView } from 'qikbar'

function settingsView(): ListView {
  const s = store.settings
  const toggle = (key: keyof typeof s, label: string, icon: string) => ({
    id: key,
    title: label,
    icon,
    section: 'Preferences',
    accessories: [{ tag: s[key] ? { value: 'On', color: 'green' } : { value: 'Off', color: 'gray' } }],
    run: (ctx) => {
      store.update({ [key]: !s[key] })
      ctx.render(settingsView())   // re-render in place
      return false                  // keep the bar open
    },
  })

  return list({
    title: 'Settings',
    items: [
      toggle('compactMode', 'Compact mode', 'list'),
      toggle('emailDigest', 'Weekly email digest', 'mail'),
      toggle('sounds', 'Sounds', 'bell'),
      {
        title: 'Language',
        subtitle: s.language,
        icon: 'languages',
        section: 'Region',
        view: grid({
          title: 'Language',
          columns: 4,
          items: LANGUAGES.map((l) => ({
            title: l.name,
            subtitle: l.native,
            icon: l.flag, // an emoji
            run: (ctx) => {
              store.update({ language: l.code })
              ctx.pop()
              return false
            },
          })),
        }),
      },
    ],
  })
}

export const settingsCommand = { title: 'Settings', icon: 'settings', shortcut: 'mod+,', view: settingsView }
```

Because `ctx.render` keeps the query and selection, users can type “sound”, press <kbd>↵</kbd> repeatedly, and watch the toggle flip.

> [!TIP]
> `ctx.pop()` followed by `return false` goes back one level and keeps the bar open. Omit `return false` to close the bar after the change.
