---
title: Building extensions
description: Package commands, live sources, AI tools and user preferences into a reusable extension, inspired by Raycast.
group: Extensions
order: 1
---

An **extension** is a portable bundle of functionality. If you've built a Raycast extension, this will feel familiar. The difference is that it's framework-agnostic and runs in any web app that uses Qikbar.

```ts
import { defineExtension, list, action } from '@qikbar/qikbar'

export default defineExtension({
  name: 'hacker-news',
  title: 'Hacker News',
  icon: 'https://news.ycombinator.com/favicon.ico',
  description: 'Browse top stories',
  commands: [
    {
      name: 'top',
      title: 'Top Stories',
      view: list({
        title: 'Top Stories',
        items: async ({ signal }) => {
          const ids: number[] = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', { signal }).then((r) => r.json())
          const stories = await Promise.all(
            ids.slice(0, 30).map((id) => fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal }).then((r) => r.json())),
          )
          return stories.map((s) => ({
            title: s.title,
            subtitle: new URL(s.url ?? 'https://news.ycombinator.com').hostname,
            url: s.url ?? `https://news.ycombinator.com/item?id=${s.id}`,
            accessories: [{ text: `▲ ${s.score}` }, { text: `${s.descendants ?? 0} comments` }],
            actions: [action.open(`https://news.ycombinator.com/item?id=${s.id}`, { title: 'Open Comments', shortcut: 'mod+o' })],
          }))
        },
        filter: true,
      }),
    },
  ],
})
```

Install it:

```ts
import hackerNews from './hacker-news'

createQikbar({ extensions: [hackerNews] })
// or at runtime
const uninstall = bar.use(hackerNews)
```

## Anatomy

| Field | Description |
| --- | --- |
| `name` | **Required.** A unique id (kebab-case). Namespaces storage, ids and tool names. |
| `title` | **Required.** The display name. It's the default section and subtitle for its commands. |
| `icon`, `description`, `author`, `version` | Metadata. |
| `commands` | `ExtensionCommand[]`: same fields as [commands](/docs/commands) plus a required `name`. |
| `sources` | [Sources](/docs/sources) that contribute to the root search. |
| `tools` | [AI tools](/docs/ai-tools). Exposed to the model as `name__tool`. |
| `preferences` | Settings the extension needs (see below). |
| `setup(ctx)` | Called once when installed. Return a cleanup function. |

Command ids are `${extension.name}.${command.name}`, which keeps them stable for frecency and AI.

## Preferences

Declare what you need. Qikbar resolves values in this order: values passed at install time, then values the user entered, then defaults.

```ts
defineExtension({
  name: 'github',
  title: 'GitHub',
  preferences: [
    { name: 'token', title: 'Personal access token', type: 'password', required: true, description: 'Needs repo scope' },
    { name: 'org', title: 'Default organization', type: 'text', placeholder: 'acme' },
    { name: 'drafts', title: 'Include draft PRs', type: 'checkbox', default: false },
    { name: 'sort', title: 'Sort by', type: 'select', default: 'updated', options: [
      { title: 'Recently updated', value: 'updated' },
      { title: 'Most stars', value: 'stars' },
    ] },
  ],
  commands: [{ name: 'prs', title: 'My Pull Requests', view: (ctx) => prList(ctx.preferences.token) }],
})
```

> [!NOTE]
> **If a required preference is missing**, the first time the user runs a command, Qikbar shows a *Configure GitHub* form. It saves the values (namespaced in storage) and then runs the command. Users can change them later with the *Configure GitHub* action in the action panel (<kbd>⌘</kbd><kbd>.</kbd>).

Apps can also provide values when installing, so users never see the form:

```ts
createQikbar({ extensions: [[github, { token: session.githubToken, org: 'acme' }]] })
// or
bar.use(github, { token: session.githubToken })
```

Preference types: `text`, `password`, `number`, `checkbox` and `select`.

## Storage

`ctx.storage` is namespaced to the extension: `qikbar:ext:<name>:<key>`.

```ts
const favorites = ctx.storage.get<string[]>('favorites') ?? []
```

## AI tools

```ts
tools: [
  {
    name: 'create_issue',
    description: 'Create a GitHub issue in a repository',
    parameters: {
      type: 'object',
      properties: { repo: { type: 'string', description: 'owner/name' }, title: { type: 'string' }, body: { type: 'string' } },
      required: ['repo', 'title'],
    },
    confirm: (a) => `Create issue “${a.title}” in ${a.repo}?`,
    run: async (args, ctx) => {
      const issue = await gh(ctx.preferences.token).createIssue(args)
      return { url: issue.html_url, number: issue.number }
    },
  },
]
```

The model sees this tool as `github__create_issue`.

## Lifecycle with `setup`

```ts
setup({ bar, preferences, storage }) {
  const off = bar.on('open', () => prefetch())
  const timer = setInterval(sync, 60_000)
  return () => {
    off()
    clearInterval(timer)
  }
}
```

## Patterns

**Factory functions** make extensions configurable:

```ts
export function jira(options: { site: string }) {
  return defineExtension({ name: 'jira', title: 'Jira', commands: [/* uses options.site */] })
}
```

**Commands that run in place** return `false`:

```ts
{ name: 'refresh', title: 'Refresh Cache', run: async (ctx) => { await refresh(); ctx.toast('Refreshed'); return false } }
```

**Views that update** use `ctx.render`. See [Re-rendering](/docs/views#re-rendering).

## Compared with Raycast

| Raycast | Qikbar |
| --- | --- |
| `package.json` manifest | An `Extension` object |
| `mode: "view"` | `view: …` or `run` returning a view |
| `mode: "no-view"` | `run: …` |
| `<List>`, `<Grid>`, `<Detail>`, `<Form>` | `list()`, `grid()`, `detail()`, `form()` |
| `<ActionPanel>` / `<Action>` | `actions: Action[]` / `action.*` helpers |
| `useNavigation().push` | `ctx.push(view)` |
| `showToast`, `confirmAlert` | `ctx.toast`, `ctx.confirm` |
| `LocalStorage` | `ctx.storage` |
| `getPreferenceValues()` | `ctx.preferences` |
| `arguments` | `arguments` (inline in the search bar) |
| `AI.ask` | `ctx.ai.ask`, `ctx.ai.stream` |
| AI Extensions (`tools`) | `tools` |
