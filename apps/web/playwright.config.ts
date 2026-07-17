import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  fullyParallel: true,
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev -- --host 127.0.0.1 --port 4173',
    reuseExistingServer: !process.env.CI,
    url: 'http://127.0.0.1:4173',
  },
  projects: [
    {
      name: 'mobile-320',
      use: { ...devices['Desktop Chrome'], viewport: { height: 700, width: 320 } },
    },
    {
      name: 'desktop-1024',
      use: { ...devices['Desktop Chrome'], viewport: { height: 900, width: 1024 } },
    },
  ],
})
