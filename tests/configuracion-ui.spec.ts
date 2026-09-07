import { test, expect } from '@playwright/test'

for (const width of [1440, 390]) {
 test(`configuración guiada a ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  let activated = false
  const module = (codigo: string, nombre: string, activo: boolean, tipo = 'incluido') => ({ id: codigo.length, codigo, nombre, descripcion: 'Una herramienta para simplificar el trabajo de tu negocio.', categoriaId: 1, tipo, precioMensual: tipo === 'pago' ? '30000' : '0', estadoProducto: 'disponible', activable: true, activoCatalogo: true, estado: activo ? 'activo' : 'inactivo', activoAhora: activo, mensajesUtilityIncluidos: tipo === 'pago' ? 200 : 0, mensajesMarketingIncluidos: 0 })
  await page.route('**/api/**', async route => {
   const url = route.request().url()
   if (url.includes('/modulos/mercadopago/activar')) { activated = true; return route.fulfill({ json: { success: true } }) }
   if (url.includes('/modulos/mis-modulos')) return route.fulfill({ json: { success: true, data: [{ id: 1, codigo: 'operacion', nombre: 'Tu operación', descripcion: 'Herramientas incluidas en tu suscripción.', modulos: [module('mercadopago', 'Mercado Pago', activated), module('facturacion_arca', 'Facturación ARCA', false), module('avisos_automaticos_whatsapp', 'Avisos por WhatsApp', true, 'pago'), { ...module('motor_recompra', 'Motor de Recompra', false, 'pago'), estado: 'pendiente_pago' }] }] } })
   if (url.includes('/suscripcion/mi-suscripcion')) return route.fulfill({ json: { success: true, data: { estado: 'activa', suscripcionId: 1, ciclo: 'mensual', fechaProximoCobro: '2026-10-07', suscripcionBase: { nombre: 'Piru', precioMensual: '40000', descuentoAnual: 20 }, cotizacionProximaFactura: { montoBaseMensual: 40000, montoTotalMensual: 70000 }, wallet: {} } } })
   if (url.includes('horarios')) return route.fulfill({ json: { success: true, horarios: [] } })
   return route.fulfill({ json: { success: true, data: [], conectado: false } })
  })
  await page.goto('/tests/configuracion-ui.html')
  await expect(page.getByRole('heading', { name: 'Todo listo para trabajar.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Definí tus horarios de atención' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Facturas a clientes/ })).toHaveCount(0)
  const search = page.getByRole('textbox', { name: 'Buscar un ajuste o módulo' })
  await search.fill('mercado')
  await page.getByRole('button', { name: /Mercado Pago.*Sin activar/ }).click()
  await page.getByRole('button', { name: 'Activar gratis', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Configurar', exact: true })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Configurar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mercado Pago', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await search.fill('')
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('button', { name: /Motor de Recompra.*Pago pendiente/ }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Ya pagué, verificar' })).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Volver al pago' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Avisos por WhatsApp.*Activo/ }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Configurar módulo' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByText('Administrar continuidad', { exact: true }).click()
  await page.getByRole('button', { name: 'Cancelar al final del período' }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: '¿Programar la baja de Piru?' })).toBeVisible()
  await page.getByRole('button', { name: 'Conservar suscripción' }).click()
  await page.getByText('Administrar continuidad', { exact: true }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: `tests/configuracion-${width}.png`, fullPage: true })
  expect(errors).toEqual([])
 })
}
