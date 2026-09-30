import { test, expect, type Page } from '@playwright/test'

/**
 * Campañas con el diseño portado de la landing
 * (`landing/src/components/replicas/panel/PanelCampanas.astro`, cambio deliberado nº 8): la
 * lista dejó de mostrar sólo nombre y canal y pasó a ser un ranking de links con visitas,
 * pedidos y ventas, ordenado por ventas y con los números medidos contra el link que más
 * vendió. El orgánico cierra la lista como línea de base y no compite.
 *
 * Las métricas salen de `GET /marketing/resumen` (todas las campañas en una llamada) y de
 * `/marketing/organico/resultados`; el ranking no las recalcula en el cliente.
 */

const metricas = (ventas: number, pedidos: number, visitas: number) => ({
  ventas, pedidos, visitas, ticketPromedio: 0, clientesNuevos: 0, clientesRecurrentes: 0,
  sesiones: visitas, conversion: 0, revenueAtribuido: ventas, descuentos: 0, descuentosAtribuidos: 0,
  enlacesCreados: 0, contactos: 0, mensajesPagos: 0, costoMensajes: 0, inversionManual: 0,
  costoTotal: 0, retorno: 0,
})

const campaña = (opciones: {
  id: number; slug: string; nombre: string; estado: 'activa' | 'inactiva'; categoria: string; tipo?: string
}) => ({
  id: opciones.id, slug: opciones.slug, nombre: opciones.nombre, tipo: opciones.tipo ?? 'adquisicion',
  categoria: opciones.categoria, recetaCodigo: null, estado: opciones.estado, destinoTipo: 'tienda',
  productoId: null, carritoRep: null, codigoDescuentoId: null, descuentoProductoPorcentaje: 0,
  limiteUsos: null, usosActuales: 0, fechaInicio: null, fechaFin: null, visitas: 0,
  utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null,
  inversionManual: 0, usaGrupoControl: false, createdAt: '2026-09-01T12:00:00.000Z',
})

const CAMPANAS = [
  campaña({ id: 1, slug: 'promo-verano', nombre: 'Promo Verano', estado: 'activa', categoria: 'historias_instagram' }),
  campaña({ id: 2, slug: 'reels-tiktok', nombre: 'Reels TikTok', estado: 'inactiva', categoria: 'reels_tiktok' }),
  campaña({ id: 3, slug: 'pauta-meta', nombre: 'Pauta Meta', estado: 'activa', categoria: 'pauta_digital' }),
  // Maestra del motor: vive en la lista para poder explicarla, pero no es un link y no se rankea.
  campaña({ id: 4, slug: 'lo-mismo', nombre: 'Lo de siempre', estado: 'activa', categoria: 'historias_instagram', tipo: 'lo_mismo' }),
]

/** Las ventas del motor son altísimas a propósito: si entraran al ranking, la barra lo delata. */
const RESUMEN = {
  success: true,
  data: {
    campanas: [
      { id: 1, nombre: 'Promo Verano', slug: 'promo-verano', tipo: 'adquisicion', metricas: metricas(52500, 42, 1200), incremental: { disponible: false } },
      { id: 2, nombre: 'Reels TikTok', slug: 'reels-tiktok', tipo: 'adquisicion', metricas: metricas(18000, 11, 800), incremental: { disponible: false } },
      { id: 3, nombre: 'Pauta Meta', slug: 'pauta-meta', tipo: 'adquisicion', metricas: metricas(0, 0, 0), incremental: { disponible: false } },
      { id: 4, nombre: 'Lo de siempre', slug: 'lo-mismo', tipo: 'lo_mismo', metricas: metricas(999999, 500, 9000), incremental: { disponible: false } },
    ],
  },
}

/** El orgánico vende más que el mejor link, y aun así no le marca la escala a las barras. */
const ORGANICO = { success: true, data: { metricas: metricas(220000, 116, 2310) } }

const CATALOGO = [{
  id: 4,
  codigo: 'adquisicion',
  nombre: 'Adquisición',
  modulos: [{
    id: 11, codigo: 'crecimiento', categoriaId: 4, nombre: 'Campañas de adquisición',
    descripcion: 'Campañas de adquisición.', tipo: 'incluido', precioMensual: '0.00',
    precioMensualCongelado: null, mensajesUtilityIncluidos: 0, mensajesMarketingIncluidos: 0,
    estadoProducto: 'disponible', activable: true, activoCatalogo: true, estado: 'activo',
    origen: 'usuario', activoAhora: true,
  }],
}]

/** Las filas del ranking son el único botón ancho de la columna: el resto son controles. */
const filas = (page: Page) => page.locator('button.w-full.rounded-2xl')

async function montar(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/modulos/mis-modulos')) return route.fulfill({ json: { success: true, data: CATALOGO } })
    if (url.includes('/marketing/resumen')) return route.fulfill({ json: RESUMEN })
    if (url.includes('/marketing/organico/resultados')) return route.fulfill({ json: ORGANICO })
    if (url.includes('/marketing/campanas')) return route.fulfill({ json: { success: true, data: CAMPANAS } })
    return route.fulfill({ json: { success: true, data: [] } })
  })
  await page.goto('/tests/campanas-ranking.html#/clientes?tab=adquisicion&vista=campanas')
  await expect(filas(page).first()).toBeVisible()
}

for (const width of [1440, 390]) {
  test.describe(`${width < 768 ? 'mobile' : 'desktop'}`, () => {
    test.use({ viewport: { width, height: 1100 } })

    test('la lista es un ranking de links ordenado por ventas', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await montar(page)

      await expect(page.getByText('¿Qué publicación te trae ventas?')).toBeVisible()
      await expect(page.getByText('Todo el historial · ventas cobradas por link')).toBeVisible()

      const ranking = filas(page)
      // Tres links, la maestra del motor y el orgánico de cierre.
      await expect(ranking).toHaveCount(5)
      await expect(ranking.nth(0)).toContainText('Promo Verano')
      await expect(ranking.nth(1)).toContainText('Reels TikTok')
      await expect(ranking.nth(2)).toContainText('Pauta Meta')
      await expect(ranking.nth(4)).toContainText('Orgánico · sin campaña')
      expect(errors).toEqual([])

      // Capturas de revisión del diseño: `CAMPANAS_RANKING_SHOTS=<carpeta>`.
      const carpeta = process.env.CAMPANAS_RANKING_SHOTS
      if (carpeta) await page.screenshot({ path: `${carpeta}/campanas-ranking-${width}.png`, fullPage: true })
    })

    test('cada fila trae ventas, visitas y pedidos del período', async ({ page }) => {
      await montar(page)

      const primera = filas(page).nth(0)
      await expect(primera).toContainText('52.500')
      await expect(primera).toContainText('1.200 visitas')
      await expect(primera).toContainText('42 pedidos')
      // La campaña sin resultados muestra sus ceros, no desaparece del ranking.
      await expect(filas(page).nth(2)).toContainText('0 pedidos')
      // El estado se nombra sólo cuando no es "activa".
      await expect(filas(page).nth(1)).toContainText('inactiva')
      await expect(primera).not.toContainText('activa')
    })

    test('las barras se miden contra el link que más vendió', async ({ page }) => {
      await montar(page)

      const ranking = filas(page)
      // 52.500 es el máximo de los links: marca la escala.
      await expect(ranking.nth(0).locator('[style*="width"]')).toHaveAttribute('style', /width: 100%/)
      // 18.000 / 52.500 = 34%.
      await expect(ranking.nth(1).locator('[style*="width"]')).toHaveAttribute('style', /width: 34%/)
      await expect(ranking.nth(2).locator('[style*="width"]')).toHaveAttribute('style', /width: 0%/)
    })

    test('buscar no vuelve a pedir los resultados del período', async ({ page }) => {
      // El ranking dispara dos cargas pesadas por período: no pueden repetirse porque el
      // padre rearme el objeto de filtros en cada render.
      const pedidos: string[] = []
      page.on('request', (request) => {
        if (request.url().includes('/marketing/resumen')) pedidos.push(request.url())
      })
      await montar(page)
      const trasCargar = pedidos.length
      expect(trasCargar).toBeGreaterThan(0)

      await page.getByPlaceholder(/Buscar campañas por nombre o slug/).fill('promo')
      await expect(filas(page)).toHaveCount(1)
      await expect(filas(page).first()).toContainText('Promo Verano')
      expect(pedidos.length).toBe(trasCargar)
    })

    test('el motor y el orgánico no compiten con los links', async ({ page }) => {
      await montar(page)

      const ranking = filas(page)
      // La maestra del motor vende 999.999 en el resumen y aun así no entra al ranking:
      // queda al final, sin monto y sin barra.
      const motor = ranking.nth(3)
      await expect(motor).toContainText('Lo de siempre')
      await expect(motor).toContainText('Solo motor')
      await expect(motor).not.toContainText('999.999')
      await expect(motor.locator('[style*="width"]')).toHaveCount(0)

      // El orgánico cierra la lista como línea de base: números, sin barra.
      const organico = ranking.nth(4)
      await expect(organico).toContainText('220.000')
      await expect(organico).toContainText('2.310 visitas')
      await expect(organico).toContainText('116 pedidos')
      await expect(organico.locator('[style*="width"]')).toHaveCount(0)
    })
  })
}
