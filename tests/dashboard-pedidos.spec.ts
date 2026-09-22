import { test, expect, type Page } from '@playwright/test'

// Regresión: el listado de pedidos activos del Dashboard con muchos pedidos.
// La lista es larga y el WebSocket la reemplaza entera a cada rato; si el orden
// entre pedidos empatados en la misma hora depende de cómo los devuelva la API,
// React mueve las tarjetas y el scroll salta hacia arriba mientras el usuario baja.
// Acá se mide que el scroll solo avance cuando la rueda avanza.

type PedidoFixture = ReturnType<typeof pedido>
type Emisor = (mensaje: string) => void

type Fixture = {
    pedidos: PedidoFixture[]
    // Refetch del listado: si no sube, los eventos no llegaron y el test no probaría nada.
    consultas: number
    // Del WebSocket mockeado alcanza con poder emitirles eventos al admin.
    emisores: Emisor[]
}

function pedido(id: number, minutosAtras: number, tipo: 'delivery' | 'takeaway' = 'delivery') {
    const createdAt = new Date(Date.now() - minutosAtras * 60_000).toISOString()
    return {
        id,
        tipo,
        estado: 'pending',
        total: '1500',
        nombreCliente: `Cliente ${id}`,
        telefono: '1122334455',
        direccion: 'Av. Siempreviva 742, Springfield',
        createdAt,
        updatedAt: createdAt,
        pagado: false,
        metodoPago: 'cash',
        impreso: false,
        consumoEnLocal: false,
        latitud: null,
        longitud: null,
        deliveryFee: null,
        montoDescuento: null,
        version: 1,
        items: [{ id: id * 10, cantidad: 1, precioUnitario: '1500', nombreProducto: 'Alfajor', imagenUrl: null, ingredientesExcluidos: [] }],
    }
}

async function preparar(page: Page, opciones: { cantidad?: number; pos?: boolean; catalogoEnColumna?: boolean } = {}): Promise<Fixture> {
    const { cantidad = 40, pos = false, catalogoEnColumna = false } = opciones
    const estado: Fixture = {
        pedidos: Array.from({ length: cantidad }, (_, i) => pedido(1000 - i, i)),
        emisores: [],
        consultas: 0,
    }
    await page.routeWebSocket(/ws\/admin/, socket => { estado.emisores.push(mensaje => socket.send(mensaje)) })
    await page.route('**/api/**', route => {
        const url = new URL(route.request().url())
        if (url.origin === 'http://127.0.0.1:4179') return route.continue()
        if (route.request().resourceType() === 'script') return route.abort()
        const path = url.pathname
        if (path.endsWith('/sucursales/list')) {
            return route.fulfill({ json: { success: true, data: [{ id: 20, nombre: 'Local', activo: true, soloPos: false }] } })
        }
        if (path.endsWith('/mis-modulos')) return route.fulfill({ json: { success: true, data: [
            { modulos: pos ? [{ codigo: 'pos', estado: 'activo', activoAhora: true }] : [] },
        ] } })
        if (path.endsWith('/mi-suscripcion')) return route.fulfill({ json: { success: true, data: { estado: 'activa' } } })
        if (path.endsWith('/pedido-unificado/list-dia')) {
            estado.consultas++
            return route.fulfill({ json: { success: true, data: estado.pedidos, pagination: { hasMore: false } } })
        }
        return route.fulfill({ json: { success: true, data: [], pagination: { hasMore: false } } })
    })
    await page.addInitScript(([columna]) => {
        localStorage.setItem('sucursal_activa_id', '20')
        localStorage.setItem('piru:pos-config', JSON.stringify({ catalogoEnColumna: columna, mostrarColumnaPedidos: true }))
    }, [catalogoEnColumna])
    return estado
}

const LISTADO = 'div.flex-1.overflow-y-auto.p-3'

async function medirRueda(page: Page, ticks: number, delta = 300) {
    const listado = page.locator(LISTADO).first()
    const caja = (await listado.boundingBox())!
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2)
    const lecturas: number[] = []
    for (let i = 0; i < ticks; i++) {
        lecturas.push(await listado.evaluate(el => el.scrollTop))
        await page.mouse.wheel(0, delta)
        await page.waitForTimeout(150)
    }
    lecturas.push(await listado.evaluate(el => el.scrollTop))
    return lecturas
}

function analizar(nombre: string, lecturas: number[]) {
    const pasos = lecturas.slice(1).map((v, i) => v - lecturas[i])
    const retrocesos = pasos.filter(p => p < 0)
    console.log(`${nombre}: ${lecturas.join(' → ')} · retrocesos=${retrocesos.length}`)
    expect(retrocesos, `${nombre}: el listado se movió solo (${lecturas.join(' → ')})`).toEqual([])
    return retrocesos.length
}

async function empujarEvento(estado: Fixture, pedidoId: number) {
    estado.emisores.forEach(emitir => emitir(JSON.stringify({
        type: 'ADMIN_ORDER_EVENT',
        payload: { tipo: 'delivery', pedidoId, shouldPrint: false },
    })))
    await new Promise(resolve => setTimeout(resolve, 250))
}

test('scroll del listado con despachos y altas mientras se scrollea', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const estado = await preparar(page, { pos: true, catalogoEnColumna: false })
    await page.goto('/tests/dashboard-pedidos.html')
    await expect(page.getByText('#1000', { exact: true })).toBeVisible()

    const listado = page.locator(LISTADO).first()
    const caja = (await listado.boundingBox())!
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2)

    analizar('quieto', await medirRueda(page, 3))

    // Despacho: los pedidos de arriba desaparecen de la lista activa.
    const consultasAntes = estado.consultas
    const lecturas: number[] = []
    for (let tick = 0; tick < 9; tick++) {
        lecturas.push(await listado.evaluate(el => el.scrollTop))
        await page.mouse.wheel(0, 250)
        await page.waitForTimeout(80)
        if (tick % 3 === 2) {
            estado.pedidos = estado.pedidos.slice(2)
            estado.pedidos = [pedido(3000 + tick, 0), ...estado.pedidos]
            await empujarEvento(estado, 3000 + tick)
        }
    }
    lecturas.push(await listado.evaluate(el => el.scrollTop))
    analizar('despachos+altas', lecturas)
    expect(estado.consultas, 'los eventos no refrescaron el listado').toBeGreaterThan(consultasAntes)
})

test('scroll del listado con empates de horario reordenados', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const estado = await preparar(page, { pos: false })
    // Todos los pedidos comparten el mismo createdAt: el orden final queda a
    // merced del orden en que la API los devuelve.
    const mismoInstante = new Date(Date.now() - 5 * 60_000).toISOString()
    estado.pedidos = estado.pedidos.map(p => ({ ...p, createdAt: mismoInstante, updatedAt: mismoInstante }))
    await page.goto('/tests/dashboard-pedidos.html')
    await expect(page.getByText('#1000', { exact: true })).toBeVisible()

    const listado = page.locator(LISTADO).first()
    const caja = (await listado.boundingBox())!
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2)

    analizar('direccion propia', await medirRueda(page, 4))

    const consultasAntes = estado.consultas
    const lecturas: number[] = []
    for (let tick = 0; tick < 9; tick++) {
        lecturas.push(await listado.evaluate(el => el.scrollTop))
        await page.mouse.wheel(0, 250)
        await page.waitForTimeout(80)
        if (tick % 3 === 2) {
            // La API devuelve los empates en otro orden. El desempate por id deja el
            // orden de las tarjetas igual, así que no debería moverse nada.
            estado.pedidos = [...estado.pedidos.slice(5), ...estado.pedidos.slice(0, 5)]
            await empujarEvento(estado, 1000)
        }
    }
    lecturas.push(await listado.evaluate(el => el.scrollTop))
    analizar('empates reordenados', lecturas)
    expect(estado.consultas, 'los eventos no refrescaron el listado').toBeGreaterThan(consultasAntes)
})
