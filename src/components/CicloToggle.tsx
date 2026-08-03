import { cn } from '@/lib/utils'

export type Ciclo = 'mensual' | 'anual'

/**
 * Segmented control Mensual / Anual para las pantallas de pricing. Cuando hay un
 * descuento anual disponible lo anuncia en la opción "Anual" ("Ahorrá X%") para que
 * el ahorro sea la razón visible de elegir el ciclo largo.
 */
export function CicloToggle({
  value,
  onChange,
  descuentoMax = 0,
  className,
}: {
  value: Ciclo
  onChange: (c: Ciclo) => void
  descuentoMax?: number
  className?: string
}) {
  const opciones: { id: Ciclo; label: string }[] = [
    { id: 'mensual', label: 'Mensual' },
    { id: 'anual', label: 'Anual' },
  ]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1',
        className,
      )}
    >
      {opciones.map((o) => {
        const activo = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              activo
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
            {o.id === 'anual' && descuentoMax > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none',
                  activo ? 'bg-brand/10 text-brand' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                )}
              >
                -{descuentoMax}%
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
