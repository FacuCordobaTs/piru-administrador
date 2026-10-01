import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, posQrApi } from '@/lib/api'
import {
    INTERVALO_CONSULTA_COBRO_MS,
    cajaParaCobrar,
    mensajeFalloCobro,
    type CajaQrDto,
    type CobroQrDto,
} from '@/lib/posCobro'

export type FaseCobroQr =
    | { fase: 'preparando' }
    | { fase: 'sin_caja'; cajas: CajaQrDto[]; motivo: 'sin_cajas' | 'elegir' }
    | { fase: 'esperando'; cobro: CobroQrDto }
    /** `cobro` es `null` si el pedido ya figuraba como pagado al pedir el cobro. */
    | { fase: 'pagado'; cobro: CobroQrDto | null }
    /** `configurar`: el motivo se resuelve en «Configurar punto de venta» (conectar Mercado Pago). */
    | { fase: 'fallido'; mensaje: string; reintentable: boolean; configurar?: boolean }

export interface OpcionesCobroQr {
    token: string
    online: boolean
    /** Caja que dejó elegida este dispositivo en la configuración del POS. */
    cajaElegidaId: number | null
    /** Anota el pedido impago (o devuelve el ya anotado) y su id; `null` si no se pudo. */
    crearPedido: () => Promise<number | null>
    /** Si se retoma un cobro (recarga de la pantalla), el pedido que ya se había anotado. */
    pedidoIdInicial: number | null
    /** Mercado Pago confirmó el pago: el pedido ya está cobrado en el servidor. */
    onPagado: (pedidoId: number) => void | Promise<void>
    onCajaElegida: (cajaId: number) => void
}

const CODIGOS_SIN_REINTENTO = new Set(['MODULO_MP_INACTIVO', 'MP_NO_CONECTADO', 'APP_QR_NO_CONFIGURADA', 'PEDIDO_NO_COBRABLE', 'MONTO_INVALIDO', 'PEDIDO_NO_ENCONTRADO'])
const CODIGOS_PARA_CONFIGURAR = new Set(['MP_NO_CONECTADO', 'CAJA_NO_ENCONTRADA'])

function mensajeDeError(error: unknown): string {
    if (error instanceof ApiError) {
        return error.status === 0 ? 'Sin conexión con el servidor. Revisá internet y reintentá.' : error.message
    }
    return error instanceof Error ? error.message : 'No se pudo completar el cobro'
}

const codigoDe = (error: unknown): string | null => (error instanceof ApiError ? error.response?.code ?? null : null)

const esReintentable = (error: unknown): boolean => {
    const codigo = codigoDe(error)
    return !(codigo && CODIGOS_SIN_REINTENTO.has(codigo))
}

/**
 * Cobro con el QR estático de Mercado Pago de un pedido del POS. Sólo orquesta: el monto y la
 * confirmación del pago los decide el servidor. La pantalla consulta cada pocos segundos y, si
 * se recarga, puede retomar el mismo cobro (`pedidoIdInicial`).
 */
export function useCobroQr(opciones: OpcionesCobroQr) {
    // Las opciones vigentes, para que los callbacks asíncronos no queden con valores viejos. Se declara
    // primero: el efecto que arranca el cobro corre después de haberlo actualizado.
    const actuales = useRef(opciones)
    useEffect(() => { actuales.current = opciones })

    const [estado, setEstado] = useState<FaseCobroQr>({ fase: 'preparando' })
    const [sinRed, setSinRed] = useState(false)
    const [cancelando, setCancelando] = useState(false)
    const [errorAlCancelar, setErrorAlCancelar] = useState<string | null>(null)
    // Reinicia la consulta periódica si se frenó por una cancelación que no prosperó.
    const [pulso, setPulso] = useState(0)

    const pedidoIdRef = useRef<number | null>(opciones.pedidoIdInicial)
    const cajaRef = useRef<number | null>(null)
    const vivo = useRef(true)
    // Cada corrida de `iniciar` se invalida cuando arranca otra o cuando se cancela.
    const generacion = useRef(0)
    const terminado = useRef(false)
    const pagadoNotificado = useRef(false)
    // Sólo se consume cuando la comprobación del cobro previo llegó a resolverse.
    const retomarPendiente = useRef(opciones.pedidoIdInicial != null)

    useEffect(() => {
        vivo.current = true
        return () => { vivo.current = false }
    }, [])

    const aplicarCobro = useCallback((cobro: CobroQrDto) => {
        if (cobro.estado === 'pagado') {
            terminado.current = true
            setEstado({ fase: 'pagado', cobro })
            if (!pagadoNotificado.current) {
                pagadoNotificado.current = true
                void actuales.current.onPagado(cobro.pedidoId)
            }
            return
        }
        if (cobro.estado === 'creando' || cobro.estado === 'creado') {
            setEstado({ fase: 'esperando', cobro })
            return
        }
        terminado.current = true
        setEstado({ fase: 'fallido', mensaje: mensajeFalloCobro(cobro), reintentable: true })
    }, [])

    const iniciar = useCallback(async (opcionesInicio: { reintento?: boolean } = {}) => {
        const mia = ++generacion.current
        const vigente = () => vivo.current && generacion.current === mia
        if (opcionesInicio.reintento) retomarPendiente.current = false
        terminado.current = false
        setSinRed(false)
        setErrorAlCancelar(null)
        setEstado({ fase: 'preparando' })
        const fallar = (mensaje: string, reintentable: boolean, configurar = false) => {
            if (vigente()) setEstado({ fase: 'fallido', mensaje, reintentable, ...(configurar ? { configurar: true } : {}) })
        }

        const { token, online } = actuales.current
        if (!online) {
            fallar('Sin conexión: Mercado Pago necesita internet para cobrar. Elegí otro método de pago.', true)
            return
        }

        try {
            const configuracion = (await posQrApi.estado(token)).data
            if (!vigente()) return
            if (!configuracion.moduloMercadoPago) return fallar('El módulo Mercado Pago no está activo en este local.', false)
            if (!configuracion.appConfigurada) return fallar('El cobro con QR todavía no está habilitado en Piru. Elegí otro método de pago.', false)
            if (!configuracion.mpConectado) return fallar('Falta conectar Mercado Pago para cobrar con QR. Se hace una vez en «Configurar punto de venta».', false, true)

            // Retomar tras una recarga: si el cobro anterior sigue vivo (o ya se pagó) se sigue con
            // ese; si terminó sin pago se muestra cómo terminó y el cajero decide qué hacer.
            if (retomarPendiente.current && pedidoIdRef.current != null) {
                const previo = (await posQrApi.consultar(token, pedidoIdRef.current)).data
                if (!vigente()) return
                retomarPendiente.current = false
                if (previo) return aplicarCobro(previo)
            }

            const eleccion = cajaParaCobrar(configuracion.cajas, cajaRef.current ?? actuales.current.cajaElegidaId)
            if (!eleccion.caja) {
                setEstado({ fase: 'sin_caja', cajas: configuracion.cajas, motivo: eleccion.motivo })
                return
            }
            cajaRef.current = eleccion.caja.id

            let pedidoId = pedidoIdRef.current
            if (pedidoId == null) {
                pedidoId = await actuales.current.crearPedido()
                if (!vigente()) {
                    // La pantalla se cerró mientras se anotaba el pedido: no dejar un impago huérfano.
                    if (pedidoId != null) void posQrApi.cancelar(token, pedidoId, true).catch(() => undefined)
                    return
                }
                if (pedidoId == null) return fallar('No se pudo anotar el pedido. Revisá la conexión y reintentá.', true)
                pedidoIdRef.current = pedidoId
            }

            const cobro = (await posQrApi.iniciarCobro(token, pedidoId, eleccion.caja.id)).data
            if (!vigente()) return
            aplicarCobro(cobro)
        } catch (error) {
            if (!vigente()) return
            const codigo = codigoDe(error)
            if (codigo === 'PEDIDO_YA_PAGADO' && pedidoIdRef.current != null) {
                terminado.current = true
                setEstado({ fase: 'pagado', cobro: null })
                if (!pagadoNotificado.current) {
                    pagadoNotificado.current = true
                    void actuales.current.onPagado(pedidoIdRef.current)
                }
                return
            }
            // La caja elegida ya no existe: en el próximo intento se vuelve a elegir.
            if (codigo === 'CAJA_NO_ENCONTRADA') cajaRef.current = null
            fallar(mensajeDeError(error), esReintentable(error), CODIGOS_PARA_CONFIGURAR.has(codigo ?? ''))
        }
    }, [aplicarCobro])

    useEffect(() => {
        void iniciar()
    // Se arranca una sola vez al montar la pantalla; los reintentos son explícitos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const consultarUnaVez = useCallback(async () => {
        const id = pedidoIdRef.current
        if (id == null || terminado.current) return
        try {
            const cobro = (await posQrApi.consultar(actuales.current.token, id)).data
            if (!vivo.current || terminado.current) return
            setSinRed(false)
            if (cobro) aplicarCobro(cobro)
            else {
                terminado.current = true
                setEstado({ fase: 'fallido', mensaje: 'No se encontró el cobro. Generalo de nuevo.', reintentable: true })
            }
        } catch {
            if (vivo.current) setSinRed(true)
        }
    }, [aplicarCobro])

    // Consulta periódica mientras se espera al cliente. Un corte de red sólo se avisa: el
    // servidor sigue confirmando por webhook y el próximo intento lo recoge.
    const esperando = estado.fase === 'esperando'
    useEffect(() => {
        if (!esperando) return
        let timer: ReturnType<typeof setTimeout> | undefined
        let activo = true
        const ciclo = async () => {
            await consultarUnaVez()
            if (activo && !terminado.current) timer = setTimeout(ciclo, INTERVALO_CONSULTA_COBRO_MS)
        }
        timer = setTimeout(ciclo, INTERVALO_CONSULTA_COBRO_MS)
        return () => {
            activo = false
            if (timer) clearTimeout(timer)
        }
    }, [esperando, consultarUnaVez, pulso])

    /** Cancela la orden en Mercado Pago y el pedido impago. Si el cliente alcanzó a pagar, gana el pago. */
    const cancelar = useCallback(async (): Promise<'cancelado' | 'pagado' | 'error'> => {
        setErrorAlCancelar(null)
        const id = pedidoIdRef.current
        generacion.current++
        terminado.current = true
        if (id == null) return 'cancelado'
        setCancelando(true)
        try {
            const { data } = await posQrApi.cancelar(actuales.current.token, id, true)
            if (data.cobro?.estado === 'pagado') {
                aplicarCobro(data.cobro)
                return 'pagado'
            }
            return 'cancelado'
        } catch (error) {
            // El cobro sigue vivo: se retoma la consulta y se avisa.
            terminado.current = false
            if (vivo.current) {
                setErrorAlCancelar(mensajeDeError(error))
                setPulso((valor) => valor + 1)
            }
            return 'error'
        } finally {
            if (vivo.current) setCancelando(false)
        }
    }, [aplicarCobro])

    const elegirCaja = useCallback((cajaId: number) => {
        cajaRef.current = cajaId
        actuales.current.onCajaElegida(cajaId)
        void iniciar()
    }, [iniciar])

    const reintentar = useCallback(() => { void iniciar({ reintento: true }) }, [iniciar])

    return {
        estado,
        sinRed,
        cancelando,
        errorAlCancelar,
        reintentar,
        elegirCaja,
        verificarAhora: consultarUnaVez,
        cancelar,
    }
}
