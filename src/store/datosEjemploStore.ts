import { create } from 'zustand'
import { datosEjemploApi, type EstadoDatosEjemplo } from '@/lib/api'
import { useAuthStore } from './authStore'

interface DatosEjemploState {
  /** Lo que queda de los datos de ejemplo; `null` hasta que se consulta (o si no se pudo). */
  estado: EstadoDatosEjemplo | null
  trabajando: boolean
  /** Sube cada vez que se borran o se cargan: la pantalla abierta se vuelve a montar y pide sus datos. */
  version: number
  cargar: () => Promise<void>
  borrar: () => Promise<boolean>
  volverACargar: () => Promise<boolean>
}

/**
 * Los datos de ejemplo de la demo de prospección (clientes, pedidos y campañas marcados "EJEMPLO"):
 * los comparten el aviso de arriba del panel y el recorrido de bienvenida.
 */
export const useDatosEjemplo = create<DatosEjemploState>((set) => ({
  estado: null,
  trabajando: false,
  version: 0,

  cargar: async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    try {
      const { data } = await datosEjemploApi.estado(token)
      set({ estado: data })
    } catch {
      // Sin la tabla (migración sin aplicar) o sin red: el panel funciona igual, sin el aviso.
      set({ estado: null })
    }
  },

  borrar: async () => {
    const token = useAuthStore.getState().token
    if (!token) return false
    set({ trabajando: true })
    try {
      const { data } = await datosEjemploApi.borrar(token)
      set((s) => ({ estado: data, version: s.version + 1 }))
      return true
    } catch {
      return false
    } finally {
      set({ trabajando: false })
    }
  },

  volverACargar: async () => {
    const token = useAuthStore.getState().token
    if (!token) return false
    set({ trabajando: true })
    try {
      const { data } = await datosEjemploApi.cargar(token)
      set((s) => ({ estado: data, version: s.version + 1 }))
      return true
    } catch {
      return false
    } finally {
      set({ trabajando: false })
    }
  },
}))
