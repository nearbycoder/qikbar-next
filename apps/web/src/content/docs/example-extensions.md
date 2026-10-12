---
title: Example extensions
description: Eleven complete, copy-pasteable extensions that show every part of the API.
group: Extensions
order: 3
label: Examples
---

Each example is a single file you can copy into your app. All of them are live on the [extensions page](/extensions), where you can install them into this site's bar with one click.

| Extension | Shows | Data |
| --- | --- | --- |
| [Weather](https://github.com/nearbycoder/qikbar-next/blob/main/apps/web/src/extensions/weather.ts) | Sources that react to phrases (“weather in tokyo”), detail views with metadata, arguments, select preferences | Open-Meteo |
| [Currency](https://github.com/nearbycoder/qikbar-next/blob/main/apps/web/src/extensions/currency.ts) | Inline answers at the top of results (`position: 'top'`), async lists, arguments with defaults | Frankfurter |
| [npm](https://github.com/nearbycoder/qikbar-next/blob/main/apps/web/src/extensions/npm.ts) | Async lists with a detail panel, sectioned actions, preferences that change behavior | npm registry |
| [Wikipedia](https://github.com/nearbycoder/qikbar-next/blob/main/apps/web/src/extensions/wikipedia.ts) | Lazily loaded detail panels, `action.ask` to hand off to AI | Wikipedia |
| [Bookmarks](https://github.com/nearbycoder/qikbar-next/blob/main/apps/web/src/extensions/bookmarks.ts) | `ctx.storage`, forms, `ctx.render` after changes, destructive actions with confirmation, a source over local data | Browser storage |
| [GitHub](https://github.com/nearbycoder/qikbar-next/blob/main/apps/web/src/extensions/github.ts) | Optional password preferences, error states, empty views | GitHub API |
| [Hacker News](https://github.com/nearbycoder/qikbar-next/blob/main/apps/web/src/extensions/hacker-news.ts) | Several commands from one function, parallel fetching, extra actions | HN API |
| [Colors](https://github.com/nearbycoder/qikbar-next/blob/main/apps/web/src/extensions/colors.ts) | A pure source that parses the query, tinted icons | — |
| [Generators](https://github.com/nearbycoder/qikbar-next/blob/main/apps/web/src/extensions/generators.ts) | `run` commands with toasts, optional arguments | `crypto` |
| [Emoji](https://github.com/nearbycoder/qikbar-next/blob/main/apps/web/src/extensions/emoji.ts) | Grid views, `keepOpen` actions, `ctx.setQuery` | — |
| [World Clock](https://github.com/nearbycoder/qikbar-next/blob/main/apps/web/src/extensions/world-clock.ts) | Lists built at open time, phrase-triggered sources | `Intl` |

## Patterns worth copying

### Phrase-triggered sources

Weather, currency, colors and the world clock all use the same trick: a source that ignores every query except the ones it understands, and shows its answer at the top.

```ts
{
  id: 'currency-convert',
  position: 'top',
  async search({ query }) {
    const m = query.match(/^([\d.,]+)\s*([a-z]{3})\s+(?:to|in)\s+([a-z]{3})$/i)
    if (!m) return []
    // …fetch and return one item
  },
}
```

### Persist, then re-render

Bookmarks saves to `ctx.storage` and calls `ctx.render(browse(ctx))`, so the list updates without leaving the view.

### Lazy detail

Wikipedia sets `detail: () => summary(title)`. The summary is only fetched when the user selects that row, and then it's cached.
