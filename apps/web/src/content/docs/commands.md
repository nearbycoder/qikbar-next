---
title: Commands
description: Commands are the items at the root of the bar. Each has a title, an icon, and something to do.
group: Core Concepts
order: 1
---

A command is a plain object. Its primary action comes from whichever of `href`, `url`, `run`, `view` or `actions` you provide:

```ts
createQikbar({
  commands: [
    { title: 'Settings', icon: 'settings', href: '/settings' },          // navigate in-app
    { title: 'Status page', icon: 'globe', url: 'https://status.acme.co' }, // open a new tab
    { title: 'Toggle sidebar', icon: 'layout-dashboard', run: () => toggleSidebar() }, // run code
    { title: 'Browse projects', icon: 'folder', view: list({ items: projects }) },     // push a view
  ],
})
```

## Fields

| Field | Type | Description |
| --- | --- | --- |
| `title` | `string` | **Required.** What the user searches and sees. |
| `subtitle` | `string` | Muted text after the title. Searchable. |
| `icon` | `Icon` | A [built-in icon](#icons) name, image URL, emoji, SVG string or DOM node. |
| `section` | `string` | Groups commands under a heading. Defaults to `"Commands"`. |
| `keywords` | `string[]` | Extra search terms ("invoice" for Billing). |
| `description` | `string` | Longer text. Searchable as a last resort and given to AI models. |
| `accessories` | `Accessory[]` | Right-aligned text, tags, dates or keys. |
| `href` | `string` | Navigate with your router. Adds *Open in New Tab* and *Copy Link* actions. |
| `url` | `string` | Open an external URL. Adds *Copy URL*. |
| `run` | `(ctx) => void \| View \| false` | Run code. Return a view to push it, or `false` to keep the bar open. |
| `view` | `View \| (ctx) => View` | Push a view. |
| `actions` | `Action[]` | Extra [actions](/docs/actions), shown in the action panel. |
| `shortcut` | `string` | A global hotkey that works even while the bar is closed, like `"mod+shift+d"` or `"g s"`. |
| `arguments` | `Argument[]` | Inline inputs asked for before running. See [Arguments](/docs/arguments). |
| `when` | `() => boolean` | Show the command only when this returns true. Checked on each open. |
| `searchOnly` | `boolean` | Hide the command until the user types. Useful for rare or dangerous commands. |
| `priority` | `number` | A ranking boost from 0 to 1. |
| `noHistory` | `boolean` | Don't track it in Recent. |
| `id` | `string` | A stable id for frecency and AI. Generated from the section and title if omitted. |

After a command runs, the bar **closes** unless the command pushed a view, returned `false`, or called `ctx.push`, `ctx.render` or `ctx.navigate` itself.

## Sections and order

With an empty query, commands appear in the order you register them, grouped by `section`. A **Recent** section at the top shows frequently and recently used commands. Configure it with `recents: false` or `recents: 6`.

When the user types, matches are ranked by relevance and frecency. Sections are ordered by their best match.

## Accessories

```ts
{
  title: 'Inbox',
  accessories: [
    { tag: { value: '3 new', color: 'blue' } },
    { text: 'Updated', date: new Date(lastUpdate) }, // "5 min. ago"
    { kbd: 'g i' },
    { icon: 'star', tooltip: 'Favorite' },
  ],
}
```

Tag colors: `gray`, `blue`, `green`, `yellow`, `orange`, `red`, `purple`, `pink`, or any CSS color.

## Icons

Strings are interpreted in this order:

1. **Built-in names**: `search`, `home`, `settings`, `user`, `users`, `folder`, `file`, `file-text`, `book`, `bookmark`, `star`, `heart`, `clock`, `history`, `calendar`, `calculator`, `sun`, `moon`, `monitor`, `palette`, `sparkles`, `bot`, `message`, `send`, `mail`, `bell`, `credit-card`, `key`, `lock`, `log-out`, `trash`, `pencil`, `eye`, `download`, `upload`, `refresh`, `filter`, `globe`, `code`, `terminal`, `hash`, `zap`, `layers`, `grid`, `list`, `image`, `git-branch`, `package`, `puzzle`, `info`, `alert`, `check`, `x`, `plus`, `minus`, `copy`, `link`, `external`, `arrow-right`, `arrow-left`, `chevron-right`, `layout-dashboard`, `bar-chart`, `inbox`, `tag`, `languages`, `wand`, `keyboard`, `github` and more
2. **Image URLs**: `https://…`, `/…`, `./…`, `data:image/…`
3. **Inline SVG**: a string starting with `<svg` (treated as trusted HTML)
4. **Anything else**: rendered as text, for example an emoji `'🚀'`

You can also pass `{ url, alt }`, a tinted icon `{ icon: 'folder', color: '#8b5cf6' }`, a DOM `Node`, or a function that returns one.

## Contextual commands

Register commands from anywhere, for example while a page is mounted:

```ts
const unregister = bar.register([
  { title: `Archive ${project.name}`, icon: 'trash', run: () => archive(project.id) },
])
// later
unregister()
```

In React, use the [`useCommands`](/docs/react#usecommands) hook.

## Fallbacks

Fallbacks appear at the bottom whenever the user has typed something. `{query}` is replaced with the search text:

```ts
createQikbar({
  fallbacks: [
    { title: 'Search the docs for “{query}”', icon: 'book', run: (ctx) => ctx.openUrl(`/docs?q=${ctx.query}`) },
    { title: 'Create issue “{query}”', icon: 'plus', run: (ctx) => createIssue(ctx.query) },
  ],
})
```

If [AI](/docs/ai) is configured, an **Ask AI** fallback is added automatically. <kbd>Tab</kbd> also triggers it.

## Global shortcuts

Commands with a `shortcut` run even when the bar is closed:

- **Combos** such as `"mod+shift+p"` work everywhere, even in text fields.
- **Single keys and sequences** such as `"?"` or `"g s"` are ignored while the user is typing in an input.

`mod` means <kbd>⌘</kbd> on macOS and <kbd>Ctrl</kbd> elsewhere. Disable all item shortcuts with `shortcuts: false`.
