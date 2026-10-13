---
title: Registry & CLI
description: Add community extensions to your project with one command, and submit your own.
group: Extensions
order: 5
label: Registry & CLI
---

Every extension in the [gallery](/extensions) can be added to your project with the Qikbar CLI. It copies the extension's source into your codebase, like shadcn/ui, so you own it: read it, change it, delete what you don't need.

```bash
npx @qikbar/qikbar add weather currency
```

```
add   src/qikbar/extensions/weather.ts
add   src/qikbar/extensions/currency.ts

Use it:

  import weather from './src/qikbar/extensions/weather'
  import currency from './src/qikbar/extensions/currency'

  createQikbar({ extensions: [weather, currency] })
```

## Commands

| Command | |
| --- | --- |
| `npx @qikbar/qikbar add <name...>` | Copy extensions into your project. `add all` copies every one. |
| `npx @qikbar/qikbar list` | List available extensions (`--json` for scripts) |
| `npx @qikbar/qikbar info <name>` | Description, author, what it uses, a query to try |

| Option | |
| --- | --- |
| `-d, --dir <path>` | Where files go. Default `src/qikbar/extensions` (or `qikbar/extensions` without a `src` folder). |
| `-f, --force` | Overwrite files that already exist (skipped by default) |
| `--registry <url>` | Use another registry, e.g. your company's (or set `QIKBAR_REGISTRY`) |

Set a default folder for your project in `qikbar.json`:

```json title="qikbar.json"
{ "extensionsDir": "app/command-bar/extensions" }
```

Typos get a suggestion (`Unknown extension "wether". Did you mean "weather"?`).

## The registry format

A registry is two kinds of static files, so you can host a private one anywhere:

- `index.json`: `{ "version": 1, "extensions": [{ "name", "title", "description", "file", … }] }`
- One source file per extension, at the path in `file` (e.g. `weather.ts`)

The public registry is served from [qikbar.com/registry/index.json](/registry/index.json).

## Submitting an extension

1. Build it in a single file with `defineExtension()`, importing only from `@qikbar/qikbar` (so it works when copied into any project). See [Building extensions](/docs/extensions).
2. Fork [the repo](https://github.com/nearbycoder/qikbar-next), add your file to `apps/web/src/extensions/`, and add an entry to `apps/web/src/data/extensions.ts` with a category, tags and a query to try.
3. Run `bun run dev`, open `/extensions` and try it in the playground.
4. Open a pull request. The [extension template](https://github.com/nearbycoder/qikbar-next/issues/new?template=extension.yml) issue is the place to propose one first.

Extensions that need API keys should use [preferences](/docs/extensions#preferences) rather than hard-coded keys, and should never send data anywhere the user wouldn't expect.

Prefer publishing on npm instead? See [Publishing extensions](/docs/publishing-extensions); the two work together.
