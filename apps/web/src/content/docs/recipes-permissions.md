---
title: Permissions & feature flags
description: Show commands only to the right users, and roll out new commands behind flags.
group: Recipes
order: 4
label: Permissions & flags
---

## `when` for simple checks

`when` runs every time the bar opens, so it always reflects the current state:

```ts
const commands: Command[] = [
  { title: 'Admin dashboard', icon: 'layout-dashboard', href: '/admin', when: () => session.user.role === 'admin' },
  { title: 'Try the new editor', icon: 'sparkles', run: openEditor, when: () => flags.isEnabled('new-editor') },
  { title: 'Upgrade to Pro', icon: 'zap', href: '/billing/upgrade', when: () => session.plan === 'free' },
]
```

## Register by role

For large sets of admin-only commands, register them as a group when the session loads:

```ts
let removeAdmin: (() => void) | undefined

auth.onChange((session) => {
  removeAdmin?.()
  removeAdmin = session?.isAdmin ? bar.register(adminCommands) : undefined
})
```

## Hide dangerous commands until searched

`searchOnly: true` keeps rare or destructive commands out of the default list. They only appear when the user types for them:

```ts
{ title: 'Delete workspace', icon: 'trash', searchOnly: true, actions: [deleteWorkspaceAction] }
```

## AI respects the same rules

The AI only sees commands that are currently registered and pass `when`. Hidden commands are invisible to the model too. For server-side authorization, always check permissions in your API as well. The bar is a UI, not a security boundary.

> [!CAUTION]
> Never rely on hiding a command for security. Anyone can call your API directly.
