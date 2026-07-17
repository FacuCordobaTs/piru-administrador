/**
 * useAjuste — autosave optimista para un campo del restaurante.
 *
 * Guarda en `onBlur` y en Enter (texto/número); nunca hay botón "Guardar".
 * La UI se actualiza al instante (setLocal) y el sync corre en background.
 * En éxito NUNCA hay toast: el feedback es el <SavedIndicator/> inline.
 *
 * ── Ejemplo: conectar a un Input (guarda en onBlur y Enter) ──────────────
 *
 *   import { useAjuste } from '@/pages/ajustes/hooks/useAjuste'
 *   import { SavedIndicator } from '@/pages/ajustes/components/SavedIndicator'
 *   import { Input } from '@/components/ui/input'
 *   import { Label } from '@/components/ui/label'
 *   import { useState, useEffect } from 'react'
 *
 *   function NombreDelLocal() {
 *     const { valor, guardar, status } = useAjuste('nombre')
 *     // Buffer local para no pisar cada tecla con el valor del store.
 *     const [draft, setDraft] = useState(String(valor ?? ''))
 *     useEffect(() => { setDraft(String(valor ?? '')) }, [valor])
 *
 *     return (
 *       <div className="space-y-1.5">
 *         <div className="flex items-center gap-2">
 *           <Label htmlFor="nombre">Nombre del local</Label>
 *           <SavedIndicator status={status} />
 *         </div>
 *         <Input
 *           id="nombre"
 *           value={draft}
 *           onChange={(e) => setDraft(e.target.value)}
 *           onBlur={() => guardar(draft)}
 *           onKeyDown={(e) => {
 *             if (e.key === 'Enter') {
 *               e.preventDefault()
 *               e.currentTarget.blur() // dispara onBlur → guardar
 *             }
 *           }}
 *         />
 *       </div>
 *     )
 *   }
 *
 * ── Ejemplo: conectar a un Switch (guarda al instante, en onChange) ───────
 * (para toggles que van por `restauranteApi.update`; los que usan endpoints
 *  propios de toggle van por `useToggleAjuste`.)
 *
 *   function SplitPagoField() {
 *     const { valor, guardar } = useAjuste('splitPayment')
 *     return (
 *       <Switch
 *         checked={Boolean(valor)}
 *         onCheckedChange={(v) => guardar(v)} // flip instantáneo + sync atrás
 *       />
 *     )
 *   }
 * ─────────────────────────────────────────────────────────────────────────
 */
import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { restauranteApi, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import {
  useRestauranteStore,
  type RestauranteData,
} from '@/store/restauranteStore'

export type AjusteStatus = 'idle' | 'saving' | 'saved' | 'error'

type UpdatePayload = Parameters<typeof restauranteApi.update>[1]

function mensajeDeError(e: unknown): string {
  if (e instanceof ApiError && e.message) return e.message
  if (e instanceof Error && e.message) return e.message
  return 'Revisá tu conexión e intentá de nuevo.'
}

export function useAjuste<K extends keyof RestauranteData>(campo: K) {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const setLocal = useRestauranteStore((s) => s.setLocal)
  const [status, setStatus] = useState<AjusteStatus>('idle')

  // Timer del "Guardado ✓" → idle, para poder limpiarlo entre guardados.
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const valor = restaurante ? restaurante[campo] : undefined

  const guardar = useCallback(
    async (nuevo: RestauranteData[K]) => {
      const token = useAuthStore.getState().token
      const previo = useRestauranteStore.getState().restaurante?.[campo]

      // (a) nada que hacer si no cambió.
      if (nuevo === previo) return
      if (!token) return

      if (savedTimer.current) {
        clearTimeout(savedTimer.current)
        savedTimer.current = null
      }

      // (b) optimista: la UI ya refleja el nuevo valor.
      setLocal({ [campo]: nuevo } as Partial<RestauranteData>)
      setStatus('saving')

      try {
        // (c) sync en background.
        await restauranteApi.update(token, {
          [campo]: nuevo,
        } as UpdatePayload)
        // (d) "Guardado ✓" durante 2s y de vuelta a idle.
        setStatus('saved')
        savedTimer.current = setTimeout(() => {
          setStatus('idle')
          savedTimer.current = null
        }, 2000)
      } catch (e) {
        // (e) revertir + toast con reintento. Nunca toast en éxito.
        setLocal({ [campo]: previo } as Partial<RestauranteData>)
        setStatus('error')
        toast.error('No se pudo guardar', {
          description: mensajeDeError(e),
          action: {
            label: 'Reintentar',
            onClick: () => {
              void guardar(nuevo)
            },
          },
        })
      }
    },
    [campo, setLocal]
  )

  return { valor, guardar, status }
}
