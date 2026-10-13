---
title: Pins & aliases
description: Let users pin favorite commands to the top and jump to them with their own short aliases.
group: Core Concepts
order: 9
---

Every command in the bar can be personalized by the people using it, like in Raycast:

- **Pin to Top** keeps a command in a **Pinned** section above everything else when the search box is empty. Pinned commands also rank a little higher in search.
- **Set Alias…** gives a command a short name. Typing the alias (say `bv2` for "Billing v2") puts that command first, and shows the alias as a tag on the row.

Both live in the action panel (⌘K → ⌘. or long-press on touch), under **Customize**. Pins also have a shortcut: ⌘⇧P.

Pins and aliases are saved in the bar's [storage](/docs/api#config) (localStorage by default), per [namespace](/docs/api#config).

## Control them from code

```ts
bar.pin('route:/billing') // pin
bar.pin('route:/billing', false) // unpin
bar.pins() // ['route:/billing']

bar.setAlias('route:/billing', 'bill')
bar.setAlias('route:/billing', null) // remove
bar.aliases() // { bill: 'route:/billing' }
```

Ids are the command's `id`, or `route:<path>` for routes. Give commands stable `id`s if you want pins and aliases to survive renames:

```ts
commands: [{ id: 'invite', title: 'Invite teammate', run: invite }]
```

Aliases are case-insensitive and trimmed, and each alias belongs to one command. The **Set Alias…** form tells the user if an alias is already taken.

## Syncing across devices

Pass a `storage` adapter backed by your API to sync pins and aliases for a signed-in user:

```ts
const cache = await api.get('/me/command-bar') // { 'qikbar:pins': '…', … }

createQikbar({
  storage: {
    getItem: (key) => cache[key] ?? null,
    setItem: (key, value) => {
      cache[key] = value
      void api.put('/me/command-bar', cache)
    },
    removeItem: (key) => {
      delete cache[key]
      void api.put('/me/command-bar', cache)
    },
  },
})
```

## Turning it off

```ts
createQikbar({ personalize: false })
```

This hides the Customize actions, the Pinned section and alias matching.

## Analytics

Pins and aliases are reported to [`onEvent`](/docs/recipes-analytics) as `pin`, `unpin` and `alias` events, which tells you which commands people care about most.
