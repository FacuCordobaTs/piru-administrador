import { test, expect, type Page } from '@playwright/test'

/**
 * El estado comercial de un módulo vive ahora donde se usa el módulo, no en
 * Ajustes. Estas pruebas cubren `components/ModuloComercial.tsx` desde sus dos
 * consumidores reales, con el catálogo devolviendo un precio **no estándar**:
 * cualquier literal comercial reintroducido en la UI hace fallar el test.
 */
const PRECIO = '30000'

const categoria = (activo: boolean, estado = activo ? 'activo' : 'inactivo') => ({
  id: 3,
  codigo: 'retencion',
  nombre: 'Retención',
  modulos: [{
    id: 9,
    codigo: 'motor_recompra',
    nombre: 'Retención',
    descripcion: 'Motor de recompra y club de puntos.',
    tipo: 'pago',
    precioMensual: PRECIO,
    precioMensualCongelado: null,
    estadoProducto: 'disponible',
    activable: true,
    activoCatalogo: true,
    estado,
    activoAhora: activo,
  }],
})

const bloqueoDeModulo = {
  status: 403,
  json: { success: false, upgradeRequired: true, error: 'upgradeRequired' },
}

const resumenVacio = { success: true, data: { clientesConPuntos: 0, clientesConHistorial: 0, puntosEnCirculacion: 0, puntosOtorgados: 0, puntosCanjeados: 0, canjes: 0, movimientos: 0, canjesProducto: 0, canjesEnvio: 0, canjesDescuento: 0, puntosOtorgados30Dias: 0, canjes30Dias: 0 } }
const clientesVacio = { success: true, data: { items: [], pagina: 1, limite: 25, total: 0, paginas: 0 } }

for (const width of [1440, 390]) {
  test.describe(`${width < 768 ? 'mobile' : 'desktop'}`, () => {
    test.use({ viewport: { width, height: 1000 } })

    async function montar(page: Page, ruta: string, activadoRef: { valor: boolean }) {
      await page.route('**/api/**', async route => {
        const url = route.request().url()
        if (url.includes('/modulos/mis-modulos')) {
          return route.fulfill({ json: { success: true, data: [categoria(activadoRef.valor, activadoRef.valor ? 'activo' : (activadoRef.pendiente ? 'pendiente_pago' : 'inactivo'))] } })
        }
        if (url.includes('/suscripcion/mi-suscripcion')) return route.fulfill({ json: { success: true, data: { estado: 'activa', ciclo: 'mensual', suscripcionBase: { precioMensual: '40000', descuentoAnual: 20 } } } })
        if (url.includes('/checkout')) {
          activadoRef.valor = true
          return route.fulfill({ json: { success: true, data: { url_pago: '/tests/modulo-comercial.html#/pago' } } })
        }
        // Los endpoints de la capacidad siguen bloqueados hasta que se activa.
        if (!activadoRef.valor && (url.includes('/clientes/recompra/estado') || url.includes('/puntos/'))) {
          return route.fulfill(bloqueoDeModulo)
        }
        if (url.includes('/puntos/resumen')) return route.fulfill({ json: resumenVacio })
        if (url.includes('/puntos/clientes')) return route.fulfill({ json: clientesVacio })
        if (url.includes('/clientes/recompra/estado')) return route.fulfill({ json: { success: true, data: { activa: false, plan: { id: 1 } } } })
        return route.fulfill({ json: { success: true, data: [] } })
      })
      await page.goto(`/tests/modulo-comercial.html#${ruta}`)
    }

    test('el motor bloqueado activa con el precio del catálogo, no con un literal', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      const activado = { valor: false, pendiente: false }
      await montar(page, '/motor', activado)

      await expect(page.getByRole('heading', { name: 'Activá Retención', exact: true })).toBeVisible()
      await expect(page.getByText('Sin activar', { exact: true })).toBeVisible()
      // El monto sale del catálogo (30.000), no de un `$20.000` escrito a mano.
      const cta = page.getByRole('button', { name: /^Activar por/ })
      await expect(cta).toContainText('30.000')
      await expect(page.getByText('20.000')).toHaveCount(0)

      await cta.click()
      await expect(page.getByRole('heading', { name: 'Activar Retención', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Enviar link a WhatsApp' })).toBeVisible()
      await page.getByRole('button', { name: 'Pagar ahora' }).click()
      await page.waitForURL(/#\/pago/)
      expect(errors).toEqual([])
    })

    test('verificar el pago desbloquea el club de puntos sin cambiar de tab', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      // El módulo ya está en `pendiente_pago` pero la capacidad sigue en 403
      // hasta que el pago se acredita.
      const activado = { valor: false, pendiente: true }
      await montar(page, '/puntos', activado)

      await expect(page.getByRole('heading', { name: 'El Club de Puntos vive en Retención', exact: true })).toBeVisible()
      await expect(page.getByText('Pago pendiente', { exact: true })).toBeVisible()

      activado.valor = true // el webhook acreditó el pago
      await page.getByRole('button', { name: 'Ya pagué, verificar' }).click()

      // `onCambioEstado` limpia el bloqueo y recarga: la mitad Puntos aparece sola. El rótulo está
      // dos veces en el DOM a propósito (el resumen del club se monta arriba en mobile y dentro de
      // la columna en escritorio), así que se busca el visible, no los dos.
      await expect(page.locator('span:text-is("Puntos en circulación"):visible')).toHaveCount(1)
      await expect(page.getByRole('button', { name: 'Ya pagué, verificar' })).toHaveCount(0)
      expect(errors).toEqual([])
    })

    test('un pago pendiente se verifica en vez de ofrecer la activación', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      const activado = { valor: false, pendiente: true }
      await montar(page, '/motor', activado)

      await expect(page.getByText('Pago pendiente', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Ya pagué, verificar' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Volver al pago' })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Activar por/ })).toHaveCount(0)
      expect(errors).toEqual([])
    })
  })
}
