import { test, expect, type Page } from '@playwright/test'

/**
 * Clientes ya no es una pantalla del panel: abre la app de marketing en modo dueño. El botón pide
 * un pase con la sesión del panel y abre la URL que devuelve el backend en otra pestaña, sin login.
 */
const PASE = 'https://marketing.piru.app/entrar#token=pase-de-prueba'

async function preparar(page: Page, opciones: { bloquearPestana?: boolean; fallar?: boolean } = {}) {
  const pedidos: { url: string; metodo: string; autorizacion: string | undefined }[] = []
  await page.addInitScript((bloquear) => {
    const abiertas: string[] = []
    Object.assign(window, { __abiertas: abiertas })
    window.open = ((url?: string | URL) => {
      abiertas.push(String(url))
      return bloquear ? null : ({} as Window)
    }) as typeof window.open
  }, Boolean(opciones.bloquearPestana))
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    pedidos.push({ url: request.url(), metodo: request.method(), autorizacion: request.headers()['authorization'] })
    if (request.url().endsWith('/marketing-duenio/entrada')) {
      return opciones.fallar
        ? route.fulfill({ status: 503, json: { error: 'Servicio no disponible' } })
        : route.fulfill({ json: { success: true, data: { url: PASE, expira: new Date(Date.now() + 120000).toISOString() } } })
    }
    return route.fulfill({ status: 404, json: { error: 'Sin fixture' } })
  })
  return { pedidos, abiertas: () => page.evaluate(() => (window as unknown as { __abiertas: string[] }).__abiertas) }
}

test('abre la app de marketing en otra pestaña con un pase de la sesión del panel', async ({ page }) => {
  const m = await preparar(page)
  await page.goto('/tests/clientes-marketing.html')
  await expect(page.getByRole('heading', { name: 'Clientes', exact: true })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('clientes-marketing-1440.png'), fullPage: true })
  await page.getByRole('button', { name: 'Abrir la app de marketing' }).click()
  await expect.poll(m.abiertas).toEqual([PASE])
  expect(m.pedidos).toEqual([
    { url: expect.stringMatching(/\/marketing-duenio\/entrada$/), metodo: 'POST', autorizacion: 'Bearer token-del-panel' },
  ])
})

for (const [hash, nombre, destino] of [
  ['/clientes?tab=retencion&vista=puntos', 'Puntos', 'puntos'],
  ['/clientes?tab=retencion&vista=motor', 'Recompra', 'recompra'],
  ['/clientes?tab=adquisicion&vista=cupones', 'Cupones', 'cupones'],
  ['/clientes?tab=adquisicion&vista=campanas', 'Campañas', 'campanas'],
  ['/clientes?tab=clientes', 'Clientes', 'clientes'],
]) {
  test(`el deep link ${hash} abre ${nombre} en la app`, async ({ page }) => {
    const m = await preparar(page)
    await page.goto(`/tests/clientes-marketing.html#${hash}`)
    await page.getByRole('button', { name: `Abrir ${nombre} en la app de marketing` }).click()
    await expect.poll(m.abiertas).toEqual([`${PASE}&destino=${destino}`])
  })
}

test('si el navegador bloquea la pestaña, ofrece abrirla con un toque', async ({ page }) => {
  await preparar(page, { bloquearPestana: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tests/clientes-marketing.html')
  await page.getByRole('button', { name: 'Abrir la app de marketing' }).click()
  await expect(page.getByRole('alert')).toContainText('Tu navegador no abrió la pestaña.')
  await expect(page.getByRole('link', { name: 'Abrila desde acá' })).toHaveAttribute('href', PASE)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('clientes-marketing-390.png'), fullPage: true })
})

test('si el backend falla, avisa y no abre nada', async ({ page }) => {
  const m = await preparar(page, { fallar: true })
  await page.goto('/tests/clientes-marketing.html')
  await page.getByRole('button', { name: 'Abrir la app de marketing' }).click()
  await expect(page.getByText('No pudimos abrir la app de marketing')).toBeVisible()
  expect(await m.abiertas()).toEqual([])
})
