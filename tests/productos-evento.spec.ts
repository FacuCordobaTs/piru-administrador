import { test, expect } from '@playwright/test'

test('asigna, vuelve al catálogo habitual y crea productos para eventos cerrados', async ({ page }) => {
    const producto = { id: 1, restauranteId: 1, nombre: 'Alfajor habitual', descripcion: 'Alfajor de chocolate', precio: '1500', activo: true, categoriaId: null, categoria: null, eventoSucursalId: null as number | null }
    const cambios: any[] = []
    await page.route('**/api/**', route => {
        if (new URL(route.request().url()).origin === 'http://127.0.0.1:4179') return route.continue()
        const path = new URL(route.request().url()).pathname
        if (path.endsWith('/sucursales/list')) return route.fulfill({ json: { success: true, data: [
            { id: 20, nombre: 'Feria', activo: true, soloPos: true },
            { id: 21, nombre: 'Evento cerrado', activo: false, soloPos: true },
            { id: 10, nombre: 'Sucursal pública', activo: true, soloPos: false },
        ] } })
        if (path.endsWith('/producto/update') || path.endsWith('/producto/create')) {
            const body = route.request().postDataJSON()
            cambios.push(body); Object.assign(producto, body)
        }
        if (path.endsWith('/restaurante/profile')) return route.fulfill({ json: { success: true, data: { restaurante: [{ id: 1, nombre: 'Local' }], mesas: [], productos: [producto] } } })
        return route.fulfill({ json: { success: true, categorias: [], ingredientes: [], agregados: [], data: [] } })
    })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/tests/productos-evento.html')
    await page.getByText('Alfajor habitual', { exact: true }).click()
    await page.getByRole('button', { name: 'Editar producto', exact: true }).click()
    await page.getByRole('combobox', { name: 'Dónde se vende' }).click()
    await expect(page.getByRole('option', { name: /Sucursal pública/ })).toHaveCount(0)
    await page.getByRole('option', { name: 'Sólo Feria', exact: true }).click()
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await expect.poll(() => cambios.length).toBe(1)
    expect(cambios[0].eventoSucursalId).toBe(20)
    await expect(page.getByText('Sólo Feria · Oculto en web', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Editar producto', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Dónde se vende' })).toHaveText('Sólo Feria')
    await page.getByRole('combobox', { name: 'Dónde se vende' }).click()
    await page.getByRole('option', { name: 'Catálogo habitual (web y POS)', exact: true }).click()
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await expect.poll(() => cambios.length).toBe(2)
    expect(cambios[1].eventoSucursalId).toBeNull()
    await page.getByRole('button', { name: 'Nuevo Plato', exact: true }).click()
    await page.getByPlaceholder('Ej: Burger Triple Cheddar').fill('Combo para el evento')
    await page.getByPlaceholder('Describe el plato...').fill('Combo exclusivo de la feria')
    await page.getByPlaceholder('0.00', { exact: true }).first().fill('3500')
    await page.getByRole('combobox', { name: 'Dónde se vende' }).click()
    await page.getByRole('option', { name: 'Sólo Evento cerrado (cerrado)', exact: true }).click()
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await expect.poll(() => cambios.length).toBe(3)
    expect(cambios[2]).toMatchObject({ eventoSucursalId: 21, categoriaId: null, nombre: 'Combo para el evento', precio: 3500 })
    await expect(page.getByText('Producto creado', { exact: true })).toBeVisible()
})
