import { create } from 'zustand'
import { useEffect } from 'react'
import {
  modulosApi,
  suscripcionApi,
  type CategoriaModulo,
  type CheckoutSuscripcion,
  type MiSuscripcion,
  type Modulo,
} from '@/lib/api'
import { useAuthStore } from './authStore'

const CACHE_TTL_MS = 30_000

const todosLosModulos = (categorias: CategoriaModulo[]): Modulo[] =>
  categorias.flatMap((categoria) => categoria.modulos)

const actualizarModuloLocal = (
  categorias: CategoriaModulo[],
  codigo: string,
  actualizar: (modulo: Modulo) => Modulo,
): CategoriaModulo[] => categorias.map((categoria) => ({
  ...categoria,
  modulos: categoria.modulos.map((modulo) => modulo.codigo === codigo ? actualizar(modulo) : modulo),
}))

interface ModulosState {
  categorias: CategoriaModulo[]
  suscripcion: MiSuscripcion | null
  cargando: boolean
  error: string | null
  actualizadoEn: number | null
  tokenActual: string | null
  cargar: (forzar?: boolean) => Promise<void>
  invalidar: () => void
  activar: (codigo: string) => Promise<Modulo | undefined>
  desactivar: (codigo: string) => Promise<Modulo | undefined>
  checkoutModulo: (codigo: string, ciclo?: 'mensual' | 'anual') => Promise<CheckoutSuscripcion>
  enviarPagoLinkModulo: (codigo: string, ciclo?: 'mensual' | 'anual') => Promise<{ enviado: boolean; telefono: string }>
  reactivar: (codigo: string) => Promise<Modulo | CheckoutSuscripcion | undefined>
  checkoutSuscripcion: (ciclo?: 'mensual' | 'anual') => Promise<CheckoutSuscripcion>
  reset: () => void
}

/**
 * Fuente de verdad de la UI nueva de suscripción y módulos. Las mutaciones no
 * intentan reconstruir el entitlement local: siempre vuelven a leer el estado
 * resuelto por el backend, incluyendo pagos pendientes y bajas programadas.
 */
export const useModulosStore = create<ModulosState>((set, get) => ({
  categorias: [],
  suscripcion: null,
  cargando: false,
  error: null,
  actualizadoEn: null,
  tokenActual: null,

  cargar: async (forzar = false) => {
    const token = useAuthStore.getState().token
    if (!token) {
      set({ categorias: [], suscripcion: null, cargando: false, error: null, actualizadoEn: null, tokenActual: null })
      return
    }

    const actualizadoEn = get().actualizadoEn
    const cambioDeSesion = get().tokenActual !== token
    if (!forzar && !cambioDeSesion && actualizadoEn && Date.now() - actualizadoEn < CACHE_TTL_MS) return

    set({ cargando: true, error: null })
    try {
      const [suscripcion, modulos] = await Promise.all([
        suscripcionApi.miSuscripcion(token),
        modulosApi.misModulos(token),
      ])
      set({
        suscripcion: suscripcion.data,
        categorias: modulos.data,
        cargando: false,
        actualizadoEn: Date.now(),
        tokenActual: token,
      })
    } catch (error) {
      set({
        cargando: false,
        error: error instanceof Error ? error.message : 'No se pudo cargar la suscripción',
      })
      throw error
    }
  },

  invalidar: () => set({ actualizadoEn: null }),

  activar: async (codigo) => {
    const token = useAuthStore.getState().token
    if (!token) throw new Error('No hay sesión activa')
    const categoriasAnteriores = get().categorias
    set({
      categorias: actualizarModuloLocal(categoriasAnteriores, codigo, (modulo) => ({
        ...modulo,
        estado: 'activo',
        activoAhora: true,
        origen: 'usuario',
      })),
    })
    try {
      const respuesta = await modulosApi.activar(token, codigo)
      // Si el refetch falla después de que el backend confirmó la mutación,
      // conservamos el estado optimista en vez de deshacer una activación real.
      await get().cargar(true).catch(() => undefined)
      return respuesta.data
    } catch (error) {
      set({ categorias: categoriasAnteriores })
      throw error
    }
  },

  desactivar: async (codigo) => {
    const token = useAuthStore.getState().token
    if (!token) throw new Error('No hay sesión activa')
    const categoriasAnteriores = get().categorias
    set({
      categorias: actualizarModuloLocal(categoriasAnteriores, codigo, (modulo) => ({
        ...modulo,
        estado: 'inactivo',
        activoAhora: false,
        origen: 'usuario',
        vigenteHasta: null,
      })),
    })
    try {
      const respuesta = await modulosApi.desactivar(token, codigo)
      await get().cargar(true).catch(() => undefined)
      return respuesta.data
    } catch (error) {
      set({ categorias: categoriasAnteriores })
      throw error
    }
  },

  checkoutModulo: async (codigo, ciclo) => {
    const token = useAuthStore.getState().token
    if (!token) throw new Error('No hay sesión activa')
    const respuesta = await modulosApi.checkout(token, codigo, ciclo)
    // El backend deja el entitlement en pendiente de pago. Refrescar antes de
    // redirigir permite mostrar ese estado al volver de Mercado Pago.
    await get().cargar(true)
    return respuesta.data
  },

  enviarPagoLinkModulo: async (codigo, ciclo) => {
    const token = useAuthStore.getState().token
    if (!token) throw new Error('No hay sesión activa')
    const respuesta = await modulosApi.enviarPagoLinkWhatsapp(token, codigo, ciclo)
    await get().cargar(true)
    return respuesta.data
  },

  reactivar: async (codigo) => {
    const token = useAuthStore.getState().token
    if (!token) throw new Error('No hay sesión activa')
    const respuesta = await modulosApi.reactivar(token, codigo)
    await get().cargar(true)
    return respuesta.data
  },

  checkoutSuscripcion: async (ciclo) => {
    const token = useAuthStore.getState().token
    if (!token) throw new Error('No hay sesión activa')
    const respuesta = await suscripcionApi.checkout(token, ciclo)
    await get().cargar(true)
    return respuesta.data
  },

  reset: () => set({ categorias: [], suscripcion: null, cargando: false, error: null, actualizadoEn: null, tokenActual: null }),
}))

/** Único helper de capacidades del frontend; no deriva acceso desde planes. */
export function moduloActivo(codigo: string): boolean {
  return todosLosModulos(useModulosStore.getState().categorias)
    .some((modulo) => modulo.codigo === codigo && modulo.activoAhora)
}

/** Versión reactiva del helper de capacidades para pantallas de configuración.
 * No deduce acceso desde planes: siempre refleja los entitlements del backend. */
export function useModuloActivo(codigo: string): boolean {
  const activo = useModulosStore((state) => todosLosModulos(state.categorias)
    .some((modulo) => modulo.codigo === codigo && modulo.activoAhora))
  const cargar = useModulosStore((state) => state.cargar)

  useEffect(() => {
    void cargar().catch(() => {})
  }, [cargar])

  return activo
}
