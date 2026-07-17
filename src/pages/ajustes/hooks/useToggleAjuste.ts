/**
 * useToggleAjuste — toggle optimista para campos booleanos del restaurante
 * que se persisten con un endpoint propio (no `restauranteApi.update`).
 *
 * Reemplaza los estados `isTogglingX`: el switch flipea al instante y NUNCA
 * muestra spinner ni se deshabilita mientras sincroniza. En éxito no hay
 * toast; si falla, se revierte y se avisa con toast + reintento.
 *
 * ── Ejemplo: conectar a un Switch ────────────────────────────────────────
 *
 *   import { useToggleAjuste } from '@/pages/ajustes/hooks/useToggleAjuste'
 *   import { SavedIndicator } from '@/pages/ajustes/components/SavedIndicator'
 *   import { restauranteApi } from '@/lib/api'
 *   import { Switch } from '@/components/ui/switch'
 *
 *   function DisenoAlternativoField() {
 *     const { checked, toggle, status } = useToggleAjuste(
 *       'disenoAlternativo',
 *       restauranteApi.toggleDisenoAlternativo,
 *     )
 *     return (
 *       <div className="flex items-center gap-2">
 *         <Switch checked={checked} onCheckedChange={toggle} />
 *         <SavedIndicator status={status} />
 *       </div>
 *     )
 *   }
 * ─────────────────────────────────────────────────────────────────────────
 */
import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import {
  useRestauranteStore,
  type RestauranteData,
} from '@/store/restauranteStore'
import type { AjusteStatus } from './useAjuste'

// Solo campos del restaurante que son booleanos (los que tienen un toggle).
type ToggleField = {
  [K in keyof RestauranteData]-?: RestauranteData[K] extends boolean | null
    ? K
    : never
}[keyof RestauranteData]

type ToggleApiFn = (token: string) => Promise<unknown>

function mensajeDeError(e: unknown): string {
  if (e instanceof ApiError && e.message) return e.message
  if (e instanceof Error && e.message) return e.message
  return 'Revisá tu conexión e intentá de nuevo.'
}

interface ToggleOpts {
  /** Cuando el campo es `null`/ausente, ¿se considera encendido? (ej: delivery). */
  defaultOn?: boolean
}

// Interpreta el valor crudo del campo según la semántica de default.
function leer(raw: unknown, defaultOn: boolean): boolean {
  return defaultOn ? raw !== false : Boolean(raw)
}

export function useToggleAjuste(campo: ToggleField, apiFn: ToggleApiFn, opts: ToggleOpts = {}) {
  const defaultOn = opts.defaultOn ?? false
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const setLocal = useRestauranteStore((s) => s.setLocal)
  const [status, setStatus] = useState<AjusteStatus>('idle')

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checked = leer(restaurante ? restaurante[campo] : undefined, defaultOn)

  const toggle = useCallback(async () => {
    const token = useAuthStore.getState().token
    if (!token) return

    const previo = leer(useRestauranteStore.getState().restaurante?.[campo], defaultOn)
    const nuevo = !previo

    if (savedTimer.current) {
      clearTimeout(savedTimer.current)
      savedTimer.current = null
    }

    // Flip instantáneo: el switch nunca espera al backend.
    setLocal({ [campo]: nuevo } as Partial<RestauranteData>)
    setStatus('saving')

    try {
      await apiFn(token)
      setStatus('saved')
      savedTimer.current = setTimeout(() => {
        setStatus('idle')
        savedTimer.current = null
      }, 2000)
    } catch (e) {
      setLocal({ [campo]: previo } as Partial<RestauranteData>)
      setStatus('error')
      toast.error('No se pudo guardar', {
        description: mensajeDeError(e),
        action: {
          label: 'Reintentar',
          onClick: () => {
            void toggle()
          },
        },
      })
    }
  }, [campo, apiFn, setLocal, defaultOn])

  return { checked, toggle, status }
}
