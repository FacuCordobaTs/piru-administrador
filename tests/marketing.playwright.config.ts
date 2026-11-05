import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  testMatch: 'marketing.spec.ts',
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  outputDir: '../node_modules/.cache/marketing-results',
  use: {
    baseURL: 'http://127.0.0.1:4205',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.MARKETING_TEST_BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    },
  },
  webServer: {
    command: 'bun run dev --host 127.0.0.1 --port 4205 --strictPort',
    url: 'http://127.0.0.1:4205/tests/marketing.html',
    reuseExistingServer: false,
    timeout: 60000,
  },
})
