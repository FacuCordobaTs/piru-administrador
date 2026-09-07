import { test, expect } from '@playwright/test'

test('selección atómica, teclado, foco, campos ocultos y snapshot sin red', async ({ page }) => {
    let requests = 0
    let offline = false
    await page.route('**/clientes/indice-pos', route => {
        requests++
        if (offline) return route.abort('internetdisconnected')
        return route.fulfill({ json: { success: true, data: Array.from({ length: 3000 }, (_, i) => ({
            id: i + 1, nombre: `José Pérez ${String(i + 1).padStart(4, '0')}`, telefono: `341${String(5000000 + i)}`,
            telefonoNormalizado: `341${String(5000000 + i)}`, updatedAt: '2026-09-01T00:00:00.000Z',
        })) } })
    })
    await page.goto('/tests/pos-ui.html', { waitUntil: 'domcontentloaded' })
    const movil = page.getByRole('region', { name: 'Móvil', exact: true })
    const desktop = page.getByRole('region', { name: 'Desktop', exact: true })
    await page.getByRole('button', { name: 'Configurar POS', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.evaluate(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('focus')) })
    expect(requests).toBe(0)
    await page.getByRole('button', { name: 'Descargar clientes para usar sin conexión', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Copia de clientes guardada en este dispositivo.')
    expect(requests).toBe(1)
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    const nombre = movil.getByRole('combobox', { name: 'Nombre', exact: true })
    await nombre.fill('jose')
    await expect(page.getByRole('option')).toHaveCount(8)
    await expect(page.getByRole('combobox', { name: 'Celular', exact: true })).toHaveValue('')
    await nombre.press('ArrowDown'); await nombre.press('Enter')
    await expect(nombre).toHaveValue('José Pérez 0001')
    await expect(desktop.getByRole('combobox', { name: 'Nombre', exact: true })).toHaveValue('José Pérez 0001')
    await expect(page.getByRole('combobox', { name: 'Celular', exact: true })).toHaveValue('3415000000')
    expect(requests).toBe(1)
    await nombre.fill('per'); await nombre.press('Escape')
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await nombre.fill('jose'); await page.getByRole('heading', { level: 1 }).click()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    const desktopNombre = desktop.getByRole('combobox', { name: 'Nombre', exact: true })
    await desktopNombre.fill('per')
    await page.getByRole('option').nth(1).click()
    await expect(page.getByRole('combobox', { name: 'Celular', exact: true })).toHaveValue('3415000001')
    await expect(desktop.getByRole('combobox')).toHaveCount(1)
    // Sólo falla el API. El shell del admin sigue accesible y la base persiste.
    offline = true
    await page.reload({ waitUntil: 'domcontentloaded' })
    await movil.getByRole('combobox', { name: 'Nombre', exact: true }).fill('jose')
    await expect(page.getByRole('option')).toHaveCount(8)
    await page.getByRole('option').first().click()
    await expect(page.getByRole('combobox', { name: 'Celular', exact: true })).toHaveValue('3415000000')
    expect(requests).toBe(1)
    await page.getByRole('button', { name: 'Salir', exact: true }).click()
    await nombre.fill('jose')
    await expect(page.getByRole('option')).toHaveCount(0)
})
