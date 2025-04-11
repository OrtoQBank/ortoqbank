import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'edge-runtime',
    server: {
      deps: {
        inline: ['convex-test'],
      },
    },
    include: ['convex/**/*.{test,spec}.{ts,tsx}'],
  },
});
