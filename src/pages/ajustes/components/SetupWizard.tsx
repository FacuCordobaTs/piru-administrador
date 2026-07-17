import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SetupStep {
  titulo: string
  descripcion?: string
  contenido: ReactNode
}

interface SetupWizardProps {
  steps: SetupStep[]
  onComplete: () => void
  /** Texto del botón final. Por defecto "Finalizar". */
  finalLabel?: string
}

/** Envuelve cada paso con un fade-in de 150ms (solo transform/opacity). */
function StepFade({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div
      className={cn(
        'transition-all duration-150 ease-out',
        shown ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'
      )}
    >
      {children}
    </div>
  )
}

/**
 * Setup por primera vez: una pregunta por pantalla (regla 11 — configurar ≠
 * ajustes). Barra de progreso, Volver/Continuar, y al terminar `onComplete`.
 */
export function SetupWizard({ steps, onComplete, finalLabel = 'Finalizar' }: SetupWizardProps) {
  const [index, setIndex] = useState(0)
  const total = steps.length
  const step = steps[index]
  const esUltimo = index === total - 1

  const continuar = () => {
    if (esUltimo) onComplete()
    else setIndex((i) => Math.min(i + 1, total - 1))
  }
  const volver = () => setIndex((i) => Math.max(i - 1, 0))

  if (!step) return null

  return (
    <div className="flex flex-col gap-6">
      {/* Barra de progreso */}
      <div className="space-y-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand transition-all duration-300 ease-out"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <p className="text-[13px] font-normal text-muted-foreground">
          Paso {index + 1} de {total}
        </p>
      </div>

      {/* Paso actual (remonta y hace fade al cambiar de index) */}
      <StepFade key={index}>
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-medium text-foreground">{step.titulo}</h3>
            {step.descripcion && (
              <p className="text-[13px] font-normal text-muted-foreground">
                {step.descripcion}
              </p>
            )}
          </div>
          <div>{step.contenido}</div>
        </div>
      </StepFade>

      {/* Navegación */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={volver}
          disabled={index === 0}
          className="h-11 min-h-[44px] font-medium disabled:opacity-0"
        >
          Volver
        </Button>
        <Button
          onClick={continuar}
          className="h-11 min-h-[44px] font-medium"
        >
          {esUltimo ? finalLabel : 'Continuar'}
        </Button>
      </div>
    </div>
  )
}
