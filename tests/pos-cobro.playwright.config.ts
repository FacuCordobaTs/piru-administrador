import { defineConfig } from '@playwright/test'
export default defineConfig({
    testDir: '.', testMatch: 'pos-cobro.spec.ts', workers: 1, timeout: 120000,
    // Precalienta vite: el primer pedido compila el Dashboard entero y vencería el timeout del primer test.
    globalSetup: './pos-cobro.warmup.ts',
    outputDir: '../node_modules/.cache/pos-cobro-results',
    use: {
        baseURL: 'http://127.0.0.1:4191', headless: true,
        launchOptions: { executablePath: process.env.POS_TEST_BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' },
    },
    webServer: { command: 'bun run dev --host 127.0.0.1 --port 4191 --strictPort', url: 'http://127.0.0.1:4191/tests/pos-cobro.html', reuseExistingServer: false, timeout: 30000 },
})
