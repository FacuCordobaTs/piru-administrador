import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.', testMatch: 'claim-tienda.spec.ts', workers: 1, timeout: 90000,
  outputDir: '../node_modules/.cache/claim-tienda-results',
  use: { baseURL: 'http://127.0.0.1:4211', headless: true,
    viewport: { width: 390, height: 844 },
    launchOptions: process.env.CLAIM_TEST_BROWSER_PATH ? { executablePath: process.env.CLAIM_TEST_BROWSER_PATH } : {},
  },
  webServer: { command: 'bun run dev --host 127.0.0.1 --port 4211 --strictPort', url: 'http://127.0.0.1:4211', reuseExistingServer: true, timeout: 60000 },
})
