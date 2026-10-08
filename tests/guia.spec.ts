import { test, expect, type Page } from '@playwright/test'

/**
 * La guía del panel (src/pages/Guia.tsx): no le pide nada a la API, salta a la sección del `#`,
 * el índice acompaña la lectura y, con sesión, los "dónde está" llevan a cada pantalla.
 * Con `GUIA_SHOTS=<carpeta>` vuelca capturas de revisión de cada ilustración, quietas.
 */
const SECCIONES = 23
const SHOTS = process.env.GUIA_SHOTS

async function abrir(page: Page, url = '/tests/guia.html') {
  const problemas: string[] = []
  page.on('pageerror', (e) => problemas.push(e.message))
  // Los recursos que fallan se anotan con su URL (abajo): el mensaje de consola no la dice.
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) problemas.push(m.text())
  })
  page.on('response', (r) => {
    // La página de prueba no tiene ícono: el navegador pide /favicon.ico por su cuenta.
    if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) problemas.push(`${r.status()} ${r.url()}`)
  })
  page.on('request', (r) => {
    if (r.url().includes('/api/')) problemas.push(`pidió a la API: ${r.url()}`)
  })
  await page.goto(url)
  await expect(page.locator('section.guia-seccion')).toHaveCount(SECCIONES)
  return problemas
}

/**
 * Dónde quedó el comienzo de una sección respecto de la parte de arriba de la ventana: debajo de la
 * barra (80 px en la compu, 128 con el índice del celular, su `scroll-margin-top`).
 */
const arribaDe = (page: Page, id: string) => page.locator(`#${id}`).evaluate((el) => el.getBoundingClientRect().top)
const unCuadro = (page: Page) =>
  page.evaluate(() => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo))))

test('con sesión: todas las secciones, sin pedirle nada a la API, y vuelve a donde estaba', async ({ page }) => {
  const problemas = await abrir(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Cómo funciona tu panel de Piru' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(SECCIONES)
  await expect(page.getByRole('link', { name: 'Ver mi tienda' })).toHaveAttribute('href', 'https://my.piru.app/brasa/')
  await expect(page.locator('#tienda strong').filter({ hasText: 'my.piru.app/brasa' })).toBeVisible()
  await page.getByRole('banner').getByRole('link', { name: 'Volver al panel' }).click()
  await expect(page.getByTestId('destino')).toHaveText('/dashboard/productos')
  expect(problemas).toEqual([])
})

test('al llegar con #seccion, salta directo a esa sección', async ({ page }) => {
  await abrir(page, '/tests/guia.html#comandas')
  await expect.poll(() => arribaDe(page, 'comandas')).toBeLessThan(92)
  expect(await arribaDe(page, 'comandas')).toBeGreaterThan(68)
  await expect(page.getByRole('navigation', { name: 'Índice de la guía' }).getByRole('link', { name: 'Comandas impresas' })).toHaveAttribute(
    'aria-current',
    'location',
  )
})

test('el índice lleva a cada sección y marca la que se está leyendo', async ({ page }) => {
  await abrir(page)
  const indice = page.getByRole('navigation', { name: 'Índice de la guía' })
  await indice.getByRole('link', { name: 'Caja y cierre de turno' }).click()
  await expect.poll(() => arribaDe(page, 'caja')).toBeLessThan(92)
  expect(await arribaDe(page, 'caja')).toBeGreaterThan(68)
  await expect(indice.getByRole('link', { name: 'Caja y cierre de turno' })).toHaveAttribute('aria-current', 'location')
  await expect(page).toHaveURL(/#caja$/)
  await page.getByRole('link', { name: 'Comandas', exact: true }).click()
  await expect.poll(() => arribaDe(page, 'comandas')).toBeLessThan(92)
})

test('los "dónde está" llevan a la pantalla del panel', async ({ page }) => {
  await abrir(page)
  await page.getByRole('link', { name: 'Impresión →' }).click()
  await expect(page.getByTestId('destino')).toHaveText('/dashboard/ajustes/impresion')
})

test('sin sesión es pública: invita a entrar y no lleva a pantallas del panel', async ({ page }) => {
  const problemas = await abrir(page, '/tests/guia.html?sesion=no')
  await expect(page.getByRole('heading', { level: 1, name: 'Cómo funciona el panel de Piru' })).toBeVisible()
  await expect(page.getByRole('banner').getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
  await expect(page.getByRole('link', { name: 'Impresión →' })).toHaveCount(0)
  await expect(page.getByText('Impresión', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver mi tienda' })).toHaveCount(0)
  expect(problemas).toEqual([])
})

test('en el celular, el índice se abre en una hoja y lleva a la sección', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await abrir(page)
  await page.getByRole('button', { name: /^Índice ·/ }).click()
  const hoja = page.getByRole('dialog', { name: 'Índice' })
  await expect(hoja).toBeVisible()
  await hoja.getByRole('link', { name: 'Mesas y app de mozos' }).click()
  await expect(hoja).toBeHidden()
  await expect.poll(() => arribaDe(page, 'mesas')).toBeLessThan(140)
  expect(await arribaDe(page, 'mesas')).toBeGreaterThan(116)
  await expect(page.getByRole('button', { name: /^Índice · Mesas y app de mozos/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('capturas de revisión, quietas', async ({ page }) => {
  test.skip(!SHOTS, 'Sólo con GUIA_SHOTS=<carpeta>')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await abrir(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${SHOTS}/inicio-1440.png` })
  const figuras = page.locator('figure')
  const total = await figuras.count()
  for (let i = 0; i < total; i++) {
    const figura = figuras.nth(i)
    await figura.scrollIntoViewIfNeeded()
    await unCuadro(page)
    const seccion = await figura.evaluate((el) => el.closest('section')?.id ?? `figura-${i}`)
    await figura.screenshot({ path: `${SHOTS}/figura-${String(i + 1).padStart(2, '0')}-${seccion}.png` })
  }
  for (const id of ['panel', 'pos', 'pagos', 'preguntas']) {
    await page.evaluate((x) => document.getElementById(x)?.scrollIntoView({ block: 'start' }), id)
    await unCuadro(page)
    await page.screenshot({ path: `${SHOTS}/seccion-${id}-1440.png` })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${SHOTS}/inicio-390.png` })
  await page.evaluate(() => document.getElementById('pedidos')?.scrollIntoView({ block: 'start' }))
  await unCuadro(page)
  await page.screenshot({ path: `${SHOTS}/pedidos-390.png` })
})
