import type { BuildOptions } from 'esbuild'

/** The ESM library build, shared by build.ts and the bundle-size test. */
export const libraryBuild: BuildOptions = {
  bundle: true,
  target: 'es2020',
  legalComments: 'none',
  entryPoints: {
    index: 'src/index.ts',
    ai: 'src/ai/index.ts',
    react: 'src/react/index.tsx',
    server: 'src/server/index.ts',
    extensions: 'src/extensions/index.ts',
    theme: 'src/theme.ts',
    utils: 'src/utils.ts',
    locales: 'src/locales/index.ts',
    element: 'src/element/index.ts',
    vue: 'src/vue/index.ts',
    svelte: 'src/svelte/index.ts',
    solid: 'src/solid/index.ts',
  },
  format: 'esm',
  // Shared chunks so `@qikbar/qikbar` and `@qikbar/qikbar/react` share one copy.
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  external: ['react', 'react-dom', 'vue', 'solid-js', 'node:*'],
  jsx: 'automatic',
  minifySyntax: true,
}
