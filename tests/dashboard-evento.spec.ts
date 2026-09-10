import { test, expect, type Page } from '@playwright/test'

async function prepararDashboard(page: Page, abierto = true) {
    const estado = { abierto, consultasSedes: 0, errorSedes: false, escrituras: [] as string[] }
    await page.routeWebSocket(/.*/, socket => socket.close())
    await page.route('**/api/**', route => {
        if (new URL(route.request().url()).origin === 'http://127.0.0.1:4179') return route.continue()
        // El script externo de Google Maps también contiene /api/ en su URL.
        if (route.request().resourceType() === 'script') return route.abort()
        const path = new URL(route.request().url()).pathname
        if (route.request().method() !== 'GET') estado.escrituras.push(path)
        if (path.endsWith('/sucursales/list')) {
            estado.consultasSedes++
            if (estado.errorSedes) return route.fulfill({ status: 503, json: { success: false } })
            return route.fulfill({ json: { success: true, data: [
                { id: 20, nombre: 'Cumple Facu', activo: estado.abierto, soloPos: true },
            ] } })
        }
        if (path.endsWith('/mis-modulos')) return route.fulfill({ json: { success: true, data: [
            { modulos: [{ codigo: 'pos', estado: 'inactivo', activoAhora: false }] },
        ] } })
        if (path.endsWith('/mi-suscripcion')) return route.fulfill({ json: { success: true, data: { estado: 'activa' } } })
        return route.fulfill({ json: { success: true, data: [], pagination: { hasMore: false } } })
    })
    await page.addInitScript(() => {
        if (!localStorage.getItem('sucursal_activa_id')) localStorage.setItem('sucursal_activa_id', '20')
    })
    return estado
}

test('ocultar pedidos amplía el catálogo, conserva el borrador y permite restaurar la lista', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await prepararDashboard(page)
    await page.addInitScript(() => localStorage.setItem('piru:pos-config', JSON.stringify({ catalogoEnColumna: true })))
    await page.goto('/tests/dashboard-evento.html')
    const catalogo = page.locator('#pos-catalogo-compacto')
    const anchoAntes = (await catalogo.boundingBox())!.width
    await page.getByRole('button', { name: /Combo exclusivo feria/ }).click()
    await page.evaluate(() => {
        localStorage.setItem('piru:pos-config', JSON.stringify({ catalogoEnColumna: true, mostrarColumnaPedidos: false }))
        window.dispatchEvent(new Event('piru:pos-config-changed'))
    })
    await expect(page.getByRole('button', { name: 'Opciones de pedidos', exact: true })).toBeHidden()
    await expect.poll(async () => (await catalogo.boundingBox())!.width).toBeGreaterThan(anchoAntes + 100)
    await expect(page.getByRole('button', { name: 'Anotar pedido', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: /Combo de otro evento/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Mostrar pedidos', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Opciones de pedidos', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Anotar pedido', exact: true })).toBeEnabled()
})

for (const width of [1920, 390]) {
    test(`actualiza apertura y cierre del evento al volver a la ventana (${width}px)`, async ({ page }) => {
        page.on('pageerror', error => { throw error })
        await page.setViewportSize({ width, height: 1044 })
        const estado = await prepararDashboard(page, false)
        await page.goto('/tests/dashboard-evento.html')
        await expect(page.getByText('Evento cerrado', { exact: true })).toHaveCount(1)
        await expect(page.getByRole('button', { name: '+ Nuevo pedido', exact: true })).toHaveCount(0)
        await expect(page.getByText('Empezá a recibir pedidos', { exact: true })).toHaveCount(0)
        estado.abierto = true
        await page.evaluate(() => window.dispatchEvent(new Event('focus')))
        await expect(page.getByPlaceholder('Buscar producto o tag...')).toBeVisible()
        estado.abierto = false
        await page.evaluate(() => window.dispatchEvent(new Event('focus')))
        await expect(page.getByRole('button', { name: '+ Nuevo pedido', exact: true })).toHaveCount(0)
        await expect(page.getByPlaceholder('Buscar producto o tag...')).toHaveCount(0)
        await expect(page.getByText('Evento cerrado', { exact: true })).toHaveCount(1)
        expect(estado.escrituras).toEqual([])
    })
}

test('Dashboard habilita POS en evento con módulo apagado y lo oculta en pedidos web', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1044 })
    const estado = await prepararDashboard(page)
    await page.goto('/tests/dashboard-evento.html')
    await expect(page.getByText('Cumple Facu', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Nuevo pedido', exact: true })).toBeVisible()
    await expect(page.getByPlaceholder('Buscar producto o tag...')).toBeVisible()
    await expect(page.getByText('Empezá a recibir pedidos', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '+ Nuevo pedido', exact: true }).click()
    await page.getByPlaceholder('Buscar producto o tag...').fill('Alfajor')
    await expect(page.getByRole('button', { name: /Alfajor de prueba/ })).toBeVisible()
    await page.getByRole('button', { name: 'Opciones de pedidos', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Cambiar sucursal' }).click()
    await page.getByRole('button', { name: 'Local · pedidos web (sin eventos)', exact: true }).click()
    await expect(page.getByText('Local · pedidos web', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Nuevo pedido', exact: true })).toHaveCount(0)
    await expect(page.getByPlaceholder('Buscar producto o tag...')).toHaveCount(0)
    await expect(page.getByText('Empezá a recibir pedidos', { exact: true })).toBeVisible()
    expect(estado.escrituras).toEqual([])
})

test('el refresco periódico conserva el borrador incluso con un fallo transitorio de red', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1044 })
    await page.clock.install()
    const estado = await prepararDashboard(page)
    await page.goto('/tests/dashboard-evento.html')
    const buscador = page.getByPlaceholder('Buscar producto o tag...')
    await expect(buscador).toBeVisible()
    await buscador.fill('Alfajor')
    await page.getByRole('button', { name: /Alfajor de prueba/ }).click()
    await expect(page.getByRole('button', { name: 'Anotar pedido', exact: true })).toBeEnabled()
    const consultas = estado.consultasSedes
    await page.clock.runFor(30_001)
    await expect.poll(() => estado.consultasSedes).toBeGreaterThan(consultas)
    await expect(page.getByRole('button', { name: 'Anotar pedido', exact: true })).toBeEnabled()
    estado.errorSedes = true
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect.poll(() => estado.consultasSedes).toBeGreaterThan(consultas + 1)
    await expect(page.getByRole('button', { name: 'Anotar pedido', exact: true })).toBeEnabled()
    await expect(page.getByText('Alfajor de prueba', { exact: true }).last()).toBeVisible()
    expect(estado.escrituras).toEqual([])
})
