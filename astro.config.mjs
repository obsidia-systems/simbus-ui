// @ts-check
import { defineConfig } from 'astro/config'
import node from '@astrojs/node'
import react from '@astrojs/react'

import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  adapter: node({
    mode: 'standalone',
  }),

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // Mirror the `@/*` path alias from tsconfig.json
        '@': path.resolve('./src'),
      },
    },
  },
})
