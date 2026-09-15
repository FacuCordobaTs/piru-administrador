import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarClock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { renovacionProxima, useSuscripcion } from '@/pages/ajustes/hooks/useSuscripcion'

const fmtFecha = (iso: string | null | undefined) => {
  if (!iso) return null
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime())
    ? null
    : fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

/** Recordatorio de la cuota manual en el lugar donde el local trabaja. */
export function SuscripcionVencimientoBanner({ onDismiss }: { onDismiss?: () => void }) {
  const { data } = useSuscripcion()
  const [dismissed, setDismissed] = useState(false)
  const renovacion = renovacionProxima(data)
  const pagoPendiente = data?.estado === 'pago_pendiente'
  const bajaProgramada = !!data?.fechaCancelacion && new Date(data.fechaCancelacion) > new Date()

  // La prueba ya tiene su banner de valor y los estados vencidos se explican
  // en Mi suscripción. Este recuerda solamente la ventana previa al vencimiento.
  if (!data || data.estado === 'trial' || bajaProgramada || (!renovacion && !pagoPendiente) || dismissed) return null

  const dias = renovacion?.diasRestantes ?? 0
  const vence = fmtFecha(data.fechaProximoCobro)
  let mensaje = dias <= 0
    ? 'Tu suscripción vence hoy. Pagá la próxima cuota para mantener todo activo.'
    : dias === 1
      ? `Tu suscripción vence mañana${vence ? `, ${vence}` : ''}. Pagá la próxima cuota cuando quieras.`
      : `Tu suscripción vence el ${vence ?? `en ${dias} días`}. Podés pagar la próxima cuota ahora.`

  if (pagoPendiente) {
    mensaje = data.graciaHasta
      ? `Tu suscripción venció. Regularizá el pago antes del ${fmtFecha(data.graciaHasta) ?? 'fin del período de gracia'}.`
      : 'Tu suscripción venció. Regularizá el pago para mantener todo activo.'
  }

  const descartar = () => {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
      <CalendarClock className="h-4 w-4 shrink-0 text-amber-600" />
      <p className="min-w-0 flex-1 text-[13px] font-medium text-foreground">{mensaje}</p>
      <Link
        to="/dashboard/ajustes/suscripcion"
        className={cn('shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600')}
      >
        {pagoPendiente ? 'Regularizar' : 'Pagar cuota'}
      </Link>
      <button
        type="button"
        onClick={descartar}
        aria-label="Cerrar aviso de vencimiento de suscripción"
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
