# Vanilla example

A plain HTML page using the built ES modules from `packages/qikbar/dist`.

```bash
# from the repo root
bun run build:lib
python3 -m http.server 4321
# open http://localhost:4321/examples/vanilla/
```

It shows `autoIndex` (nav links and the `data-qikbar` Sign out button), commands with views (form, list with a detail panel, grid, detail), a live source, inline arguments, confirmation, built-in extensions, and a scripted AI provider that runs without an API key.
