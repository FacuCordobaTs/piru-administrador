import { create } from 'zustand'
import { clientesApi } from './api'
import { useAuthStore } from '@/store/authStore'
import { filaClienteLocal, leerParticion, purgarDirectorioPos, reemplazarDirectorio, validarIndice, type ClienteLocal } from './posLocalDb'

export const useDirectorioPos = create<{ restauranteId: number | null; clientes: ClienteLocal[] }>(() => ({ restauranteId: null, clientes: [] }))
let generacion = 0
let revision = 0
const vuelos = new Map<number, Promise<void>>()
const descargas = new Map<number, Promise<void>>()
const vigente = (id: number, gen: number) => generacion === gen && useAuthStore.getState().restaurante?.id === id && !!useAuthStore.getState().token
useAuthStore.subscribe((state, previo) => {
    if (state.restaurante?.id !== previo.restaurante?.id || state.token !== previo.token) {
        generacion++; revision++
        useDirectorioPos.setState({ restauranteId: null, clientes: [] })
    }
})
/** Sólo lectura local: montar el POS nunca descarga ni persiste clientes. */
export function cargarDirectorioPos(id: number): Promise<void> {
    if (vuelos.has(id)) return vuelos.get(id)!
    const gen = generacion, token = useAuthStore.getState().token
    if (!token || !vigente(id, gen)) return Promise.resolve()
    const vuelo = (async () => {
        try {
            const clientes = await leerParticion<ClienteLocal>('clientes', id)
            if (vigente(id, gen)) {
                const state = useDirectorioPos.getState()
                const actuales = state.restauranteId === id ? state.clientes : []
                const combinados = new Map(clientes.map(c => [c.id, c]))
                actuales.forEach(c => combinados.set(c.id, c))
                useDirectorioPos.setState({ restauranteId: id, clientes: [...combinados.values()] })
            }
        } catch { /* Directorio opcional; un fallo de caché no bloquea caja. */ }
    })().finally(() => { vuelos.delete(id) })
    vuelos.set(id, vuelo)
    return vuelo
}

/** Descarga explícita desde la configuración; los errores llegan al botón. */
export function descargarDirectorioPos(id: number): Promise<void> {
    if (descargas.has(id)) return descargas.get(id)!
    const gen = generacion, token = useAuthStore.getState().token
    const comprobarSesion = () => {
        if (!token || !vigente(id, gen)) throw new Error('La sesión cambió. Volvé a abrir la configuración del POS.')
    }
    const vuelo = (async () => {
        comprobarSesion()
        if (navigator.onLine === false) throw new Error('Conectate a internet para descargar los clientes.')
        await cargarDirectorioPos(id)
        comprobarSesion()
        const rev = revision
        const res = await clientesApi.indicePos(token!)
        comprobarSesion()
        if (!res.success || !validarIndice(res.data)) throw new Error('No se recibió un directorio completo. Intentá nuevamente.')
        if (rev !== revision) throw new Error('Los clientes cambiaron durante la descarga. Intentá nuevamente.')
        await reemplazarDirectorio(id, res.data)
        if (!vigente(id, gen)) { await purgarDirectorioPos(id); comprobarSesion() }
        // Conservar en memoria las altas que terminaron durante la escritura local.
        const clientes = res.data.map(c => filaClienteLocal(id, c))
        if (rev !== revision) {
            const combinados = new Map(clientes.map(c => [c.id, c]))
            useDirectorioPos.getState().clientes.forEach(c => combinados.set(c.id, c))
            useDirectorioPos.setState({ restauranteId: id, clientes: [...combinados.values()] })
        } else useDirectorioPos.setState({ restauranteId: id, clientes })
    })().finally(() => { descargas.delete(id) })
    descargas.set(id, vuelo)
    return vuelo
}
export async function aplicarClienteRespuesta(id: number, res: unknown) {
    const r = res as { clienteIndice?: unknown; data?: { clienteIndice?: unknown } }
    const cliente = r?.clienteIndice ?? r?.data?.clienteIndice
    if (!validarIndice([cliente])) return
    const gen = generacion
    if (!vigente(id, gen)) return
    revision++
    const fila = filaClienteLocal(id, cliente as Parameters<typeof filaClienteLocal>[1])
    // La copia durable sólo se actualiza al pulsar el botón de descarga.
    const state = useDirectorioPos.getState()
    useDirectorioPos.setState({ restauranteId: id, clientes: [...(state.restauranteId === id ? state.clientes.filter(x => x.id !== fila.id) : []), fila] })
}
