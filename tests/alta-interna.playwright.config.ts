import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.', testMatch: 'alta-interna.spec.ts', workers: 1, timeout: 60000,
  outputDir: '../node_modules/.cache/alta-interna-results',
  use: { baseURL: 'http://127.0.0.1:4203', headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: process.env.ALTA_TEST_BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' },
  },
  webServer: { command: 'bun run preview --host 127.0.0.1 --port 4203 --strictPort', url: 'http://127.0.0.1:4203', reuseExistingServer: false, timeout: 60000 },
})
