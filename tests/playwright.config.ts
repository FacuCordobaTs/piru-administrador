import { defineConfig } from '@playwright/test'
export default defineConfig({
    testDir: '.', testMatch: ['pos-ui.spec.ts', 'evento-ui.spec.ts', 'dashboard-evento.spec.ts'], workers: 1, timeout: 60000,
    outputDir: '../node_modules/.cache/pos-ui-results',
    use: { baseURL: 'http://127.0.0.1:4179', headless: true, screenshot: 'only-on-failure',
        launchOptions: process.env.POS_TEST_BROWSER_PATH ? { executablePath: process.env.POS_TEST_BROWSER_PATH } : {},
    },
    webServer: { command: 'bun run dev --host 127.0.0.1 --port 4179 --strictPort', url: 'http://127.0.0.1:4179/tests/pos-ui.html', reuseExistingServer: false, timeout: 30000 },
})
