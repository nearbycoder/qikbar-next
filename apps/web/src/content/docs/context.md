---
title: Context
description: The ctx object passed to every run function, action, loader and form handler.
group: Core Concepts
order: 7
---

Every `run`, action, loader, source, form `onSubmit` and AI tool receives a **context** object. It's how your code talks to the bar.

```ts
{
  title: 'Deploy',
  async run(ctx) {
    if (!(await ctx.confirm('Deploy to production?'))) return false
    const t = ctx.toast({ title: 'Deploying…', style: 'loading' })
    await deploy({ signal: ctx.signal })
    t.update({ title: 'Deployed', style: 'success' })
  },
}
```

## Reference

| Member | Description |
| --- | --- |
| `ctx.query` | The current search text. |
| `ctx.signal` | An `AbortSignal` that fires when the view is popped, the query changes (for loaders), or the bar closes. |
| `ctx.arguments` | Values for the command's [arguments](/docs/arguments). |
| `ctx.preferences` | Values for the extension's [preferences](/docs/extensions#preferences). Empty for app commands. |
| `ctx.storage` | Persistent key-value storage, namespaced per extension: `get(key)`, `set(key, value)`, `remove(key)`. |
| `ctx.ai` | The AI client: `ask(prompt)` returns a promise of the answer, `stream(prompt)` returns an async iterable of text. `undefined` without AI. |
| `ctx.push(view)` | Push a view. |
| `ctx.pop()` | Go back. |
| `ctx.render(view)` | Replace the current view, keeping the query and selection. |
| `ctx.close()` | Close the bar. |
| `ctx.navigate(href, { newTab? })` | Navigate with your router, then close the bar. |
| `ctx.openUrl(url)` | Open a URL in a new tab and close the bar. |
| `ctx.copy(text)` | Copy to the clipboard. Resolves to `true` on success. |
| `ctx.toast(options)` | Show a toast. Returns `{ update, hide }`. |
| `ctx.confirm(options)` | Ask the user to confirm. Resolves to a boolean. |
| `ctx.setQuery(text)` | Change the search text. |
| `ctx.bar` | The [Qikbar instance](/docs/api#instance). |

## Storage

`ctx.storage` uses `localStorage` by default, and falls back to memory during SSR or in private mode. Values are JSON-serialized. Each extension gets its own namespace, so keys don't collide.

```ts
const recent = ctx.storage.get<string[]>('recent') ?? []
ctx.storage.set('recent', [item.id, ...recent].slice(0, 10))
```

Replace the backend with the `storage` config option. It takes any object with `getItem`, `setItem` and `removeItem`.

## AI

```ts
const answer = await ctx.ai?.ask('Write a commit message for: ' + diff)
for await (const chunk of ctx.ai!.stream('Explain this error: ' + error)) output += chunk
```
