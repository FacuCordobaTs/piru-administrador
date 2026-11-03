import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// El claim de un local que ya cerró: tiene página propia, dirección y WhatsApp cargados, y no tiene
// alias ni zonas. Todo contra una API simulada.
const jwt = (payload: object) => `e30.${Buffer.from(JSON.stringify({ id: 902, scope: 'restaurante', exp: Math.floor(Date.now() / 1000) + 7200, ...payload })).toString('base64url')}.test`
const local = { id: 902, nombre: 'Rice & Roll', username: 'riceandroll', telefono: '5493511234567' }
const producto = { id: 1, nombre: 'Roll Philadelphia', precio: '9500', descripcion: 'Salmón y queso', imagenUrl: null, variantes: [], ingredientes: [], extras: [] }

async function preparar(page: Page) {
  const pedidos: { path: string; body: any }[] = []
  const errores: string[] = []
  page.on('pageerror', (e) => errores.push(e.message))
  await page.route(/tile\.openstreetmap\.org/, (route) => route.abort())
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname.replace(/^\/api/, '')
    const body = req.postDataJSON?.() ?? null
    pedidos.push({ path, body })
    let res: any = { success: true, data: [] }
    if (path === '/public/claim/test-claim') res = {
      success: true,
      tienda: { nombre: local.nombre, username: local.username, imagenUrl: null, imagenLightUrl: null, telefonoEnmascarado: '••••••567', telefono: '5493511234567', urlTienda: 'https://riceandroll.piru.app/', tienePagina: true },
      inventario: { productos: 1, tieneImagen: false, tieneCobros: true, zonasDelivery: 0, primerPedido: false, tieneNombre: true, tieneLink: true },
      config: {
        pagos: { efectivo: true, transferenciaManual: true, transferenciaAutomatica: false, mercadopagoCheckout: false, transferenciaAlias: 'alias.de.facu', autoTransferAvailable: false, mpConnected: false },
        delivery: { deliveryEnabled: true, takeawayEnabled: true, direccion: 'Av. Colón 1234, Córdoba', lat: -31.4135, lng: -64.1960, zonas: [] },
        productos: [producto],
      },
    }
    if (path === '/public/claim/test-claim/credenciales') res = { success: true, token: jwt({}), restaurante: local }
    if (path === '/modulos/mis-modulos') res = { success: true, data: [{ id: 1, codigo: 'gestion', nombre: 'Gestión', modulos: [
      { codigo: 'gestion_cadetes', tipo: 'incluido', activable: true, estadoProducto: 'disponible', activoAhora: false },
      { codigo: 'cierre_turno_manual', tipo: 'incluido', activable: true, estadoProducto: 'disponible', activoAhora: false },
      { codigo: 'gestion_stock', tipo: 'pago', activable: true, estadoProducto: 'disponible', activoAhora: false },
    ] }] }
    if (path === '/suscripcion/mi-suscripcion') res = { success: true, data: { trialFin: new Date(Date.now() + 5 * 86_400_000).toISOString(), suscripcionBase: { precioMensual: '40000' } } }
    if (path === '/datos-ejemplo') res = { success: true, data: { hay: true } }
    await route.fulfill({ json: res })
  })
  return { pedidos, errores }
}

async function captura(page: Page, nombre: string) {
  if (!process.env.CLAIM_SHOTS) return
  await mkdir(process.env.CLAIM_SHOTS, { recursive: true })
  await page.waitForTimeout(900)
  await page.screenshot({ path: join(process.env.CLAIM_SHOTS, `${nombre}.png`), fullPage: true })
}

test('el dueño completa alias, zonas y acceso con mail, y aprende el panel', async ({ page }) => {
  const { pedidos, errores } = await preparar(page)
  await page.goto('/mi-tienda/test-claim')

  await expect(page.getByRole('heading', { name: 'Dejemos lo último listo' })).toBeVisible()
  await expect(page.getByText('Ver mi tienda')).toHaveCount(0)
  await expect(page.getByText(/piru\.app\/riceandroll/)).toHaveCount(0)
  await captura(page, '01-bienvenida')
  await page.getByRole('button', { name: /Empezar/ }).click()

  await expect(page.getByRole('heading', { name: 'Revisá tu carta' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()

  await expect(page.getByRole('heading', { name: '¿Cuántos locales tenés?' })).toBeVisible()
  await captura(page, '02-locales')
  await page.getByRole('button', { name: /Un solo local/ }).click()

  // El alias se abre directo, vacío: el que hubiera cargado Facu no es el real.
  await expect(page.getByRole('heading', { name: '¿A qué alias te transfieren?' })).toBeVisible()
  await expect(page.getByLabel('Tu alias o CBU')).toHaveValue('')
  await expect(page.getByLabel('Tu alias o CBU')).toBeFocused()
  await captura(page, '03-alias')
  await page.getByLabel('Tu alias o CBU').fill('riceandroll.mp')
  await page.getByRole('button', { name: 'Continuar' }).click()

  await expect(page.getByRole('heading', { name: '¿Cómo entregás tus pedidos?' })).toBeVisible()
  await page.getByRole('button', { name: 'Sí' }).click()
  await page.getByRole('button', { name: 'Sí' }).click()

  // Dirección ya cargada + presentación de "Dibujar zonas" abierta sola.
  await expect(page.getByText('Av. Colón 1234, Córdoba')).toBeVisible()
  await expect(page.getByText('Ya estaba cargada')).toBeVisible()
  const intro = page.getByRole('dialog', { name: 'Cómo dibujar tus zonas de delivery' })
  await expect(intro).toBeVisible()
  for (let i = 1; i <= 5; i++) {
    await captura(page, `04-zonas-intro-${i}`)
    await intro.getByRole('button', { name: i === 5 ? 'Empezar a dibujar' : 'Siguiente' }).click()
  }
  await expect(intro).toBeHidden()
  await expect(page.getByRole('button', { name: 'Dibujar zonas' })).toHaveClass(/bg-\[#FF7A00\]/)

  // Dibuja una zona real con leaflet-draw.
  await page.locator('.leaflet-draw-draw-polygon').click()
  const mapa = await page.locator('.leaflet-container').boundingBox()
  if (!mapa) throw new Error('sin mapa')
  const puntos = [[0.3, 0.3], [0.75, 0.28], [0.78, 0.75], [0.32, 0.78]]
  for (const [x, y] of puntos) {
    await page.mouse.move(mapa.x + mapa.width * x, mapa.y + mapa.height * y)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(400)
  }
  await page.getByRole('link', { name: 'Terminar' }).click()
  await expect(page.getByText('Nueva zona')).toBeVisible()
  await page.getByPlaceholder('Costo de envío').fill('1200')
  await page.getByRole('button', { name: 'Agregar zona' }).click()
  await captura(page, '05-zona-dibujada')
  await page.getByRole('button', { name: /Guardar delivery/ }).click()

  await expect(page.getByRole('heading', { name: 'Así te llega cada pedido' })).toBeVisible()
  await page.getByRole('button', { name: 'Entendido' }).click()

  await expect(page.getByRole('heading', { name: 'Tus pedidos llegan a este WhatsApp' })).toBeVisible()
  await expect(page.getByText('+5493511234567')).toBeVisible()
  await expect(page.getByText(/••/)).toHaveCount(0)
  await captura(page, '06-whatsapp')
  await page.getByRole('button', { name: 'Continuar' }).click()

  await expect(page.getByRole('heading', { name: '¿Cómo querés entrar a tu panel?' })).toBeVisible()
  await page.getByRole('radio', { name: /Con mail y contraseña/ }).click()
  await page.getByLabel('Tu mail').fill('duenio@riceandroll.com')
  await page.getByLabel('Elegí una contraseña').fill('sushi-2026')
  await captura(page, '07-acceso')
  await page.getByRole('button', { name: 'Crear mi acceso' }).click()

  await expect(page.getByRole('heading', { name: '¿Cómo trabajás en el local?' })).toBeVisible()
  await expect(page.getByText('Tengo repartidores propios')).toBeVisible()
  await expect(page.getByText('Quiero controlar el stock')).toHaveCount(0)
  await captura(page, '08-modos')
  await page.getByRole('button', { name: /^Continuar/ }).click()

  // Sin pedido de prueba: de cómo trabaja pasa directo a aprender el panel.
  await expect(page.getByRole('heading', { name: 'Hacé un pedido de prueba' })).toHaveCount(0)
  await expect(page.getByText(/Aprendé tu panel · 1 de/)).toBeVisible()
  await captura(page, '09-aprender-1')
  while (await page.getByRole('button', { name: 'Siguiente' }).count()) await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByRole('heading', { name: 'Rice & Roll ya puede recibir pedidos' })).toBeVisible()
  await expect(page.getByText('Tenés 5 días de prueba incluidos')).toBeVisible()
  await captura(page, '10-aprender-fin')

  const credenciales = pedidos.find((p) => p.path === '/public/claim/test-claim/credenciales')
  expect(credenciales?.body).toEqual({ email: 'duenio@riceandroll.com', password: 'sushi-2026' })
  const metodos = pedidos.find((p) => p.path === '/restaurante/metodos-pago')
  expect(metodos?.body?.transferenciaAlias).toBe('riceandroll.mp')
  expect(pedidos.some((p) => p.path.startsWith('/zona-delivery'))).toBe(true)
  expect(errores).toEqual([])
})
