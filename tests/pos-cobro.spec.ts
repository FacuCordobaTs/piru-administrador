import { test, expect, type Page } from '@playwright/test'

// Con "Confirmar cobros manualmente", sólo Mercado Pago abre el cobro con QR verificado por el servidor.
// Efectivo, tarjeta y transferencia se anotan directamente. La API se intercepta.
test.use({ hasTouch: true })

const ORIGEN = 'http://127.0.0.1:4191'
const CELULAR = { width: 390, height: 844 }
const ESCRITORIO = { width: 1440, height: 900 }
const PEDIDO_ID = 901
const CAJA_BARRA = { id: 5, nombre: 'Barra', externalPosId: 'PIRU1BARRA', qrUrl: 'https://mp.example/qr-5.png', plantillaUrl: null }
const CAJA_SALIDA = { id: 6, nombre: 'Salida', externalPosId: 'PIRU1SALIDA', qrUrl: 'https://mp.example/qr-6.png', plantillaUrl: null }

type Cobro = {
    id: number; pedidoId: number; cajaId: number; cajaNombre: string | null; qrUrl: string | null; monto: string
    estado: string; mpStatus: string | null; mensaje: string | null; expiraAt: string | null; pagadoAt: string | null; reintentable?: boolean
}

/** Lo que el POS manda en el cuerpo de cada llamada simulada (sólo lo que las pruebas leen). */
type Cuerpo = {
    tipo?: string; pagado?: boolean; metodoPago?: string; clientRequestId?: string
    nombre?: string; mpPosId?: string; tiendaId?: string; cajaId?: number; cancelarPedido?: boolean
}
type CajaFixture = { id: number; nombre: string; externalPosId: string; qrUrl: string | null; plantillaUrl: string | null }
type CajaMpFixture = { mpPosId: string; nombre: string; externalId: string | null; storeId: string | null; qrUrl: string | null; activa: boolean; vinculada: boolean }
type TiendaFixture = { id: string; nombre: string; direccion: string | null }

interface Api {
    creaciones: Cuerpo[]
    iniciosCobro: Array<Cuerpo & { pedidoId: number }>
    cancelaciones: Array<Cuerpo & { pedidoId: number }>
    consultas: number
    cobro: Cobro | null
    monto: string
    cajas: CajaFixture[]
    estado: { moduloMercadoPago: boolean; mpConectado: boolean; appConfigurada: boolean }
    /** Llamadas a la conexión con la aplicación de Mercado Pago para QR. */
    conexion: { inicios: number; desconexiones: number }
    cajasMp: CajaMpFixture[]
    tiendas: TiendaFixture[]
    vinculaciones: Cuerpo[]
    creacionesCaja: Cuerpo[]
    desvinculadas: number[]
    /** Respuesta de error para el próximo alta de cobro. */
    falloInicio: { status: number; body: Record<string, unknown> } | null
}

/** Un pedido ya cerrado del día: el listado no está vacío, como en cualquier turno en marcha. */
function pedidoPrevio() {
    const createdAt = new Date(Date.now() - 45 * 60_000).toISOString()
    return {
        id: 700, tipo: 'takeaway', estado: 'delivered', total: '2800', nombreCliente: 'Cliente previo', telefono: null,
        direccion: null, createdAt, updatedAt: createdAt, pagado: true, metodoPago: 'cash', impreso: true,
        consumoEnLocal: false, latitud: null, longitud: null, deliveryFee: null, montoDescuento: null, version: 1, totalItems: 1,
        editable: false, items: [{ id: 7001, productoId: 3, cantidad: 1, precioUnitario: '2800', nombreProducto: 'Coca-Cola 500ml', imagenUrl: null, ingredientesExcluidos: [] }],
    }
}

interface Opciones {
    /** Pedidos ya listados en el día (por defecto 1). Con 0, el Dashboard remonta el POS al refrescar la lista. */
    pedidosPrevios?: number
    /** Configuración local del POS (`piru:pos-config`). */
    config?: Record<string, unknown>
    cajas?: CajaFixture[]
    estado?: Partial<Api['estado']>
    monto?: string
}

async function preparar(page: Page, opciones: Opciones = {}): Promise<Api> {
    const api: Api = {
        creaciones: [], iniciosCobro: [], cancelaciones: [], consultas: 0, cobro: null,
        monto: opciones.monto ?? '2800.00',
        cajas: opciones.cajas ?? [CAJA_BARRA],
        estado: { moduloMercadoPago: true, mpConectado: true, appConfigurada: true, ...opciones.estado },
        conexion: { inicios: 0, desconexiones: 0 },
        cajasMp: [], tiendas: [], vinculaciones: [], creacionesCaja: [], desvinculadas: [], falloInicio: null,
    }
    await page.routeWebSocket(/.*/, (socket) => socket.close())
    // Pantalla de autorización de Mercado Pago (la que se abre al conectar): sólo se comprueba a dónde se llega.
    await page.route('https://auth.mercadopago.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Autorizar Piru</h1>' }))
    await page.route('https://mp.example/**', (route) => route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#009EE3"/></svg>',
    }))
    await page.route('**/api/**', (route) => {
        const url = new URL(route.request().url())
        if (url.origin === ORIGEN) return route.continue()
        if (route.request().resourceType() === 'script') return route.abort()
        const path = url.pathname
        const metodo = route.request().method()
        const cuerpo = () => route.request().postDataJSON() as Cuerpo

        if (path.endsWith('/sucursales/list')) return route.fulfill({ json: { success: true, data: [{ id: 20, nombre: 'Local Centro', activo: true, soloPos: false }] } })
        if (path.endsWith('/mis-modulos')) return route.fulfill({ json: { success: true, data: [{ modulos: [{ codigo: 'pos', estado: 'activo', activoAhora: true }] }] } })
        if (path.endsWith('/mi-suscripcion')) return route.fulfill({ json: { success: true, data: { estado: 'activa' } } })
        if (path.endsWith('/pedido-unificado/list-dia')) {
            const data = Array.from({ length: opciones.pedidosPrevios ?? 1 }, pedidoPrevio)
            return route.fulfill({ json: { success: true, data, pagination: { hasMore: false } } })
        }
        if (path.endsWith('/pedido-unificado/create') && metodo === 'POST') {
            const body = cuerpo()
            api.creaciones.push(body)
            return route.fulfill({ status: 201, json: { success: true, data: { id: PEDIDO_ID, tipo: body.tipo, pagado: body.pagado } } })
        }
        if (path.endsWith('/clientes/indice-pos')) return route.fulfill({ json: { success: true, data: [] } })
        if (path.endsWith('/cliente-contexto')) return route.fulfill({ json: { success: true, data: null } })

        // ── POS · QR estático de Mercado Pago ──
        if (path.endsWith('/pos-qr/conexion/iniciar') && metodo === 'POST') {
            api.conexion.inicios++
            return route.fulfill({ json: { success: true, data: { url: 'https://auth.mercadopago.test/authorization?client_id=7364289770550796&response_type=code&platform_id=mp&state=42.1.ab.cd' } } })
        }
        if (path.endsWith('/pos-qr/conexion') && metodo === 'DELETE') {
            api.conexion.desconexiones++
            api.estado.mpConectado = false
            api.cajas = []
            return route.fulfill({ json: { success: true } })
        }
        if (path.endsWith('/pos-qr/estado')) return route.fulfill({ json: { success: true, data: { ...api.estado, cajas: api.cajas } } })
        if (path.endsWith('/pos-qr/mp/cajas')) return route.fulfill({ json: { success: true, data: api.cajasMp } })
        if (path.endsWith('/pos-qr/mp/tiendas')) return route.fulfill({ json: { success: true, data: api.tiendas } })
        if (path.endsWith('/pos-qr/cajas/nueva') && metodo === 'POST') {
            const body = cuerpo()
            api.creacionesCaja.push(body)
            const nueva = { id: 20 + api.cajas.length, nombre: body.nombre ?? 'Caja', externalPosId: 'PIRU1NUEVA', qrUrl: 'https://mp.example/qr-nueva.png', plantillaUrl: null }
            api.cajas.push(nueva)
            return route.fulfill({ status: 200, json: { success: true, data: nueva } })
        }
        if (path.endsWith('/pos-qr/cajas') && metodo === 'POST') {
            const body = cuerpo()
            api.vinculaciones.push(body)
            const origen = api.cajasMp.find((c) => c.mpPosId === body.mpPosId)
            const nueva = { id: 30 + api.cajas.length, nombre: origen?.nombre ?? 'Caja', externalPosId: origen?.externalId ?? 'X', qrUrl: origen?.qrUrl ?? null, plantillaUrl: null }
            api.cajas.push(nueva)
            return route.fulfill({ json: { success: true, data: nueva } })
        }
        const caja = path.match(/\/pos-qr\/cajas\/(\d+)$/)
        if (caja && metodo === 'DELETE') {
            api.desvinculadas.push(Number(caja[1]))
            api.cajas = api.cajas.filter((c) => c.id !== Number(caja[1]))
            return route.fulfill({ json: { success: true } })
        }
        const cobro = path.match(/\/pos-qr\/pedidos\/(\d+)\/cobro(\/cancelar)?$/)
        if (cobro) {
            const pedidoId = Number(cobro[1])
            if (cobro[2] && metodo === 'POST') {
                const body = cuerpo()
                api.cancelaciones.push({ pedidoId, ...body })
                if (api.cobro && api.cobro.estado !== 'pagado') api.cobro = { ...api.cobro, estado: 'cancelado' }
                return route.fulfill({ json: { success: true, data: { cobro: api.cobro, pedidoCancelado: body.cancelarPedido === true } } })
            }
            if (metodo === 'POST') {
                const body = cuerpo()
                api.iniciosCobro.push({ pedidoId, ...body })
                if (api.falloInicio) {
                    const { status, body: error } = api.falloInicio
                    api.falloInicio = null
                    return route.fulfill({ status, json: { success: false, ...error } })
                }
                const elegida = api.cajas.find((c) => c.id === body.cajaId)
                api.cobro = {
                    id: api.iniciosCobro.length, pedidoId, cajaId: body.cajaId ?? 0, cajaNombre: elegida?.nombre ?? null, qrUrl: elegida?.qrUrl ?? null,
                    monto: api.monto, estado: 'creado', mpStatus: 'created', mensaje: null,
                    expiraAt: new Date(Date.now() + 10 * 60_000).toISOString(), pagadoAt: null,
                }
                return route.fulfill({ json: { success: true, data: api.cobro } })
            }
            api.consultas++
            return route.fulfill({ json: { success: true, data: api.cobro } })
        }
        const idPedido = path.match(/\/pedido-unificado\/(\d+)$/)
        if (idPedido && metodo === 'GET') return route.fulfill({ json: { success: true, data: null } })
        return route.fulfill({ json: { success: true, data: [], pagination: { hasMore: false } } })
    })
    await page.addInitScript((datos) => {
        localStorage.setItem('sucursal_activa_id', '20')
        // Sólo la primera carga limpia la sesión: una recarga (retomar un cobro) debe conservar el borrador.
        if (!sessionStorage.getItem('__cobro_test_iniciado')) {
            sessionStorage.clear()
            sessionStorage.setItem('__cobro_test_iniciado', '1')
        }
        if (datos.config) localStorage.setItem('piru:pos-config', JSON.stringify(datos.config))
    }, { config: opciones.config ?? null })
    return api
}

const CONFIRMAR = { confirmarCobrosManualmente: true, cajaMpQrId: CAJA_BARRA.id }

async function abrirPos(page: Page, opciones: Opciones = {}, consulta = '') {
    const api = await preparar(page, opciones)
    await page.goto(`/tests/pos-cobro.html${consulta}`)
    await expect(page.getByPlaceholder('Buscar producto o tag...')).toBeVisible({ timeout: 20_000 })
    return api
}

/** Celular: agrega productos y abre la hoja del pedido. */
async function abrirPedidoMovil(page: Page, productos: string[] = ['Coca-Cola 500ml']) {
    for (const nombre of productos) await page.getByRole('button', { name: new RegExp(`^${nombre}`) }).click()
    await page.getByRole('button', { name: /^Ver pedido/ }).click()
    const hoja = page.getByRole('dialog', { name: 'Pedido' })
    await expect(hoja).toBeVisible()
    return hoja
}

const dialogoMp = (page: Page) => page.getByRole('dialog', { name: 'Cobrar con Mercado Pago' })
const dialogoManual = (page: Page) => page.getByRole('dialog', { name: 'Confirmar cobro' })
const configGuardada = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('piru:pos-config') ?? 'null'))

test.describe('celular', () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize(CELULAR) })

    test('la configuración ofrece "Confirmar cobros manualmente", apagado por defecto, y lo guarda con la caja de este equipo', async ({ page }) => {
        await abrirPos(page)
        await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
        await page.getByRole('menuitem', { name: 'Configurar punto de venta' }).click()
        const configuracion = page.getByRole('dialog', { name: 'Configurar punto de venta' })
        const interruptor = configuracion.getByRole('switch', { name: 'Confirmar cobros manualmente' })
        await expect(interruptor).toBeVisible()
        await expect(interruptor).toHaveAttribute('aria-checked', 'false')
        // Sin la opción no se ofrece administrar cajas.
        await expect(configuracion.getByTestId('pos-cajas-qr')).toHaveCount(0)

        await interruptor.click()
        const cajas = configuracion.getByTestId('pos-cajas-qr')
        await expect(cajas).toBeVisible()
        // Con una única caja, esa queda como la de este dispositivo sin tener que elegirla.
        await expect(cajas.getByRole('radio', { name: 'Barra' })).toHaveAttribute('aria-checked', 'true')
        await configuracion.getByRole('button', { name: 'Guardar', exact: true }).click()
        await expect.poll(() => configGuardada(page)).toMatchObject({ confirmarCobrosManualmente: true, cajaMpQrId: CAJA_BARRA.id })
    })

    test('la caja se puede vincular desde la configuración (sólo cajas con ID externo) y ver su QR', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR, cajas: [] })
        api.cajasMp = [
            { mpPosId: '111', nombre: 'Caja del evento', externalId: 'EVENTO1', storeId: '9', qrUrl: 'https://mp.example/qr-evento.png', activa: true, vinculada: false },
            { mpPosId: '222', nombre: 'Caja sin id', externalId: null, storeId: '9', qrUrl: null, activa: true, vinculada: false },
        ]
        await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
        await page.getByRole('menuitem', { name: 'Configurar punto de venta' }).click()
        const configuracion = page.getByRole('dialog', { name: 'Configurar punto de venta' })
        await expect(configuracion.getByText('Todavía no vinculaste ninguna caja.')).toBeVisible()
        await configuracion.getByRole('button', { name: 'Vincular o crear una caja' }).click()

        const agregar = page.getByRole('dialog', { name: 'Agregar caja de Mercado Pago' })
        await expect(agregar.getByRole('button', { name: 'Vincular Caja sin id' })).toBeDisabled()
        await expect(agregar.getByText(/Sin ID externo/)).toBeVisible()
        await agregar.getByRole('button', { name: 'Vincular Caja del evento' }).click()
        await expect(agregar).toHaveCount(0)
        expect(api.vinculaciones).toEqual([{ mpPosId: '111' }])

        const cajas = configuracion.getByTestId('pos-cajas-qr')
        await expect(cajas.getByRole('radio', { name: 'Caja del evento' })).toHaveAttribute('aria-checked', 'true')
        await cajas.getByRole('button', { name: 'Ver QR de Caja del evento' }).click()
        await expect(page.getByRole('img', { name: 'QR de la caja Caja del evento' })).toBeVisible()
    })

    test('una caja nueva se crea sobre una tienda que ya existe en la cuenta', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR, cajas: [] })
        api.tiendas = [{ id: '10', nombre: 'Stand Feria', direccion: 'Belgrano 10' }]
        await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
        await page.getByRole('menuitem', { name: 'Configurar punto de venta' }).click()
        const configuracion = page.getByRole('dialog', { name: 'Configurar punto de venta' })
        await configuracion.getByRole('button', { name: 'Vincular o crear una caja' }).click()
        const agregar = page.getByRole('dialog', { name: 'Agregar caja de Mercado Pago' })
        await agregar.getByRole('tab', { name: 'Crear una nueva' }).click()
        await expect(agregar.getByLabel('Tienda')).toHaveValue('10')
        await expect(agregar.getByRole('button', { name: 'Crear caja' })).toBeDisabled()
        await agregar.getByLabel('Nombre de la caja').fill('Barra del evento')
        await agregar.getByRole('button', { name: 'Crear caja' }).click()
        await expect(agregar).toHaveCount(0)
        expect(api.creacionesCaja).toEqual([{ nombre: 'Barra del evento', tiendaId: '10' }])
        await expect(configuracion.getByRole('radio', { name: 'Barra del evento' })).toHaveAttribute('aria-checked', 'true')
    })

    test('sin la conexión de QR la configuración ofrece conectarla y lleva a autorizar la aplicación de Mercado Pago', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR, estado: { mpConectado: false }, cajas: [] })
        await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
        await page.getByRole('menuitem', { name: 'Configurar punto de venta' }).click()
        const configuracion = page.getByRole('dialog', { name: 'Configurar punto de venta' })
        const cajas = configuracion.getByTestId('pos-cajas-qr')
        // Los cobros con QR tienen su conexión propia: no se manda a la de pagos online.
        await expect(cajas.getByText(/conexión propia con Mercado Pago/)).toBeVisible()
        await expect(cajas.getByText(/Ajustes → Métodos de pago/)).toHaveCount(0)
        await expect(cajas.getByRole('button', { name: 'Vincular o crear una caja' })).toHaveCount(0)

        await cajas.getByRole('button', { name: 'Conectar Mercado Pago', exact: true }).click()
        await expect(page).toHaveURL(/^https:\/\/auth\.mercadopago\.test\/authorization\?client_id=7364289770550796/)
        expect(api.conexion.inicios).toBe(1)
    })

    test('conectar guarda antes lo que se acaba de encender, para que al volver la sección de cajas siga ahí', async ({ page }) => {
        await abrirPos(page, { estado: { mpConectado: false }, cajas: [] })
        await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
        await page.getByRole('menuitem', { name: 'Configurar punto de venta' }).click()
        const configuracion = page.getByRole('dialog', { name: 'Configurar punto de venta' })
        // Sin guardar: la opción se enciende en el formulario y se va directo a autorizar.
        await configuracion.getByRole('switch', { name: 'Confirmar cobros manualmente' }).click()
        await configuracion.getByRole('button', { name: 'Conectar Mercado Pago', exact: true }).click()
        await expect(page).toHaveURL(/^https:\/\/auth\.mercadopago\.test\//)
        const almacenado = (await page.context().storageState()).origins.find((o) => o.origin === ORIGEN)?.localStorage
            .find((entrada) => entrada.name === 'piru:pos-config')?.value
        expect(JSON.parse(almacenado ?? 'null')).toMatchObject({ confirmarCobrosManualmente: true })
    })

    test('si el servidor no tiene configurada la aplicación de QR no se ofrece conectar', async ({ page }) => {
        await abrirPos(page, { config: CONFIRMAR, estado: { mpConectado: false, appConfigurada: false }, cajas: [] })
        await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
        await page.getByRole('menuitem', { name: 'Configurar punto de venta' }).click()
        const cajas = page.getByRole('dialog', { name: 'Configurar punto de venta' }).getByTestId('pos-cajas-qr')
        await expect(cajas.getByText(/todavía no está habilitado en Piru/)).toBeVisible()
        await expect(cajas.getByRole('button', { name: /Conectar Mercado Pago/ })).toHaveCount(0)
    })

    test('al volver de autorizar con éxito se avisa, se limpia la URL y se abre la configuración para vincular la caja', async ({ page }) => {
        await abrirPos(page, { config: CONFIRMAR }, '?mp_qr_status=success')
        await expect(page.getByText('Mercado Pago conectado para cobros con QR')).toBeVisible()
        await expect(page.getByRole('dialog', { name: 'Configurar punto de venta' })).toBeVisible()
        expect(new URL(page.url()).search).toBe('')
    })

    test('al volver sin haber autorizado se explica el motivo y se permite reintentar desde la configuración', async ({ page }) => {
        await abrirPos(page, { config: CONFIRMAR, estado: { mpConectado: false }, cajas: [] }, '?mp_qr_status=error&mp_qr_error=denegado')
        await expect(page.getByText('No se pudo conectar Mercado Pago')).toBeVisible()
        await expect(page.getByText('No autorizaste la conexión')).toBeVisible()
        await expect(page.getByRole('dialog', { name: 'Configurar punto de venta' }).getByRole('button', { name: 'Conectar Mercado Pago', exact: true })).toBeVisible()
        expect(new URL(page.url()).search).toBe('')
    })

    test('un fallo del servidor vuelve a la configuración y permite iniciar una autorización nueva', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR, estado: { mpConectado: false }, cajas: [] }, '?mp_qr_status=error&mp_qr_error=servidor')
        await expect(page.getByText('No se pudo conectar Mercado Pago')).toBeVisible()
        const configuracion = page.getByRole('dialog', { name: 'Configurar punto de venta' })
        await configuracion.getByRole('button', { name: 'Conectar Mercado Pago', exact: true }).click()
        await expect(page).toHaveURL(/^https:\/\/auth\.mercadopago\.test\/authorization/)
        expect(api.conexion.inicios).toBe(1)
    })

    test('se puede desconectar Mercado Pago de los cobros con QR', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR })
        page.on('dialog', (dialogo) => void dialogo.accept())
        await page.getByRole('button', { name: 'Más opciones del punto de venta' }).click()
        await page.getByRole('menuitem', { name: 'Configurar punto de venta' }).click()
        const cajas = page.getByRole('dialog', { name: 'Configurar punto de venta' }).getByTestId('pos-cajas-qr')
        await cajas.getByRole('button', { name: 'Desconectar Mercado Pago de los cobros con QR' }).click()
        await expect(cajas.getByRole('button', { name: 'Conectar Mercado Pago', exact: true })).toBeVisible()
        expect(api.conexion.desconexiones).toBe(1)
        expect(api.cajas).toEqual([])
    })

    test('sin la conexión de QR, cobrar con Mercado Pago no anota nada y lleva a configurarla', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR, estado: { mpConectado: false }, cajas: [] })
        const hoja = await abrirPedidoMovil(page)
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        const cobro = dialogoMp(page)
        await expect(cobro.getByRole('alert')).toContainText('Falta conectar Mercado Pago para cobrar con QR')
        expect(api.creaciones).toEqual([])

        await cobro.getByRole('button', { name: 'Configurar QR' }).click()
        await expect(cobro).toHaveCount(0)
        await expect(page.getByRole('dialog', { name: 'Configurar punto de venta' })).toBeVisible()
        expect(api.creaciones).toEqual([])
    })

    test('sin la opción, "Anotar pedido" sigue creando el pedido ya cobrado (nada cambia)', async ({ page }) => {
        const api = await abrirPos(page)
        const hoja = await abrirPedidoMovil(page)
        await expect(hoja.getByRole('button', { name: 'Cobrar', exact: true })).toHaveCount(0)
        await hoja.getByRole('button', { name: 'Anotar pedido', exact: true }).click()
        await expect.poll(() => api.creaciones.length).toBe(1)
        expect(api.creaciones[0]).toMatchObject({ tipo: 'takeaway', pagado: true, metodoPago: 'cash', anotadoManualmente: true })
        await expect(dialogoManual(page)).toHaveCount(0)
        expect(api.iniciosCobro).toEqual([])
    })

    test('efectivo: se anota directamente sin mostrar el diálogo de cobro', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR })
        const hoja = await abrirPedidoMovil(page)
        await expect(hoja.getByRole('button', { name: 'Cobrar', exact: true })).toHaveCount(0)
        await hoja.getByRole('button', { name: 'Anotar pedido', exact: true }).click()
        await expect.poll(() => api.creaciones.length).toBe(1)
        expect(api.creaciones[0]).toMatchObject({ tipo: 'takeaway', pagado: true, metodoPago: 'cash', anotadoManualmente: true })
        await expect(dialogoManual(page)).toHaveCount(0)
        await expect(page.getByRole('button', { name: /^Pedido vacío/ })).toBeVisible()
        expect(api.iniciosCobro).toEqual([])
    })

    for (const [boton, metodoPago] of [['Tarjeta', 'tarjeta'], ['Transferencia', 'manual_transfer']] as const) {
        test(`${boton.toLowerCase()}: se anota directamente sin diálogo ni cobro de Mercado Pago`, async ({ page }) => {
            const api = await abrirPos(page, { config: CONFIRMAR })
            const hoja = await abrirPedidoMovil(page)
            await hoja.getByRole('button', { name: boton, exact: true }).click()
            await hoja.getByRole('button', { name: 'Anotar pedido', exact: true }).click()
            await expect.poll(() => api.creaciones.length).toBe(1)
            expect(api.creaciones[0]).toMatchObject({ pagado: true, metodoPago })
            await expect(dialogoManual(page)).toHaveCount(0)
            expect(api.iniciosCobro).toEqual([])
        })
    }

    test('un delivery sin dirección no llega al cobro', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR })
        const hoja = await abrirPedidoMovil(page)
        await hoja.getByRole('button', { name: 'Delivery', exact: true }).click()
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        await expect(hoja.getByRole('alert')).toHaveText('Ingresá la dirección de entrega')
        await expect(dialogoManual(page)).toHaveCount(0)
        expect(api.creaciones).toEqual([])
    })

    test('Mercado Pago: anota el pedido impago, muestra el QR de la caja y se cierra solo cuando el servidor confirma el pago', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR, monto: '15300.00' })
        const hoja = await abrirPedidoMovil(page, ['Combo Clásico', 'Coca-Cola 500ml'])
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()

        const cobro = dialogoMp(page)
        await expect(cobro.getByText('Esperando el pago…')).toBeVisible({ timeout: 15_000 })
        // El pedido se anotó IMPAGO y el cobro se pidió sólo con la caja: el monto lo pone el servidor.
        expect(api.creaciones).toHaveLength(1)
        expect(api.creaciones[0]).toMatchObject({ tipo: 'takeaway', pagado: false, metodoPago: 'mercadopago', anotadoManualmente: true })
        expect(api.iniciosCobro).toEqual([{ pedidoId: PEDIDO_ID, cajaId: CAJA_BARRA.id }])
        await expect(cobro.getByTestId('cobro-total')).toHaveText('$15.300')
        await expect(cobro.getByRole('img', { name: 'QR de la caja Barra' })).toBeVisible()
        await expect(cobro.getByText(/vence en \d\d:\d\d/)).toBeVisible()
        // Sin "ya pagó" manual: el pago sólo lo confirma Mercado Pago a través del servidor.
        await expect(cobro.getByRole('button', { name: /Cobrado|Ya pagó/ })).toHaveCount(0)

        // El cliente paga: la pantalla lo detecta sola en la próxima consulta.
        api.cobro = { ...api.cobro!, estado: 'pagado', mpStatus: 'processed', pagadoAt: new Date().toISOString() }
        await expect(cobro.getByText('¡Pago recibido!')).toBeVisible({ timeout: 10_000 })
        await expect(cobro).toHaveCount(0, { timeout: 8_000 })
        await expect(page.getByRole('button', { name: /^Pedido vacío/ })).toBeVisible()
        expect(api.creaciones).toHaveLength(1)
        expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('piru:pos-draft')))).toEqual([])
    })

    test('Mercado Pago en la primera venta del día: refrescar la lista vacía no desmonta el POS y el cobro queda cerrado', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR, pedidosPrevios: 0 })
        const hoja = await abrirPedidoMovil(page)
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        await expect(dialogoMp(page).getByText('Esperando el pago…')).toBeVisible({ timeout: 15_000 })

        api.cobro = { ...api.cobro!, estado: 'pagado', mpStatus: 'processed', pagadoAt: new Date().toISOString() }
        // Con la lista todavía vacía el refresco es silencioso (antes cambiaba toda la pantalla por un spinner y
        // desmontaba el POS): el aviso queda, el diálogo se cierra solo, el POS vuelve vacío, el borrador se limpia y
        // no se anota ni se cobra dos veces.
        await expect(page.getByText('Pago recibido: pedido anotado')).toBeVisible({ timeout: 10_000 })
        await expect(dialogoMp(page)).toHaveCount(0)
        await expect(page.getByRole('button', { name: /^Pedido vacío/ })).toBeVisible()
        expect(api.creaciones).toHaveLength(1)
        expect(api.iniciosCobro).toHaveLength(1)
        expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('piru:pos-draft')))).toEqual([])
        // Nada retoma un cobro ya pagado: pasado el intervalo de consulta no vuelve a abrirse.
        await page.waitForTimeout(3_000)
        await expect(dialogoMp(page)).toHaveCount(0)
    })

    test('Mercado Pago: cancelar el cobro cancela el pedido impago y conserva lo cargado', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR })
        const hoja = await abrirPedidoMovil(page, ['Coca-Cola 500ml', 'Empanada de carne'])
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        const cobro = dialogoMp(page)
        await expect(cobro.getByText('Esperando el pago…')).toBeVisible({ timeout: 15_000 })

        await cobro.getByRole('button', { name: 'Cancelar cobro' }).click()
        await expect(cobro).toHaveCount(0)
        expect(api.cancelaciones).toEqual([{ pedidoId: PEDIDO_ID, cancelarPedido: true }])
        // El borrador sigue ahí: se puede cobrar de otra forma sin volver a cargar todo.
        await expect(hoja.getByText('2 ítems')).toBeVisible()
        await hoja.getByRole('button', { name: 'Efectivo', exact: true }).click()
        await hoja.getByRole('button', { name: 'Anotar pedido', exact: true }).click()
        await expect(dialogoManual(page)).toHaveCount(0)
        await expect.poll(() => api.creaciones.length).toBe(2)
        expect(api.creaciones[1]).toMatchObject({ pagado: true, metodoPago: 'cash' })
        // Dos altas distintas: la del cobro cancelado y la nueva en efectivo.
        expect(api.creaciones[0].clientRequestId).not.toBe(api.creaciones[1].clientRequestId)
    })

    test('Mercado Pago: si el cobro vence se puede reintentar sin anotar otro pedido', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR })
        const hoja = await abrirPedidoMovil(page)
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        const cobro = dialogoMp(page)
        await expect(cobro.getByText('Esperando el pago…')).toBeVisible({ timeout: 15_000 })

        api.cobro = { ...api.cobro!, estado: 'vencido', mensaje: 'El cobro venció sin pagarse' }
        await cobro.getByRole('button', { name: 'Verificar ahora' }).click()
        await expect(cobro.getByText('El cobro venció sin que el cliente pagara.')).toBeVisible()
        await cobro.getByRole('button', { name: 'Reintentar' }).click()
        await expect(cobro.getByText('Esperando el pago…')).toBeVisible({ timeout: 15_000 })
        expect(api.iniciosCobro).toHaveLength(2)
        expect(api.creaciones).toHaveLength(1)
    })

    test('Mercado Pago: si el servidor rechaza el cobro se muestra el motivo y no se marca nada como pagado', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR })
        api.falloInicio = { status: 409, body: { code: 'CAJA_OCUPADA', message: 'La caja está cobrando el pedido #777. Esperá a que termine o cancelá ese cobro.', data: { pedidoId: 777 } } }
        const hoja = await abrirPedidoMovil(page)
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        const cobro = dialogoMp(page)
        await expect(cobro.getByRole('alert')).toHaveText('La caja está cobrando el pedido #777. Esperá a que termine o cancelá ese cobro.')
        // Cancelar cierra la pantalla y cancela el pedido impago que se había anotado.
        await cobro.getByRole('button', { name: 'Cancelar', exact: true }).click()
        await expect(cobro).toHaveCount(0)
        expect(api.cancelaciones).toEqual([{ pedidoId: PEDIDO_ID, cancelarPedido: true }])
    })

    test('un rechazo definitivo de MP no ofrece repetir los mismos datos ni muestra el QR', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR })
        api.falloInicio = { status: 502, body: { code: 'MP_ERROR', reintentable: false,
            message: 'Mercado Pago rechazó los datos del cobro: config.qr.external_pos_id: Invalid POS value' } }
        const hoja = await abrirPedidoMovil(page)
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        const cobro = dialogoMp(page)
        await expect(cobro.getByRole('alert')).toContainText('config.qr.external_pos_id')
        await expect(cobro.getByRole('button', { name: 'Reintentar' })).toHaveCount(0)
        await expect(cobro.getByRole('img')).toHaveCount(0)
        await cobro.getByRole('button', { name: 'Cerrar', exact: true }).click()
        expect(api.creaciones).toHaveLength(1)
        expect(api.creaciones[0].pagado).toBe(false)
    })

    test('al retomar una creación pendiente espera la aceptación de MP antes de mostrar el QR', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR })
        const hoja = await abrirPedidoMovil(page)
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        await expect(dialogoMp(page).getByText('Esperando el pago…')).toBeVisible()
        api.cobro = { ...api.cobro!, estado: 'creando', expiraAt: null }
        await page.reload()
        const cobro = dialogoMp(page)
        await expect(cobro.getByText('Preparando el cobro…')).toBeVisible()
        await expect(cobro.getByRole('img')).toHaveCount(0)
        api.cobro = { ...api.cobro!, estado: 'error', mensaje: 'Mercado Pago rechazó los datos del cobro: total_amount', reintentable: false }
        await expect(cobro.getByRole('alert')).toContainText('total_amount')
        await expect(cobro.getByRole('button', { name: 'Reintentar' })).toHaveCount(0)
        expect(api.creaciones).toHaveLength(1)
    })

    test('una consulta vieja no reemplaza el nuevo cobro después de reintentar', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR })
        const hoja = await abrirPedidoMovil(page)
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        const cobro = dialogoMp(page)
        await expect(cobro.getByText('Esperando el pago…')).toBeVisible()
        const viejo = { ...api.cobro!, estado: 'vencido' }
        let liberar!: () => void
        let recibida!: () => void
        const pendiente = new Promise<void>((resolve) => { liberar = resolve })
        const llegada = new Promise<void>((resolve) => { recibida = resolve })
        let interceptada = false
        await page.route('**/pos-qr/pedidos/*/cobro', async (route) => {
            if (route.request().method() !== 'GET' || interceptada) return route.fallback()
            interceptada = true
            recibida()
            await pendiente
            await route.fulfill({ json: { success: true, data: viejo } })
        })
        await cobro.getByRole('button', { name: 'Verificar ahora' }).click()
        await llegada
        api.cobro = viejo
        await cobro.getByRole('button', { name: 'Verificar ahora' }).click()
        await expect(cobro.getByRole('button', { name: 'Reintentar' })).toBeVisible()
        await cobro.getByRole('button', { name: 'Reintentar' }).click()
        await expect(cobro.getByText('Esperando el pago…')).toBeVisible()
        const respondida = page.waitForResponse((response) => response.url().endsWith(`/pos-qr/pedidos/${PEDIDO_ID}/cobro`) && response.request().method() === 'GET')
        liberar()
        await (await respondida).finished()
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
        await expect(cobro.getByText('Esperando el pago…')).toBeVisible()
        await expect(cobro.getByRole('button', { name: 'Reintentar' })).toHaveCount(0)
        expect(api.creaciones).toHaveLength(1)
    })

    test('un timeout del servidor se distingue de un corte de internet', async ({ page }) => {
        await abrirPos(page, { config: CONFIRMAR })
        const hoja = await abrirPedidoMovil(page)
        await page.evaluate(() => {
            const enviar = window.fetch
            window.fetch = (input, init) => String(input).includes('/pos-qr/estado')
                ? Promise.reject(new DOMException('timed out', 'TimeoutError')) : enviar(input, init)
        })
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        await expect(dialogoMp(page).getByRole('alert')).toHaveText('El servidor tardó demasiado en responder. Reintentá para retomar el mismo cobro.')
    })

    test('Mercado Pago sin cajas vinculadas: no anota nada y lleva a configurar el QR', async ({ page }) => {
        const api = await abrirPos(page, { config: { confirmarCobrosManualmente: true }, cajas: [] })
        const hoja = await abrirPedidoMovil(page)
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        const cobro = dialogoMp(page)
        await expect(cobro.getByText('Todavía no hay una caja de Mercado Pago vinculada')).toBeVisible()
        expect(api.creaciones).toEqual([])
        await cobro.getByRole('button', { name: 'Configurar QR' }).click()
        await expect(cobro).toHaveCount(0)
        await expect(page.getByRole('dialog', { name: 'Configurar punto de venta' })).toBeVisible()
        expect(api.creaciones).toEqual([])
    })

    test('Mercado Pago con varias cajas y ninguna elegida: se elige una y se recuerda para los próximos cobros', async ({ page }) => {
        const api = await abrirPos(page, { config: { confirmarCobrosManualmente: true }, cajas: [CAJA_BARRA, CAJA_SALIDA] })
        const hoja = await abrirPedidoMovil(page)
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        const cobro = dialogoMp(page)
        await expect(cobro.getByText('¿Con qué caja cobrás en este dispositivo?')).toBeVisible()
        expect(api.creaciones).toEqual([])
        await cobro.getByRole('button', { name: 'Salida' }).click()
        await expect(cobro.getByText('Esperando el pago…')).toBeVisible({ timeout: 15_000 })
        expect(api.iniciosCobro).toEqual([{ pedidoId: PEDIDO_ID, cajaId: CAJA_SALIDA.id }])
        await expect(cobro.getByRole('img', { name: 'QR de la caja Salida' })).toBeVisible()
        expect(await configGuardada(page)).toMatchObject({ confirmarCobrosManualmente: true, cajaMpQrId: CAJA_SALIDA.id })
    })

    test('Mercado Pago sin conexión no anota el pedido: avisa y deja cobrar de otra forma', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR })
        const hoja = await abrirPedidoMovil(page)
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await page.context().setOffline(true)
        await page.evaluate(() => window.dispatchEvent(new Event('offline')))
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        const cobro = dialogoMp(page)
        await expect(cobro.getByRole('alert')).toContainText('Sin conexión')
        expect(api.creaciones).toEqual([])
        await cobro.getByRole('button', { name: 'Cancelar', exact: true }).click()
        await expect(cobro).toHaveCount(0)
        // El pedido sigue cargado para elegir otro método.
        await expect(hoja.getByText('1 ítem')).toBeVisible()
        await page.context().setOffline(false)
    })

    test('Mercado Pago: si se recarga la pantalla a mitad del cobro se retoma el mismo cobro, sin duplicar el pedido', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR })
        const hoja = await abrirPedidoMovil(page)
        await hoja.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await hoja.getByRole('button', { name: 'Cobrar', exact: true }).click()
        await expect(dialogoMp(page).getByText('Esperando el pago…')).toBeVisible({ timeout: 15_000 })
        expect(api.creaciones).toHaveLength(1)

        await page.reload()
        // El pedido impago ya existía: la pantalla vuelve a abrirse sola y sigue esperando ese cobro.
        const cobro = dialogoMp(page)
        await expect(cobro.getByText('Esperando el pago…')).toBeVisible({ timeout: 20_000 })
        expect(api.creaciones).toHaveLength(1)
        expect(api.iniciosCobro).toHaveLength(1)

        api.cobro = { ...api.cobro!, estado: 'pagado', mpStatus: 'processed', pagadoAt: new Date().toISOString() }
        await cobro.getByRole('button', { name: 'Verificar ahora' }).click()
        await expect(cobro.getByText('¡Pago recibido!')).toBeVisible()
        await expect(cobro).toHaveCount(0, { timeout: 8_000 })
        await expect(page.getByRole('button', { name: /^Pedido vacío/ })).toBeVisible()
        expect(api.creaciones).toHaveLength(1)
    })
})

test.describe('escritorio', () => {
    test.use({ hasTouch: false, viewport: ESCRITORIO })

    test('la comanda dice "Cobrar" y Mercado Pago sigue el mismo circuito de pago verificado por el servidor', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR })
        const buscador = page.getByPlaceholder('Buscar producto o tag...')
        await buscador.fill('coca')
        await buscador.press('Enter')
        await expect(page.getByText('Comanda · 1 ítems')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Anotar pedido', exact: true })).toBeVisible()

        await page.getByRole('button', { name: 'Mercado Pago', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Anotar pedido', exact: true })).toHaveCount(0)
        await page.getByRole('button', { name: 'Cobrar', exact: true }).click()
        const cobro = dialogoMp(page)
        await expect(cobro.getByText('Esperando el pago…')).toBeVisible({ timeout: 15_000 })
        expect(api.creaciones[0]).toMatchObject({ pagado: false, metodoPago: 'mercadopago' })
        expect(api.iniciosCobro).toEqual([{ pedidoId: PEDIDO_ID, cajaId: CAJA_BARRA.id }])

        api.cobro = { ...api.cobro!, estado: 'pagado', mpStatus: 'processed', pagadoAt: new Date().toISOString() }
        await cobro.getByRole('button', { name: 'Verificar ahora' }).click()
        await expect(cobro.getByText('¡Pago recibido!')).toBeVisible()
        await expect(cobro).toHaveCount(0, { timeout: 8_000 })
        await expect(page.getByText('Comanda en blanco').or(page.getByText('Comanda · 0 ítems'))).toBeVisible()
    })

    test('efectivo: anota directamente el pedido cobrado y el pedido nuevo arranca vacío', async ({ page }) => {
        const api = await abrirPos(page, { config: CONFIRMAR })
        const buscador = page.getByPlaceholder('Buscar producto o tag...')
        await buscador.fill('empanada')
        await buscador.press('Enter')
        await expect(page.getByRole('button', { name: 'Cobrar', exact: true })).toHaveCount(0)
        await page.getByRole('button', { name: 'Anotar pedido', exact: true }).click()
        await expect.poll(() => api.creaciones.length).toBe(1)
        expect(api.creaciones[0]).toMatchObject({ pagado: true, metodoPago: 'cash' })
        await expect(dialogoManual(page)).toHaveCount(0)
        expect(api.iniciosCobro).toEqual([])
        await expect(page.getByText('Comanda en blanco').or(page.getByText('Comanda · 0 ítems'))).toBeVisible()
    })
})
