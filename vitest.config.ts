import { getViteConfig } from 'astro/config'

import { defineConfig, mergeConfig } from 'vitest/config'

// getViteConfig returns a UserConfigFn — cast to any so mergeConfig accepts it

export default mergeConfig(
  getViteConfig({}) as any,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/test/**', 'src/**/*.d.ts'],
      },
    },
  }),
)
