import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.', testMatch: 'tienda-personalizacion.spec.ts', workers: 2, timeout: 60000,
  outputDir: '../node_modules/.cache/tienda-personalizacion-results',
  use: { baseURL: 'http://127.0.0.1:4187', reducedMotion: 'reduce', trace: 'retain-on-failure', launchOptions: process.env.TIENDA_ADMIN_BROWSER_PATH ? { executablePath: process.env.TIENDA_ADMIN_BROWSER_PATH } : undefined },
  webServer: { command: 'bun run dev --host 127.0.0.1 --port 4187 --strictPort', url: 'http://127.0.0.1:4187/tests/tienda-personalizacion.html', timeout: 30000 },
})
