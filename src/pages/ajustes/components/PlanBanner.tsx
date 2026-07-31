import { Link } from 'react-router'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { useSuscripcion, suscripcionNecesitaAtencion } from '../hooks/useSuscripcion'

/**
 * Banner de atención de facturación que aparece arriba de Ajustes cuando el plan o
 * el saldo necesitan acción (cobro vencido, suspensión, saldo agotado). Lleva a la
 * pantalla de Plan. Cuando todo está en orden no renderiza nada (regla 11: sin ruido).
 */
export function PlanBanner() {
  const { data } = useSuscripcion()

  if (!suscripcionNecesitaAtencion(data) || !data) return null

  let mensaje = 'Revisá tu plan y saldo'
  let critico = false

  if (data.estado === 'suspendida') {
    critico = true
    mensaje = 'Tu plan está suspendido por falta de pago. Reactivalo para recuperar las funciones premium.'
  } else if (data.estado === 'pago_pendiente') {
    mensaje = 'Tenés un pago pendiente de tu plan. Pagá para no perder funciones.'
  } else if (data.estado === 'cancelada') {
    mensaje = 'Cancelaste tu plan. Volvé a elegir uno cuando quieras.'
  } else if (data.wallet?.utility?.negativo) {
    critico = true
    mensaje = 'Te quedaste sin saldo de avisos. Recargá para ponerte al día.'
  } else if (data.wallet?.alerta === '95') {
    mensaje = 'Te quedan muy pocos avisos este mes. Considerá recargar.'
  }

  return (
    <Link
      to="/dashboard/ajustes/plan"
      className={
        'mt-6 flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ' +
        (critico
          ? 'border-red-500/30 bg-red-500/10 hover:bg-red-500/15'
          : 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15')
      }
    >
      <AlertTriangle
        className={'h-4 w-4 shrink-0 ' + (critico ? 'text-red-500' : 'text-amber-500')}
      />
      <span className="min-w-0 flex-1 text-[13px] font-medium text-foreground">{mensaje}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
