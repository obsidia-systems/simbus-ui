import { getViteConfig } from 'astro/config'

import { defineConfig, mergeConfig } from 'vitest/config'

// getViteConfig returns a UserConfigFn in Astro 6 + Vite 7 — resolve it first.
const astroViteConfig = getViteConfig({})

export default defineConfig(async (env) => {
  const astro = typeof astroViteConfig === 'function' ? await astroViteConfig(env) : astroViteConfig

  return mergeConfig(astro, {
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
  })
})
