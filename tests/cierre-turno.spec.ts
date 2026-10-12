import { test, expect, type Page } from '@playwright/test'

/**
 * Cierre de turno → "Productos vendidos": el ranking se puede ordenar por lo más vendido (como
 * hasta ahora) o por categorías, con las unidades y la facturación de cada una y sus productos
 * al desplegarla. Se monta el componente real con `GET /pedido/cierre-turno` mockeado.
 */

const item = (id: number, nombreProducto: string, cantidad: number, precioUnitario: number) => ({
  id, productoId: id, nombreProducto, cantidad, precioUnitario: String(precioUnitario), estado: 'entregado',
})

const delivery = (id: number, total: number, nombreCliente: string, hora: number) => ({
  id, direccion: 'Mitre 123', nombreCliente, telefono: '3415550101', estado: 'delivered', total: String(total),
  notas: null, createdAt: `2026-10-12T${String(hora).padStart(2, '0')}:15:00.000Z`,
  deliveredAt: `2026-10-12T${String(hora).padStart(2, '0')}:55:00.000Z`, tipo: 'delivery' as const,
  items: [item(id * 10, 'Hamburguesa clásica', 1, total)], totalItems: 1, pagado: true, metodoPago: 'efectivo',
  montoDescuento: null, deliveryFee: null, repartidorId: null, repartidorNombre: null, anotadoManualmente: false,
})

const takeaway = (id: number, total: number, nombreCliente: string, hora: number) => ({
  id, nombreCliente, telefono: '3415550102', estado: 'delivered', total: String(total), notas: null,
  createdAt: `2026-10-12T${String(hora).padStart(2, '0')}:20:00.000Z`,
  deliveredAt: `2026-10-12T${String(hora).padStart(2, '0')}:40:00.000Z`, tipo: 'takeaway' as const,
  items: [item(id * 10, 'Papas fritas', 1, total)], totalItems: 1, pagado: true, metodoPago: 'mercadopago',
  montoDescuento: null, anotadoManualmente: false,
})

const vendido = (nombre: string, cantidad: number, totalVendido: number, categoria: string | null) => ({
  nombre, cantidad, totalVendido, categoria, categoriaId: null,
})

/**
 * Ordenados por unidades, como los entrega el backend. Los extras y el envío no son productos:
 * no entran ni al ranking ni a las categorías.
 */
const PRODUCTOS = [
  vendido('Gaseosa 500 ml', 25, 25000, 'Bebidas'),
  vendido('Papas fritas', 22, 33000, 'Acompañamientos'),
  vendido('Hamburguesa clásica', 18, 54000, 'Hamburguesas'),
  vendido('[Extra] Cheddar', 12, 6000, 'Hamburguesas'),
  vendido('Envío', 10, 15000, null),
  vendido('Hamburguesa doble', 9, 36000, 'Hamburguesas'),
  vendido('Cerveza IPA', 6, 21000, 'Bebidas'),
  vendido('Flan casero', 4, 8000, null),
]

const CIERRE = {
  success: true,
  data: {
    fecha: '2026-10-12',
    pedidosMesa: [],
    pedidosDelivery: [delivery(1, 90000, 'Lucía Pérez', 14), delivery(3, 40000, 'Tomás Gil', 20)],
    pedidosTakeaway: [takeaway(2, 70000, 'Sofía Ríos', 17)],
    totales: { mesa: '0', delivery: '130000', takeaway: '70000', general: '200000' },
    cantidades: { mesa: 0, delivery: 2, takeaway: 1, total: 3 },
    productosVendidos: PRODUCTOS,
    fechasDisponibles: ['2026-10-12'],
    turno: null,
    turnosDisponibles: [],
  },
}

async function montar(page: Page, hash = '') {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/pedido/cierre-turno')) return route.fulfill({ json: CIERRE })
    return route.fulfill({ json: { success: true, data: { habilitado: false } } })
  })
  await page.goto(`/tests/cierre-turno.html${hash}`)
  await expect(page.getByRole('button', { name: 'Productos vendidos' })).toBeVisible()
}

/** El diálogo del ranking: el último contenedor a pantalla completa que lo nombra. */
const dialogo = (page: Page) =>
  page.locator('div.fixed.inset-0').filter({ hasText: 'Ranking de productos' }).last()

/** Nombres de las filas, en el orden en que se ven. */
const nombres = (page: Page) =>
  dialogo(page).locator('span[title]').evaluateAll((els) => els.map((el) => el.getAttribute('title')))

const abrirRanking = async (page: Page) => {
  await page.getByRole('button', { name: 'Productos vendidos' }).click()
  await expect(dialogo(page).getByText('Ranking de productos', { exact: true })).toBeVisible()
}

for (const width of [1440, 390]) {
  test.describe(width < 768 ? 'mobile' : 'desktop', () => {
    test.use({ viewport: { width, height: 1000 } })

    test('por defecto es el ranking de siempre: más vendidos, sin extras ni envío', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await montar(page)
      await abrirRanking(page)

      const grupo = dialogo(page).getByRole('group', { name: 'Ordenar el ranking' })
      await expect(grupo.getByRole('button', { name: 'Más vendidos' })).toHaveAttribute('aria-pressed', 'true')
      await expect(grupo.getByRole('button', { name: 'Categorías' })).toHaveAttribute('aria-pressed', 'false')

      expect(await nombres(page)).toEqual([
        'Gaseosa 500 ml', 'Papas fritas', 'Hamburguesa clásica', 'Hamburguesa doble', 'Cerveza IPA', 'Flan casero',
      ])
      const primera = dialogo(page).getByTitle('Gaseosa 500 ml', { exact: true }).locator('xpath=ancestor::div[2]')
      await expect(primera).toContainText('25 u.')
      await expect(primera).toContainText('$25.000')
      await expect(primera).toContainText('12.5%')
      expect(errors).toEqual([])
    })

    test('por categorías: unidades y facturación de cada una, de la que más factura a la que menos', async ({ page }) => {
      await montar(page)
      await abrirRanking(page)
      await dialogo(page).getByRole('button', { name: 'Categorías' }).click()

      await expect(dialogo(page).getByRole('button', { name: 'Categorías' })).toHaveAttribute('aria-pressed', 'true')
      // Hamburguesas (27 u.) va antes que Bebidas (31 u.): manda lo facturado, no las unidades.
      expect(await nombres(page)).toEqual(['Hamburguesas', 'Bebidas', 'Acompañamientos', 'Sin categoría'])

      const filas = dialogo(page).getByRole('button', { expanded: false })
      const hamburguesas = filas.filter({ hasText: 'Hamburguesas' })
      // Los extras no suman: 18 + 9 unidades y 54.000 + 36.000 pesos, sobre 200.000 cobrados.
      await expect(hamburguesas).toContainText('27 u.')
      await expect(hamburguesas).toContainText('$90.000')
      await expect(hamburguesas).toContainText('45.0%')
      await expect(hamburguesas).toContainText('2 productos')

      const bebidas = filas.filter({ hasText: 'Bebidas' })
      await expect(bebidas).toContainText('31 u.')
      await expect(bebidas).toContainText('$46.000')
      await expect(bebidas).toContainText('23.0%')

      const acompanamientos = filas.filter({ hasText: 'Acompañamientos' })
      await expect(acompanamientos).toContainText('22 u.')
      await expect(acompanamientos).toContainText('$33.000')
      await expect(acompanamientos).toContainText('1 producto')
      await expect(acompanamientos).not.toContainText('1 productos')

      // Lo que no tiene categoría no se pierde: queda junto, con nombre propio.
      const sinCategoria = filas.filter({ hasText: 'Sin categoría' })
      await expect(sinCategoria).toContainText('4 u.')
      await expect(sinCategoria).toContainText('$8.000')
    })

    test('cada categoría se despliega con sus productos, y se despliegan o pliegan todas a la vez', async ({ page }) => {
      await montar(page)
      await abrirRanking(page)
      await dialogo(page).getByRole('button', { name: 'Categorías' }).click()

      const hamburguesas = dialogo(page).getByRole('button', { name: /^Hamburguesas/ })
      await expect(hamburguesas).toHaveAttribute('aria-expanded', 'false')
      await hamburguesas.click()
      await expect(hamburguesas).toHaveAttribute('aria-expanded', 'true')
      // Adentro, del más vendido al menos vendido.
      expect(await nombres(page)).toEqual([
        'Hamburguesas', 'Hamburguesa clásica', 'Hamburguesa doble', 'Bebidas', 'Acompañamientos', 'Sin categoría',
      ])
      const clasica = dialogo(page).getByTitle('Hamburguesa clásica', { exact: true }).locator('xpath=ancestor::div[2]')
      await expect(clasica).toContainText('18 u.')
      await expect(clasica).toContainText('$54.000')
      await expect(clasica).toContainText('27.0%')

      await dialogo(page).getByRole('button', { name: 'Expandir todo' }).click()
      expect(await nombres(page)).toEqual([
        'Hamburguesas', 'Hamburguesa clásica', 'Hamburguesa doble',
        'Bebidas', 'Gaseosa 500 ml', 'Cerveza IPA',
        'Acompañamientos', 'Papas fritas',
        'Sin categoría', 'Flan casero',
      ])
      await dialogo(page).getByRole('button', { name: 'Contraer todo' }).click()
      expect(await nombres(page)).toEqual(['Hamburguesas', 'Bebidas', 'Acompañamientos', 'Sin categoría'])
    })

    test('volver a "Más vendidos" muestra otra vez el ranking plano', async ({ page }) => {
      await montar(page)
      await abrirRanking(page)
      await dialogo(page).getByRole('button', { name: 'Categorías' }).click()
      await dialogo(page).getByRole('button', { name: 'Más vendidos' }).click()

      await expect(dialogo(page).getByRole('button', { name: 'Más vendidos' })).toHaveAttribute('aria-pressed', 'true')
      expect((await nombres(page))[0]).toBe('Gaseosa 500 ml')
      await expect(dialogo(page).getByRole('button', { name: 'Expandir todo' })).toHaveCount(0)
    })

    test('el diálogo entra en el ancho de la pantalla y se ve bien', async ({ page }) => {
      await montar(page)
      await abrirRanking(page)
      await dialogo(page).getByRole('button', { name: 'Categorías' }).click()
      await dialogo(page).getByRole('button', { name: 'Expandir todo' }).click()

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const caja = await dialogo(page).getByText('Ranking de productos', { exact: true }).boundingBox()
      expect(caja).not.toBeNull()
      expect(caja!.x).toBeGreaterThanOrEqual(0)

      // Capturas de revisión del diseño: `CIERRE_TURNO_SHOTS=<carpeta>`.
      const carpeta = process.env.CIERRE_TURNO_SHOTS
      if (carpeta) await page.screenshot({ path: `${carpeta}/cierre-turno-categorias-${width}.png` })
    })
  })
}

test('en tema claro el ranking por categorías conserva el contraste', async ({ page }) => {
  await montar(page, '#claro')
  await abrirRanking(page)
  await dialogo(page).getByRole('button', { name: 'Categorías' }).click()
  await expect(dialogo(page).getByRole('button', { name: /^Hamburguesas/ })).toBeVisible()
  const carpeta = process.env.CIERRE_TURNO_SHOTS
  if (carpeta) await page.screenshot({ path: `${carpeta}/cierre-turno-categorias-claro.png` })
})
