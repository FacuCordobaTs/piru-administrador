import { test, expect } from '@playwright/test'

const foto = { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBz0AAAAASUVORK5CYII=', 'base64') }
for (const width of [390, 1440]) {
  test.describe(`tienda ${width}px`, () => {
    test.use({ viewport: { width, height: 960 } })
    test('configuración vacía, fotos, todos los campos y respuesta normalizada del servidor', async ({ page }) => {
      const errores: string[] = []
      page.on('pageerror', e => errores.push(e.message))
      let enviado: any
      await page.route('**/restaurante/update', route => {
        enviado = route.request().postDataJSON()
        const tienda = { ...enviado.tienda, portadaUrl: '/logopiru.jpeg', galeria: ['/logopiru.jpeg'], whatsapp: '5491112345678' }
        return route.fulfill({ json: { success: true, data: { tienda } } })
      })
      await page.goto('/tests/tienda-personalizacion.html')
      await expect(page.getByRole('radio', { name: 'Sin elegir' })).toBeChecked()
      await page.getByRole('radio', { name: 'Moderna' }).check()
      await expect(page.getByLabel('Producto destacado', { exact: true })).toHaveValue('')
      await expect(page.getByLabel('Producto destacado', { exact: true }).locator('option')).toHaveText(['Sin producto destacado', 'Milanesa', 'Ensalada'])
      await page.getByLabel('Producto destacado', { exact: true }).selectOption('11')
      await page.getByLabel('Frase de tu local').fill('Cocina de estación')
      await page.getByLabel('Descripción breve').fill('Desde nuestra cocina a tu mesa.')
      await page.getByLabel('Frases de la cinta').fill('Hecho en casa\nCon amor')
      await page.getByRole('group', { name: 'Foto de portada', exact: true }).locator('input[type=file]').setInputFiles(foto)
      await page.getByRole('group', { name: 'Agregar foto a la galería', exact: true }).locator('input[type=file]').setInputFiles(foto)
      await expect(page.getByRole('group', { name: 'Foto de galería 1', exact: true })).toBeVisible()
      await page.getByLabel('Título de la historia').fill('Nuestras raíces')
      await page.getByLabel('Historia de tu local').fill('Primer párrafo.\nSegundo párrafo.')
      await page.getByLabel('Instagram', { exact: true }).fill('@casaoliva')
      await page.getByLabel('WhatsApp de contacto').fill('+54 9 11 1234-5678')
      await page.getByText('Paleta y tipografías personalizadas (opcional)', { exact: true }).click()
      await page.getByLabel('Color de fondo', { exact: true }).fill('#fff')
      await page.getByLabel('Color de superficie', { exact: true }).fill('#eee')
      await page.getByLabel('Color de texto', { exact: true }).fill('#111')
      await page.getByLabel('Color de acento', { exact: true }).fill('#f70')
      await page.getByLabel('Fuente de los títulos').fill('DM Sans')
      await page.getByLabel('Fuente del cuerpo').fill('Manrope')
      await page.getByLabel('Enlace a la hoja de fuentes').fill('https://fonts.googleapis.com/css2?family=DM+Sans')
      await page.getByLabel('Peso de los títulos').fill('800')
      await page.getByRole('button', { name: 'Guardar personalización', exact: true }).click()
      await expect(page.getByRole('status')).toContainText('Personalización guardada')
      expect(enviado.tienda).toMatchObject({ plantilla: 'moderna', productoDestacadoId: 11, frase: 'Cocina de estación', cinta: ['Hecho en casa', 'Con amor'], fuentes: { titulos: 'DM Sans', cuerpo: 'Manrope', pesoTitulos: 800 } })
      expect(enviado.tienda.portadaUrl).toMatch(/^data:image\/png/)
      await expect(page.getByLabel('Enlace de la portada')).toHaveValue('/logopiru.jpeg')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      if (process.env.TIENDA_ADMIN_SHOTS) await page.screenshot({ path: `${process.env.TIENDA_ADMIN_SHOTS}/tienda-${width}.png`, fullPage: true })
      expect(errores).toEqual([])
    })
    test('editar un local existente conserva sus campos, cambia orden y permite volver al predeterminado', async ({ page }) => {
      let enviado: any
      await page.route('**/restaurante/update', route => {
        enviado = route.request().postDataJSON()
        return route.fulfill({ json: { success: true, data: { tienda: enviado.tienda } } })
      })
      await page.goto('/tests/tienda-personalizacion.html?existente')
      await expect(page.getByLabel('Frase de tu local')).toHaveValue('La cocina de siempre')
      await page.getByRole('radio', { name: 'Artesanal', exact: true }).check()
      await page.getByRole('button', { name: 'Bajar foto 1', exact: true }).click()
      await page.getByRole('button', { name: 'Guardar personalización', exact: true }).click()
      await expect(page.getByRole('status')).toContainText('Personalización guardada')
      expect(enviado.tienda).toMatchObject({ plantilla: 'artesanal', historia: { texto: 'Nuestra historia' }, galeria: ['/logopiru.jpeg?segunda', '/logopiru.jpeg'] })
      await page.getByRole('button', { name: 'Quitar personalización y usar el diseño predeterminado' }).click()
      await page.getByRole('button', { name: 'Guardar personalización', exact: true }).click()
      await expect(page.getByRole('status')).toContainText('Personalización guardada')
      expect(enviado).toEqual({ tienda: {} })
      await expect(page.getByRole('radio', { name: 'Sin elegir' })).toBeChecked()
    })
  })
}

test('onboarding conserva y guarda la personalización del borrador por local', async ({ page }) => {
  let enviado: any
  await page.route('**/api/**', route => {
    if (route.request().method() === 'PUT' && route.request().url().endsWith('/onboarding/complete')) {
      enviado = route.request().postDataJSON()
      return route.fulfill({ json: { success: true, tienda: enviado.tienda } })
    }
    return route.fulfill({ json: { success: true, data: [], productos: [], categorias: [] } })
  })
  await page.goto('/tests/tienda-personalizacion.html?onboarding&existente')
  await page.getByText('Personalizar diseño y contenido (opcional)', { exact: true }).click()
  await expect(page.getByLabel('Frase de tu local')).toHaveValue('La cocina de siempre')
  await page.getByRole('radio', { name: 'Moderna' }).check()
  await page.getByLabel('Producto destacado', { exact: true }).selectOption('10')
  await page.getByLabel('Frase de tu local').fill('Una cocina con raíces')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('piru_onboarding_data:7')!).tienda.frase)).toBe('Una cocina con raíces')
  await page.evaluate(() => { localStorage.setItem('piru_onboarding_data:7:phase', 'whatsapps'); localStorage.setItem('piru_onboarding_data:7:configurada', 'true') })
  await page.reload()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect.poll(() => enviado?.tienda?.plantilla).toBe('moderna')
  expect(enviado.tienda).toMatchObject({ productoDestacadoId: 10, frase: 'Una cocina con raíces', historia: { texto: 'Nuestra historia' } })
})


test('valida los campos opcionales y conserva el borrador si falla el guardado', async ({ page }) => {
  let intentos = 0
  await page.route('**/restaurante/update', route => {
    intentos++
    return intentos === 1 ? route.fulfill({ status: 500, json: { success: false, message: 'Error de prueba' } })
      : route.fulfill({ json: { success: true, data: { tienda: route.request().postDataJSON().tienda } } })
  })
  await page.goto('/tests/tienda-personalizacion.html')
  await page.getByLabel('Frase de tu local').fill('Mi borrador')
  await page.getByText('Paleta y tipografías personalizadas (opcional)', { exact: true }).click()
  await page.getByLabel('Color de fondo', { exact: true }).fill('rojo')
  await expect(page.getByRole('button', { name: 'Guardar personalización', exact: true })).toBeDisabled()
  await page.getByLabel('Color de fondo', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Guardar personalización', exact: true }).click()
  await expect(page.getByText('No se pudo guardar la personalización', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Frase de tu local')).toHaveValue('Mi borrador')
  await page.getByRole('button', { name: 'Guardar personalización', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Personalización guardada')
})


test('se puede quitar el destacado sin quitar el resto de la personalización', async ({ page }) => {
  let enviado: any
  await page.route('**/restaurante/update', route => {
    enviado = route.request().postDataJSON()
    return route.fulfill({ json: { success: true, data: { tienda: enviado.tienda } } })
  })
  await page.goto('/tests/tienda-personalizacion.html?existente')
  await page.getByLabel('Producto destacado', { exact: true }).selectOption('11')
  await page.getByRole('button', { name: 'Guardar personalización', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Personalización guardada')
  expect(enviado.tienda.productoDestacadoId).toBe(11)
  await page.getByLabel('Producto destacado', { exact: true }).selectOption('')
  await page.getByRole('button', { name: 'Guardar personalización', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Personalización guardada')
  expect(enviado.tienda.productoDestacadoId).toBeUndefined()
  expect(enviado.tienda.frase).toBe('La cocina de siempre')
})


test('la revisión de la carta permite destacar un producto recién guardado', async ({ page }) => {
  let enviado: any
  await page.addInitScript(() => {
    localStorage.setItem('piru_onboarding_data:7:phase', 'revision')
    localStorage.setItem('piru_onboarding_data:7', JSON.stringify({
      tienda: { plantilla: 'moderna' },
      cartaDetectada: { categorias: [{ nombre: 'Comidas', productos: [{ localId: 'nuevo', id: 20, guardado: true, nombre: 'Producto nuevo', precio: 500, activo: true }] }] },
    }))
  })
  await page.route('**/api/**', route => {
    if (route.request().method() === 'PUT' && route.request().url().endsWith('/restaurante/update')) {
      enviado = route.request().postDataJSON()
      return route.fulfill({ json: { success: true, data: { tienda: enviado.tienda } } })
    }
    return route.fulfill({ json: { success: true, data: [], productos: [{ id: 20, nombre: 'Producto nuevo', precio: '500' }], categorias: [], ingredientes: [], agregados: [] } })
  })
  await page.goto('/tests/tienda-personalizacion.html?onboarding')
  await page.getByLabel('Producto destacado', { exact: true }).selectOption('20')
  await page.getByRole('button', { name: 'Guardar pendientes y continuar' }).click()
  await expect.poll(() => enviado?.tienda?.productoDestacadoId).toBe(20)
})
