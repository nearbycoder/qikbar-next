---
title: Actions
description: Primary and secondary actions, the action panel, shortcuts, and built-in action helpers.
group: Core Concepts
order: 5
---

Every item can have several **actions**. The first is the **primary** action (<kbd>↵</kbd>), the second is the **secondary** action (<kbd>⌘</kbd><kbd>↵</kbd>), and all of them are listed in the **action panel** (<kbd>⌘</kbd><kbd>.</kbd>). The panel works like Raycast's.

```ts
{
  title: 'Q3 report',
  href: '/reports/q3',             // primary: Open. Secondary: Open in New Tab.
  actions: [
    action.copy('https://acme.co/r/q3', { title: 'Copy share link' }),
    { title: 'Export as PDF', icon: 'download', shortcut: 'mod+e', run: () => exportPdf('q3') },
    { title: 'Delete report', icon: 'trash', style: 'destructive', section: 'Danger', shortcut: 'mod+backspace', run: deleteReport },
  ],
}
```

## Action fields

| Field | Description |
| --- | --- |
| `title` | **Required.** |
| `run(ctx)` | **Required.** Return a view to push it, or `false` to keep the bar open. |
| `icon` | Any [icon](/docs/commands#icons). |
| `shortcut` | Runs the action while the bar is open, for example `"mod+c"`. |
| `section` | Groups actions in the panel. |
| `style` | `"destructive"` shows the action in red. When AI runs it, the user is asked to confirm first. |
| `keepOpen` | Keep the bar open after running. |

## How actions are built

The action list for an item is assembled in this order:

1. Shorthands: `run` (*Run*), `view` (*Open*), `href` (*Open*, *Open in New Tab*, *Copy Link*), `url` (*Open in Browser*, *Copy URL*)
2. The item's own `actions`
3. The view's `actions`, which apply to every item in that view
4. For extension commands: *Configure Extension*, if the extension has preferences

## Built-in helpers

```ts
import { action } from 'qikbar'

action.copy(text | () => text, options?)   // Copy to Clipboard (⌘C)
action.open(url, options?)                 // Open in Browser
action.navigate(href, options?)            // Open with your router
action.navigateNewTab(href, options?)      // Open in New Tab (⌘↵)
action.push(title, view, options?)         // Push a view
action.ask(prompt, options?)               // Ask AI (⌘J)
```

`options` overrides any field, for example `action.copy(id, { title: 'Copy ID', shortcut: 'mod+i' })`.

## The action panel

Press <kbd>⌘</kbd><kbd>.</kbd> (or <kbd>Ctrl</kbd><kbd>.</kbd>), or click **Actions** in the footer. You can type to filter, use the arrow keys and <kbd>↵</kbd> to run, and <kbd>Esc</kbd> to close. Change the key with `actionsHotkey`.

## Confirmation

```ts
{
  title: 'Delete workspace',
  style: 'destructive',
  async run(ctx) {
    const ok = await ctx.confirm({ title: 'Delete workspace?', message: 'This cannot be undone.', destructive: true, confirmLabel: 'Delete' })
    if (!ok) return false
    await api.deleteWorkspace()
    ctx.toast({ title: 'Workspace deleted', style: 'success' })
  },
}
```

## Toasts

```ts
const t = ctx.toast({ title: 'Deploying…', style: 'loading' })
await deploy()
t.update({ title: 'Deployed', style: 'success' })
```

Styles: `success`, `failure`, `loading` and `info`. While the bar is open, toasts appear in the footer. When it's closed, they appear as a small floating HUD. Loading toasts stay until you update or hide them. Others hide after 2.6 seconds unless you set `duration`.

## Errors

If `run` throws, Qikbar shows a failure toast with the error message and logs the error. The bar stays open.
