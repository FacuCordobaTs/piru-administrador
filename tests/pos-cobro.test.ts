import { beforeEach, describe, expect, test } from 'bun:test'

class StoragePrueba {
    values = new Map<string, string>()
    getItem(k: string) { return this.values.get(k) ?? null }
    setItem(k: string, v: string) { this.values.set(k, String(v)) }
    removeItem(k: string) { this.values.delete(k) }
    clear() { this.values.clear() }
}
const eventos: string[] = []
Object.defineProperty(globalThis, 'localStorage', { value: new StoragePrueba(), configurable: true })
Object.defineProperty(globalThis, 'window', {
    value: { dispatchEvent: (e: Event) => { eventos.push(e.type); return true }, addEventListener() {}, removeEventListener() {} },
    configurable: true,
})

const {
    METODO_COBRO_QR, cajaParaCobrar, cobroFinalizado, formatoCuentaRegresiva, formatoMonto, mensajeConexionQr, mensajeFalloCobro,
    requiereConfirmarCobro, segundosRestantes,
} = await import('../src/lib/posCobro')
const { DEFAULT_POS_CONFIG, POS_CONFIG_KEY, getPosConfig, setPosConfig } = await import('../src/lib/posConfig')

beforeEach(() => {
    localStorage.clear()
    eventos.length = 0
})

const cajas = [
    { id: 1, nombre: 'Barra', externalPosId: 'PIRU1A', qrUrl: 'https://mp/1.png', plantillaUrl: null },
    { id: 2, nombre: 'Salida', externalPosId: 'PIRU1B', qrUrl: null, plantillaUrl: null },
]

describe('configuración del POS', () => {
    test('los equipos sin la opción guardada arrancan como hasta ahora: cobros sin confirmar y sin caja', () => {
        expect(getPosConfig().confirmarCobrosManualmente).toBe(false)
        expect(getPosConfig().cajaMpQrId).toBeNull()
        expect(DEFAULT_POS_CONFIG.confirmarCobrosManualmente).toBe(false)
        // Una configuración vieja (sin los campos nuevos) se completa sin perder nada de lo guardado.
        localStorage.setItem(POS_CONFIG_KEY, JSON.stringify({ imprimirComandaDosVeces: true, metodosPago: { cash: false } }))
        const vieja = getPosConfig()
        expect(vieja).toMatchObject({ imprimirComandaDosVeces: true, confirmarCobrosManualmente: false, cajaMpQrId: null })
        expect(vieja.metodosPago.cash).toBe(false)
        expect(vieja.metodosPago.mercadopago).toBe(true)
    })

    test('guarda y recupera la confirmación de cobros y la caja de este dispositivo', () => {
        setPosConfig({ ...DEFAULT_POS_CONFIG, confirmarCobrosManualmente: true, cajaMpQrId: 12 })
        expect(getPosConfig()).toMatchObject({ confirmarCobrosManualmente: true, cajaMpQrId: 12 })
        expect(eventos).toEqual(['piru:pos-config-changed'])
    })

    test('sólo un true explícito activa la confirmación y sólo un entero positivo es una caja', () => {
        for (const valor of ['true', 1, 'si', null, {}]) {
            localStorage.setItem(POS_CONFIG_KEY, JSON.stringify({ confirmarCobrosManualmente: valor }))
            expect(getPosConfig().confirmarCobrosManualmente).toBe(false)
        }
        for (const valor of [0, -3, 1.5, '7', null, 'x', {}]) {
            localStorage.setItem(POS_CONFIG_KEY, JSON.stringify({ cajaMpQrId: valor }))
            expect(getPosConfig().cajaMpQrId).toBeNull()
        }
        localStorage.setItem(POS_CONFIG_KEY, JSON.stringify({ confirmarCobrosManualmente: true, cajaMpQrId: 7 }))
        expect(getPosConfig()).toMatchObject({ confirmarCobrosManualmente: true, cajaMpQrId: 7 })
    })

    test('un JSON roto cae a los valores por defecto', () => {
        localStorage.setItem(POS_CONFIG_KEY, '{no es json')
        expect(getPosConfig()).toEqual(DEFAULT_POS_CONFIG)
    })
})

describe('cuándo se pide confirmar el cobro', () => {
    const activo = { confirmarCobrosManualmente: true }
    const nuevo = { modoEdicion: false, conMesa: false, metodoPago: METODO_COBRO_QR }

    test('con la opción apagada nada cambia', () => {
        expect(requiereConfirmarCobro({ config: { confirmarCobrosManualmente: false }, ...nuevo, tipo: 'takeaway' })).toBe(false)
    })

    test('un pedido nuevo con Mercado Pago de delivery o takeaway pasa por el cobro', () => {
        expect(requiereConfirmarCobro({ config: activo, ...nuevo, tipo: 'takeaway' })).toBe(true)
        expect(requiereConfirmarCobro({ config: activo, ...nuevo, tipo: 'delivery' })).toBe(true)
    })

    test('efectivo, tarjeta y transferencia se anotan directamente con la opción encendida', () => {
        for (const metodoPago of ['cash', 'tarjeta', 'manual_transfer', '', 'otro']) {
            for (const tipo of ['delivery', 'takeaway'] as const) {
                expect(requiereConfirmarCobro({ config: activo, ...nuevo, metodoPago, tipo })).toBe(false)
            }
        }
    })

    test('editar un pedido conserva su estado de pago y las mesas se cobran al cerrarlas', () => {
        expect(requiereConfirmarCobro({ config: activo, ...nuevo, modoEdicion: true, tipo: 'takeaway' })).toBe(false)
        expect(requiereConfirmarCobro({ config: activo, ...nuevo, conMesa: true, tipo: 'mesa' })).toBe(false)
        expect(requiereConfirmarCobro({ config: activo, ...nuevo, tipo: 'mesa' })).toBe(false)
        expect(requiereConfirmarCobro({ config: activo, ...nuevo, conMesa: true, tipo: 'takeaway' })).toBe(false)
    })
})

describe('caja con la que se cobra', () => {
    test('usa la elegida en la configuración de este dispositivo', () => {
        expect(cajaParaCobrar(cajas, 2)).toEqual({ motivo: 'ok', caja: cajas[1] })
    })

    test('con una sola caja no hace falta elegir, aunque la guardada ya no exista', () => {
        expect(cajaParaCobrar([cajas[0]], null)).toEqual({ motivo: 'ok', caja: cajas[0] })
        expect(cajaParaCobrar([cajas[0]], 99)).toEqual({ motivo: 'ok', caja: cajas[0] })
    })

    test('con varias y ninguna válida hay que elegir; sin cajas hay que configurar', () => {
        expect(cajaParaCobrar(cajas, null)).toEqual({ motivo: 'elegir', caja: null })
        expect(cajaParaCobrar(cajas, 99)).toEqual({ motivo: 'elegir', caja: null })
        expect(cajaParaCobrar([], null)).toEqual({ motivo: 'sin_cajas', caja: null })
        expect(cajaParaCobrar([], 3)).toEqual({ motivo: 'sin_cajas', caja: null })
    })
})

describe('estado y textos del cobro', () => {
    test('pendiente vs terminado', () => {
        expect(cobroFinalizado('creando')).toBe(false)
        expect(cobroFinalizado('creado')).toBe(false)
        for (const estado of ['pagado', 'cancelado', 'vencido', 'reembolsado', 'error'] as const) expect(cobroFinalizado(estado)).toBe(true)
    })

    test('cuenta regresiva: nunca negativa y tolerante a fechas inválidas', () => {
        const vence = '2026-09-29T15:10:00.000Z'
        const ahora = Date.parse('2026-09-29T15:00:00.000Z')
        expect(segundosRestantes(vence, ahora)).toBe(600)
        expect(segundosRestantes(vence, ahora + 599_500)).toBe(1)
        expect(segundosRestantes(vence, ahora + 700_000)).toBe(0)
        expect(segundosRestantes(null, ahora)).toBeNull()
        expect(segundosRestantes('no-es-fecha', ahora)).toBeNull()
        expect(formatoCuentaRegresiva(600)).toBe('10:00')
        expect(formatoCuentaRegresiva(65)).toBe('01:05')
        expect(formatoCuentaRegresiva(-4)).toBe('00:00')
    })

    test('mensajes para el cajero según cómo terminó', () => {
        expect(mensajeFalloCobro({ estado: 'vencido', mensaje: null })).toContain('venció')
        expect(mensajeFalloCobro({ estado: 'cancelado', mensaje: null })).toContain('cancelado')
        expect(mensajeFalloCobro({ estado: 'reembolsado', mensaje: null })).toContain('reembolsó')
        expect(mensajeFalloCobro({ estado: 'error', mensaje: 'Mercado Pago acreditó menos que el total del pedido' })).toBe('Mercado Pago acreditó menos que el total del pedido')
        expect(mensajeFalloCobro({ estado: 'error', mensaje: null })).toContain('no pudo procesar')
    })

    test('el motivo con el que vuelve la autorización de Mercado Pago se explica en castellano', () => {
        expect(mensajeConexionQr('denegado')).toContain('No autorizaste')
        expect(mensajeConexionQr('estado_invalido')).toContain('venció')
        expect(mensajeConexionQr('faltan_parametros')).toBe(mensajeConexionQr('estado_invalido'))
        expect(mensajeConexionQr('sin_configurar')).toContain('todavía no está habilitado')
        expect(mensajeConexionQr('modulo')).toContain('módulo Mercado Pago')
        expect(mensajeConexionQr('oauth_fallido')).toContain('rechazó')
        expect(mensajeConexionQr('cuenta_invalida')).toContain('datos de tu cuenta')
        // Lo que no se reconoce (o falta) no filtra códigos internos: cae en un mensaje genérico.
        for (const raro of ['servidor', 'algo_nuevo', '', null]) expect(mensajeConexionQr(raro)).toContain('problema de nuestro lado')
    })

    test('formato de importes en pesos argentinos', () => {
        expect(formatoMonto(1500)).toBe('$1.500')
        expect(formatoMonto('1500.50')).toBe('$1.500,5')
        expect(formatoMonto('2340.25')).toBe('$2.340,25')
        expect(formatoMonto('basura')).toBe('$0')
    })
})
