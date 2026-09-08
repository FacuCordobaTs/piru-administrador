import { test, expect } from '@playwright/test'

test('el selector distingue el local del evento y conserva el selector convencional', async ({ page }) => {
    await page.goto('/tests/evento-ui.html')
    await page.getByRole('button', { name: 'Elegir sede', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Ver todas (dueño)' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Fiesta · POS del evento', exact: true }).click()
    await expect(page.getByLabel('Sede elegida')).toHaveText('20: Fiesta')
    await page.getByRole('button', { name: 'Elegir sede', exact: true }).click()
    await page.getByRole('button', { name: 'Local · pedidos web (sin eventos)', exact: true }).click()
    await expect(page.getByLabel('Sede elegida')).toHaveText('local: Local · pedidos web')
    await page.goto('/tests/evento-ui.html?convencional')
    await page.getByRole('button', { name: 'Elegir sede', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Ver todas (dueño)' })).toBeVisible()
})

test('crea evento sin dirección ni cambios de la tienda, usando sólo el endpoint nuevo', async ({ page }) => {
    const writes: string[] = []
    await page.route('**/sucursales/**', route => {
        writes.push(route.request().url())
        return route.fulfill({ json: { success: true, data: { id: 20, soloPos: true } } })
    })
    await page.goto('/tests/evento-ui.html')
    await page.getByRole('button', { name: 'Crear evento', exact: true }).click()
    await page.getByLabel('Nombre', { exact: true }).fill('Fiesta de Alfajor')
    await expect(page.getByText('Dirección exacta', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByText('Evento guardado')).toBeVisible()
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatch(/\/sucursales\/evento-pos$/)
})

test('backend anterior rechaza la creación del evento sin convertirlo en sucursal pública', async ({ page }) => {
    const writes: string[] = []
    await page.route('**/sucursales/**', route => {
        writes.push(route.request().url())
        return route.fulfill({ status: 404, json: { success: false, message: 'Actualizá el backend' } })
    })
    await page.goto('/tests/evento-ui.html')
    await page.getByRole('button', { name: 'Crear evento', exact: true }).click()
    await page.getByLabel('Nombre', { exact: true }).fill('Fiesta')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByText('Actualizá el backend')).toBeVisible()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatch(/\/sucursales\/evento-pos$/)
})
