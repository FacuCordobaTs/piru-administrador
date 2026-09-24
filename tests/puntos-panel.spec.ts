import { test, expect, type Page } from '@playwright/test'

/**
 * Mitad Puntos de Retención. Fija lo que se cambió a pedido del dueño: la
 * configuración del club —reglas, beneficios y puntos por producto— ya no vive
 * en un diálogo. Ocupa la columna derecha, en el mismo lugar que el detalle del
 * cliente, así que se ve siempre que no haya ningún cliente abierto, y se vuelve
 * deseleccionando el que estaba abierto (la misma fila, o el botón de cerrar).
 *
 * El montaje es el de la pantalla real: la configuración es un panel de la
 * columna, no una capa por encima, y con un cliente abierto no queda montada.
 */

const CLIENTE = {
  id: 7,
  nombre: 'Camila Duarte',
  telefono: '+54 9 11 5555-1234',
  telefonoNormalizado: '5491155551234',
  puntos: 320,
  puntosOtorgados: 500,
  puntosCanjeados: 180,
  canjes: 2,
  movimientos: 9,
  ultimoMovimientoAt: '2026-09-18T15:04:00.000Z',
}

const RESPUESTA_RESUMEN = {
  success: true,
  data: {
    clientesConPuntos: 1, clientesConHistorial: 1, puntosEnCirculacion: 320,
    puntosOtorgados: 500, puntosCanjeados: 180, canjes: 2, movimientos: 9,
    canjesProducto: 1, canjesEnvio: 1, canjesDescuento: 0,
    puntosOtorgados30Dias: 120, canjes30Dias: 1, ultimoMovimientoAt: '2026-09-18T15:04:00.000Z',
  },
}

const PAGINA_CLIENTES = { success: true, data: { items: [CLIENTE], pagina: 1, limite: 25, total: 1, paginas: 1 } }

/** Reglas del club, con valores no estándar: un default reintroducido en la UI se vería. */
const CONFIG_PUNTOS = {
  success: true,
  data: {
    restauranteId: 1, activo: true, pesosPorPunto: 250, puntosPrimerPedido: 70,
    puntosMinimosCanje: 150, permiteCanjeEnvioGratis: true, puntosEnvioGratis: 450,
    permiteCanjeDescuento: true, descuentoPuntosCosto: 600, descuentoTipo: 'monto_fijo',
    descuentoValor: 2500, descuentoMontoMinimo: 9000,
  },
}

const HISTORIAL_CLIENTE = {
  success: true,
  data: {
    cliente: { id: CLIENTE.id, nombre: CLIENTE.nombre, telefono: CLIENTE.telefono, puntos: CLIENTE.puntos },
    transacciones: [
      { id: 91, clienteId: CLIENTE.id, pedidoUnificadoId: 44, tipo: 'suma_compra', puntos: 40, saldoResultante: 320, motivo: 'Compra #44', createdAt: '2026-09-18T15:04:00.000Z' },
      { id: 90, clienteId: CLIENTE.id, pedidoUnificadoId: null, tipo: 'canje_envio', puntos: -180, saldoResultante: 280, motivo: 'Envío gratis', createdAt: '2026-09-11T20:10:00.000Z' },
    ],
  },
}

const PRODUCTOS = {
  productos: [
    { id: 3, nombre: 'Milanesa napolitana', activo: true, puntosGanados: 12, puntosNecesarios: 340 },
    { id: 4, nombre: 'Flan casero', activo: true, puntosGanados: 0, puntosNecesarios: 90 },
  ],
}

const PERFIL = {
  success: true,
  data: {
    restaurante: { id: 1, nombre: 'Lomitos del Barrio', username: 'lomitos', puntosActivo: true },
    mesas: [], productos: [], suscripcion: null,
  },
}

async function montar(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/puntos/resumen')) return route.fulfill({ json: RESPUESTA_RESUMEN })
    if (url.includes('/puntos/clientes')) return route.fulfill({ json: PAGINA_CLIENTES })
    if (url.includes('/puntos/cliente/')) return route.fulfill({ json: HISTORIAL_CLIENTE })
    if (url.includes('/puntos/config')) return route.fulfill({ json: CONFIG_PUNTOS })
    if (url.includes('/producto')) return route.fulfill({ json: PRODUCTOS })
    if (url.includes('/restaurante/profile')) return route.fulfill({ json: PERFIL })
    return route.fulfill({ json: { success: true, data: [] } })
  })
  await page.goto('/tests/puntos-panel.html')
}

/** El panel de configuración, por su pestaña de entrada. */
const tabBeneficios = (page: Page) => page.getByRole('button', { name: 'Beneficios y costos' })
const tabProductos = (page: Page) => page.getByRole('button', { name: 'Productos', exact: true })
const filaCliente = (page: Page) => page.getByRole('button', { name: /Camila Duarte/ })

for (const width of [1440, 390]) {
  test.describe(`${width < 768 ? 'mobile' : 'desktop'}`, () => {
    test.use({ viewport: { width, height: 1000 } })

    test('sin cliente abierto la columna derecha es la configuración', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await montar(page)

      // En mobile la columna derecha se elige desde la barra de arriba; en
      // escritorio ya está a la vista.
      if (width < 768) await page.getByRole('button', { name: 'Detalle', exact: true }).click()

      // La configuración viene abierta: sus dos bloques y la regla del club a la vista.
      await expect(tabBeneficios(page)).toBeVisible()
      await expect(tabProductos(page)).toBeVisible()
      await expect(page.getByLabel('Pesos por cada 1 punto ($)')).toHaveValue('250')
      await expect(page.getByRole('button', { name: /Guardar configuración de puntos/ })).toBeVisible()

      // Y ya no hay ningún "Seleccioná un cliente" que tape la configuración.
      await expect(page.getByRole('heading', { name: 'Seleccioná un cliente' })).toHaveCount(0)
      await expect(page.getByText('Vas a ver su saldo, su historial de movimientos')).toHaveCount(0)
      // Es un panel, no una capa: no hay diálogo montado.
      await expect(page.getByRole('dialog')).toHaveCount(0)

      if (width === 1440) await page.screenshot({ path: 'tests/puntos-panel.png', animations: 'disabled' })
      else await page.screenshot({ path: 'tests/puntos-panel-390.png', animations: 'disabled' })
      expect(errors).toEqual([])
    })

    test('abrir un cliente reemplaza la configuración por su detalle', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await montar(page)

      await filaCliente(page).click()

      await expect(page.getByRole('heading', { name: 'Camila Duarte' })).toBeVisible()
      await expect(page.getByText('Ajustar puntos')).toBeVisible()
      // La configuración cede la columna: no queda montada detrás del detalle.
      await expect(tabBeneficios(page)).toHaveCount(0)
      // El detalle se cierra con la X, que devuelve la columna a la configuración.
      await expect(page.getByRole('button', { name: 'Cerrar el cliente' })).toBeVisible()

      if (width === 1440) await page.screenshot({ path: 'tests/puntos-panel-cliente.png', animations: 'disabled' })
      else await page.screenshot({ path: 'tests/puntos-panel-cliente-390.png', animations: 'disabled' })
      expect(errors).toEqual([])
    })

    test('volver a tocar el cliente abierto devuelve la configuración', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await montar(page)

      await filaCliente(page).click()
      await expect(tabBeneficios(page)).toHaveCount(0)

      // En mobile el listado queda detrás de la vista de detalle: se vuelve primero.
      if (width < 768) await page.getByRole('button', { name: 'Clientes', exact: true }).click()

      // La misma fila, otra vez: se deselecciona y la columna vuelve a la configuración.
      await filaCliente(page).click()
      if (width < 768) await page.getByRole('button', { name: 'Detalle', exact: true }).click()
      await expect(tabBeneficios(page)).toBeVisible()
      await expect(page.getByLabel('Pesos por cada 1 punto ($)')).toHaveValue('250')
      await expect(page.getByRole('heading', { name: 'Camila Duarte' })).toHaveCount(0)
      expect(errors).toEqual([])
    })

    test('el botón de cerrar el cliente también la devuelve', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await montar(page)

      await filaCliente(page).click()
      await page.getByRole('button', { name: 'Cerrar el cliente' }).click()

      if (width < 768) {
        // Cerrar en mobile vuelve al listado, y de ahí el detalle muestra la configuración.
        await expect(page.getByRole('button', { name: 'Beneficios y productos' })).toBeVisible()
        await page.getByRole('button', { name: 'Detalle', exact: true }).click()
      }
      await expect(tabBeneficios(page)).toBeVisible()
      // El detalle se fue; la fila del listado, con su nombre, sigue estando.
      await expect(page.getByRole('heading', { name: 'Camila Duarte' })).toHaveCount(0)
      expect(errors).toEqual([])
    })

    test('la pestaña Productos edita los puntos por producto', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await montar(page)

      if (width < 768) await page.getByRole('button', { name: 'Detalle', exact: true }).click()
      await tabProductos(page).click()

      // La lista de productos con sus dos valores, editable en el lugar.
      await expect(page.getByText('Milanesa napolitana')).toBeVisible()
      await expect(page.getByText('Flan casero')).toBeVisible()
      const fila = page.getByText('Milanesa napolitana').locator('..').locator('..')
      await expect(fila.getByText('Otorga')).toBeVisible()
      await expect(fila.getByText('Costo en puntos')).toBeVisible()
      // Sin cambios pendientes no se ofrece guardar.
      await expect(fila.getByRole('button', { name: 'Guardar' })).toBeDisabled()

      expect(errors).toEqual([])
    })
  })
}
