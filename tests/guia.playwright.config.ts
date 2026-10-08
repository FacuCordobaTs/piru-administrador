import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: '.', testMatch: 'guia.spec.ts', workers: 1, timeout: 60000, globalSetup: './guia.warmup.ts',
 outputDir: '../node_modules/.cache/guia-results',
 use: { baseURL: 'http://127.0.0.1:4196', headless: true, viewport: { width: 1440, height: 1000 }, launchOptions: { executablePath: process.env.GUIA_TEST_BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' } },
 webServer: { command: 'bun run dev --host 127.0.0.1 --port 4196 --strictPort', url: 'http://127.0.0.1:4196/tests/guia.html', reuseExistingServer: false, timeout: 60000 }
})
