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

/**
 * ¿La suscripción o el saldo necesitan atención del local? (cobro vencido, suspensión,
 * cancelación o saldo de avisos por agotarse). Alimenta el banner y el highlight de la nav.
 */
export function suscripcionNecesitaAtencion(s: MiSuscripcion | null): boolean {
  if (!s) return false
  const estadoMal = s.estado === 'pago_pendiente' || s.estado === 'suspendida' || s.estado === 'cancelada'
  const saldoMal = !s.wallet?.ilimitado && (s.wallet?.utility?.negativo || s.wallet?.alerta === '95')
  return estadoMal || saldoMal
}
