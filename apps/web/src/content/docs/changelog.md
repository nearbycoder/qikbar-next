---
title: Changelog
description: What's new in each release.
group: Reference
order: 7
---

## 1.0.0

The first open-source release. Qikbar is now a free MIT-licensed library instead of a hosted SaaS.

**Library**

- `createQikbar` with commands, routes, sources, fallbacks, extensions and `autoIndex`
- Fuzzy ranking with word-boundary and acronym awareness, frecency and highlighting
- Views: list (with detail panel and virtualization), grid, detail (streaming Markdown), form, chat
- Actions: primary and secondary actions, the action panel, shortcuts, confirmations, toasts and HUD
- Inline arguments, global shortcuts and key sequences
- A lazy UI chunk: about 3.5 KB boots the shell
- 14 theme presets, CSS variables, class name slots, unstyled mode, automatic light and dark

**AI**

- Providers: `anthropic`, `openai`, `openaiCompatible`, `ollama`, `gemini`, `browserAI`, `proxy`, `byok`
- An agent loop where the model can `search`, `run` and `read_page`, plus your own tools
- `createHandler` and `toNodeHandler` in `qikbar/server`

**Ecosystem**

- `qikbar/react`: `<Qikbar>`, hooks and `<QikbarTrigger>`
- Built-in extensions: calculator, theme switcher, page tools, AI actions, shortcuts, AI settings
- Eleven example extensions, a theme builder, a playground, and docs for AI agents (`llms.txt`)
