import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Resolve browser builds (Solid ships a no-op server build under the node condition).
  resolve: { conditions: ['browser', 'development'] },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    server: { deps: { inline: ['solid-js'] } },
  },
})
