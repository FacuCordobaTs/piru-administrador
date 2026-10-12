import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * El recorrido de bienvenida del panel (components/recorrido/), el aviso de datos de ejemplo
 * (components/DemoBanner.tsx) y la entrada de la demo (pages/DemoPanel.tsx), contra el DashboardLayout
 * real. La API la responde cada test con `page.route`. `RECORRIDO_SHOTS=<carpeta>` vuelca capturas.
 */
const SHOTS = process.env.RECORRIDO_SHOTS

const PASOS = [
  'Este es el panel de Brasa',
  'Inicio: los pedidos del día',
  'Todo está en el menú de la izquierda',
  'Tu carta, con fotos y precios',
  'Cada pedido suma un cliente a tu base',
  'Cuánto vendiste, sin planillas',
  'Estos datos son de ejemplo',
  'Recorrelo a tu ritmo',
]

type Estado = { hay: boolean; borrado: boolean; clientes: number; pedidos: number; campanas: number }
const CON_EJEMPLO: Estado = { hay: true, borrado: false, clientes: 16, pedidos: 52, campanas: 2 }
const SIN_EJEMPLO: Estado = { hay: false, borrado: true, clientes: 0, pedidos: 0, campanas: 0 }

interface Api {
  estado: Estado
  /** Qué se pidió: método y path, sin el origen. */
  pedidos: string[]
  sesionDemo?: { status: number; body: unknown }
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function mockApi(page: Page, inicial: Estado = CON_EJEMPLO, extra: Partial<Api> = {}): Promise<Api> {
  const api: Api = { estado: inicial, pedidos: [], ...extra }
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const { pathname } = new URL(req.url())
    const ruta = pathname.slice(pathname.indexOf('/api/') + 4)
    api.pedidos.push(`${req.method()} ${ruta}`)
    if (ruta === '/datos-ejemplo') {
      if (req.method() === 'DELETE') {
        api.estado = SIN_EJEMPLO
        return json(route, { success: true, borrados: true, data: api.estado })
      }
      if (req.method() === 'POST') {
        api.estado = CON_EJEMPLO
        return json(route, { success: true, data: api.estado })
      }
      return json(route, { success: true, data: api.estado })
    }
    if (ruta === '/demo-panel/sesion') {
      const r = api.sesionDemo ?? {
        status: 200,
        body: {
          success: true,
          token: `test.${btoa(JSON.stringify({ exp: 9999999999, id: 6, scope: 'restaurante', demo: true }))}.test`,
          restauranteId: 6,
          nombre: 'Brasa',
        },
      }
      return json(route, r.body, r.status)
    }
    if (ruta === '/restaurante/profile') {
      return json(route, {
        success: true,
        data: {
          restaurante: { id: 6, nombre: 'Brasa', username: 'brasa', email: '', completedOnboarding: true },
          mesas: [],
          productos: [],
          suscripcion: null,
        },
      })
    }
    if (ruta.startsWith('/categoria')) return json(route, { success: true, categorias: [] })
    return json(route, { success: true, data: [] })
  })
  return api
}

async function abrir(page: Page, query = '') {
  const problemas: string[] = []
  page.on('pageerror', (e) => problemas.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) problemas.push(m.text())
  })
  await page.goto(`/tests/recorrido-panel.html${query}`)
  return problemas
}

const dialogo = (page: Page) => page.getByRole('dialog')
// El diálogo trae además su título oculto (`sr-only`) para lectores de pantalla.
const titulo = (page: Page) => dialogo(page).locator('h2:not(.sr-only)')

test('la primera vez que entra por la demo, el recorrido se abre solo y explica el panel paso a paso', async ({ page }) => {
  await mockApi(page)
  const problemas = await abrir(page)
  await expect(dialogo(page)).toBeVisible()
  await expect(titulo(page)).toHaveText(PASOS[0])
  await expect(dialogo(page).getByText('Paso 1 de 8')).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/paso-1.png` })

  for (let i = 1; i < PASOS.length; i++) {
    await dialogo(page).getByRole('button', { name: 'Siguiente' }).click()
    await expect(titulo(page)).toHaveText(PASOS[i])
    await expect(dialogo(page).getByText(`Paso ${i + 1} de 8`)).toBeVisible()
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/paso-${i + 1}.png` })
  }

  // El último paso lleva a hablar con el fundador y a la guía, y cerrarlo lo recuerda.
  const hablar = dialogo(page).getByRole('link', { name: 'Hablar con Facu' })
  const href = (await hablar.getAttribute('href'))!
  expect(href).toMatch(/^https:\/\/api\.whatsapp\.com\/send\?phone=543408681915&/)
  // Curiosidad y permiso para que Facu llame, no "quiero activarlo".
  expect(new URL(href).searchParams.get('text')).toBe('Hola Facu, vi la demo de Brasa. ¿Me contás cómo sigue? Podés llamarme.')
  await expect(dialogo(page).getByRole('button', { name: 'Leer la guía' })).toBeVisible()
  await dialogo(page).getByRole('button', { name: 'Empezar' }).click()
  await expect(dialogo(page)).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('piru-admin-recorrido-v1:6'))).toBe('visto')
  expect(problemas).toEqual([])

  // Al recargar ya lo vio: no vuelve a aparecer.
  await page.reload()
  await expect(page.getByTestId('pantalla')).toBeVisible()
  await expect(dialogo(page)).toHaveCount(0)
})

test('"Ver recorrido" del menú lo vuelve a abrir desde el principio', async ({ page }) => {
  await mockApi(page)
  await abrir(page)
  await dialogo(page).getByRole('button', { name: 'Saltar' }).first().click()
  await expect(dialogo(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Ver recorrido' }).first().click()
  await expect(titulo(page)).toHaveText(PASOS[0])
  await dialogo(page).getByRole('button', { name: 'Siguiente' }).click()
  await expect(titulo(page)).toHaveText(PASOS[1])
  await page.keyboard.press('Escape')
  await expect(dialogo(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver recorrido' }).first().click()
  await expect(titulo(page)).toHaveText(PASOS[0])
})

test('las flechas y la barra de progreso recorren los pasos', async ({ page }) => {
  await mockApi(page)
  await abrir(page)
  await expect(dialogo(page)).toBeVisible()
  await expect(dialogo(page).getByRole('button', { name: 'Siguiente' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(titulo(page)).toHaveText(PASOS[1])
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowLeft')
  await expect(titulo(page)).toHaveText(PASOS[1])
  await dialogo(page).getByRole('button', { name: 'Paso 6: Caja' }).click()
  await expect(titulo(page)).toHaveText(PASOS[5])
})

test('el último paso lleva a la guía y vuelve al panel donde estaba', async ({ page }) => {
  await mockApi(page)
  await abrir(page)
  await dialogo(page).getByRole('button', { name: 'Paso 8: Listo' }).click()
  await dialogo(page).getByRole('button', { name: 'Leer la guía' }).click()
  await expect(page.getByTestId('pantalla')).toHaveText('La guía')
})

test('el aviso de la demo deja borrar los datos de ejemplo con confirmación y vuelve a cargarlos', async ({ page }) => {
  const api = await mockApi(page)
  await abrir(page)
  await dialogo(page).getByRole('button', { name: 'Saltar' }).first().click()

  const aviso = page.getByRole('region', { name: 'Datos de ejemplo' })
  await expect(aviso).toContainText('Estás en la demo de Brasa')
  await expect(aviso).toContainText('EJEMPLO')
  await aviso.getByRole('button', { name: 'Borrar datos de ejemplo' }).click()
  // Pide confirmar y no borra nada todavía.
  await expect(aviso).toContainText('Se borran los clientes, pedidos y campañas de ejemplo')
  expect(api.pedidos).not.toContain('DELETE /datos-ejemplo')
  await aviso.getByRole('button', { name: 'No' }).click()
  await expect(aviso.getByRole('button', { name: 'Borrar datos de ejemplo' })).toBeVisible()

  await aviso.getByRole('button', { name: 'Borrar datos de ejemplo' }).click()
  await aviso.getByRole('button', { name: 'Sí, borrar' }).click()
  await expect(aviso.getByRole('button', { name: 'Cargar datos de ejemplo' })).toBeVisible()
  expect(api.pedidos).toContain('DELETE /datos-ejemplo')

  // Sin datos de ejemplo, el recorrido no tiene el paso que habla de ellos.
  await page.getByRole('button', { name: 'Ver recorrido' }).first().click()
  await expect(dialogo(page).getByText('Paso 1 de 7')).toBeVisible()
  await page.keyboard.press('Escape')

  await aviso.getByRole('button', { name: 'Cargar datos de ejemplo' }).click()
  await expect(aviso.getByRole('button', { name: 'Borrar datos de ejemplo' })).toBeVisible()
  expect(api.pedidos).toContain('POST /datos-ejemplo')
})

test('un dueño de verdad no ve la demo: sin recorrido automático, sin aviso y sin invitaciones a hablar con Facu', async ({ page }) => {
  await mockApi(page, SIN_EJEMPLO)
  await abrir(page, '?sesion=dueno')
  await expect(page.getByTestId('pantalla')).toBeVisible()
  await expect(dialogo(page)).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Datos de ejemplo' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Ver recorrido' }).first().click()
  await expect(titulo(page)).toHaveText('Este es el panel de Brasa')
  await expect(dialogo(page).getByText('Paso 1 de 7')).toBeVisible()
  await dialogo(page).getByRole('button', { name: 'Paso 7: Listo' }).click()
  await expect(dialogo(page).getByRole('link', { name: 'Hablar con Facu' })).toHaveCount(0)
  await expect(titulo(page)).toHaveText('Todo listo para empezar')
})

test('si el dueño ya reclamó la tienda y quedan datos de ejemplo, el aviso le deja borrarlos', async ({ page }) => {
  const api = await mockApi(page, CON_EJEMPLO)
  await abrir(page, '?sesion=dueno')
  const aviso = page.getByRole('region', { name: 'Datos de ejemplo' })
  await expect(aviso).toContainText('Hay datos de ejemplo cargados')
  await expect(aviso.getByRole('link', { name: 'Hablar con Facu' })).toHaveCount(0)
  await aviso.getByRole('button', { name: 'Borrar datos de ejemplo' }).click()
  await aviso.getByRole('button', { name: 'Sí, borrar' }).click()
  await expect(aviso).toHaveCount(0)
  expect(api.pedidos).toContain('DELETE /datos-ejemplo')
})

test('en el celular el recorrido entra entero, sin scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await mockApi(page)
  await abrir(page)
  await expect(dialogo(page)).toBeVisible()
  for (let i = 0; i < PASOS.length; i++) {
    await expect(titulo(page)).toHaveText(PASOS[i])
    const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(desborda, `paso ${i + 1}`).toBe(false)
    const caja = await dialogo(page).boundingBox()
    expect(caja!.width).toBeLessThanOrEqual(390)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/movil-${i + 1}.png` })
    if (i < PASOS.length - 1) await dialogo(page).getByRole('button', { name: 'Siguiente' }).click()
  }
})

test('la entrada de la demo abre una sesión sin login y lleva al panel', async ({ page }) => {
  const api = await mockApi(page)
  await abrir(page, '?sesion=no&ruta=/demo/brasa')
  await expect(page.getByTestId('pantalla')).toBeVisible()
  expect(api.pedidos).toContain('POST /demo-panel/sesion')
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('piru-auth-storage') ?? '{}'))
  expect(guardado.state.isAuthenticated).toBe(true)
  expect(guardado.state.restaurante.username).toBe('brasa')
  // La sesión guardada es la de la demo y el recorrido se abre solo.
  const claims = JSON.parse(atob(guardado.state.token.split('.')[1]))
  expect(claims.demo).toBe(true)
  await expect(titulo(page)).toHaveText(PASOS[0])
})

test('una tienda que ya tiene dueño manda a entrar con su cuenta', async ({ page }) => {
  await mockApi(page, CON_EJEMPLO, {
    sesionDemo: { status: 409, body: { error: 'Esta tienda ya tiene dueño. Entrá con tu cuenta.', code: 'demo_cerrada' } },
  })
  await abrir(page, '?sesion=no&ruta=/demo/brasa')
  await expect(page.getByRole('heading', { name: 'Esta tienda ya tiene dueño' })).toBeVisible()
  await page.getByRole('link', { name: 'Entrar con mi cuenta' }).click()
  await expect(page.getByTestId('destino')).toHaveText('/login')
  const guardado = await page.evaluate(() => localStorage.getItem('piru-auth-storage'))
  expect(guardado === null || JSON.parse(guardado).state.isAuthenticated !== true).toBe(true)
})

test('con otra sesión abierta, pregunta antes de reemplazarla', async ({ page }) => {
  const api = await mockApi(page)
  await abrir(page, '?sesion=otra&ruta=/demo/brasa')
  await expect(page.getByRole('heading', { name: 'Ya tenés una sesión abierta' })).toBeVisible()
  await expect(page.getByText('Otro Local')).toBeVisible()
  expect(api.pedidos).not.toContain('POST /demo-panel/sesion')
  await page.getByRole('button', { name: 'Abrir la demo' }).click()
  await expect(page.getByTestId('pantalla')).toBeVisible()
  expect(api.pedidos).toContain('POST /demo-panel/sesion')
})
