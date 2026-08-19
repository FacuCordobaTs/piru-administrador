import { create } from 'zustand'
import { pedidoUnificadoApi, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type { PosDraft } from '@/components/PuntoDeVenta'

/**
 * Cola offline del POS (PuntoDeVenta).
 *
 * Cuando no hay conexión, los pedidos del POS se guardan en localStorage con
 * estado `pendiente` y se sincronizan solos contra el backend cuando vuelve el
 * internet (evento `online`, reintento periódico, o al guardar un pedido
 * mientras el navegador ya está conectado pero el servidor estaba caído).
 *
 * El estado vive en un store de módulo (singleton), compartido por todas las
 * instancias del POS (desktop y mobile), y la sincronización tiene un guard
 * de "una a la vez" para no duplicar pedidos si dos instancias disparan sync.
 */
export type PedidoPendienteEstado = 'pendiente' | 'error'

export interface PedidoPosPendiente {
    /** id local único (uuid). Nunca viaja al backend. */
    localId: string
    /** Número de comanda local: se imprime como "PEDIDO #LOCAL-{n}". */
    localNumero: number
    creadoEn: string
    tipo: 'delivery' | 'takeaway' | 'mesa'
    estado: PedidoPendienteEstado
    /** Motivo cuando la sincronización falló con un error real del servidor. */
    errorMessage?: string
    /** Snapshot del borrador en el momento del alta: alimenta el panel de
     *  pendientes y la reimpresión de la comanda sin depender del carrito. */
    draft: PosDraft
    /** Body exacto que se reenvía a pedidoUnificadoApi.create al sincronizar. */
    payload: Parameters<typeof pedidoUnificadoApi.create>[1]
}

const storageKey = (restauranteId: number) => `piru:pos-pendientes:${restauranteId}`
const contadorKey = (restauranteId: number) => `piru:pos-pendientes-contador:${restauranteId}`

const leerPersistidos = (restauranteId: number): PedidoPosPendiente[] => {
    try {
        const raw = localStorage.getItem(storageKey(restauranteId))
        if (!raw) return []
        const parsed = JSON.parse(raw) as unknown
        return Array.isArray(parsed) ? (parsed as PedidoPosPendiente[]) : []
    } catch {
        return []
    }
}

const guardarPersistidos = (restauranteId: number, pendientes: PedidoPosPendiente[]): void => {
    try {
        if (pendientes.length === 0) localStorage.removeItem(storageKey(restauranteId))
        else localStorage.setItem(storageKey(restauranteId), JSON.stringify(pendientes))
    } catch {
        // localStorage puede estar deshabilitado; la cola se pierde al recargar.
    }
}

interface PosOfflineState {
    restauranteId: number | null
    pendientes: PedidoPosPendiente[]
    sincronizando: boolean
    /** Carga la cola del restaurante que inició sesión (una sola por sesión). */
    initPendientes: (restauranteId: number) => void
    guardarPendiente: (pendiente: PedidoPosPendiente) => void
    eliminarPendiente: (localId: string) => void
    marcarError: (localId: string, errorMessage: string) => void
    setSincronizando: (sincronizando: boolean) => void
}

export const usePosOfflineStore = create<PosOfflineState>((set, get) => ({
    restauranteId: null,
    pendientes: [],
    sincronizando: false,
    initPendientes: (restauranteId) => {
        if (get().restauranteId === restauranteId) return
        set({ restauranteId, pendientes: leerPersistidos(restauranteId), sincronizando: false })
    },
    guardarPendiente: (pendiente) => {
        const { restauranteId, pendientes } = get()
        if (restauranteId == null) return
        const next = [...pendientes, pendiente]
        guardarPersistidos(restauranteId, next)
        set({ pendientes: next })
    },
    eliminarPendiente: (localId) => {
        const { restauranteId, pendientes } = get()
        if (restauranteId == null) return
        const next = pendientes.filter((p) => p.localId !== localId)
        guardarPersistidos(restauranteId, next)
        set({ pendientes: next })
    },
    marcarError: (localId, errorMessage) => {
        const { restauranteId, pendientes } = get()
        if (restauranteId == null) return
        const next = pendientes.map((p) =>
            p.localId === localId ? { ...p, estado: 'error' as const, errorMessage } : p
        )
        guardarPersistidos(restauranteId, next)
        set({ pendientes: next })
    },
    setSincronizando: (sincronizando) => set({ sincronizando }),
}))

/** Número correlativo de comanda local, único por restaurante (persiste). */
export const nextLocalNumero = (restauranteId: number): number => {
    let siguiente = 1
    try {
        siguiente = (parseInt(localStorage.getItem(contadorKey(restauranteId)) || '0', 10) || 0) + 1
    } catch {
        siguiente = 1
    }
    try {
        localStorage.setItem(contadorKey(restauranteId), String(siguiente))
    } catch {
        // noop
    }
    return siguiente
}

/**
 * Un error de conexión real (no una validación del servidor) es lo que activa
 * la cola offline: el fetch wrapper de la app tira ApiError con status 0
 * cuando no pudo contactar el servidor, o el navegador reporta estar offline.
 */
export const esErrorDeConexion = (error: unknown): boolean => {
    if (error instanceof ApiError && error.status === 0) return true
    return navegadorOffline()
}

/** El navegador reporta estar sin conexión (nunca es true si onLine es undefined). */
export const navegadorOffline = (): boolean =>
    typeof navigator !== 'undefined' && navigator.onLine === false

/**
 * Espejo de `deferComandaHastaPagado` de Dashboard.tsx: la comanda de métodos
 * de pago online (MP/Cucuru/Talo) se imprime recién cuando el pedido está
 * pagado. Se duplica acá para que la impresión offline del POS siga la misma
 * regla sin importar el Dashboard.
 */
export const deferComandaHastaPagado = (
    metodoPago: string | null | undefined,
    cucuruConfigurado: boolean | null | undefined
): boolean => {
    const m = String(metodoPago || '').trim()
    if (['transferencia_automatica_cucuru', 'transferencia_automatica_talo', 'mercadopago', 'mercadopago_checkout', 'mercadopago_bricks'].includes(m)) return true
    if (cucuruConfigurado && (m === 'transferencia' || m === '')) return true
    return false
}

// ── Sincronización ──
// Guard de "una sincronización a la vez" en el módulo: aunque haya dos
// instancias del POS montadas (desktop/mobile), el loop nunca corre en paralelo
// y siempre revalida contra el estado persistido actual antes de enviar.
let syncInFlight: Promise<boolean> | null = null

/** Se invoca con el id real del backend cuando un pedido pendiente se sincroniza. */
const syncListeners = new Set<(pedidoId: number) => void>()

export const registrarPedidoSincronizado = (fn: (pedidoId: number) => void): (() => void) => {
    syncListeners.add(fn)
    return () => { syncListeners.delete(fn) }
}

/**
 * Envía al backend todos los pedidos pendientes, en orden. Cada éxito elimina
 * el pendiente de la cola y avisa a los listeners (el POS refresca el listado
 * del Dashboard). Devuelve true si al menos un pedido se sincronizó (el POS lo
 * usa para apagar el chip "Sin conexión" cuando el servidor se recupera).
 *
 * Un error de conexión corta el loop (se reintenta después); un 401 (sesión
 * vencida) deja el pedido pendiente para reintentar tras volver a entrar; un
 * error real del servidor (p. ej. producto eliminado) marca el pendiente como
 * `error` para que el local lo vea en el panel y decida.
 */
export const sincronizarPendientes = (): Promise<boolean> => {
    if (syncInFlight) return syncInFlight
    syncInFlight = (async (): Promise<boolean> => {
        const store = usePosOfflineStore.getState()
        const restauranteId = store.restauranteId
        const token = useAuthStore.getState().token
        if (restauranteId == null || !token) return false
        if (navegadorOffline()) return false
        if (store.pendientes.length === 0) return false

        store.setSincronizando(true)
        let sincronizo = false
        try {
            const cola = store.pendientes.filter((p) => p.estado === 'pendiente')
            for (const pendiente of cola) {
                // Si el usuario cambió de restaurante o eliminó el pendiente
                // mientras corría la sincronización, no se procesa.
                const actual = usePosOfflineStore.getState().pendientes.find((p) => p.localId === pendiente.localId)
                if (usePosOfflineStore.getState().restauranteId !== restauranteId) return sincronizo
                if (!actual || actual.estado !== 'pendiente') continue

                try {
                    const res = await pedidoUnificadoApi.create(token, pendiente.payload) as { success?: boolean; data?: { id?: number }; message?: string }
                    if (!res?.success) {
                        usePosOfflineStore.getState().marcarError(pendiente.localId, res?.message || 'No se pudo sincronizar el pedido')
                        continue
                    }
                    sincronizo = true
                    const nuevoId = res.data?.id
                    if (nuevoId) {
                        // La comanda ya se imprimió localmente en modo offline:
                        // marcar el pedido como impreso en el backend para que el
                        // auto-print del Dashboard no lo imprima de nuevo.
                        try {
                            await pedidoUnificadoApi.claimImpreso(token, nuevoId)
                        } catch {
                            // best-effort: a lo sumo se imprime una comanda duplicada.
                        }
                        syncListeners.forEach((fn) => fn(nuevoId))
                    }
                    usePosOfflineStore.getState().eliminarPendiente(pendiente.localId)
                } catch (error) {
                    if (error instanceof ApiError && error.status === 401) continue // sesión vencida: reintenta tras re-login
                    if (esErrorDeConexion(error)) return sincronizo // sigue sin conexión: reintentar más tarde
                    usePosOfflineStore.getState().marcarError(
                        pendiente.localId,
                        error instanceof Error ? error.message : 'Error al sincronizar el pedido'
                    )
                }
            }
            return sincronizo
        } finally {
            usePosOfflineStore.getState().setSincronizando(false)
        }
    })().finally(() => {
        syncInFlight = null
    })
    return syncInFlight
}
