/**
 * Cobro del POS: tipos del contrato con `/api/pos-qr` y las reglas puras que deciden cuándo se
 * pide confirmar un cobro, cómo se cobra cada método y qué caja de Mercado Pago se usa.
 *
 * Vive en un `.ts` (y no en un `.tsx`) para que los componentes sólo exporten componentes.
 */
import type { PosConfig } from './posConfig'

export type EstadoCobroQr = 'creando' | 'creado' | 'pagado' | 'cancelado' | 'vencido' | 'reembolsado' | 'error'

export interface CajaQrDto {
    id: number
    nombre: string
    externalPosId: string
    qrUrl: string | null
    plantillaUrl: string | null
}

export interface CobroQrDto {
    id: number
    pedidoId: number
    cajaId: number
    cajaNombre: string | null
    qrUrl: string | null
    /** Importe con dos decimales, tal como se le cobra al cliente ("1500.00"). */
    monto: string
    estado: EstadoCobroQr
    mpStatus: string | null
    mensaje: string | null
    /** ISO 8601; `null` mientras la orden todavía no se creó en Mercado Pago. */
    expiraAt: string | null
    pagadoAt: string | null
}

export interface EstadoPosQrDto {
    moduloMercadoPago: boolean
    mpConectado: boolean
    cajas: CajaQrDto[]
}

export interface CajaMpDto {
    mpPosId: string
    nombre: string
    externalId: string | null
    storeId: string | null
    qrUrl: string | null
    vinculada: boolean
}

export interface TiendaMpDto {
    id: string
    nombre: string
    direccion: string | null
}

export interface ResultadoCancelacionQrDto {
    cobro: CobroQrDto | null
    /** El pedido impago quedó cancelado por esta llamada. */
    pedidoCancelado: boolean
}

/** Cada cuánto consulta el POS el estado del cobro mientras espera al cliente. */
export const INTERVALO_CONSULTA_COBRO_MS = 2_500
/** Cuánto se ve "Pago recibido" antes de cerrar la pantalla de cobro. */
export const ESPERA_CIERRE_COBRO_PAGADO_MS = 1_600

/** Único método que se verifica solo con Mercado Pago cuando se confirman los cobros. */
export const METODO_COBRO_QR = 'mercadopago'

export type ModoCobro = 'manual' | 'qr'

/**
 * ¿Este alta pasa por la pantalla de cobro? Sólo los pedidos nuevos de delivery/takeaway: al editar
 * un pedido se conserva su estado de pago, y las mesas se guardan solas y se cobran al cerrarlas.
 */
export function requiereConfirmarCobro(entrada: {
    config: Pick<PosConfig, 'confirmarCobrosManualmente'>
    modoEdicion: boolean
    tipo: 'delivery' | 'takeaway' | 'mesa'
    conMesa: boolean
}): boolean {
    return entrada.config.confirmarCobrosManualmente
        && !entrada.modoEdicion
        && !entrada.conMesa
        && entrada.tipo !== 'mesa'
}

/** Mercado Pago se verifica solo (QR); efectivo, tarjeta y transferencia se confirman con "Cobrado". */
export const modoDeCobro = (metodoPago: string): ModoCobro => (metodoPago === METODO_COBRO_QR ? 'qr' : 'manual')

export type EleccionCaja =
    | { motivo: 'ok'; caja: CajaQrDto }
    | { motivo: 'sin_cajas'; caja: null }
    | { motivo: 'elegir'; caja: null }

/**
 * Caja con la que cobra este dispositivo: la que dejó elegida en la configuración; si no hay
 * ninguna elegida (o ya no existe) y hay una sola, esa; con varias, hay que elegir.
 */
export function cajaParaCobrar(cajas: CajaQrDto[], cajaElegidaId: number | null): EleccionCaja {
    const elegida = cajaElegidaId == null ? undefined : cajas.find((caja) => caja.id === cajaElegidaId)
    if (elegida) return { motivo: 'ok', caja: elegida }
    if (cajas.length === 0) return { motivo: 'sin_cajas', caja: null }
    if (cajas.length === 1) return { motivo: 'ok', caja: cajas[0] }
    return { motivo: 'elegir', caja: null }
}

export const cobroFinalizado = (estado: EstadoCobroQr): boolean => estado !== 'creando' && estado !== 'creado'

/** Segundos que faltan para que venza la orden; `null` si todavía no tiene vencimiento. Nunca negativo. */
export function segundosRestantes(expiraAt: string | null, ahoraMs: number): number | null {
    if (!expiraAt) return null
    const vence = Date.parse(expiraAt)
    if (!Number.isFinite(vence)) return null
    return Math.max(0, Math.ceil((vence - ahoraMs) / 1000))
}

export function formatoCuentaRegresiva(segundos: number): string {
    const s = Math.max(0, Math.floor(segundos))
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Texto para mostrarle al cajero cuando el cobro terminó sin pago. */
export function mensajeFalloCobro(cobro: Pick<CobroQrDto, 'estado' | 'mensaje'>): string {
    switch (cobro.estado) {
        case 'vencido': return 'El cobro venció sin que el cliente pagara.'
        case 'cancelado': return 'El cobro fue cancelado.'
        case 'reembolsado': return 'Mercado Pago reembolsó este cobro.'
        default: return cobro.mensaje || 'Mercado Pago no pudo procesar el cobro.'
    }
}

export const formatoMonto = (monto: number | string): string => {
    const n = typeof monto === 'number' ? monto : Number(monto)
    return `$${(Number.isFinite(n) ? n : 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
