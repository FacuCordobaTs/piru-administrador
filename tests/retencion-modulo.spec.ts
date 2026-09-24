import { test, expect, type Page } from '@playwright/test'

/**
 * Retención con el módulo apagado: no hay mitades que navegar, así que en su
 * lugar va la explicación de las dos capacidades (Club de puntos + motor de
 * recompra) y el bloque de activación. Y Campañas de adquisición, que pasa a
 * estar incluida: se activa gratis y no muestra precio en ninguna parte.
 *
 * Los montos salen del catálogo mockeado con valores no estándar (37.500 /
 * 0.00), así que un literal comercial reintroducido en la UI hace fallar el test.
 */
const PRECIO_RETENCION = '37500'
const PRECIO_RETENCION_TEXTO = '37.500'
/** Precio viejo del catálogo: no debe aparecer en ningún lado. */
const PRECIO_VIEJO = '20.000'

const modulo = (opciones: {
  id: number
  codigo: string
  nombre: string
  tipo: 'pago' | 'incluido'
  precioMensual: string
  activo: boolean
  estado?: string
}) => ({
  id: opciones.id,
  codigo: opciones.codigo,
  categoriaId: 3,
  nombre: opciones.nombre,
  descripcion: 'Descripción de catálogo.',
  tipo: opciones.tipo,
  precioMensual: opciones.precioMensual,
  precioMensualCongelado: null,
  mensajesUtilityIncluidos: 0,
  mensajesMarketingIncluidos: 0,
  estadoProducto: 'disponible',
  activable: true,
  activoCatalogo: true,
  estado: opciones.estado ?? (opciones.activo ? 'activo' : 'inactivo'),
  origen: 'usuario',
  activoAhora: opciones.activo,
})

/** Catálogo con Retención y Campañas en el estado que pida cada test. */
const catalogo = (estado: {
  retencion: boolean
  campanas: boolean
  tipoRetencion?: 'pago' | 'incluido'
  tipoCampanas?: 'pago' | 'incluido'
  estadoRetencion?: string
}) => [
  {
    id: 3,
    codigo: 'retencion',
    nombre: 'Retención',
    modulos: [
      modulo({
        id: 9,
        codigo: 'motor_recompra',
        nombre: 'Retención',
        tipo: estado.tipoRetencion ?? 'pago',
        precioMensual: PRECIO_RETENCION,
        activo: estado.retencion,
        estado: estado.estadoRetencion,
      }),
    ],
  },
  {
    id: 4,
    codigo: 'adquisicion',
    nombre: 'Adquisición',
    modulos: [
      modulo({
        id: 11,
        codigo: 'crecimiento',
        nombre: 'Campañas de adquisición',
        tipo: estado.tipoCampanas ?? 'incluido',
        precioMensual: '0.00',
        activo: estado.campanas,
      }),
    ],
  },
]

const resumenVacio = { success: true, data: { clientesConPuntos: 0, clientesConHistorial: 0, puntosEnCirculacion: 0, puntosOtorgados: 0, puntosCanjeados: 0, canjes: 0, movimientos: 0, canjesProducto: 0, canjesEnvio: 0, canjesDescuento: 0, puntosOtorgados30Dias: 0, canjes30Dias: 0 } }
const clientesVacio = { success: true, data: { items: [], pagina: 1, limite: 25, total: 0, paginas: 0 } }
/**
 * Lo mínimo para que la mitad del motor monte: la cola y el estado de la campaña.
 * El surtido completo de fixtures vive en `motor-recompra.spec.ts`; acá sólo se
 * comprueba que el switch de mitades monta la otra mitad sin romperse.
 */
const CAMPANA_RECOMPRA = {
  estado: 'activa', modo: 'manual', cupoDiario: 30, enviadosHoy: 0, totalEnviados: 0,
  enCola: 0, contactados: 0, volvieron: 0, plataRecuperada: 0, control: 30,
  controlVolvieron: 0, tasaContactados: 0, tasaControl: 0, saldoMarketing: 120,
  activadaAt: '2026-09-01T12:00:00.000Z', pausadaAt: null,
}

/**
 * La config del local y las tandas. Sin esto el tablero del motor no monta: la mitad derecha
 * recorre las tandas vivas para el filtro de la cola, y `estado.config` alimenta el diálogo de
 * configuración. El backend los manda siempre; el mock tiene que hacer lo mismo.
 */
const CONFIG_RECOMPRA = {
  restauranteId: 1, estado: 'activa', modo: 'manual', cupoDiario: 30,
  diasToque2: 2, diasToque3: 2, porcentajeControl: 10,
  ultimoDrenajeDia: null, avisoSinSaldoAt: null,
}

async function montar(
  page: Page,
  ruta: string,
  estado: Parameters<typeof catalogo>[0] & { activaciones?: string[] },
) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/modulos/mis-modulos')) {
      const estadoActual = { ...estado }
      if (estado.activaciones?.includes('motor_recompra')) estadoActual.retencion = true
      if (estado.activaciones?.includes('crecimiento')) estadoActual.campanas = true
      return route.fulfill({ json: { success: true, data: catalogo(estadoActual) } })
    }
    if (url.includes('/suscripcion/mi-suscripcion')) {
      return route.fulfill({ json: { success: true, data: { estado: 'activa', ciclo: 'mensual', suscripcionBase: { precioMensual: '40000', descuentoAnual: 20 } } } })
    }
    // Activar un módulo incluido: el backend lo deja activo y el store recarga.
    if (url.includes('/modulos/motor_recompra/activar')) {
      estado.activaciones?.push('motor_recompra')
      return route.fulfill({ json: { success: true, data: { codigo: 'motor_recompra' } } })
    }
    if (url.includes('/puntos/resumen')) return route.fulfill({ json: resumenVacio })
    if (url.includes('/puntos/clientes')) return route.fulfill({ json: clientesVacio })
    if (url.includes('/clientes/recompra/estado')) {
      return route.fulfill({ json: { success: true, data: { activa: true, campana: CAMPANA_RECOMPRA, config: CONFIG_RECOMPRA, programaciones: [], plan: null, saldoMarketing: CAMPANA_RECOMPRA.saldoMarketing } } })
    }
    if (url.includes('/clientes/recompra/cola')) return route.fulfill({ json: clientesVacio })
    if (url.includes('/clientes/recompra/historial')) return route.fulfill({ json: clientesVacio })
    return route.fulfill({ json: { success: true, data: [] } })
  })
  await page.goto(`/tests/retencion-modulo.html#${ruta}`)
}

for (const width of [1440, 390]) {
  test.describe(`${width < 768 ? 'mobile' : 'desktop'}`, () => {
    test.use({ viewport: { width, height: 1000 } })

    test('con el módulo apagado no hay switch de mitades, hay explicación', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await montar(page, '/clientes?tab=retencion', { retencion: false, campanas: false })

      // El switch que elige la mitad es navegación: con el módulo apagado no va.
      await expect(page.getByRole('navigation', { name: 'Vistas de retención' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Motor de recompra', exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Puntos', exact: true })).toHaveCount(0)

      // En su lugar, las dos capacidades del módulo, con sus iconos.
      await expect(page.getByText('Club de puntos', { exact: true })).toBeVisible()
      await expect(page.getByText('Motor de recompra', { exact: true })).toBeVisible()
      await expect(page.getByText('Que tus clientes vuelvan', { exact: true })).toBeVisible()

      // Y la activación, con el precio del catálogo y sin literales viejos.
      await expect(page.getByRole('button', { name: /^Activar por/ })).toContainText(PRECIO_RETENCION_TEXTO)
      await expect(page.getByText(PRECIO_VIEJO)).toHaveCount(0)
      expect(errors).toEqual([])
    })

    test('activar el módulo incluido trae de vuelta la navegación', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      // Catálogo con Retención incluida: la activación no pasa por checkout, así
      // que el switch de mitades tiene que aparecer sin recargar la pantalla.
      await montar(page, '/clientes?tab=retencion', {
        retencion: false,
        campanas: false,
        tipoRetencion: 'incluido',
        activaciones: [],
      })

      await expect(page.getByRole('navigation', { name: 'Vistas de retención' })).toHaveCount(0)
      await page.getByRole('button', { name: 'Activar gratis' }).click()

      await expect(page.getByRole('navigation', { name: 'Vistas de retención' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Motor de recompra', exact: true })).toBeVisible()
      await expect(page.getByText('Club de puntos', { exact: true })).toHaveCount(0)
      expect(errors).toEqual([])
    })

    test('con el módulo activo el switch navega entre puntos y motor', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await montar(page, '/clientes?tab=retencion', { retencion: true, campanas: true })

      await expect(page.getByText('Que tus clientes vuelvan', { exact: true })).toHaveCount(0)
      // La mitad por defecto de Retención es Puntos. El rótulo existe en el
      // layout de mobile y en el de escritorio: sólo uno está visible a la vez.
      await expect(page.getByRole('button', { name: 'Puntos', exact: true })).toBeVisible()
      await expect(page.locator('span:text-is("Puntos en circulación"):visible')).toHaveCount(1)

      await page.getByRole('button', { name: 'Motor de recompra', exact: true }).click()
      // Si la mitad del motor no monta, esto lo delata antes que el switch.
      expect(errors).toEqual([])
      // El switch cambia de mitad y la de Puntos se va con él.
      await expect(page.getByRole('button', { name: 'Motor de recompra', exact: true })).toHaveAttribute('class', /bg-foreground/)
      await expect(page.getByRole('button', { name: 'Puntos', exact: true })).not.toHaveAttribute('class', /bg-foreground/)
      await expect(page.locator('span:text-is("Puntos en circulación")')).toHaveCount(0)
      expect(errors).toEqual([])
    })

    test('campañas incluidas se activan gratis y sin precio', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await montar(page, '/clientes?tab=adquisicion&vista=campanas', { retencion: true, campanas: false })

      await expect(page.getByText('Campañas de adquisición', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Activar gratis' })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Activar por/ })).toHaveCount(0)
      // La fila de Campañas no anuncia monto: el módulo dejó de tener precio.
      const fila = page
        .getByText('Campañas de adquisición', { exact: true })
        .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
      await expect(fila).not.toContainText('/mes')
      await expect(fila).not.toContainText(PRECIO_VIEJO)
      expect(errors).toEqual([])
    })

    test('el catálogo manda sobre la prop: incluido nunca muestra precio', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      // El componente se declara `pago` y el catálogo dice `incluido`: ofrecer el
      // checkout sería mandar al local a un 409.
      await montar(page, '/divergente', {
        retencion: false,
        campanas: false,
        tipoRetencion: 'incluido',
      })

      await expect(page.getByRole('button', { name: 'Activar gratis' })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Activar por/ })).toHaveCount(0)
      await expect(page.getByText(PRECIO_RETENCION_TEXTO)).toHaveCount(0)
      expect(errors).toEqual([])
    })
  })
}
