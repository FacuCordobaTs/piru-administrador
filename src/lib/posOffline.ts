import { create } from 'zustand'
import { pedidoUnificadoApi, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type { PosDraft } from '@/components/PuntoDeVenta'
import { borrarRegistro, guardarRegistro, leerParticion, leerMeta, transaccionPos } from './posLocalDb'
import { aplicarClienteRespuesta } from './directorioClientesPos'

export type PedidoPendienteEstado = 'pendiente' | 'sincronizando' | 'error_bloqueante'
export interface PedidoPosPendiente {
    restauranteId: number
    localId: string; localNumero: number; creadoEn: string
    tipo: 'delivery' | 'takeaway' | 'mesa'; estado: PedidoPendienteEstado
    errorMessage?: string; errorCodigo?: number; leaseHasta?: number
    draftKey?: string
    impresion?: 'sin_imprimir' | 'iniciada' | 'impresa' | 'revisar'
    draft: PosDraft
    payload: Parameters<typeof pedidoUnificadoApi.create>[1]
}
type FilaPendiente = PedidoPosPendiente & { restauranteId: number }
const storageKey = (id: number) => `piru:pos-pendientes:${id}`
const contadorKey = (id: number) => `piru:pos-pendientes-contador:${id}`
export const nuevoRequestId = () => crypto.randomUUID()

export async function migrarColaLegacy(restauranteId: number) {
    if ((await leerMeta(restauranteId, 'migracionLegacy'))?.valor) {
        try { localStorage.removeItem(storageKey(restauranteId)); localStorage.removeItem(contadorKey(restauranteId)) } catch { /* Ya está confirmada en IDB. */ }
        return
    }
    // Un JSON corrupto detiene la migración: nunca sustituirlo por una cola vacía.
    const raw = localStorage.getItem(storageKey(restauranteId))
    const legacy = raw ? JSON.parse(raw) : []
    if (!Array.isArray(legacy) || legacy.some(p => !p || typeof p.localId !== 'string' || !p.payload || !p.draft || !Number.isFinite(p.localNumero))) {
        throw new Error('La cola anterior necesita recuperación; sus datos se conservaron')
    }
    const contador = Number(localStorage.getItem(contadorKey(restauranteId))) || 0
    await transaccionPos<void>(['pedidosPendientes', 'meta'], 'readwrite', tx => {
        const meta = tx.objectStore('meta'), marca = meta.get([restauranteId, 'migracionLegacy'])
        marca.onsuccess = () => {
            if (marca.result) return
            const store = tx.objectStore('pedidosPendientes')
            for (const p of legacy) {
                const req = store.get([restauranteId, p.localId])
                req.onsuccess = () => {
                    if (!req.result) store.put({ ...p, restauranteId,
                        estado: p.estado === 'error' ? 'error_bloqueante' : 'pendiente',
                        // Legacy intentaba imprimir pero no persistía el resultado.
                        impresion: 'revisar', payload: { ...p.payload, clientRequestId: p.payload.clientRequestId ?? nuevoRequestId(), impresoOffline: true },
                    })
                }
            }
            const count = meta.get([restauranteId, 'contador'])
            count.onsuccess = () => meta.put({ restauranteId, clave: 'contador', valor: Math.max(count.result?.valor ?? 0, contador, ...legacy.map(p => p.localNumero)) })
            meta.put({ restauranteId, clave: 'migracionLegacy', valor: true })
        }
    })
    // Sólo después del commit; la marca hace seguro reintentar la limpieza.
    localStorage.removeItem(storageKey(restauranteId))
    localStorage.removeItem(contadorKey(restauranteId))
}
export const nextLocalNumero = (restauranteId: number) => transaccionPos<number>(['meta'], 'readwrite', (tx, done) => {
    const store = tx.objectStore('meta'), req = store.get([restauranteId, 'contador'])
    req.onsuccess = () => { const valor = (req.result?.valor ?? 0) + 1; store.put({ restauranteId, clave: 'contador', valor }); done(valor) }
})
interface PosOfflineState {
    restauranteId: number | null; pendientes: PedidoPosPendiente[]; sincronizando: boolean
    initPendientes: (id: number) => Promise<void>
    guardarPendiente: (p: PedidoPosPendiente) => Promise<void>
    eliminarPendiente: (id: string) => Promise<void>
    marcarError: (id: string, message: string) => Promise<void>
    setSincronizando: (v: boolean) => void
}
const mismoTenant = (id: number) => useAuthStore.getState().restaurante?.id === id && !!useAuthStore.getState().token
async function refrescar(id: number) {
    const pendientes = await leerParticion<FilaPendiente>('pedidosPendientes', id)
    if (mismoTenant(id) && usePosOfflineStore.getState().restauranteId === id) {
        usePosOfflineStore.setState({ pendientes: pendientes.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn) || a.localNumero - b.localNumero) })
    }
}
export const usePosOfflineStore = create<PosOfflineState>((set, get) => ({
    restauranteId: null, pendientes: [], sincronizando: false,
    initPendientes: async id => {
        if (!mismoTenant(id)) return
        if (get().restauranteId !== id) set({ restauranteId: id, pendientes: [], sincronizando: false })
        await migrarColaLegacy(id)
        await refrescar(id)
    },
    guardarPendiente: async p => {
        const id = get().restauranteId
        if (id == null || p.restauranteId !== id || !mismoTenant(id)) throw new Error('Sesión POS no disponible')
        if (!p.payload.clientRequestId) throw new Error('Falta la clave de reintento del pedido')
        await transaccionPos<void>(['pedidosPendientes', 'meta'], 'readwrite', tx => {
            tx.objectStore('pedidosPendientes').put({ ...p, restauranteId: id })
            if (p.draftKey) tx.objectStore('meta').put({ restauranteId: id, clave: `borradorEncolado:${p.payload.clientRequestId}`, valor: true })
        })
        await refrescar(id)
    },
    eliminarPendiente: async localId => {
        const id = get().restauranteId
        if (id == null || !mismoTenant(id)) return
        await transaccionPos<void>(['pedidosPendientes'], 'readwrite', tx => {
            const store = tx.objectStore('pedidosPendientes'), req = store.get([id, localId])
            req.onsuccess = () => {
                if ((req.result?.leaseHasta ?? 0) > Date.now()) { tx.abort(); return }
                store.delete([id, localId])
            }
        })
        await refrescar(id)
    },
    marcarError: async (localId, errorMessage) => {
        const p = get().pendientes.find(x => x.localId === localId)
        if (p) await get().guardarPendiente({ ...p, estado: 'error_bloqueante', errorMessage })
    },
    setSincronizando: sincronizando => set({ sincronizando }),
}))
useAuthStore.subscribe((state, anterior) => {
    if (state.restaurante?.id !== anterior.restaurante?.id || !state.token) {
        usePosOfflineStore.setState({ restauranteId: null, pendientes: [], sincronizando: false })
    }
})
export const esErrorDeConexion = (error: unknown) => error instanceof ApiError && (error.status === 0 || error.status >= 500 || error.status === 408 || error.status === 429)
export const navegadorOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false
export const deferComandaHastaPagado = (metodoPago: string | null | undefined, cucuruConfigurado: boolean | null | undefined) => {
    const m = String(metodoPago || '').trim()
    return ['transferencia_automatica_cucuru', 'transferencia_automatica_talo', 'mercadopago', 'mercadopago_checkout', 'mercadopago_bricks'].includes(m)
        || !!cucuruConfigurado && (m === 'transferencia' || m === '')
}
// Claim transaccional entre pestañas. Un proceso interrumpido se recupera a los 2 min.
export async function reclamarPendiente(id: number, localId: string, permitirBloqueado = false) {
    return transaccionPos<FilaPendiente | null>(['pedidosPendientes'], 'readwrite', (tx, done) => {
        const store = tx.objectStore('pedidosPendientes'), req = store.get([id, localId])
        req.onsuccess = () => {
            const p = req.result as FilaPendiente | undefined
            if (!p || (!permitirBloqueado && p.estado === 'error_bloqueante') || (p.leaseHasta ?? 0) > Date.now()) { done(null); return }
            const claimed = { ...p, estado: 'sincronizando' as const, leaseHasta: Date.now() + 120_000 }
            store.put(claimed); done(claimed)
        }
    })
}
let syncInFlight: Promise<boolean> | null = null
const listeners = new Set<(id: number) => void>()
export const registrarPedidoSincronizado = (fn: (id: number) => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const sincronizarPendientes = (): Promise<boolean> => {
    if (syncInFlight) return syncInFlight
    syncInFlight = (async () => {
        const id = usePosOfflineStore.getState().restauranteId, token = useAuthStore.getState().token
        if (id == null || !token || !mismoTenant(id) || navegadorOffline()) return false
        usePosOfflineStore.setState({ sincronizando: true })
        let sincronizo = false
        try {
            await refrescar(id)
            const cola = usePosOfflineStore.getState().pendientes
            console.info('[pos_cola]', { cantidad: cola.length, edadMs: cola.length ? Date.now() - Date.parse(cola[0].creadoEn) : 0 })
            for (const p of cola) {
                if (!mismoTenant(id) || useAuthStore.getState().token !== token) break
                const pendiente = await reclamarPendiente(id, p.localId)
                if (!pendiente) { if (p.estado !== 'error_bloqueante') break; continue }
                if (!mismoTenant(id) || useAuthStore.getState().token !== token) {
                    await guardarRegistro('pedidosPendientes', { ...pendiente, estado: 'pendiente', leaseHasta: 0 })
                    break
                }
                try {
                    const res = await pedidoUnificadoApi.create(token, pendiente.payload) as { success?: boolean; data?: { id?: number }; clienteIndice?: unknown }
                    if (!res?.success || !Number.isSafeInteger(res.data?.id)) throw new ApiError('Respuesta incompleta: se reintentará con la misma clave', 0)
                    await borrarRegistro('pedidosPendientes', id, pendiente.localId)
                    sincronizo = true
                    if (mismoTenant(id) && useAuthStore.getState().token === token) {
                        await aplicarClienteRespuesta(id, res)
                        listeners.forEach(fn => { try { fn(res.data!.id!) } catch { /* fallo de UI no reencola ventas */ } })
                    }
                } catch (error) {
                    const codigo = error instanceof ApiError ? error.status : 0
                    const transitorio = codigo === 0 || codigo === 401 || codigo === 408 || codigo === 429 || codigo >= 500
                    await guardarRegistro('pedidosPendientes', { ...pendiente, leaseHasta: 0,
                        estado: transitorio ? 'pendiente' : 'error_bloqueante', errorCodigo: codigo,
                        errorMessage: transitorio ? undefined : error instanceof Error ? error.message : 'Error de validación',
                    })
                    console.info('[pos_sync_error]', { codigo })
                    if (transitorio) break
                }
            }
        } finally {
            await refrescar(id)
            if (mismoTenant(id)) usePosOfflineStore.setState({ sincronizando: false })
        }
        return sincronizo
    })().finally(() => { syncInFlight = null })
    return syncInFlight
}
