import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Unit tests only — exclude worker tests (they need the CF pool)
    exclude: [
      '**/node_modules/**',
      '**/workers/**',
      '**/e2e/**',
    ],
  },
})
