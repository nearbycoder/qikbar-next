---
title: Publishing extensions
description: Share your extension on npm so any Qikbar app can install it.
group: Extensions
order: 3
---

Extensions are plain ES modules, so publishing one is the same as publishing any small package.

## Package layout

```
qikbar-extension-linear/
├─ src/index.ts       # export default defineExtension({...}) or a factory
├─ package.json
└─ README.md          # screenshots, preferences, commands
```

```json
{
  "name": "qikbar-extension-linear",
  "version": "1.0.0",
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "keywords": ["qikbar-extension", "qikbar", "linear"],
  "peerDependencies": { "qikbar": "^1.0.0" }
}
```

## Conventions

- **Name** it `qikbar-extension-<thing>` or `@scope/qikbar-<thing>`, and add the `qikbar-extension` keyword so the [extensions page](/extensions) can find it.
- List `qikbar` as a **peer dependency**. Only import types and helpers (`defineExtension`, `list`, `action`) from it.
- **Export a factory** when the extension takes options: `export function linear(options) { … }`.
- **Declare preferences** instead of reading environment variables. The app can pass values at install time.
- **Respect `ctx.signal`** in every `fetch`.
- **Never ship secrets.** API calls that need a private key belong behind the app's own endpoint.
- **Keep it small.** Avoid heavy dependencies. Qikbar's users care about bundle size.

## Testing

Extensions are data, so you can unit test commands directly:

```ts
import { expect, it, vi } from 'vitest'
import { linear } from '../src'

it('searches issues', async () => {
  const ext = linear({ team: 'ENG' })
  const source = ext.sources![0]!
  const items = await source.search({ query: 'login', signal: new AbortController().signal, ctx: fakeCtx({ preferences: { token: 'x' } }) })
  expect(items[0]!.title).toContain('login')
})
```

## Get listed

Open a pull request that adds your extension to `apps/web/src/data/extensions.ts` in the [Qikbar repo](https://github.com/nearbycoder/qikbar-next).
