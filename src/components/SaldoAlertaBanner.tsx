import { useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSuscripcion } from '@/pages/ajustes/hooks/useSuscripcion'

/**
 * Banner de saldo de avisos por WhatsApp para mostrar DONDE el local vive (el Dashboard),
 * no enterrado en Ajustes. Aparece sólo cuando el saldo utility está por agotarse (80/95%)
 * o ya quedó negativo, y linkea a la pantalla de Plan para recargar. Sin ruido cuando todo
 * está en orden (regla 11). Descartable por sesión: si el nivel empeora (80→95→negativo)
 * vuelve a aparecer.
 */
export function SaldoAlertaBanner() {
  const { data } = useSuscripcion()
  const [dismissed, setDismissed] = useState<string | null>(() =>
    sessionStorage.getItem('piru-saldo-alerta-dismiss'),
  )

  const w = data?.wallet
  if (!data || !w || w.ilimitado) return null

  // Nivel de urgencia. La gracia agotada manda sobre el negativo, y el negativo sobre las alertas de %.
  let nivel: 'agotada' | 'negativo' | '95' | '80' | null = null
  if (w.utility?.graciaAgotada) nivel = 'agotada'
  else if (w.utility?.negativo) nivel = 'negativo'
  else if (w.alerta === '95') nivel = '95'
  else if (w.alerta === '80') nivel = '80'

  if (!nivel || dismissed === nivel) return null

  const critico = nivel === 'agotada' || nivel === 'negativo'
  const disponible = w.utility?.disponible ?? 0

  const mensaje =
    nivel === 'agotada'
      ? 'Los avisos por WhatsApp se pausaron por falta de saldo. Tus clientes siguen viendo el estado del pedido, pero dejan de recibir el aviso con tu marca. Recargá para reactivarlos.'
      : nivel === 'negativo'
        ? 'Te quedaste sin saldo de avisos. Siguen saliendo y quedan como saldo a descontar (hasta un tope). Recargá para ponerte al día.'
        : nivel === '95'
          ? `Te quedan ${disponible} avisos por WhatsApp este mes. Recargá para no quedarte corto.`
          : `Te quedan ${disponible} avisos por WhatsApp este mes. Cuando quieras, recargá.`

  const descartar = () => {
    setDismissed(nivel)
    sessionStorage.setItem('piru-saldo-alerta-dismiss', nivel!)
  }

  return (
    <div
      className={cn(
        'shrink-0 flex items-center gap-3 border-b px-4 py-2.5',
        critico ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10',
      )}
    >
      <AlertTriangle className={cn('h-4 w-4 shrink-0', critico ? 'text-red-500' : 'text-amber-500')} />
      <p className="min-w-0 flex-1 text-[13px] font-medium text-foreground">{mensaje}</p>
      <Link
        to="/dashboard/mensajes"
        className={cn(
          'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors',
          critico ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600',
        )}
      >
        Recargar
      </Link>
      <button
        onClick={descartar}
        aria-label="Descartar"
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
