import { Link } from 'react-router'
import { Sparkles } from 'lucide-react'
import { useSuscripcion } from '@/pages/ajustes/hooks/useSuscripcion'

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

/**
 * Contador de VALOR del trial (Claim Flow · Tarea 6). Banner siempre visible mientras la
 * suscripción está en `trial`: no cuenta días para asustar, cuenta lo que el local YA ganó
 * con Piru ("Recibiste X pedidos por $Y"). El día del pago la pregunta deja de ser "¿cuánto
 * cuesta?" y pasa a ser "¿dejo de recibir esto?". Los datos salen de `/planes/mi-suscripcion`
 * (`trialFin` + `trialValor`, computados en el backend sobre los pedidos que entraron por Piru
 * desde que arrancó la prueba). No es descartable: es información, no una alerta.
 */
export function TrialValorBanner() {
  const { data } = useSuscripcion()

  if (!data || data.estado !== 'trial') return null

  // Días restantes de la prueba (fin = trialFin, con fallback al próximo cobro que en trial coincide).
  const finIso = data.trialFin ?? data.fechaProximoCobro
  const fin = finIso ? new Date(finIso) : null
  if (!fin || isNaN(fin.getTime())) return null
  const diasRestantes = Math.max(0, Math.ceil((fin.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
  const diasTxt =
    diasRestantes === 0 ? 'último día' : diasRestantes === 1 ? '1 día' : `${diasRestantes} días`

  const pedidos = data.trialValor?.pedidos ?? 0
  const monto = data.trialValor?.monto ?? 0

  // Con valor generado, el gancho es lo que se pierde; sin pedidos todavía, empujamos a compartir el link.
  const mensaje =
    pedidos > 0
      ? `Tu prueba: ${diasTxt} · Recibiste ${pedidos} ${pedidos === 1 ? 'pedido' : 'pedidos'} por ${fmtARS(monto)} con Piru.`
      : `Tu prueba: ${diasTxt} · Compartí tu link para empezar a recibir pedidos con Piru.`

  return (
    <div className="shrink-0 flex items-center gap-3 border-b border-[#FF7A00]/30 bg-[#FF7A00]/10 px-4 py-2.5">
      <Sparkles className="h-4 w-4 shrink-0 text-[#FF7A00]" />
      <p className="min-w-0 flex-1 text-[13px] font-medium text-foreground">{mensaje}</p>
      <Link
        to="/dashboard/ajustes/plan"
        className="shrink-0 rounded-lg bg-[#FF7A00] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#e56e00]"
      >
        Activar plan
      </Link>
    </div>
  )
}
