# Contributing to Qikbar

Thanks for helping. Bug reports, extensions, themes, docs fixes and features are all welcome.

## Setup

You need [Bun](https://bun.sh) 1.3+ and Node 22+.

```bash
bun install
bun run build      # builds the library, then the website
bun run test       # library tests
bun run dev        # website with docs at http://localhost:4321
```

Library only:

```bash
cd packages/qikbar
bun run build      # esbuild bundles + type declarations
bun run test       # vitest + happy-dom
bun run typecheck
```

## Layout

| Path | What |
| --- | --- |
| `packages/qikbar/src/core` | Types, fuzzy search, hotkeys, storage, frecency, the lazy shell |
| `packages/qikbar/src/ui` | The DOM renderer (`bar.ts` controller, `views.ts` renderers), styles, themes, icons, Markdown |
| `packages/qikbar/src/ai` | Providers, SSE parsing, the agent loop, bring-your-own-key |
| `packages/qikbar/src/react` | React bindings |
| `packages/qikbar/src/server` | `createHandler` for AI proxies |
| `packages/qikbar/src/extensions` | Built-in extensions |
| `apps/web` | The website and docs (Astro). Docs live in `src/content/docs/*.md`. |
| `apps/web/src/extensions` | Example extensions shown on qikbar.com/extensions |

## Principles

- **Zero runtime dependencies.** Every byte ships to someone's users.
- **Plain data.** Commands, views and actions are objects. Keep the API serializable where possible, so that AI models can reason about it.
- **Fast by default.** Avoid work on keystrokes. Measure with `rank()` on 10k items before and after.
- **Accessible.** Keyboard first. Keep the ARIA combobox semantics intact.
- **Framework-agnostic core.** Framework bindings stay thin.

## Pull requests

1. Add or update tests in `packages/qikbar/test`.
2. Update the docs in `apps/web/src/content/docs` if behavior or API changes.
3. Run `bun run test` and `bun run build`.
4. Keep PRs focused. One feature or fix per PR.

## Adding an extension to the gallery

Add a file to `apps/web/src/extensions/` and an entry to `apps/web/src/data/extensions.ts`. Published npm extensions are welcome too. See [Publishing extensions](https://qikbar.com/docs/publishing-extensions).

## Adding a theme preset

Add it to `presets` in `packages/qikbar/src/ui/themes.ts` and to `ThemePresetName` in `src/core/types.ts`. Check contrast in both appearances in the theme builder.
