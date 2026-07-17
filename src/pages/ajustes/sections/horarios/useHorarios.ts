import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { restauranteApi, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type { AjusteStatus } from '../../hooks/useAjuste'
import type { Horarios, Turno } from './resumirHorarios'

const DEBOUNCE_MS = 1500

/**
 * Carga y edición del horario semanal con guardado automático (debounce 1.5s
 * tras el último cambio). Sin botón Guardar; `status` alimenta el indicador.
 */
export function useHorarios() {
  const [horarios, setHorarios] = useState<Horarios>({})
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<AjusteStatus>('idle')

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)

  useEffect(() => {
    const cargar = async () => {
      const token = useAuthStore.getState().token
      if (!token) return
      try {
        const res = (await restauranteApi.getHorarios(token)) as {
          success: boolean
          horarios?: Array<{ diaSemana: number; horaApertura: string; horaCierre: string }>
        }
        if (res.success && res.horarios) {
          const agrupado: Horarios = {}
          for (const h of res.horarios) {
            ;(agrupado[h.diaSemana] ??= []).push({
              horaApertura: h.horaApertura,
              horaCierre: h.horaCierre,
            })
          }
          setHorarios(agrupado)
        }
      } catch (e) {
        console.error('Error cargando horarios:', e)
      } finally {
        setLoaded(true)
      }
    }
    void cargar()
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (savedTimer.current) clearTimeout(savedTimer.current)
    }
  }, [])

  const guardar = useCallback(async (data: Horarios) => {
    const token = useAuthStore.getState().token
    if (!token) return
    const flat: Array<{ diaSemana: number; horaApertura: string; horaCierre: string }> = []
    for (const [dia, turnos] of Object.entries(data)) {
      for (const t of turnos) {
        flat.push({ diaSemana: Number(dia), horaApertura: t.horaApertura, horaCierre: t.horaCierre })
      }
    }
    setStatus('saving')
    try {
      await restauranteApi.updateHorarios(token, flat)
      setStatus('saved')
      savedTimer.current = setTimeout(() => setStatus('idle'), 2000)
    } catch (e) {
      setStatus('error')
      toast.error('No se pudieron guardar los horarios', {
        description: e instanceof ApiError ? e.message : 'Revisá tu conexión.',
        action: { label: 'Reintentar', onClick: () => void guardar(data) },
      })
    }
  }, [])

  // Programa el guardado con debounce tras cada mutación.
  const mutar = useCallback(
    (updater: (prev: Horarios) => Horarios) => {
      dirtyRef.current = true
      setHorarios((prev) => {
        const next = updater(prev)
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        if (savedTimer.current) clearTimeout(savedTimer.current)
        debounceTimer.current = setTimeout(() => void guardar(next), DEBOUNCE_MS)
        return next
      })
    },
    [guardar]
  )

  const agregarTurno = useCallback(
    (dia: number) =>
      mutar((prev) => ({
        ...prev,
        [dia]: [...(prev[dia] || []), { horaApertura: '09:00', horaCierre: '18:00' }],
      })),
    [mutar]
  )

  const eliminarTurno = useCallback(
    (dia: number, idx: number) =>
      mutar((prev) => {
        const turnos = [...(prev[dia] || [])]
        turnos.splice(idx, 1)
        const next = { ...prev }
        if (turnos.length === 0) delete next[dia]
        else next[dia] = turnos
        return next
      }),
    [mutar]
  )

  const actualizarTurno = useCallback(
    (dia: number, idx: number, campo: keyof Turno, valor: string) =>
      mutar((prev) => {
        const turnos = [...(prev[dia] || [])]
        turnos[idx] = { ...turnos[idx], [campo]: valor }
        return { ...prev, [dia]: turnos }
      }),
    [mutar]
  )

  return { horarios, loaded, status, agregarTurno, eliminarTurno, actualizarTurno }
}
