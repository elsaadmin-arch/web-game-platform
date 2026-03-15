import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  // Start dev servers before running tests
  webServer: [
    {
      command: 'cd workers/room-worker && npx wrangler dev --local',
      port: 8787,
      reuseExistingServer: true,
    },
    {
      command: 'cd apps/platform && npx vite --port 3000',
      port: 3000,
      reuseExistingServer: true,
    },
  ],
})
