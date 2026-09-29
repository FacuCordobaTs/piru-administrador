import { chromium } from '@playwright/test'

/** El `webServer` ya está arriba cuando corre esto. */
const URL = 'http://127.0.0.1:4179/tests/printer-copias.html'

/**
 * Calienta el servidor de desarrollo antes de los tests.
 *
 * El primer pedido a `vite dev` compila todo el grafo de módulos de la app y en un equipo lento
 * tarda más que el timeout de un test, así que el primer test de la suite vencía por tiempo en el
 * `goto` mientras los demás corrían en un segundo. Acá se paga ese costo una sola vez y fuera del
 * reloj de los tests. Si falla, no se aborta la corrida: los tests vuelven a pagarlo como antes.
 */
export default async function calentarServidor() {
  // Mismo criterio que `playwright.config.ts` para elegir el navegador.
  const launchOptions = process.env.POS_TEST_BROWSER_PATH
    ? { executablePath: process.env.POS_TEST_BROWSER_PATH }
    : {}
  const browser = await chromium.launch(launchOptions)
  try {
    const page = await browser.newPage()
    await page.goto(URL, { waitUntil: 'load', timeout: 180_000 })
  } catch (error) {
    console.warn('[warmup] no se pudo precalentar el servidor:', error)
  } finally {
    await browser.close()
  }
}
