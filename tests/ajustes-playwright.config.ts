import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: '.', testMatch: 'ajustes-ui.spec.ts', workers: 1, timeout: 60000, outputDir: '../node_modules/.cache/ajustes-results', use: { baseURL: 'http://127.0.0.1:4183', viewport: { width: 1440, height: 1000 }, channel: process.env.AJUSTES_TEST_BROWSER_CHANNEL ?? 'msedge' }, webServer: { command: 'bun run dev --host 127.0.0.1 --port 4183 --strictPort', url: 'http://127.0.0.1:4183/tests/ajustes-ui.html', timeout: 30000 } })

