import { test, expect, type Page } from '@playwright/test'

const back = (page: Page) => page.getByRole('button', { name: 'Volver a la pantalla anterior' })
const row = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name}`) })

for (const width of [1440, 390]) {
  test.describe(`${width < 768 ? 'mobile' : 'desktop'}`, () => {
    test.use({ viewport: { width, height: 1000 } })
    let errors: string[]
    test.beforeEach(async ({ page }) => {
      errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', async route => {
        if (route.request().resourceType() === 'script') return route.fulfill({ body: '', contentType: 'application/javascript' })
        const url = route.request().url()
        let body: object = { success: true, data: [], franjas: [] }
        if (url.endsWith('/restaurante/horarios')) body = { success: true, horarios: [{ diaSemana: 1, horaApertura: '09:00', horaCierre: '23:30' }] }
        if (url.endsWith('/whatsapp-oauth/status')) body = { success: true, conectado: true, phoneNumber: '3415550000', tokenVencido: false }
        // Hay zona de delivery: General esconde el costo fijo.
        if (url.endsWith('/zona-delivery')) body = { success: true, data: [{ id: 1, nombre: 'Centro', precio: '500' }] }
        await route.fulfill({ json: body })
      })
      await page.goto('/tests/ajustes-ui.html')
    })
    test.afterEach(() => expect(errors).toEqual([]))

    async function section(page: Page, name: string) {
      if (width < 768 && !await page.getByRole('navigation', { name: 'Secciones de ajustes' }).isVisible()) await page.getByLabel('Volver a Ajustes').click()
      await page.getByRole('navigation', { name: 'Secciones de ajustes' }).getByRole('link', { name: new RegExp(`^${name}`) }).filter({ visible: true }).click()
      if (width < 768) await expect(page.getByRole('navigation', { name: 'Secciones de ajustes' })).toBeHidden()
    }

    test('las URLs viejas de Crecimiento redirigen en vez de morir', async ({ page }) => {
      // `null` = destino dentro de Ajustes: ahí no hay sonda de ruta, así que se
      // verifica la pantalla que se renderiza (General es la única con fila de GTM).
      const casos: [string, string | null][] = [
        ['/dashboard/ajustes/adquisicion', '/dashboard/marketing/campanas'],
        ['/dashboard/ajustes/crecimiento', '/dashboard/marketing/campanas'],
        ['/dashboard/ajustes/retencion', '/dashboard/marketing/hoy'],
        ['/dashboard/ajustes/retencion?config=puntos', '/dashboard/marketing/puntos'],
        ['/dashboard/ajustes/activacion', null],
        ['/dashboard/ajustes/experiencia', null],
      ]
      for (const [origen, destino] of casos) {
        await page.goto(`/tests/ajustes-ui.html#${origen}`)
        await page.reload()
        if (destino === null) {
          await expect(page.getByTestId('ruta')).toHaveCount(0)
          await expect(row(page, 'Tu negocio')).toBeVisible()
        } else {
          await expect(page.getByTestId('ruta')).toHaveText(destino)
        }
      }
    })

    test('Suscripción y pagos vive dentro de Cuenta', async ({ page }) => {
      await page.goto('/tests/ajustes-ui.html#/dashboard/ajustes/suscripcion')
      await page.reload()
      await expect(page.getByRole('heading', { name: 'Cuenta', exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Suscripción y pagos', exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: /^Suscripción y pagos/ })).toHaveCount(0)
    })

    test('las secciones de Ajustes aparecen sólo con sus módulos activos', async ({ page }) => {
      const nav = page.getByRole('navigation', { name: 'Secciones de ajustes' })
      const whatsapp = nav.getByRole('link', { name: /^WhatsApp/ })
      const ventas = nav.getByRole('link', { name: /^Ventas en el local/ })
      const mozos = nav.getByRole('link', { name: /^Mozos/ })

      await expect(whatsapp).toBeVisible()
      await page.evaluate(() => (window as unknown as { __piruModulo: (codigo: string, activo: boolean) => void }).__piruModulo('avisos_automaticos_whatsapp', false))
      await expect(whatsapp).toHaveCount(0)

      await expect(ventas).toBeVisible()
      await page.evaluate(() => (window as unknown as { __piruModulo: (codigo: string, activo: boolean) => void }).__piruModulo('pos', false))
      await page.evaluate(() => (window as unknown as { __piruModulo: (codigo: string, activo: boolean) => void }).__piruModulo('mesas', false))
      await expect(ventas).toHaveCount(0)
      await expect(mozos).toHaveCount(0)
      // Sin tabs visibles, el grupo tampoco se muestra.
      await expect(page.getByText('Operación', { exact: true })).toHaveCount(0)
    })

    test('Módulos vive fuera de Ajustes y muestra los activos y el catálogo completo', async ({ page }) => {
      await page.goto('/tests/ajustes-ui.html#/dashboard/ajustes/modulos')
      await page.reload()
      await expect(page.getByRole('heading', { name: 'Módulos', exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Tus módulos activos' })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Punto de venta/ }).first()).toBeVisible()
      // El catálogo sigue mostrando lo que todavía no está activo.
      await expect(page.getByRole('button', { name: /^Gestión de stock/ })).toBeVisible()
    })

    test('horarios reemplaza el resumen y conserva el autosave al volver', async ({ page }) => {
      await section(page, 'Horarios')
      await row(page, 'Horarios de atención').click()
      await expect(page.getByRole('region', { name: 'Horarios de atención' })).toBeVisible()
      await expect(page.getByText('Cuándo abrís y si aceptás pedidos para más tarde.')).toBeHidden()
      await expect(row(page, 'Pedidos programados')).toBeHidden()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      const save = page.waitForRequest(request => request.url().endsWith('/restaurante/horarios') && request.method() === 'PUT')
      await page.locator('input[type=time]').first().fill('10:00')
      await back(page).click()
      expect((await save).postDataJSON().horarios[0].horaApertura).toBe('10:00')
      await expect(page.getByText(/10:00 a 23:30/)).toBeVisible()
      await row(page, 'Horarios de atención').click()
      await expect(page.locator('input[type=time]').first()).toHaveValue('10:00')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `node_modules/.cache/ajustes-horarios-${width}.png`, fullPage: true })
      await page.keyboard.press('Escape')
      await expect(row(page, 'Pedidos programados')).toBeVisible()
    })

    test('franjas y sucursales tienen un segundo nivel con retorno al padre', async ({ page }) => {
      await section(page, 'Horarios')
      await row(page, 'Pedidos programados').click()
      await page.getByRole('button', { name: 'Nueva', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Nueva franja' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Pedidos programados' })).toBeHidden()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await back(page).click()
      await expect(page.getByRole('button', { name: 'Nueva', exact: true })).toBeVisible()
      await back(page).click()
      await section(page, 'Ventas en el local')
      await row(page, 'Eventos con POS').click()
      await page.getByRole('button', { name: 'Nuevo evento' }).click()
      await expect(page.getByRole('button', { name: 'Nuevo evento', exact: true })).toBeHidden()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await back(page).click()
      await expect(page.getByRole('button', { name: 'Nuevo evento' })).toBeVisible()
      await back(page).click()
      await section(page, 'Entregas y zonas')
      await row(page, 'Dirección de entrega').click()
      await expect(page.getByRole('switch', { name: 'Pasar a dirección de solo texto' })).toBeVisible()
      await expect(row(page, 'Tipos de pedido')).toBeHidden()
    })

    test('general, cuenta, mozos y ventas usan vistas exclusivas', async ({ page }) => {
      await section(page, 'General')
      await expect(page.getByText('Av. Siempre Viva 742')).toBeVisible()
      // Con zonas cargadas el costo fijo desaparece y las opciones de tienda ya no viven acá.
      await expect(row(page, 'Costo de envío')).toHaveCount(0)
      await expect(row(page, 'Tu tienda')).toHaveCount(0)
      await expect(row(page, 'Google Tag Manager')).toHaveCount(0)
      await expect(row(page, 'Meta Pixel')).toHaveCount(0)
      await expect(row(page, 'Logos')).toHaveCount(0)
      await expect(page.getByText('Permitir pedidos en grupo')).toHaveCount(0)
      await expect(page.getByText('Productos grandes en mayúsculas')).toHaveCount(0)
      await row(page, 'Tu negocio').click()
      await expect(page.getByRole('region', { name: 'Tu negocio', exact: true })).toBeVisible()
      await expect(row(page, 'Tu tienda')).toBeHidden()
      await back(page).click()
      await section(page, 'Cuenta')
      await row(page, 'Contraseña').click()
      await expect(page.getByRole('heading', { name: 'Cambiar contraseña' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeHidden()
      await back(page).click()
      await section(page, 'Mozos')
      await page.getByRole('button', { name: 'Agregar mozo' }).click()
      await expect(page.getByRole('heading', { name: 'Agregar mozo' })).toBeVisible()
      await back(page).click()
      await section(page, 'Ventas en el local')
      await row(page, 'Punto de venta').click()
      await expect(page.getByRole('region', { name: 'Configurar punto de venta', exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Ventas en el local', exact: true })).toBeHidden()
      // Los módulos que se activan en Clientes no caen al fallback "ventas".
      await expect(page.getByText('Campañas de adquisición')).toHaveCount(0)
      await expect(page.getByText('Retención')).toHaveCount(0)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await back(page).click()
      await section(page, 'Métodos de pago')
      await expect(row(page, 'Métodos de pago habilitados')).toBeVisible()
      await row(page, 'Mercado Pago').first().click()
      await expect(page.getByRole('region', { name: 'Mercado Pago', exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Métodos de pago', exact: true })).toBeHidden()
      await back(page).click()
      await section(page, 'Entregas y zonas')
      await row(page, 'Múltiples sucursales').click()
      await expect(page.getByRole('heading', { name: 'Módulos', exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })

    test('Ventas en el local abre la misma configuración del POS (cobro manual y QR incluidos)', async ({ page }) => {
      await section(page, 'Ventas en el local')
      await row(page, 'Punto de venta').click()
      const configuracion = page.getByRole('region', { name: 'Configurar punto de venta', exact: true })
      await expect(configuracion).toBeVisible()
      // Es el formulario compartido, no una copia: trae lo agregado después (copias de la comanda, cobro manual).
      await expect(configuracion.getByRole('switch', { name: 'Imprimir cada comanda dos veces' })).toBeVisible()
      const cobroManual = configuracion.getByRole('switch', { name: 'Confirmar cobros manualmente' })
      await expect(cobroManual).toHaveAttribute('aria-checked', 'false')
      // La conexión de Mercado Pago para QR aparece recién con la opción encendida.
      await expect(configuracion.getByTestId('pos-cajas-qr')).toHaveCount(0)
      await cobroManual.click()
      await expect(configuracion.getByTestId('pos-cajas-qr')).toBeVisible()
    })

    test('Meta Pixel se configura aparte de GTM', async ({ page }) => {
      await section(page, 'Medición')
      // Son dos filas separadas: la vieja prometía las dos integraciones y sólo gobernaba GTM.
      await expect(row(page, 'Google Tag Manager')).toBeVisible()
      await row(page, 'Meta Pixel').click()
      await expect(page.getByRole('region', { name: 'Meta Pixel', exact: true })).toBeVisible()
      await expect(row(page, 'Google Tag Manager')).toBeHidden()

      const pixel = page.getByLabel('ID del pixel')
      await pixel.fill('2426')
      await pixel.blur()
      // Un ID que no llega a 15 dígitos no se guarda y el error queda a la vista.
      await expect(page.getByText(/Usá sólo el número de tu pixel/)).toBeVisible()

      await pixel.fill('2426435001137598')
      const guardado = page.waitForRequest(request => request.url().endsWith('/restaurante/update') && request.method() === 'PUT')
      await pixel.blur()
      expect((await guardado).postDataJSON()).toEqual({ metaPixelId: '2426435001137598' })
      await back(page).click()
    })

    test('medición, WhatsApp y mapa respetan la misma profundidad', async ({ page }) => {
      await section(page, 'Medición')
      await row(page, 'Google Tag Manager').click()
      await expect(page.getByRole('region', { name: 'Google Tag Manager', exact: true })).toBeVisible()
      await expect(row(page, 'Meta Pixel')).toBeHidden()
      await back(page).click()
      await section(page, 'WhatsApp')
      await expect(page.getByText('Conectado · 3415550000')).toBeVisible()
      await row(page, 'WhatsApp Business').click()
      await expect(page.getByRole('heading', { name: 'WhatsApp Business', exact: true })).toBeVisible()
      await back(page).click()
      await row(page, 'Avisos automáticos por WhatsApp').click()
      await expect(page.getByRole('heading', { name: 'Avisos automáticos por WhatsApp', exact: true })).toBeVisible()
      await back(page).click()
      await section(page, 'Entregas y zonas')
      await row(page, 'Zonas de delivery').click()
      await page.getByRole('button', { name: 'Abrir Mapa' }).click()
      await expect(page.getByRole('heading', { name: 'Dibujar Zonas de Delivery' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Abrir Mapa' })).toBeHidden()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      const map = page.locator('.leaflet-container')
      await expect(map).toBeVisible()
      expect((await map.boundingBox())!.height).toBeGreaterThan(250)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `node_modules/.cache/ajustes-mapa-${width}.png`, fullPage: true })
      await back(page).click()
      await expect(page.getByRole('button', { name: 'Abrir Mapa' })).toBeVisible()
    })
  })
}
