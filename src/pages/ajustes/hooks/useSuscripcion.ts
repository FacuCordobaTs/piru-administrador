import { useEffect } from 'react'
import { type MiSuscripcion } from '@/lib/api'
import { useModulosStore } from '@/store/modulosStore'

/**
 * Suscripción vigente + wallet del local. Fuente de verdad para la pantalla de Plan
 * y para el banner de atención en Ajustes. Una sola llamada (`/planes/mi-suscripcion`).
 */
export function useSuscripcion() {
  const data = useModulosStore((state) => state.suscripcion)
  const loading = useModulosStore((state) => state.cargando)
  const cargar = useModulosStore((state) => state.cargar)

  useEffect(() => {
    // Silencioso para mantener el comportamiento previo del banner: la
    // pantalla sigue usable si este resumen auxiliar no está disponible.
    void cargar().catch(() => {})
  }, [cargar])

  return { data, loading, refetch: () => cargar(true) }
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
