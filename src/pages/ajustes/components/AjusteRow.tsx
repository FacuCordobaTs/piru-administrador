import { cn } from '@/lib/utils'

export type AjusteEstado = 'configurado' | 'sin-configurar' | 'atencion'

interface AjusteRowProps {
  titulo: string
  /** Estado actual como frase legible, ej: "Cobrás con Mercado Pago y efectivo". */
  oracion: string
  estado?: AjusteEstado
  /** Texto del botón. Por defecto se deriva del estado ("Cambiar" / "Configurar"). */
  accionLabel?: string
  /** Sin `onAccion` la fila es de solo lectura (sin botón), ej: Email. */
  onAccion?: () => void
}

/**
 * Fila de ajuste en modo lectura: una oración que describe el estado actual,
 * nunca un formulario abierto (regla 11 — "cada pregunta visible es una falla
 * de diseño"). El editor aparece recién al tocar el botón de acción.
 */
export function AjusteRow({
  titulo,
  oracion,
  estado = 'configurado',
  accionLabel,
  onAccion,
}: AjusteRowProps) {
  const sinConfigurar = estado === 'sin-configurar'
  const label = accionLabel ?? (sinConfigurar ? 'Configurar' : 'Cambiar')
  const Row = onAccion ? 'button' : 'div'

  return (
    <Row type={onAccion ? 'button' : undefined} onClick={onAccion} className={cn('flex w-full items-center justify-between gap-4 border-b border-border/50 py-3.5 text-left', onAccion && 'cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand')}>
      <span className="block min-w-0 space-y-0.5">
        <span className="block text-sm font-medium text-foreground">{titulo}</span>
        <span
          className={cn(
            'flex items-center gap-1.5 text-[13px] font-normal',
            sinConfigurar ? 'text-muted-foreground/60' : 'text-muted-foreground'
          )}
        >
          {estado === 'atencion' && (
            <span
              aria-hidden
              className="inline-block size-1.5 shrink-0 rounded-full bg-amber-500"
            />
          )}
          <span className="min-w-0 truncate">{oracion}</span>
        </span>
      </span>

      {onAccion && (
        <span className="inline-flex h-11 min-h-[44px] shrink-0 items-center rounded-md border bg-background px-4 text-sm font-medium">
          {label}
        </span>
      )}
    </Row>
  )
}
