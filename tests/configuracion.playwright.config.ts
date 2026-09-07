import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: '.', testMatch: 'configuracion-ui.spec.ts', workers: 1, timeout: 45000,
 outputDir: '../node_modules/.cache/configuracion-results',
 use: { baseURL: 'http://127.0.0.1:4181', headless: true, launchOptions: { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' } },
 webServer: { command: 'bun run dev --host 127.0.0.1 --port 4181 --strictPort', url: 'http://127.0.0.1:4181/tests/configuracion-ui.html', reuseExistingServer: false }
})
