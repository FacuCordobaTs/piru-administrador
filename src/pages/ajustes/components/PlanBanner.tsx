import { Link } from 'react-router'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { useSuscripcion, renovacionProxima } from '../hooks/useSuscripcion'

/**
 * Banner de atención del plan que aparece arriba de Ajustes cuando la suscripción necesita
 * acción (cobro vencido, suspensión, cancelación o renovación próxima). Lleva a la pantalla
 * "Mi suscripción" (`/dashboard/suscripcion`). El saldo de mensajes tiene su propio banner en la sección
 * Mensajes. Cuando todo está en orden no renderiza nada (regla 11: sin ruido).
 */
export function PlanBanner() {
  const { data } = useSuscripcion()

  if (!data) return null

  const estadoMal =
    data.estado === 'pago_pendiente' || data.estado === 'suspendida' || data.estado === 'cancelada'
  const renov = renovacionProxima(data)
  if (!estadoMal && !renov) return null

  let mensaje = 'Revisá tu suscripción'
  let critico = false

  if (data.estado === 'suspendida') {
    critico = true
    mensaje = 'Tu plan está suspendido por falta de pago. Reactivalo para recuperar las funciones premium.'
  } else if (data.estado === 'pago_pendiente') {
    mensaje = 'Tenés un pago pendiente de tu plan. Pagá para no perder funciones.'
  } else if (data.estado === 'cancelada') {
    mensaje = 'Cancelaste tu plan. Volvé a activarlo cuando quieras.'
  } else if (renov) {
    mensaje =
      renov.diasRestantes <= 0
        ? 'Tu plan se renueva hoy. Pagá la cuota para no perder funciones.'
        : `Tu plan se renueva en ${renov.diasRestantes} ${renov.diasRestantes === 1 ? 'día' : 'días'}. Pagá la cuota para no perder funciones.`
  }

  return (
    <Link
      to="/dashboard/suscripcion"
      className={
        'mt-6 flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ' +
        (critico
          ? 'border-red-500/30 bg-red-500/10 hover:bg-red-500/15'
          : 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15')
      }
    >
      <AlertTriangle className={'h-4 w-4 shrink-0 ' + (critico ? 'text-red-500' : 'text-amber-500')} />
      <span className="min-w-0 flex-1 text-[13px] font-medium text-foreground">{mensaje}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
