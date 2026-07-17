import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { restauranteApi, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore, type RestauranteData } from '@/store/restauranteStore'
import type { AjusteStatus } from './useAjuste'

type UpdatePayload = Parameters<typeof restauranteApi.update>[1]

function mensajeDeError(e: unknown): string {
  if (e instanceof ApiError && e.message) return e.message
  if (e instanceof Error && e.message) return e.message
  return 'Revisá tu conexión e intentá de nuevo.'
}

/**
 * Autosave optimista para casos que no calzan en `useAjuste` (un campo = una
 * clave de update): guardados de varios campos a la vez (dirección + coords) o
 * cuando la clave local difiere de la del API (logo: imagenUrl ↔ image).
 *
 * `run(localPatch, updatePayload)`:
 *  - aplica `localPatch` al store (optimista),
 *  - manda `updatePayload` a restauranteApi.update en background,
 *  - "Guardado ✓" 2s → idle; si falla revierte y hace toast con reintento.
 * Nunca toast en éxito.
 */
export function useOptimisticUpdate() {
  const setLocal = useRestauranteStore((s) => s.setLocal)
  const [status, setStatus] = useState<AjusteStatus>('idle')
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const run = useCallback(
    async (localPatch: Partial<RestauranteData>, updatePayload: UpdatePayload) => {
      const token = useAuthStore.getState().token
      if (!token) return

      // Snapshot de los valores previos de las claves que vamos a tocar.
      const actual = useRestauranteStore.getState().restaurante
      const previo: Partial<RestauranteData> = {}
      if (actual) {
        for (const k of Object.keys(localPatch) as (keyof RestauranteData)[]) {
          previo[k] = actual[k] as never
        }
      }

      if (savedTimer.current) {
        clearTimeout(savedTimer.current)
        savedTimer.current = null
      }

      setLocal(localPatch)
      setStatus('saving')
      try {
        await restauranteApi.update(token, updatePayload)
        setStatus('saved')
        savedTimer.current = setTimeout(() => {
          setStatus('idle')
          savedTimer.current = null
        }, 2000)
      } catch (e) {
        setLocal(previo)
        setStatus('error')
        toast.error('No se pudo guardar', {
          description: mensajeDeError(e),
          action: { label: 'Reintentar', onClick: () => { void run(localPatch, updatePayload) } },
        })
      }
    },
    [setLocal]
  )

  return { run, status }
}
