import { test, expect, type Page } from '@playwright/test'

// Todo lo que se prueba acá es táctil: sin esto el puntero es "fino" y el buscador se enfocaría solo.
test.use({ hasTouch: true })

const ORIGEN = 'http://127.0.0.1:4190'
// Con POS_MOVIL_SHOTS=<carpeta> el test de capturas vuelca imágenes para revisar el diseño.
const SHOTS = process.env.POS_MOVIL_SHOTS

type Estado = { creaciones: Array<Record<string, unknown>>; ediciones: Array<Record<string, unknown>> }

/** Pedido en la forma editable que devuelve GET /pedido-unificado/:id. */
function pedidoEditable(id: number, version = 3, mesa = false) {
    return {
        id, version, tipo: mesa ? 'mesa' : 'delivery', estado: 'pending', editable: true, nombreCliente: 'Cliente ' + id, telefono: '3415550000',
        direccion: mesa ? null : 'Córdoba 1234, Rosario', latitud: null, longitud: null, notas: '', metodoPago: 'cash', pagado: false,
        deliveryFee: mesa ? null : '1500', montoDescuento: null, mesaLocalId: mesa ? 1 : null, mesaNombre: mesa ? 'Mesa 1' : null,
        items: [{
            id: 9001, productoId: 4, nombreProducto: 'Doble cheddar', varianteId: null, varianteNombre: null, varianteSecundariaId: null,
            varianteSecundariaNombre: null, cantidad: 2, cantidadImpresa: 2, precioUnitario: '11200', ingredientesExcluidos: [],
            ingredientesExcluidosNombres: [], agregados: [], nota: null,
        }],
    }
}

function pedidoActivo(id: number, tipo: 'delivery' | 'takeaway', minutos: number) {
    const createdAt = new Date(Date.now() - minutos * 60_000).toISOString()
    return {
        id, tipo, estado: 'pending', total: '11200', nombreCliente: `Cliente ${id}`, telefono: '3415550000',
        direccion: tipo === 'delivery' ? 'Córdoba 1234, Rosario' : null, createdAt, updatedAt: createdAt,
        pagado: false, metodoPago: 'cash', impreso: false, consumoEnLocal: false, latitud: null, longitud: null,
        deliveryFee: null, montoDescuento: null, version: 1, totalItems: 1, editable: true,
        items: [{ id: id * 10, productoId: 3, cantidad: 1, precioUnitario: '11200', nombreProducto: 'Doble cheddar', imagenUrl: null, ingredientesExcluidos: [] }],
    }
}

async function preparar(page: Page, opciones: { mesas?: boolean; pedidos?: number } = {}): Promise<Estado> {
    const { mesas = false, pedidos = 3 } = opciones
    const estado: Estado = { creaciones: [], ediciones: [] }
    await page.routeWebSocket(/.*/, socket => socket.close())
    await page.route('**/api/**', route => {
        const url = new URL(route.request().url())
        if (url.origin === ORIGEN) return route.continue()
        if (route.request().resourceType() === 'script') return route.abort()
        const path = url.pathname
        const metodo = route.request().method()
        if (path.endsWith('/sucursales/list')) return route.fulfill({ json: { success: true, data: [{ id: 20, nombre: 'Local Centro', activo: true, soloPos: false }] } })
        if (path.endsWith('/mis-modulos')) {
            const modulos = [{ codigo: 'pos', estado: 'activo', activoAhora: true }]
            if (mesas) modulos.push({ codigo: 'mesas', estado: 'activo', activoAhora: true })
            return route.fulfill({ json: { success: true, data: [{ modulos }] } })
        }
        if (path.endsWith('/mi-suscripcion')) return route.fulfill({ json: { success: true, data: { estado: 'activa' } } })
        if (path.endsWith('/pedido-unificado/list-dia')) {
            const data = Array.from({ length: pedidos }, (_, i) => pedidoActivo(900 - i, i % 2 ? 'takeaway' : 'delivery', 4 + i * 7))
            return route.fulfill({ json: { success: true, data, pagination: { hasMore: false } } })
        }
        if (path.endsWith('/pedido-unificado/create') && metodo === 'POST') {
            estado.creaciones.push(route.request().postDataJSON())
            return route.fulfill({ json: { success: true, data: { id: 901, tipo: estado.creaciones[estado.creaciones.length - 1]?.tipo ?? 'takeaway' } } })
        }
        if (path.endsWith('/mesas-locales')) {
            return route.fulfill({ json: { success: true, data: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, nombre: `Mesa ${i + 1}`, orden: i, sucursalId: 20, restauranteId: 1 })) } })
        }
        if (path.endsWith('/clientes/indice-pos')) return route.fulfill({ json: { success: true, data: [] } })
        if (path.endsWith('/cliente-contexto')) return route.fulfill({ json: { success: true, data: null } })
        const idPedido = path.match(/\/pedido-unificado\/(\d+)(\/pos)?$/)
        if (idPedido && metodo === 'GET') return route.fulfill({ json: { success: true, data: pedidoEditable(Number(idPedido[1]), 3, Number(idPedido[1]) === 901 && estado.creaciones[0]?.tipo === 'mesa') } })
        if (idPedido?.[2] && metodo === 'PUT') {
            estado.ediciones.push(route.request().postDataJSON())
            return route.fulfill({ json: { success: true, data: pedidoEditable(Number(idPedido[1]), 4) } })
        }
        return route.fulfill({ json: { success: true, data: [], pagination: { hasMore: false } } })
    })
    await page.addInitScript(() => {
        localStorage.setItem('sucursal_activa_id', '20')
        sessionStorage.clear()
    })
    return estado
}

const DISPOSITIVOS: Array<{ nombre: string; ancho: number; alto: number; colapsado?: boolean }> = [
    { nombre: 'celular-390', ancho: 390, alto: 844 },
    { nombre: 'celular-360', ancho: 360, alto: 740 },
    { nombre: 'tablet-768', ancho: 768, alto: 1024 },
    { nombre: 'tablet-768-colapsado', ancho: 768, alto: 1024, colapsado: true },
    { nombre: 'tablet-820-colapsado', ancho: 820, alto: 1180, colapsado: true },
    { nombre: 'tablet-1000x600-colapsado', ancho: 1000, alto: 600, colapsado: true },
    { nombre: 'celular-horizontal-844-colapsado', ancho: 844, alto: 390, colapsado: true },
]


async function abrirPos(page: Page, opciones: Parameters<typeof preparar>[1] = {}) {
    const estado = await preparar(page, opciones)
    await page.goto('/tests/pos-movil.html')
    await expect(page.getByPlaceholder('Buscar producto o tag...')).toBeVisible({ timeout: 20_000 })
    return estado
}

test('capturas del POS en celular y tablet', async ({ browser }) => {
    test.skip(!SHOTS, 'Sólo se ejecuta para revisar el diseño (POS_MOVIL_SHOTS).')
    test.setTimeout(300_000)
    for (const d of DISPOSITIVOS) {
        const contexto = await browser.newContext({ viewport: { width: d.ancho, height: d.alto }, hasTouch: true })
        const page = await contexto.newPage()
        if (d.colapsado) await page.addInitScript(() => localStorage.setItem('piru-sidebar-collapsed', '1'))
        const errores: string[] = []
        page.on('pageerror', error => errores.push(error.message))
        await abrirPos(page, { mesas: true })
        const foto = async (paso: string) => {
            await page.waitForTimeout(350)
            await page.screenshot({ path: `${SHOTS}/${d.nombre}-${paso}.png`, animations: 'disabled' })
        }
        await foto('1-inicio')
        await page.getByRole('button', { name: 'Pizzas', exact: true }).click()
        await foto('2-categoria')
        await page.getByRole('button', { name: 'Todo', exact: true }).click()
        await page.getByRole('button', { name: /^Combo Clásico/ }).click()
        await page.getByRole('button', { name: /^Doble cheddar/ }).click()
        await page.getByRole('button', { name: /^Doble cheddar/ }).click()
        await foto('3-con-items')
        await page.getByRole('button', { name: /^Muzzarella/ }).click()
        await foto('4-variantes')
        await page.getByRole('button', { name: /Grande/ }).click()
        // Tablet: extras y bebida junto a la variante (en celular sigue la hoja con las variantes).
        await page.getByRole('button', { name: /^Clásica/ }).click()
        const selector = page.getByRole('dialog', { name: 'Configurar Clásica' })
        if (await selector.getByRole('region', { name: 'Bebida' }).count()) {
            await selector.getByRole('button', { name: /^Huevo/ }).click()
            await selector.getByRole('button', { name: /^Coca-Cola 500ml/ }).click()
            await foto('4b-extras-y-bebida')
        }
        await selector.getByRole('button', { name: /^Doble/ }).click()
        const barra = page.getByRole('button', { name: /^Ver pedido/ })
        if (await barra.count()) await barra.click()
        await foto('5-pedido')
        // Tablet: cliente, entrega y pago están en el segundo paso.
        const siguiente = page.getByRole('button', { name: 'Siguiente', exact: true })
        if (await siguiente.count()) await siguiente.click()
        await page.getByRole('button', { name: 'Delivery', exact: true }).click()
        await foto('6-delivery')
        const cerrar = page.getByRole('button', { name: 'Volver al menú' })
        if (await cerrar.count()) await cerrar.click()
        await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
        await foto('7-menu')
        await page.keyboard.press('Escape')
        expect(errores, `errores de página en ${d.nombre}`).toEqual([])
        await contexto.close()
    }
})

// ─────────────────────────────────────────────
// Suite funcional
// ─────────────────────────────────────────────
const CELULAR = { width: 390, height: 844 }
const TABLET = { width: 768, height: 1024 }

async function conMenuColapsado(page: Page) {
    await page.addInitScript(() => localStorage.setItem('piru-sidebar-collapsed', '1'))
}

test('celular: el POS ocupa la pantalla y el catálogo se recorre por categorías sin escribir', async ({ page }) => {
    await page.setViewportSize(CELULAR)
    await abrirPos(page)
    // Es una pantalla propia: el encabezado del Dashboard ("Hoy") no queda arriba.
    await expect(page.getByRole('heading', { name: 'Hoy' })).toBeHidden()
    // El catálogo está a la vista desde el primer momento y sin teclado en pantalla.
    await expect(page.getByRole('button', { name: /^Combo Clásico/ })).toBeVisible()
    await expect(page.getByPlaceholder('Buscar producto o tag...')).not.toBeFocused()
    // Categorías en el orden que definió el local, no alfabético.
    const chips = page.getByRole('group', { name: 'Categorías' }).getByRole('button')
    await expect(chips).toHaveText(['Todo', 'Combos', 'Hamburguesas', 'Pizzas', 'Empanadas', 'Postres', 'Bebidas'])
    await page.getByRole('button', { name: 'Pizzas', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Muzzarella/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Combo Clásico/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Todo', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Combo Clásico/ })).toBeVisible()
    // La búsqueda cruza categorías y oculta los chips.
    await page.getByPlaceholder('Buscar producto o tag...').fill('coca')
    await expect(page.getByRole('button', { name: /^Coca-Cola 500ml/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Combo Clásico/ })).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Categorías' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Borrar búsqueda' }).click()
    await expect(page.getByRole('button', { name: /^Combo Clásico/ })).toBeVisible()
})

test('celular: se arma el pedido, se completa en la hoja y el alta llega con los datos correctos', async ({ page }) => {
    await page.setViewportSize(CELULAR)
    const estado = await abrirPos(page)
    await expect(page.getByRole('button', { name: /^Pedido vacío/ })).toBeVisible()

    await page.getByRole('button', { name: /^Combo Clásico/ }).click()
    await page.getByRole('button', { name: /^Combo Clásico/ }).click()
    await page.getByRole('button', { name: /^Coca-Cola 500ml/ }).click()
    // La tarjeta cuenta las unidades y la barra inferior el total.
    await expect(page.getByRole('button', { name: /^Combo Clásico.*2 en el pedido/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Ver pedido \(3\)/ })).toContainText('$27.800')

    await page.getByRole('button', { name: /^Ver pedido/ }).click()
    const hoja = page.getByRole('dialog', { name: 'Pedido' })
    await expect(hoja).toBeVisible()
    await expect(hoja.getByText('3 ítems')).toBeVisible()
    // Steppers: sumar una unidad a la gaseosa y quitar un Combo (cada toque es una fila).
    await hoja.getByRole('button', { name: 'Sumar una unidad de Coca-Cola 500ml' }).click()
    await hoja.getByRole('button', { name: 'Eliminar Combo Clásico' }).first().click()
    await expect(hoja.getByText('3 ítems')).toBeVisible()

    // Delivery: la dirección aparece pegada al selector y el envío se precarga desde Ajustes.
    await hoja.getByRole('button', { name: 'Delivery', exact: true }).click()
    await expect(hoja.getByLabel('Costo de envío')).toHaveValue('1500')
    await hoja.getByPlaceholder('Calle y número...').fill('San Martín 500')
    await hoja.getByPlaceholder('Nombre del cliente').fill('Lucía')
    await hoja.getByPlaceholder('Celular').fill('341 555-1234')
    await hoja.getByRole('button', { name: 'Transferencia', exact: true }).click()
    await expect(hoja.getByText('Delivery · Transferencia')).toBeVisible()
    await hoja.getByRole('button', { name: 'Anotar pedido', exact: true }).click()

    await expect.poll(() => estado.creaciones.length).toBe(1)
    const pedido = estado.creaciones[0] as { items: Array<{ productoId: number; cantidad: number }> }
    expect(pedido).toMatchObject({
        tipo: 'delivery', direccion: 'San Martín 500', deliveryFee: 1500, nombreCliente: 'Lucía',
        telefono: '3415551234', metodoPago: 'manual_transfer', anotadoManualmente: true,
    })
    // Combo (1) + Coca-Cola (1 fila de 2 unidades).
    expect(pedido.items.map((item) => [item.productoId, item.cantidad])).toEqual([[1, 1], [20, 2]])
    // La hoja se cierra y el POS queda listo para el próximo pedido.
    await expect(hoja).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Pedido vacío/ })).toBeVisible()
})

test('celular: un delivery sin dirección marca el campo y no se envía', async ({ page }) => {
    await page.setViewportSize(CELULAR)
    const estado = await abrirPos(page)
    await page.getByRole('button', { name: /^Coca-Cola 500ml/ }).click()
    await page.getByRole('button', { name: /^Ver pedido/ }).click()
    const hoja = page.getByRole('dialog', { name: 'Pedido' })
    await hoja.getByRole('button', { name: 'Delivery', exact: true }).click()
    await hoja.getByRole('button', { name: 'Anotar pedido', exact: true }).click()
    await expect(hoja.getByRole('alert')).toHaveText('Ingresá la dirección de entrega')
    expect(estado.creaciones).toEqual([])
    // Al escribir la dirección el aviso desaparece.
    await hoja.getByPlaceholder('Calle y número...').fill('X')
    await expect(hoja.getByRole('alert')).toHaveCount(0)
})

test('celular: variantes, ajuste de ingredientes y extras desde el pedido', async ({ page }) => {
    await page.setViewportSize(CELULAR)
    await abrirPos(page)
    // Un producto con variantes abre el selector; un toque en la opción lo agrega.
    await page.getByRole('button', { name: /^Muzzarella/ }).click()
    const selector = page.getByRole('dialog', { name: 'Configurar Muzzarella' })
    await expect(selector).toBeVisible()
    // En celular el selector sigue siendo una hoja sólo con las variantes: no ofrece bebida.
    await expect(selector.getByText('Bebida')).toHaveCount(0)
    await selector.getByRole('button', { name: /Grande/ }).click()
    await expect(selector).toHaveCount(0)

    await page.getByRole('button', { name: /^Clásica/ }).click()
    await page.getByRole('dialog', { name: 'Configurar Clásica' }).getByRole('button', { name: /Doble/ }).click()

    await page.getByRole('button', { name: /^Ver pedido/ }).click()
    const hoja = page.getByRole('dialog', { name: 'Pedido' })
    await expect(hoja.getByText('Muzzarella')).toBeVisible()
    await expect(hoja.getByText('(Grande)')).toBeVisible()
    await hoja.getByRole('button', { name: 'Editar Clásica' }).click()
    const ajuste = page.getByRole('dialog', { name: 'Configurar Clásica' })
    await ajuste.getByRole('button', { name: 'Tomate' }).click()
    await ajuste.getByRole('button', { name: /Huevo/ }).click()
    await ajuste.getByRole('button', { name: 'Listo' }).click()
    await expect(ajuste).toHaveCount(0)
    await expect(hoja.getByText('Sin: Tomate')).toBeVisible()
    await expect(hoja.getByText('Extras: Huevo')).toBeVisible()
    // 11.200 (doble) + 1.200 (huevo) + 13.200 (muzzarella grande).
    await expect(hoja.getByText('$25.600')).toBeVisible()
})

test('celular: ir a Pedidos conserva el borrador y "Seguir pedido" lo retoma', async ({ page }) => {
    await page.setViewportSize(CELULAR)
    await abrirPos(page)
    await page.getByRole('button', { name: /^Sprite 500ml/ }).click()
    await page.getByRole('button', { name: /^Pedidos/ }).click()
    // Lista de pedidos activos (mock) con el encabezado del Dashboard de vuelta.
    await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible()
    await expect(page.getByText('#900', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Seguir pedido (1)' }).click()
    await expect(page.getByRole('button', { name: /^Ver pedido \(1\)/ })).toContainText('$2.800')
    // "+ Nuevo pedido" en cambio arranca de cero.
    await page.getByRole('button', { name: /^Pedidos/ }).click()
    await page.getByRole('button', { name: '+ Nuevo pedido', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Pedido vacío/ })).toBeVisible()
})

test('celular: el mapa se abre desde el menú del POS (antes mostraba la comanda de escritorio)', async ({ page }) => {
    await page.setViewportSize(CELULAR)
    await abrirPos(page)
    await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
    await page.getByRole('menuitem', { name: 'Mapa de pedidos' }).click()
    await expect(page.getByRole('heading', { name: 'Mapa de pedidos', level: 1 })).toBeVisible()
    await expect(page.getByText('Ningún pedido activo de delivery tiene ubicación guardada.')).toBeVisible()
    // Nada de la comanda de escritorio filtrada al mobile.
    await expect(page.getByText('Comanda en blanco')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Anotar pedido', exact: true })).toHaveCount(0)
})

test('celular: editar un pedido existente desde el detalle y guardar los cambios', async ({ page }) => {
    await page.setViewportSize(CELULAR)
    const estado = await abrirPos(page)
    await page.getByRole('button', { name: /^Pedidos/ }).click()
    await page.getByText('#900', { exact: true }).click()
    await page.getByRole('button', { name: 'Editar pedido', exact: true }).click()
    // El POS reabre en modo edición con el pedido cargado.
    // La franja de contexto (el h1 con el mismo texto es sólo para lectores de pantalla).
    await expect(page.locator('span.truncate', { hasText: 'Editando pedido #900' })).toBeVisible()
    // Al editar, lo primero que se ve es el pedido (la hoja ya viene abierta).
    const hoja = page.getByRole('dialog', { name: 'Pedido' })
    await expect(hoja).toBeVisible()
    await expect(hoja.getByText('Doble cheddar')).toBeVisible()
    await expect(hoja.getByText('Guardado', { exact: true })).toBeVisible()
    await hoja.getByRole('button', { name: 'Sumar una unidad de Doble cheddar' }).click()
    // El guardado es automático (con una demora corta) y no imprime nada.
    await expect.poll(() => estado.ediciones.length, { timeout: 10_000 }).toBe(1)
    expect(estado.ediciones[0]).toMatchObject({ version: 3, tipo: 'delivery', items: [{ id: 9001, cantidad: 3 }] })
    await expect(hoja.getByRole('button', { name: /Imprimir productos nuevos/ })).toBeVisible()
})

test('tablet: con el menú lateral colapsado el catálogo y el pedido conviven en dos paneles', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await conMenuColapsado(page)
    const estado = await abrirPos(page)
    // Sin barra inferior ni hoja: el pedido está siempre a la vista.
    await expect(page.getByRole('button', { name: /^Ver pedido|^Pedido vacío/ })).toHaveCount(0)
    const panel = page.getByRole('region', { name: 'Pedido' })
    await expect(panel).toBeVisible()
    await expect(panel.getByText('Tocá productos del menú para agregarlos')).toBeVisible()
    await page.getByRole('button', { name: /^Veggie/ }).click()
    await page.getByRole('button', { name: /^Sprite 500ml/ }).click()
    await expect(panel.getByText('2 ítems')).toBeVisible()
    await expect(panel.getByText('Takeaway · Efectivo')).toBeVisible()
    await panel.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await panel.getByRole('button', { name: 'Anotar pedido', exact: true }).click()
    await expect.poll(() => estado.creaciones.length).toBe(1)
    expect(estado.creaciones[0]).toMatchObject({ tipo: 'takeaway', metodoPago: 'cash' })
    // El POS vuelve al primer paso, listo para el próximo pedido.
    await expect(panel.getByText('Tocá productos del menú para agregarlos')).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Siguiente', exact: true })).toBeDisabled()
})

test('tablet: el pedido va en dos pasos y el cliente y el pago no quedan debajo de los productos', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await conMenuColapsado(page)
    const estado = await abrirPos(page)
    const panel = page.getByRole('region', { name: 'Pedido' })
    const pasos = panel.getByRole('navigation', { name: 'Pasos del pedido' })
    // Suficientes productos como para que, en una sola columna, el pago quedara fuera de la pantalla.
    for (const producto of [/^Combo Clásico/, /^Combo Doble/, /^Doble cheddar/, /^Veggie/, /^Pollo crispy/, /^Flan casero/, /^Coca-Cola 500ml/]) {
        await page.getByRole('button', { name: producto }).click()
    }

    // Paso 1: sólo los productos. Cliente, entrega y pago esperan al paso siguiente.
    await expect(pasos.getByRole('button', { name: 'Productos' })).toHaveAttribute('aria-current', 'step')
    await expect(panel.getByRole('button', { name: 'Eliminar Combo Clásico' })).toBeVisible()
    await expect(panel.getByPlaceholder('Nombre del cliente')).toHaveCount(0)
    await expect(panel.getByRole('button', { name: 'Delivery', exact: true })).toHaveCount(0)
    await expect(panel.getByRole('button', { name: 'Anotar pedido', exact: true })).toHaveCount(0)

    // Paso 2: tipo, entrega, cliente y pago, a la vista sin scrollear y sin los ítems encima.
    await panel.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await expect(pasos.getByRole('button', { name: 'Cliente y pago' })).toHaveAttribute('aria-current', 'step')
    await expect(panel.getByRole('button', { name: 'Eliminar Combo Clásico' })).toHaveCount(0)
    await expect(panel.getByRole('button', { name: 'Mercado Pago', exact: true })).toBeInViewport({ ratio: 1 })
    await panel.getByRole('button', { name: 'Delivery', exact: true }).click()
    await expect(panel.getByLabel('Costo de envío')).toHaveValue('1500')
    // También un delivery (dirección y envío de más) entra entero: la nota se abre a pedido.
    await expect(panel.getByRole('button', { name: 'Mercado Pago', exact: true })).toBeInViewport({ ratio: 1 })
    await expect(panel.getByLabel('Nota del pedido')).toHaveCount(0)
    // Un delivery sin dirección no se anota: se marca el campo.
    await panel.getByRole('button', { name: 'Anotar pedido', exact: true }).click()
    await expect(panel.getByRole('alert')).toHaveText('Ingresá la dirección de entrega')
    expect(estado.creaciones).toEqual([])
    await panel.getByPlaceholder('Calle y número...').fill('San Martín 500')
    await panel.getByPlaceholder('Nombre del cliente').fill('Lucía')
    await panel.getByPlaceholder('Celular').fill('341 555-1234')
    await panel.getByRole('button', { name: 'Transferencia', exact: true }).click()
    await expect(panel.getByText('Delivery · Transferencia')).toBeVisible()
    await panel.getByRole('button', { name: 'Agregar nota' }).click()
    await expect(panel.getByLabel('Nota del pedido')).toBeFocused()
    await panel.getByLabel('Nota del pedido').fill('Tocar timbre')

    // Volver a los productos no pierde lo cargado.
    await panel.getByRole('button', { name: 'Volver a los productos' }).click()
    await panel.getByRole('button', { name: 'Sumar una unidad de Coca-Cola 500ml' }).click()
    await expect(panel.getByText('8 ítems')).toBeVisible()
    await panel.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await expect(panel.getByPlaceholder('Nombre del cliente')).toHaveValue('Lucía')
    await expect(panel.getByPlaceholder('Calle y número...')).toHaveValue('San Martín 500')
    // Una nota con texto queda a la vista.
    await expect(panel.getByLabel('Nota del pedido')).toHaveValue('Tocar timbre')
    await panel.getByRole('button', { name: 'Anotar pedido', exact: true }).click()

    await expect.poll(() => estado.creaciones.length).toBe(1)
    const pedido = estado.creaciones[0] as { items: Array<{ productoId: number; cantidad: number }> }
    expect(pedido).toMatchObject({
        tipo: 'delivery', direccion: 'San Martín 500', deliveryFee: 1500, nombreCliente: 'Lucía',
        telefono: '3415551234', metodoPago: 'manual_transfer', notas: 'Tocar timbre', anotadoManualmente: true,
    })
    expect(pedido.items.map((item) => [item.productoId, item.cantidad])).toEqual([[1, 1], [2, 1], [4, 1], [6, 1], [7, 1], [17, 1], [20, 2]])
    // El pedido siguiente arranca otra vez por los productos.
    await expect(pasos.getByRole('button', { name: 'Productos' })).toHaveAttribute('aria-current', 'step')
    await expect(panel.getByText('Tocá productos del menú para agregarlos')).toBeVisible()
})

test('tablet: anotar no recarga nada, aunque la lista de pedidos del día esté vacía', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await conMenuColapsado(page)
    // Primera venta del día: el refresco de la lista vuelve vacío (el mock no suma el pedido nuevo).
    const estado = await abrirPos(page, { pedidos: 0 })
    const panel = page.getByRole('region', { name: 'Pedido' })
    await page.getByRole('button', { name: /^Sprite 500ml/ }).click()
    // Marca en el DOM: si el Dashboard desmonta el POS para mostrar un spinner, se pierde.
    await panel.evaluate((nodo) => { (nodo as HTMLElement).dataset.marca = 'antes-de-anotar' })
    await panel.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await panel.getByRole('button', { name: 'Anotar pedido', exact: true }).click()
    await expect(page.getByText('Pedido anotado correctamente')).toBeVisible()
    expect(estado.creaciones).toHaveLength(1)
    // Pasa el refresco de la lista que dispara el alta: el POS sigue montado y listo para el próximo.
    await page.waitForTimeout(1_000)
    await expect(panel).toHaveAttribute('data-marca', 'antes-de-anotar')
    await expect(panel.getByText('Tocá productos del menú para agregarlos')).toBeVisible()
    await page.getByRole('button', { name: /^Coca-Cola 500ml/ }).click()
    await expect(panel.getByText('1 ítem', { exact: true })).toBeVisible()
})

test('tablet: mientras se envía el pedido no aparece el aviso de pedidos guardados sin conexión', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await conMenuColapsado(page)
    const estado = await abrirPos(page)
    let responder!: () => void
    const respuesta = new Promise<void>((resolve) => { responder = resolve })
    // El alta tarda: mientras viaja, el pedido vive en la cola local, pero no es un "pendiente" para el cajero.
    await page.route('**/pedido-unificado/create', async (route) => { await respuesta; await route.fallback() })
    const panel = page.getByRole('region', { name: 'Pedido' })
    await page.getByRole('button', { name: /^Sprite 500ml/ }).click()
    await panel.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await panel.getByRole('button', { name: 'Anotar pedido', exact: true }).click()
    // El formulario ya quedó libre para el próximo pedido mientras el alta viaja.
    await expect(panel.getByText('Tocá productos del menú para agregarlos')).toBeVisible()
    await page.waitForTimeout(500)
    await expect(page.getByRole('button', { name: /pendiente/ })).toHaveCount(0)
    responder()
    await expect(page.getByText('Pedido anotado correctamente')).toBeVisible()
    expect(estado.creaciones).toHaveLength(1)
    await expect(page.getByRole('button', { name: /pendiente/ })).toHaveCount(0)
})

test('tablet: un doble toque en "Siguiente" no anota el pedido', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await conMenuColapsado(page)
    const estado = await abrirPos(page)
    const panel = page.getByRole('region', { name: 'Pedido' })
    await page.getByRole('button', { name: /^Veggie/ }).click()
    // "Anotar pedido" aparece donde estaba "Siguiente": el segundo toque no debe confirmarlo.
    await panel.getByRole('button', { name: 'Siguiente', exact: true }).dblclick()
    await expect(panel.getByRole('button', { name: 'Anotar pedido', exact: true })).toBeVisible()
    await page.waitForTimeout(800)
    expect(estado.creaciones).toEqual([])
    await panel.getByRole('button', { name: 'Anotar pedido', exact: true }).click()
    await expect.poll(() => estado.creaciones.length).toBe(1)
})

test('tablet: al tocar la variante se suman, sin confirmar, los extras y la bebida marcados', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await conMenuColapsado(page)
    const estado = await abrirPos(page)
    const panel = page.getByRole('region', { name: 'Pedido' })

    await page.getByRole('button', { name: /^Clásica/ }).click()
    const selector = page.getByRole('dialog', { name: 'Configurar Clásica' })
    const extras = selector.getByRole('region', { name: 'Extras' })
    const bebidas = selector.getByRole('region', { name: 'Bebida' })
    const variantes = selector.getByRole('region', { name: 'Variante' })
    // Lo opcional primero y, al final, la variante: la que agrega.
    const izquierda = async (columna: typeof extras) => (await columna.boundingBox())!.x
    expect(await izquierda(extras)).toBeLessThan(await izquierda(bebidas))
    expect(await izquierda(bebidas)).toBeLessThan(await izquierda(variantes))
    // Una opción por variante de bebida, y ningún botón de confirmar.
    await expect(bebidas.getByRole('button', { name: /^Limonada de la casa/ })).toHaveCount(2)
    await expect(selector.getByRole('button', { name: 'Agregar', exact: true })).toHaveCount(0)

    await extras.getByRole('button', { name: /^Huevo/ }).click()
    await extras.getByRole('button', { name: /^Bacon/ }).click()
    await extras.getByRole('button', { name: /^Bacon/ }).click()
    await expect(extras.getByRole('button', { name: /^Bacon/ })).toHaveAttribute('aria-pressed', 'false')
    // La bebida es una sola: elegir otra reemplaza la anterior.
    await bebidas.getByRole('button', { name: /^Sprite 500ml/ }).click()
    await bebidas.getByRole('button', { name: /^Coca-Cola 500ml/ }).click()
    await expect(bebidas.getByRole('button', { name: /^Sprite 500ml/ })).toHaveAttribute('aria-pressed', 'false')
    await expect(selector).toContainText('Se agrega con Huevo, Coca-Cola 500ml')
    await expect(selector).toContainText('+$4.000')
    await variantes.getByRole('button', { name: /^Doble/ }).click()
    await expect(selector).toHaveCount(0)

    // El producto con su extra y, en otra fila, la bebida.
    await expect(panel.getByText('2 ítems')).toBeVisible()
    await expect(panel.getByText('(Doble)')).toBeVisible()
    await expect(panel.getByText('Extras: Huevo')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Coca-Cola 500ml.*1 en el pedido/ })).toBeVisible()
    // 11.200 (doble) + 1.200 (huevo) + 2.800 (gaseosa).
    await expect(panel.getByText('$15.200')).toBeVisible()

    // Sin marcar nada, la variante agrega sólo el producto, como siempre. Sin extras, sólo se ofrece la bebida.
    await page.getByRole('button', { name: /^Muzzarella/ }).click()
    const pizza = page.getByRole('dialog', { name: 'Configurar Muzzarella' })
    await expect(pizza.getByRole('region', { name: 'Extras' })).toHaveCount(0)
    await expect(pizza).toContainText('Marcá una bebida si la pide y tocá la variante')
    await pizza.getByRole('button', { name: /^Grande/ }).click()
    await expect(panel.getByText('3 ítems')).toBeVisible()

    await panel.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await panel.getByRole('button', { name: 'Anotar pedido', exact: true }).click()
    await expect.poll(() => estado.creaciones.length).toBe(1)
    const pedido = estado.creaciones[0] as { items: Array<{ productoId: number; varianteId?: number; agregados?: Array<{ id: number }> }> }
    expect(pedido.items.map((item) => [item.productoId, item.varianteId ?? null, item.agregados?.map((agregado) => agregado.id) ?? []]))
        .toEqual([[3, 31, [1]], [20, null, []], [9, 92, []]])
})

test('tablet: una bebida no ofrece otra bebida, y cerrar el selector no agrega nada', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await conMenuColapsado(page)
    await abrirPos(page)
    const panel = page.getByRole('region', { name: 'Pedido' })
    await page.getByRole('button', { name: /^Limonada de la casa/ }).click()
    const selector = page.getByRole('dialog', { name: 'Configurar Limonada de la casa' })
    await expect(selector.getByRole('region', { name: 'Variante' })).toBeVisible()
    await expect(selector.getByRole('region', { name: 'Bebida' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(selector).toHaveCount(0)
    await expect(panel.getByText('Tocá productos del menú para agregarlos')).toBeVisible()
    await page.getByRole('button', { name: /^Limonada de la casa/ }).click()
    await selector.getByRole('button', { name: /^1 litro/ }).click()
    await expect(selector).toHaveCount(0)
    await expect(panel.getByText('(1 litro)')).toBeVisible()
})

test('tablet: al editar un pedido los pasos separan productos y datos, y el guardado sigue siendo automático', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await conMenuColapsado(page)
    const estado = await abrirPos(page)
    await page.getByRole('button', { name: /^Pedidos/ }).click()
    await page.getByText('#900', { exact: true }).click()
    await page.getByRole('button', { name: 'Editar pedido', exact: true }).click()
    const panel = page.getByRole('region', { name: 'Pedido' })
    await expect(panel.getByText('Doble cheddar')).toBeVisible()
    // Una edición no se "anota": no hay "Siguiente" y "Guardar cambios" queda en los dos pasos.
    await expect(panel.getByRole('button', { name: 'Siguiente', exact: true })).toHaveCount(0)
    await expect(panel.getByRole('button', { name: 'Guardar cambios' })).toBeVisible()
    await panel.getByRole('button', { name: 'Cliente y pago' }).click()
    await expect(panel.getByRole('button', { name: 'Guardar cambios' })).toBeVisible()
    await expect(panel.getByPlaceholder('Calle y número...')).toHaveValue('Córdoba 1234, Rosario')
    await panel.getByPlaceholder('Nombre del cliente').fill('Cliente editado')
    await expect.poll(() => estado.ediciones.length, { timeout: 10_000 }).toBe(1)
    expect(estado.ediciones[0]).toMatchObject({ version: 3, tipo: 'delivery', nombreCliente: 'Cliente editado' })
})

test('tablet: el POS cubre el menú lateral y muestra dos paneles aunque el menú esté abierto', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await abrirPos(page)
    // Con 768 px de ventana el menú (256) no le roba ancho: catálogo y pedido conviven.
    await expect(page.getByRole('region', { name: 'Pedido' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Pedido vacío/ })).toHaveCount(0)
    // La barra del POS arranca en el borde de la ventana, no junto al menú lateral.
    expect((await page.getByRole('button', { name: /^Pedidos/ }).boundingBox())!.x).toBeLessThan(40)
    // Ir a Pedidos devuelve el menú lateral.
    await page.getByRole('button', { name: /^Pedidos/ }).click()
    await expect(page.getByRole('button', { name: 'Configuración' })).toBeInViewport()
    await expect(page.getByRole('region', { name: 'Pedido' })).toHaveCount(0)
})

test('celular: el POS queda dentro del shell, con el acceso al menú de la aplicación arriba', async ({ page }) => {
    await page.setViewportSize(CELULAR)
    await abrirPos(page)
    // La barra del POS empieza debajo de la barra con el botón de menú.
    expect((await page.getByRole('button', { name: /^Pedidos/ }).boundingBox())!.y).toBeGreaterThanOrEqual(56)
})

test('ningún tamaño desborda: sin scroll horizontal y con las acciones a la vista', async ({ browser }) => {
    test.setTimeout(150_000)
    const tamanos = [
        { ancho: 360, alto: 640, colapsado: false }, { ancho: 390, alto: 844, colapsado: false },
        { ancho: 768, alto: 1024, colapsado: true }, { ancho: 1000, alto: 600, colapsado: true }, { ancho: 844, alto: 390, colapsado: true },
    ]
    for (const t of tamanos) {
        const contexto = await browser.newContext({ viewport: { width: t.ancho, height: t.alto }, hasTouch: true })
        const page = await contexto.newPage()
        if (t.colapsado) await conMenuColapsado(page)
        await abrirPos(page)
        await page.getByRole('button', { name: /^Coca-Cola 500ml/ }).click()
        const etiqueta = `${t.ancho}x${t.alto}`
        const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(desborde, `scroll horizontal a ${etiqueta}`).toBeLessThanOrEqual(0)
        // La acción principal (la barra en celular, "Siguiente" del panel en tablet) queda dentro de la pantalla.
        const accion = page.getByRole('button', { name: /^Ver pedido|^Siguiente$/ }).first()
        await expect(accion, `acción principal a ${etiqueta}`).toBeVisible()
        const caja = (await accion.boundingBox())!
        expect(caja.y + caja.height, `acción dentro de la pantalla a ${etiqueta}`).toBeLessThanOrEqual(t.alto + 1)
        expect(caja.x + caja.width, `acción dentro del ancho a ${etiqueta}`).toBeLessThanOrEqual(t.ancho + 1)
        // En tablet, "Anotar pedido" del segundo paso también.
        if ((await accion.textContent())?.startsWith('Siguiente')) {
            await accion.click()
            const anotar = (await page.getByRole('button', { name: 'Anotar pedido', exact: true }).boundingBox())!
            expect(anotar.y + anotar.height, `"Anotar pedido" dentro de la pantalla a ${etiqueta}`).toBeLessThanOrEqual(t.alto + 1)
            expect(anotar.x + anotar.width, `"Anotar pedido" dentro del ancho a ${etiqueta}`).toBeLessThanOrEqual(t.ancho + 1)
        }
        await contexto.close()
    }
})

test('celular: el menú del POS abre la configuración y limpia el pedido con confirmación', async ({ page }) => {
    await page.setViewportSize(CELULAR)
    await abrirPos(page)
    await page.getByRole('button', { name: /^Sprite 500ml/ }).click()
    await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
    await page.getByRole('menuitem', { name: 'Configurar punto de venta' }).click()
    await expect(page.getByRole('dialog').getByText('Configurar punto de venta').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    // Limpiar pide confirmación: cancelar conserva el pedido, aceptar lo vacía.
    await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
    page.once('dialog', dialogo => dialogo.dismiss())
    await page.getByRole('menuitem', { name: 'Limpiar pedido' }).click()
    await expect(page.getByRole('button', { name: /^Ver pedido \(1\)/ })).toBeVisible()
    await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
    page.once('dialog', dialogo => dialogo.accept())
    await page.getByRole('menuitem', { name: 'Limpiar pedido' }).click()
    await expect(page.getByRole('button', { name: /^Pedido vacío/ })).toBeVisible()
})

test('celular: se pueden ocultar las fotos para ver más productos y la preferencia se recuerda', async ({ page }) => {
    await page.setViewportSize(CELULAR)
    await abrirPos(page)
    const tarjeta = page.getByRole('button', { name: /^Clásica/ })
    const conFoto = (await tarjeta.boundingBox())!.height
    await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Mostrar fotos' }).click()
    await expect.poll(async () => (await tarjeta.boundingBox())!.height).toBeLessThan(conFoto - 40)
    await page.reload()
    await expect(page.getByRole('button', { name: /^Clásica/ })).toBeVisible()
    expect((await page.getByRole('button', { name: /^Clásica/ }).boundingBox())!.height).toBeLessThan(conFoto - 40)
})

test('celular apaisado: el pedido queda a la derecha y la acción principal sigue a la vista', async ({ browser }) => {
    const contexto = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })
    const page = await contexto.newPage()
    await conMenuColapsado(page)
    await abrirPos(page)
    await page.getByRole('button', { name: /^Coca-Cola 500ml/ }).click()
    const panel = page.getByRole('region', { name: 'Pedido' })
    await expect(panel.getByRole('button', { name: 'Siguiente', exact: true })).toBeInViewport()
    // Los ítems conservan un alto útil aun con la pantalla baja.
    const lista = await panel.getByRole('list').boundingBox()
    expect(lista!.height).toBeGreaterThan(60)
    // En el segundo paso la acción sigue a la vista.
    await panel.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Anotar pedido', exact: true })).toBeInViewport()
    await contexto.close()
})

test('celular: una mesa libre abre el POS con la mesa asignada y se guarda sola', async ({ page }) => {
    await page.setViewportSize(CELULAR)
    const estado = await abrirPos(page, { mesas: true })
    await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
    await page.getByRole('menuitem', { name: 'Mesas' }).click()
    // Lista de mesas del Dashboard: una libre abre el POS ya asignada.
    await page.getByRole('button', { name: /^Mesa 1, libre/ }).click()
    await expect(page.locator('span.truncate', { hasText: 'Mesa 1' })).toBeVisible()
    await page.getByRole('button', { name: 'Bebidas', exact: true }).click()
    await page.getByRole('button', { name: /^Sprite 500ml/ }).click()
    // Una mesa no elige tipo ni pide "Anotar": se abre y se guarda sola en cuanto hay un producto.
    await expect.poll(() => estado.creaciones.length, { timeout: 10_000 }).toBe(1)
    expect(estado.creaciones[0]).toMatchObject({ tipo: 'mesa', mesaLocalId: 1, consumoEnLocal: true })
    // Al crearse el pedido el POS pasa de borrador a edición sin devolver el catálogo al principio:
    // quien está cargando bebidas sigue viendo las bebidas.
    await expect(page.getByRole('button', { name: 'Bebidas', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: /^Sprite 500ml/ })).toBeVisible()
    await page.getByRole('button', { name: /^Ver pedido/ }).click()
    const hoja = page.getByRole('dialog', { name: 'Pedido' })
    await expect(hoja.getByText('Mesa 1', { exact: true }).first()).toBeVisible()
    await expect(hoja.getByRole('button', { name: 'Delivery', exact: true })).toHaveCount(0)
    await expect(hoja.getByRole('button', { name: 'Anotar pedido', exact: true })).toHaveCount(0)
})

test('celular: sin conexión el pedido queda en la cola local y se ve en el panel de pendientes', async ({ page }) => {
    await page.setViewportSize(CELULAR)
    await abrirPos(page)
    await page.route('**/pedido-unificado/create', route => route.abort('internetdisconnected'))
    await page.getByRole('button', { name: /^Coca-Cola 500ml/ }).click()
    await page.getByRole('button', { name: /^Ver pedido/ }).click()
    await page.getByRole('dialog', { name: 'Pedido' }).getByRole('button', { name: 'Anotar pedido', exact: true }).click()
    await expect(page.getByText('Sin conexión', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: /1 pendiente/ }).click()
    const panel = page.getByRole('region', { name: 'Pedidos sin conexión' })
    await expect(panel.getByText('#LOCAL-1')).toBeVisible()
    await expect(panel.getByText('1x Coca-Cola 500ml')).toBeVisible()
    await panel.getByRole('button', { name: 'Cerrar pedidos sin conexión' }).click()
    await expect(panel).toHaveCount(0)
})

test('capturas de estados especiales (mesa, sin conexión, edición, oscuro)', async ({ browser }) => {
    test.skip(!SHOTS, 'Sólo se ejecuta para revisar el diseño (POS_MOVIL_SHOTS).')
    test.setTimeout(300_000)
    for (const d of [
        { nombre: 'celular-390', ancho: 390, alto: 844, colapsado: false },
        { nombre: 'tablet-768-colapsado', ancho: 768, alto: 1024, colapsado: true },
    ]) {
        const contexto = await browser.newContext({ viewport: { width: d.ancho, height: d.alto }, hasTouch: true })
        const page = await contexto.newPage()
        if (d.colapsado) await conMenuColapsado(page)
        await abrirPos(page, { mesas: true })
        const foto = async (paso: string) => {
            await page.waitForTimeout(400)
            await page.screenshot({ path: `${SHOTS}/estado-${d.nombre}-${paso}.png`, animations: 'disabled' })
        }
        // Borrador + lista de pedidos con "Seguir pedido".
        await page.getByRole('button', { name: /^Sprite 500ml/ }).click()
        await page.getByRole('button', { name: /^Pedidos/ }).click()
        await foto('1-lista-seguir-pedido')
        await page.getByRole('button', { name: /^Seguir pedido/ }).click()
        // Edición de un pedido existente.
        await page.getByRole('button', { name: /^Pedidos/ }).click()
        await page.getByText('#900', { exact: true }).click()
        await foto('2-detalle')
        await page.getByRole('button', { name: 'Editar pedido', exact: true }).click()
        await expect(page.locator('span.truncate, h1', { hasText: 'Editando pedido #900' }).first()).toBeVisible()
        // En celular la hoja de una edición ya viene abierta; en tablet no hay hoja.
        const barra = page.getByRole('button', { name: /^Ver pedido/ })
        if (await barra.count() && !await page.getByRole('dialog', { name: 'Pedido' }).count()) await barra.click()
        await foto('3-edicion')
        // Modo oscuro sobre el mismo estado.
        await page.emulateMedia({ colorScheme: 'dark' })
        await page.evaluate(() => document.documentElement.classList.add('dark'))
        await foto('4-oscuro')
        await page.evaluate(() => document.documentElement.classList.remove('dark'))
        await page.emulateMedia({ colorScheme: 'light' })
        await contexto.close()
    }
})
