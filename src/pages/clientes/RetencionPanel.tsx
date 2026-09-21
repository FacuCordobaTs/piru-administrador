import MotorRecompra from '../MotorRecompra'
import { PuntosPanel } from './PuntosPanel'
import { RetencionBloqueada } from './RetencionBloqueada'
import type { EstadoRetencion, RetencionTab } from './types'

/**
 * Pantalla única de Retención. Puntos y motor de recompra son dos capacidades
 * del mismo módulo, así que viven en la misma tab: el Club de Puntos (saldo,
 * canjes y configuración) y el motor de recompra (cola, historial y
 * prioridades). El switch que elige la mitad vive en el header del workspace
 * —`Clientes.tsx`, y sólo con el módulo activo— junto a las tabs.
 *
 * Con el módulo apagado no se monta ninguna de las dos: no hay mitades que
 * elegir, así que en su lugar va la explicación de lo que habilita.
 */
export function RetencionPanel({ vista, estado }: { vista: RetencionTab; estado: EstadoRetencion }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {estado === 'inactiva' ? (
        <RetencionBloqueada />
      ) : estado === 'cargando' ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-16">
          <span className="text-xs text-muted-foreground">Cargando módulo…</span>
        </div>
      ) : vista === 'puntos' ? (
        <PuntosPanel />
      ) : (
        <MotorRecompra />
      )}
    </div>
  )
}
