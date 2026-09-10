import { test, expect, type Page } from '@playwright/test'

const trabajos = async (page: Page): Promise<number[][]> => JSON.parse(await page.getByLabel('Trabajos').textContent() || '[]')
async function cambiarCopias(page: Page) {
    await page.getByRole('button', { name: 'Configurar POS', exact: true }).click()
    await page.getByRole('switch', { name: 'Imprimir cada comanda dos veces', exact: true }).click()
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
}

test('una o dos copias por trabajo, cambio inmediato y persistencia del switch', async ({ page }) => {
    await page.goto('/tests/printer-copias.html')
    await page.getByRole('button', { name: 'Imprimir comanda', exact: true }).click()
    await expect.poll(async () => (await trabajos(page)).length).toBe(1)
    const [original] = await trabajos(page)
    await cambiarCopias(page)
    // Guardar la preferencia no dispara una impresión por sí solo.
    expect(await trabajos(page)).toHaveLength(1)
    await page.getByRole('button', { name: 'Imprimir comanda', exact: true }).click()
    await expect.poll(async () => (await trabajos(page)).length).toBe(2)
    expect((await trabajos(page))[1]).toEqual(original.concat(original))
    await page.getByRole('button', { name: 'Imprimir prueba', exact: true }).click()
    await expect.poll(async () => (await trabajos(page)).length).toBe(3)
    expect((await trabajos(page))[2]).toEqual(original)
    await page.reload()
    await page.getByRole('button', { name: 'Configurar POS', exact: true }).click()
    await expect(page.getByRole('switch', { name: 'Imprimir cada comanda dos veces', exact: true })).toBeChecked()
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await page.getByRole('button', { name: 'Imprimir comanda', exact: true }).click()
    await expect.poll(async () => (await trabajos(page)).length).toBe(1)
    const [doble] = await trabajos(page)
    expect(doble.slice(0, doble.length / 2)).toEqual(doble.slice(doble.length / 2))
    await cambiarCopias(page)
    await page.getByRole('button', { name: 'Imprimir comanda', exact: true }).click()
    await expect.poll(async () => (await trabajos(page)).length).toBe(2)
    expect((await trabajos(page))[1]).toEqual(doble.slice(0, doble.length / 2))
})

test('mantiene errores de impresión y exige el módulo aunque haya dos copias', async ({ page }) => {
    await page.goto('/tests/printer-copias.html')
    await cambiarCopias(page)
    await page.getByRole('button', { name: 'Simular falla', exact: true }).click()
    await page.getByRole('button', { name: 'Imprimir comanda', exact: true }).click()
    await expect(page.getByLabel('Resultado')).toContainText('Impresora desconectada')
    expect(await trabajos(page)).toHaveLength(1)
    await page.getByRole('button', { name: 'Desactivar módulo', exact: true }).click()
    await page.getByRole('button', { name: 'Imprimir comanda', exact: true }).click()
    await expect(page.getByLabel('Resultado')).toContainText('Activá el módulo Impresión de comandas')
    expect(await trabajos(page)).toHaveLength(1)
})
