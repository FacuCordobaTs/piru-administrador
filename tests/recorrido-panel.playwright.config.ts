import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  testMatch: 'recorrido-panel.spec.ts',
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  globalSetup: './recorrido-panel.warmup.ts',
  outputDir: '../node_modules/.cache/recorrido-panel-results',
  use: {
    baseURL: 'http://127.0.0.1:4204',
    headless: true,
    // Las capturas de revisión salen quietas y completas, sin las entradas a medio hacer.
    reducedMotion: process.env.RECORRIDO_SHOTS ? 'reduce' : 'no-preference',
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.RECORRIDO_TEST_BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    },
  },
  webServer: {
    command: 'bun run dev --host 127.0.0.1 --port 4204 --strictPort',
    url: 'http://127.0.0.1:4204/tests/recorrido-panel.html',
    reuseExistingServer: false,
    timeout: 60000,
  },
})
