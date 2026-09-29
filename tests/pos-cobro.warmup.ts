import { chromium } from '@playwright/test'

/** El `webServer` ya está arriba cuando corre esto. */
const URL = 'http://127.0.0.1:4191/tests/pos-cobro.html'

/**
 * Calienta el servidor de desarrollo antes de los tests: el primer pedido a `vite dev` compila todo
 * el grafo de módulos del Dashboard (~1 minuto) y vencería el timeout del primer test. Se paga una
 * sola vez y fuera del reloj de los tests; si falla, no se aborta la corrida.
 */
export default async function calentarServidor() {
    const executablePath = process.env.POS_TEST_BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    const browser = await chromium.launch({ executablePath })
    try {
        const page = await browser.newPage()
        await page.route('**/api/**', (route) => route.abort())
        await page.goto(URL, { waitUntil: 'load', timeout: 240_000 })
    } catch (error) {
        console.warn('[warmup] no se pudo precalentar el servidor:', error)
    } finally {
        await browser.close()
    }
}
