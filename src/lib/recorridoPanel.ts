import { create } from 'zustand'

/**
 * El recorrido de bienvenida del panel (components/recorrido/RecorridoPanel.tsx): se abre solo la
 * primera vez que alguien entra por la demo de prospección y después, a pedido, desde "Ver recorrido"
 * del menú. Cerrarlo de cualquier forma lo marca como visto en este navegador, para ese local.
 */

// La v1 permite volver a mostrarlo a todos si un día el recorrido cambia de verdad.
const clave = (restauranteId: number) => `piru-admin-recorrido-v1:${restauranteId}`

// Si el navegador no deja guardar, se recuerda en memoria: se muestra una vez por carga de página.
const vistos = new Set<number>()

export function recorridoVisto(restauranteId: number): boolean {
  if (vistos.has(restauranteId)) return true
  try {
    return localStorage.getItem(clave(restauranteId)) === 'visto'
  } catch {
    return false
  }
}

export function marcarRecorridoVisto(restauranteId: number) {
  vistos.add(restauranteId)
  try {
    localStorage.setItem(clave(restauranteId), 'visto')
  } catch {
    /* Queda en memoria. */
  }
}

interface EstadoRecorrido {
  abierto: boolean
  /** Cuántas veces se abrió: cada apertura empieza del primer paso. */
  vez: number
  abrir: () => void
  cerrar: () => void
}

export const useRecorridoPanel = create<EstadoRecorrido>()((set) => ({
  abierto: false,
  vez: 0,
  abrir: () => set((s) => ({ abierto: true, vez: s.vez + 1 })),
  cerrar: () => set({ abierto: false }),
}))
