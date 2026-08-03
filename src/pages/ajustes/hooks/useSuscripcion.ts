import { useCallback, useEffect, useState } from 'react'
import { planesApi, type MiSuscripcion } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

/**
 * Suscripción vigente + wallet del local. Fuente de verdad para la pantalla de Plan
 * y para el banner de atención en Ajustes. Una sola llamada (`/planes/mi-suscripcion`).
 */
export function useSuscripcion() {
  const [data, setData] = useState<MiSuscripcion | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const token = useAuthStore.getState().token
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const res = await planesApi.miSuscripcion(token)
      setData(res.data)
    } catch {
      // silencioso: el banner/pantalla simplemente no muestra nada si falla
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}

/** Días de anticipación con los que empezamos a recordar el próximo cobro (manual). */
export const RECORDATORIO_DIAS_ANTES = 5

/**
 * Recordatorio de renovación: como el cobro es MANUAL (no hay débito automático), avisamos
 * al local cuando se acerca `fechaProximoCobro` mientras el plan sigue al día. Una vez
 * vencido, el estado ya pasa a `pago_pendiente` (banner propio), así que acá sólo miramos
 * la ventana previa. Devuelve null si no corresponde recordar nada.
 */
export function renovacionProxima(s: MiSuscripcion | null): { diasRestantes: number } | null {
  if (!s || !s.fechaProximoCobro) return null
  if (s.estado !== 'activa' && s.estado !== 'trial') return null
  const cobro = new Date(s.fechaProximoCobro)
  if (isNaN(cobro.getTime())) return null
  const ahora = new Date()
  const diasRestantes = Math.ceil((cobro.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000))
  if (diasRestantes < 0 || diasRestantes > RECORDATORIO_DIAS_ANTES) return null
  return { diasRestantes }
}

/**
 * ¿La suscripción o el saldo necesitan atención del local? (cobro vencido, suspensión,
 * cancelación, renovación próxima o saldo de avisos por agotarse). Alimenta el banner y
 * el highlight de la nav.
 */
export function suscripcionNecesitaAtencion(s: MiSuscripcion | null): boolean {
  if (!s) return false
  const estadoMal = s.estado === 'pago_pendiente' || s.estado === 'suspendida' || s.estado === 'cancelada'
  const saldoMal = !s.wallet?.ilimitado && (s.wallet?.utility?.negativo || s.wallet?.alerta === '95')
  return estadoMal || saldoMal || renovacionProxima(s) !== null
}
