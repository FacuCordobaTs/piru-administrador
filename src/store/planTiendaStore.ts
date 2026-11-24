import { create } from 'zustand'
import { useEffect } from 'react'
import { planesTiendaApi, type MiPlanTienda, type PlanCodigo, type PrimerosPasos } from '@/lib/api'
import { useAuthStore } from './authStore'

const CACHE_TTL_MS = 30_000

interface PlanTiendaState {
  plan: MiPlanTienda | null
  pasos: PrimerosPasos | null
  token: string | null
  actualizadoEn: number | null
  cargando: boolean
  cargar: (forzar?: boolean) => Promise<void>
  reset: () => void
}

/**
 * Plan de tienda del local (Inicial…Evolución) y sus "Primeros pasos". El backend decide todo
 * (gates con `requireModulo`); esto sólo sirve para mostrar u ofrecer. Si falla la red, la UI se
 * comporta como Evolución: no esconde nada que el backend todavía permita.
 */
export const usePlanTiendaStore = create<PlanTiendaState>((set, get) => ({
  plan: null,
  pasos: null,
  token: null,
  actualizadoEn: null,
  cargando: false,
  cargar: async (forzar = false) => {
    const token = useAuthStore.getState().token
    if (!token) return set({ plan: null, pasos: null, token: null, actualizadoEn: null })
    const mismo = get().token === token
    if (!forzar && mismo && get().cargando) return
    if (!forzar && mismo && get().actualizadoEn && Date.now() - get().actualizadoEn! < CACHE_TTL_MS) return
    set({ cargando: true, ...(mismo ? {} : { plan: null, pasos: null }) })
    try {
      const [plan, pasos] = await Promise.all([planesTiendaApi.miPlan(token), planesTiendaApi.primerosPasos(token)])
      set({ plan: plan.data, pasos: pasos.data, token, actualizadoEn: Date.now(), cargando: false })
    } catch {
      set({ cargando: false, token })
    }
  },
  reset: () => set({ plan: null, pasos: null, token: null, actualizadoEn: null, cargando: false }),
}))

/** Carga (con caché) y devuelve el plan. */
export function usePlanTienda() {
  const token = useAuthStore((s) => s.token)
  const estado = usePlanTiendaStore()
  useEffect(() => {
    void estado.cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  return estado
}

/** ¿El plan efectivo incluye esta capacidad o módulo? Sin datos o en Evolución: sí. */
export function planIncluye(plan: MiPlanTienda | null, codigo: string): boolean {
  if (!plan || plan.esLegado) return true
  return plan.catalogo.find((p) => p.codigo === plan.efectivo)?.modulos.includes(codigo) ?? false
}

/** El plan más barato que incluye el módulo, para "Disponible desde el plan X". */
export function planMinimo(plan: MiPlanTienda | null, codigo: string) {
  if (!plan) return null
  return [...plan.catalogo]
    .sort((a, b) => a.orden - b.orden)
    .find((p) => p.codigo !== 'evolucion' && p.modulos.includes(codigo)) ?? plan.catalogo.find((p) => p.codigo === 'evolucion') ?? null
}

export const nombrePlan = (plan: MiPlanTienda | null, codigo: PlanCodigo) =>
  plan?.catalogo.find((p) => p.codigo === codigo)?.nombre ?? codigo
