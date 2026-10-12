import { chromium } from '@playwright/test'

/** El `webServer` ya está arriba cuando corre esto. */
const URL = 'http://127.0.0.1:4204/tests/recorrido-panel.html'

/**
 * Calienta el servidor de desarrollo antes de los tests: el primer pedido a `vite dev` compila el
 * grafo del panel y el chunk del recorrido, y puede vencer el timeout del primer test. Se paga una
 * sola vez y fuera del reloj de los tests; si falla, no se aborta la corrida.
 */
export default async function calentarServidor() {
  const browser = await chromium.launch({
    executablePath: process.env.RECORRIDO_TEST_BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  })
  try {
    const page = await browser.newPage()
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }),
    )
    await page.goto(URL, { waitUntil: 'load', timeout: 240_000 })
    await page.getByRole('dialog').waitFor({ timeout: 240_000 })
  } catch (error) {
    console.warn('[warmup] no se pudo precalentar el servidor:', error)
  } finally {
    await browser.close()
  }
}
