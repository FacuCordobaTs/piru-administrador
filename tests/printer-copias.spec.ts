import { test, expect, type Page } from '@playwright/test'
import type { PrinterTarget } from '../src/utils/printerTypes'

const trabajos = async (page: Page): Promise<number[][]> => JSON.parse(await page.getByLabel('Trabajos').textContent() || '[]')
const destinos = async (page: Page): Promise<PrinterTarget[]> => JSON.parse(await page.getByLabel('Destinos').textContent() || '[]')
const seleccionada = (page: Page) => page.getByLabel('Impresora')
const manuales = async (page: Page): Promise<string[]> => JSON.parse(await page.getByLabel('Manuales').textContent() || '[]')
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

test('un equipo ya instalado conserva su impresora al migrar la clave vieja', async ({ page }) => {
    // "COM3" antes se abría como puerto serie a 9600 por la forma del nombre: ahora es un destino explícito.
    await page.goto('/tests/printer-copias.html?legacy=COM3')
    await expect(seleccionada(page)).toHaveText('serial:COM3:9600')
    await page.getByRole('button', { name: 'Imprimir comanda', exact: true }).click()
    await expect.poll(async () => (await destinos(page)).length).toBe(1)
    expect((await destinos(page))[0]).toEqual({ kind: 'serial', port: 'COM3', baud: 9600 })
    // La migración se persiste: el próximo arranque ya no depende de la clave vieja.
    expect(await page.evaluate(() => localStorage.getItem('piru_printer_target')))
        .toBe('{"kind":"serial","port":"COM3","baud":9600}')
})

test('la impresora virtual de debug migra al destino de archivo', async ({ page }) => {
    await page.goto(`/tests/printer-copias.html?legacy=${encodeURIComponent('GUARDAR EN ARCHIVO (DEBUG)')}`)
    await expect(seleccionada(page)).toHaveText('debug-file')
    await page.getByRole('button', { name: 'Imprimir comanda', exact: true }).click()
    await expect.poll(async () => (await destinos(page)).length).toBe(1)
    expect((await destinos(page))[0]).toEqual({ kind: 'debug-file' })
})

test('lo ya elegido en la clave nueva manda sobre la clave vieja', async ({ page }) => {
    await page.goto('/tests/printer-copias.html?nueva=tcp')
    await expect(seleccionada(page)).toHaveText('tcp:192.168.1.50:9100')
    // No se re-migra ni se pisa la elección nueva.
    expect(await page.evaluate(() => localStorage.getItem('piru_printer_target')))
        .toBe('{"kind":"tcp","host":"192.168.1.50","port":9100}')
})

test('una clave nueva ilegible no deja al equipo sin impresora', async ({ page }) => {
    await page.goto('/tests/printer-copias.html?nueva=rota')
    await expect(seleccionada(page)).toHaveText('spooler:Impresora fixture')
    expect(await page.evaluate(() => localStorage.getItem('piru_printer_target')))
        .toBe('{"kind":"spooler","name":"Impresora fixture"}')
})

test('sin impresora elegida avisa en vez de mandar el trabajo', async ({ page }) => {
    await page.goto('/tests/printer-copias.html?legacy=')
    await expect(seleccionada(page)).toHaveText('sin-impresora')
    await page.getByRole('button', { name: 'Imprimir comanda', exact: true }).click()
    await expect(page.getByLabel('Resultado')).toContainText('No hay impresora seleccionada')
    expect(await trabajos(page)).toHaveLength(0)
})

test('elegir una impresora no borra las otras cargadas a mano', async ({ page }) => {
    // Un local con impresora de cocina y de barra: las dos se tipean a mano (red, sin descubrimiento).
    await page.goto('/tests/printer-copias.html?nueva=tcp&manual=2')
    await expect(seleccionada(page)).toHaveText('tcp:192.168.1.50:9100')
    await expect.poll(async () => (await manuales(page)).length).toBe(2)
    expect(await manuales(page)).toEqual(['tcp:192.168.1.50:9100', 'tcp:192.168.1.51:9100'])

    await page.getByRole('button', { name: 'Imprimir comanda', exact: true }).click()
    await expect.poll(async () => (await destinos(page)).length).toBe(1)
    expect((await destinos(page))[0]).toEqual({ kind: 'tcp', host: '192.168.1.50', port: 9100 })
})

test('borrar la manual elegida deja el equipo sin impresora y conserva las demás', async ({ page }) => {
    await page.goto('/tests/printer-copias.html?nueva=tcp&manual=2')
    await expect(seleccionada(page)).toHaveText('tcp:192.168.1.50:9100')

    await page.getByRole('button', { name: 'Quitar la elegida', exact: true }).click()
    await expect(seleccionada(page)).toHaveText('sin-impresora')
    expect(await manuales(page)).toEqual(['tcp:192.168.1.51:9100'])
    // La elección se borra del almacenamiento: si sobreviviera, el equipo volvería a creer que tiene impresora.
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('piru_printer_target'))).toBeNull()
    await expect.poll(async () => JSON.parse(await page.evaluate(() => localStorage.getItem('piru_printer_targets_manual')) || '[]'))
        .toEqual([{ kind: 'tcp', host: '192.168.1.51', port: 9100 }])

    // Sin impresora no se manda nada, y lo dice.
    await page.getByRole('button', { name: 'Imprimir comanda', exact: true }).click()
    await expect(page.getByLabel('Resultado')).toContainText('No hay impresora seleccionada')
    expect(await trabajos(page)).toHaveLength(0)
})
