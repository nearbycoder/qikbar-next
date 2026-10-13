---
title: Toasts & undo
description: Show feedback after actions, with an Undo button and ⌘Z.
group: Core Concepts
order: 11
---

Call `ctx.toast()` from a command or action, or `bar.toast()` from anywhere. While the bar is open, toasts show in its footer. After it closes, they float at the bottom of the page.

```ts
ctx.toast('Saved')
ctx.toast({ title: 'Deploying…', style: 'loading' })
ctx.toast({ title: 'Deployed', message: 'acme.app', style: 'success' })
ctx.toast({ title: 'Deploy failed', message: err.message, style: 'failure' })
```

`toast()` returns a handle you can `update()` and `hide()`:

```ts
const t = ctx.toast({ title: 'Uploading…', style: 'loading' })
await upload()
t.update({ title: 'Uploaded', style: 'success' })
```

## Undo

Destructive actions feel safer with an undo. Pass `undo` and the toast gets an **Undo** button, bound to ⌘Z (Ctrl+Z):

```ts
{
  title: 'Archive Project',
  icon: 'trash',
  style: 'destructive',
  run: async (ctx) => {
    await api.archive(project.id)
    ctx.toast({
      title: 'Project archived',
      style: 'success',
      undo: () => api.restore(project.id),
    })
  },
}
```

Undo toasts stay up for 6 seconds (pass `duration` to change that). ⌘Z only triggers the undo when the user isn't editing text, so it never steals undo from an input. Undos are reported to [`onEvent`](/docs/recipes-analytics) as `{ type: 'undo' }`.

## Other buttons

`action` adds any button, with an optional shortcut:

```ts
ctx.toast({
  title: 'Invite sent',
  action: { title: 'View', run: () => router.push('/team') },
})
```

## Options

| Option | Type | Default |
| --- | --- | --- |
| `title` | `string` | required |
| `message` | `string` | |
| `style` | `'success' \| 'failure' \| 'loading' \| 'info'` | `'info'` |
| `duration` | `number` (ms, `0` keeps it) | 2600, or 6000 with a button. Loading toasts persist. |
| `undo` | `() => void \| Promise<void>` | |
| `action` | `{ title, run, shortcut? }` | |
