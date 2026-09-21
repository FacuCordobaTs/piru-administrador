import { test, expect } from '@playwright/test'

/**
 * Pantalla de la tienda de indumentaria (Alfajor, restaurante id 6).
 *
 * Cubre lo que no puede romperse sin que el dueño lo note: que sólo el local 6 la vea,
 * que cobre y despache pedidos, y que editar una prenda no vuelva a subir las imágenes
 * que ya están en R2.
 */

const IMAGEN_YA_SUBIDA = 'https://cdn.test/ropa/hoodie-1.webp'

const producto = {
  id: 7,
  nombre: 'Hoodie Drop 01',
  subtitulo: 'Algodón peinado 400g',
  descripcion: 'Buzo con cordón, calce holgado.',
  precio: 45000,
  precioAnterior: 52000,
  categoria: 'hoodies',
  imagenes: [IMAGEN_YA_SUBIDA],
  talles: ['S', 'M', 'L'],
  colores: [{ nombre: 'Negro', hex: '#111111' }],
  stock: null as number | null,
  activo: true,
  orden: 0,
}

const pedidoImpago = {
  id: 12,
  estado: 'pendiente',
  pagado: false,
  estadoPago: 'pendiente',
  metodoPago: 'transferencia_automatica_cucuru',
  tipoEntrega: 'envio',
  nombreCliente: 'Ana Gómez',
  telefono: '1145550000',
  direccion: 'Rivadavia 100',
  ciudad: 'CABA',
  codigoPostal: '1405',
  notas: 'Timbre 2',
  subtotal: 90000,
  costoEnvio: 2500,
  total: 92500,
  aliasTransferencia: 'alfajor.pedido12.cucuru',
  cvuTransferencia: '0000003100010000000001',
  createdAt: '2026-09-20T14:05:00.000Z',
  items: [
    {
      id: 1,
      productoId: 7,
      nombreProducto: 'Hoodie Drop 01',
      imagenUrl: null,
      talle: 'L',
      colorNombre: 'Negro',
      colorHex: '#111111',
      cantidad: 2,
      precioUnitario: 45000,
    },
  ],
}

const pedidoCobrado = {
  ...pedidoImpago,
  id: 13,
  estado: 'entregado',
  pagado: true,
  estadoPago: 'pagado',
  metodoPago: 'mercadopago_checkout',
  tipoEntrega: 'retiro',
  nombreCliente: 'Bruno Díaz',
  total: 45000,
  aliasTransferencia: null,
  cvuTransferencia: null,
  createdAt: '2026-09-19T10:00:00.000Z',
}

test('un local que no es Alfajor no ve la pantalla', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: { success: true, pedidos: [], productos: [] } }))
  await page.setViewportSize({ width: 1440, height: 1000 })

  await page.goto('/tests/ropa.html?restauranteId=1')

  await expect(page.getByText('Panel general', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ropa' })).toHaveCount(0)
})

test('Alfajor cobra y despacha pedidos, y edita el catálogo', async ({ page }) => {
  const pagos: Array<{ id: string; body: unknown }> = []
  const estados: Array<{ id: string; body: unknown }> = []
  const guardados: unknown[] = []
  let catálogo = [producto]

  await page.route('**/api/**', route => {
    if (new URL(route.request().url()).origin === 'http://127.0.0.1:4179') return route.continue()
    const url = new URL(route.request().url())
    const path = url.pathname
    const metodo = route.request().method()

    if (path.endsWith('/ropa/admin/pedidos')) {
      return route.fulfill({ json: { success: true, pedidos: [pedidoImpago, pedidoCobrado] } })
    }
    if (path.endsWith('/ropa/admin/productos') && metodo === 'GET') {
      return route.fulfill({ json: { success: true, productos: catálogo } })
    }
    if (path.includes('/ropa/admin/productos/') && metodo === 'PUT') {
      const body = route.request().postDataJSON()
      guardados.push(body)
      catálogo = [{ ...producto, ...body }]
      return route.fulfill({ json: { success: true } })
    }
    if (path.endsWith('/ropa/admin/config')) {
      if (metodo === 'GET') {
        return route.fulfill({ json: { success: true, data: { ropaEnvioEnabled: true, ropaCostoEnvio: 2500 } } })
      }
      return route.fulfill({ json: { success: true } })
    }
    if (path.endsWith('/pagado')) {
      pagos.push({ id: path, body: route.request().postDataJSON() })
      return route.fulfill({ json: { success: true } })
    }
    if (path.endsWith('/estado')) {
      estados.push({ id: path, body: route.request().postDataJSON() })
      return route.fulfill({ json: { success: true } })
    }
    return route.fulfill({ json: { success: true, data: [] } })
  })

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/tests/ropa.html?restauranteId=6')

  // ── Pedidos ──
  await expect(page.getByRole('heading', { name: 'Ropa' })).toBeVisible()
  await expect(page.getByText('1 sin cobrar', { exact: true })).toBeVisible()
  await expect(page.getByText('1 por despachar', { exact: true })).toBeVisible()

  // El impago se ordena antes que el cobrado, aunque sea más nuevo.
  const tarjetas = page.locator('text=Pedido #')
  await expect(tarjetas.first()).toHaveText('Pedido #12')

  // El alias dinámico de Cucuru tiene que estar a la vista para verificar la transferencia.
  await expect(page.getByText('alfajor.pedido12.cucuru', { exact: true })).toBeVisible()
  await expect(page.getByText('Rivadavia 100, CABA, 1405 · envío $ 2.500', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Marcar cobrado' }).click()
  await expect.poll(() => pagos.length).toBe(1)
  expect(pagos[0].body).toEqual({ pagado: true })
  expect(pagos[0].id).toContain('/ropa/admin/pedidos/12/pagado')

  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Preparando', exact: true }).click()
  await expect.poll(() => estados.length).toBe(1)
  expect(estados[0].body).toEqual({ estado: 'preparando' })
  expect(estados[0].id).toContain('/ropa/admin/pedidos/12/estado')

  // ── Catálogo ──
  await page.getByRole('tab', { name: /Productos/ }).click()
  await expect(page.getByText('Hoodie Drop 01', { exact: true })).toBeVisible()
  await expect(page.getByText('Talles: S · M · L', { exact: true })).toBeVisible()
  await expect(page.getByText(/Stock:\s*sin control/)).toBeVisible()

  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  await expect(page.getByRole('dialog').getByText('Editar prenda', { exact: true })).toBeVisible()

  await page.getByPlaceholder('S, M, L, XL…').fill('XL')
  await page.getByPlaceholder('S, M, L, XL…').press('Enter')
  await page.getByPlaceholder('Negro, Crema…').fill('Crema')
  await page.getByPlaceholder('Negro, Crema…').press('Enter')

  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await expect.poll(() => guardados.length).toBe(1)

  // La imagen ya subida se manda tal cual: no se re-sube ni se pierde al editar.
  expect(guardados[0].imagenes).toEqual([IMAGEN_YA_SUBIDA])
  expect(guardados[0].talles).toEqual(['S', 'M', 'L', 'XL'])
  expect(guardados[0].colores).toEqual([
    { nombre: 'Negro', hex: '#111111' },
    { nombre: 'Crema', hex: '#000000' },
  ])
  expect(guardados[0].stock).toBeNull()

  await expect(page.getByText('Prenda actualizada', { exact: true })).toBeVisible()
  await expect(page.getByText('Talles: S · M · L · XL', { exact: true })).toBeVisible()
})
