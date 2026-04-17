// @ts-check
import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import astroPlugin from 'eslint-plugin-astro'
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'

/** @type {import("typescript-eslint").ConfigArray} */
const config = [
  // ─── Ignores ────────────────────────────────────────────────────────────────
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**'],
  },

  // ─── Base JS ────────────────────────────────────────────────────────────────
  js.configs.recommended,

  // ─── TypeScript ─────────────────────────────────────────────────────────────
  ...tseslint.configs.recommended,

  // ─── React + Hooks (solo .tsx/.jsx — no aplica a .astro que usa HTML) ───────
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
    },
  },

  // ─── Accessibility (solo .tsx/.jsx) ─────────────────────────────────────────
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: { 'jsx-a11y': jsxA11yPlugin },
    rules: jsxA11yPlugin.configs.recommended.rules,
  },

  // ─── Import sorting ─────────────────────────────────────────────────────────
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^\\u0000'], // side effects (e.g. import "./polyfills")
            ['^node:'], // Node builtins
            ['^astro', '^@astrojs'], // Astro ecosystem
            ['^@?\\w'], // external packages
            ['^@/'], // internal alias
            ['^\\.'], // relative imports
            ['^.+\\.s?css$'], // styles last
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },

  // ─── Astro ──────────────────────────────────────────────────────────────────
  ...astroPlugin.configs['flat/recommended'],

  // ─── Custom TS rules ────────────────────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Enforce `import type` — prevents value imports from being used as types
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Unused vars: allow underscore-prefixed to opt-out
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Warn on `any` — don't error since sometimes it's intentional
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  {
    files: ['**/*.astro'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.astro'],
      },
    },
    rules: {
      // These rules do not require type information and are safe for Astro frontmatter.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // ─── Prettier (must be last — disables formatting rules) ────────────────────
  prettierConfig,
]

export default config
