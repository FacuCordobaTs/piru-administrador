import type { AjusteStatus } from '../hooks/useAjuste'

interface SavedIndicatorProps {
  status: AjusteStatus
  className?: string
}

/**
 * Indicador chico que acompaña a un label de ajuste.
 * - saving → "Guardando…"
 * - saved  → "Guardado ✓"
 * - idle / error → nada (el error se comunica por toast).
 *
 * El fade es solo de opacity (150ms) para no generar jank ni reflow.
 * El nodo siempre está montado con un ancho reservado por el texto: solo
 * cambia su opacidad, así no empuja el layout al aparecer/desaparecer.
 */
export function SavedIndicator({ status, className = '' }: SavedIndicatorProps) {
  const visible = status === 'saving' || status === 'saved'
  const texto = status === 'saving' ? 'Guardando…' : 'Guardado ✓'

  return (
    <span
      aria-live="polite"
      className={`text-xs text-muted-foreground transition-opacity duration-150 ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      {texto}
    </span>
  )
}
