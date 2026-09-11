import { categoriasApi, modulosApi, restauranteApi, sucursalesApi, suscripcionApi } from './api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useModulosStore } from '@/store/modulosStore'
import {
    guardarModulosLocal,
    leerCatalogoLocal,
    leerModulosLocal,
    reemplazarCatalogoLocal,
} from './posLocalDb'

let descargasEnVuelo = new Map<number, Promise<{ productosCount: number; categoriasCount: number; syncedAt: string }>>()

/**
 * Hidrata inmediatamente los stores en memoria (Restaurante y Módulos)
 * con los datos locales guardados en IndexedDB.
 * Permite que la aplicación muestre y opere el catálogo sin esperar a la red
 * o incluso si se inicia completamente sin internet.
 */
export async function hidratarCatalogoLocal(restauranteId: number): Promise<boolean> {
    try {
        const [catalogo, modulos] = await Promise.all([
            leerCatalogoLocal(restauranteId),
            leerModulosLocal(restauranteId),
        ])

        const tieneDatos = (catalogo.productos && catalogo.productos.length > 0) || !!catalogo.restaurante

        if (tieneDatos) {
            const restauranteState = useRestauranteStore.getState()
            // Solo hidratar si el store en memoria está vacío o aún no tiene productos
            if (restauranteState.productos.length === 0 || !restauranteState.restaurante) {
                useRestauranteStore.setState({
                    restaurante: catalogo.restaurante || (useAuthStore.getState().restaurante as any),
                    suscripcion: catalogo.suscripcion || null,
                    productos: catalogo.productos || [],
                    categorias: catalogo.categorias || [],
                    mesas: catalogo.mesas || [],
                    error: null,
                    isLoading: false,
                })
            }
        }

        if (modulos.modulos && modulos.modulos.length > 0) {
            const modulosState = useModulosStore.getState()
            if (modulosState.categorias.length === 0) {
                useModulosStore.setState({
                    categorias: modulos.modulos,
                    suscripcion: modulos.suscripcion || null,
                    cargando: false,
                    error: null,
                    actualizadoEn: Date.now(),
                    tokenActual: useAuthStore.getState().token,
                })
            }
        }

        return tieneDatos
    } catch (e) {
        console.warn('[catalogoLocalPos] Error hidratando catálogo local:', e)
        return false
    }
}

/**
 * Descarga explícita o programada del catálogo completo y dependencias del restaurante
 * para su almacenamiento duradero en IndexedDB.
 */
export function descargarCatalogoPos(restauranteId: number): Promise<{ productosCount: number; categoriasCount: number; syncedAt: string }> {
    if (descargasEnVuelo.has(restauranteId)) {
        return descargasEnVuelo.get(restauranteId)!
    }

    const token = useAuthStore.getState().token
    if (!token || useAuthStore.getState().restaurante?.id !== restauranteId) {
        return Promise.reject(new Error('Sesión no disponible'))
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return Promise.reject(new Error('Conectate a internet para descargar el catálogo.'))
    }

    const promesa = (async () => {
        // 1. Obtener perfil completo (productos, mesas, suscripción, restaurante)
        const profileRes = await restauranteApi.getProfile(token) as {
            success: boolean
            data?: {
                restaurante: any
                mesas: any[]
                productos: any[]
                suscripcion?: any
            }
        }

        if (!profileRes?.success || !profileRes.data) {
            throw new Error('No se pudieron obtener los productos del servidor.')
        }

        const restauranteData = Array.isArray(profileRes.data.restaurante)
            ? profileRes.data.restaurante[0]
            : profileRes.data.restaurante

        const productos = profileRes.data.productos || []
        const mesas = profileRes.data.mesas || []
        const suscripcion = profileRes.data.suscripcion || null

        // 2. Obtener categorías, sucursales y módulos en paralelo
        const [catRes, sucRes, modulosRes, miSubRes] = await Promise.all([
            categoriasApi.getAll(token).catch(() => ({ success: false, categorias: [] })),
            sucursalesApi.list(token).catch(() => ({ success: false, data: [] })),
            modulosApi.misModulos(token).catch(() => ({ success: false, data: [] })),
            suscripcionApi.miSuscripcion(token).catch(() => ({ success: false, data: null })),
        ])

        const categorias = (catRes as any)?.categorias || []
        const sucursales = Array.isArray((sucRes as any)?.data) ? (sucRes as any).data : []
        const modulos = Array.isArray((modulosRes as any)?.data) ? (modulosRes as any).data : []
        const miSuscripcion = (miSubRes as any)?.data || null

        // 3. Persistir en IndexedDB de forma atómica
        await reemplazarCatalogoLocal(restauranteId, {
            productos,
            categorias,
            sucursales,
            mesas,
            restaurante: restauranteData,
            suscripcion,
        })

        if (modulos.length > 0) {
            await guardarModulosLocal(restauranteId, modulos, miSuscripcion)
        }

        // 4. Actualizar stores en memoria si la sesión actual sigue activa
        if (useAuthStore.getState().restaurante?.id === restauranteId) {
            useRestauranteStore.setState({
                restaurante: restauranteData,
                suscripcion,
                productos,
                categorias,
                mesas,
                isLoading: false,
                error: null,
            })

            if (modulos.length > 0) {
                useModulosStore.setState({
                    categorias: modulos,
                    suscripcion: miSuscripcion,
                    cargando: false,
                    error: null,
                    actualizadoEn: Date.now(),
                    tokenActual: token,
                })
            }
        }

        const syncedAt = new Date().toISOString()
        return {
            productosCount: productos.length,
            categoriasCount: categorias.length,
            syncedAt,
        }
    })().finally(() => {
        descargasEnVuelo.delete(restauranteId)
    })

    descargasEnVuelo.set(restauranteId, promesa)
    return promesa
}

/**
 * Consulta el estado y metadatos del catálogo local en IndexedDB.
 */
export async function consultarEstadoCatalogoLocal(restauranteId: number): Promise<{
    syncedAt: string | null
    productosCount: number
    categoriasCount: number
}> {
    try {
        const catalogo = await leerCatalogoLocal(restauranteId)
        return {
            syncedAt: catalogo.syncedAt,
            productosCount: catalogo.productos.length,
            categoriasCount: catalogo.categorias.length,
        }
    } catch {
        return { syncedAt: null, productosCount: 0, categoriasCount: 0 }
    }
}
