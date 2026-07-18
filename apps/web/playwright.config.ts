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
    command: 'pnpm exec vite --mode e2e --host 127.0.0.1 --port 4173',
    env: {
      VITE_CLARITY_PROJECT_ID: 'xoernfdaoq',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-public-key',
      VITE_SUPABASE_URL: 'https://aibrendxalzmqsovaqps.supabase.co',
    },
    reuseExistingServer: !process.env.CI,
    url: 'http://127.0.0.1:4173',
  },
  projects: [
    {
      name: 'mobile-320',
      use: { ...devices['Desktop Chrome'], viewport: { height: 700, width: 320 } },
    },
    {
      name: 'desktop-640',
      use: { ...devices['Desktop Chrome'], viewport: { height: 900, width: 640 } },
    },
  ],
})
