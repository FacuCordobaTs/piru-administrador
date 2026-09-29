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
        const barra = page.getByRole('button', { name: /^Ver pedido/ })
        if (await barra.count()) await barra.click()
        await foto('5-pedido')
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
    await panel.getByRole('button', { name: 'Anotar pedido', exact: true }).click()
    await expect.poll(() => estado.creaciones.length).toBe(1)
    expect(estado.creaciones[0]).toMatchObject({ tipo: 'takeaway', metodoPago: 'cash' })
    await expect(panel.getByText('Tocá productos del menú para agregarlos')).toBeVisible()
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
        // La acción principal (barra o botón del panel) queda dentro de la pantalla.
        const accion = page.getByRole('button', { name: /^Ver pedido|^Anotar pedido$/ }).first()
        await expect(accion, `acción principal a ${etiqueta}`).toBeVisible()
        const caja = (await accion.boundingBox())!
        expect(caja.y + caja.height, `acción dentro de la pantalla a ${etiqueta}`).toBeLessThanOrEqual(t.alto + 1)
        expect(caja.x + caja.width, `acción dentro del ancho a ${etiqueta}`).toBeLessThanOrEqual(t.ancho + 1)
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
    await expect(panel.getByRole('button', { name: 'Anotar pedido', exact: true })).toBeInViewport()
    // Los ítems conservan un alto útil aun con la pantalla baja.
    const lista = await panel.getByRole('list').boundingBox()
    expect(lista!.height).toBeGreaterThan(60)
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
