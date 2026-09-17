import { Sparkles, Zap } from 'lucide-react'
import MotorRecompra from '../MotorRecompra'
import { PuntosPanel } from './PuntosPanel'
import type { RetencionTab } from './types'

/**
 * Pantalla única de Retención. Puntos y motor de recompra son dos capacidades
 * del mismo módulo, así que viven en la misma tab con un switch adentro:
 * el Club de Puntos (saldo, canjes y configuración) y el motor de recompra
 * (cola, historial y prioridades).
 */
export function RetencionPanel({
  vista,
  onCambiarVista,
}: {
  vista: RetencionTab
  onCambiarVista: (vista: RetencionTab) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 sm:px-6">
        <div className="mx-auto max-w-[1680px]">
          <div className="flex rounded-xl bg-muted/60 p-1 sm:max-w-md">
            <BotonVista
              activo={vista === 'puntos'}
              onClick={() => onCambiarVista('puntos')}
              icono={<Sparkles className="h-3.5 w-3.5" />}
            >
              Puntos
            </BotonVista>
            <BotonVista
              activo={vista === 'motor'}
              onClick={() => onCambiarVista('motor')}
              icono={<Zap className="h-3.5 w-3.5" />}
            >
              Motor de recompra
            </BotonVista>
          </div>
        </div>
      </div>

      {vista === 'puntos' ? <PuntosPanel /> : <MotorRecompra />}
    </div>
  )
}

function BotonVista({ activo, onClick, icono, children }: { activo: boolean; onClick: () => void; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${activo ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {icono}
      <span className="truncate">{children}</span>
    </button>
  )
}
