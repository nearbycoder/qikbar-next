---
title: Workspace switcher
description: Let users switch workspaces, accounts or projects from the bar, with the current one marked.
group: Recipes
order: 2
label: Workspace switcher
---

A switcher is a [list view](/docs/views#list) whose items run a function. Mark the current item with an accessory, and give the command a shortcut so power users can switch without the mouse.

```ts title="command-bar/switcher.ts"
import { list, type Command } from '@qikbar/qikbar'

export function switcher(workspaces: Workspace[], current: Workspace, switchTo: (id: string) => Promise<void>): Command {
  return {
    title: 'Switch Workspace',
    subtitle: current.name,
    icon: 'layers',
    shortcut: 'mod+shift+o',
    keywords: ['team', 'org', 'account', 'change'],
    view: list({
      title: 'Workspaces',
      placeholder: 'Switch to…',
      items: workspaces.map((w) => ({
        id: w.id,
        title: w.name,
        subtitle: `${w.members} members`,
        icon: w.logoUrl ?? { icon: 'layers', color: w.color },
        accessories: w.id === current.id ? [{ tag: { value: 'Current', color: 'green' } }] : [{ text: w.plan }],
        async run(ctx) {
          if (w.id === current.id) return false
          const t = ctx.toast({ title: `Switching to ${w.name}…`, style: 'loading' })
          await switchTo(w.id)
          t.update({ title: `Now in ${w.name}`, style: 'success' })
        },
      })),
      actions: [{ title: 'Create Workspace', icon: 'plus', run: (ctx) => ctx.navigate('/workspaces/new') }],
    }),
  }
}
```

## Keep it fresh

Register the switcher wherever your workspace data lives, so it updates when the data changes:

```tsx title="React"
const { data: workspaces } = useWorkspaces()
const current = useCurrentWorkspace()
useCommands(workspaces ? [switcher(workspaces, current, switchWorkspace)] : [], [workspaces, current.id])
```

## Also searchable from the root

To let users type a workspace name straight from the root, add a source as well:

```ts
sources: [{
  id: 'workspaces',
  title: 'Workspaces',
  filter: true,
  debounce: 0,
  search: () => workspaces.map((w) => ({ title: `Switch to ${w.name}`, icon: 'layers', run: () => switchWorkspace(w.id) })),
}]
```
