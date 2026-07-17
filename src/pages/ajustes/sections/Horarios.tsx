import { useState } from 'react'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { resumirHorarios } from './horarios/resumirHorarios'
import { useHorarios } from './horarios/useHorarios'
import { HorariosGrid } from './horarios/HorariosGrid'
import { ProgramadosEditor } from './horarios/ProgramadosEditor'

type EditorId = 'horarios' | 'programados' | null

export default function Horarios() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const [editor, setEditor] = useState<EditorId>(null)
  const h = useHorarios()

  const programadosOn = restaurante?.permitirPedidosProgramados === true

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Horarios</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Cuándo abrís y si aceptás pedidos para más tarde.
        </p>
      </header>

      <div>
        <AjusteRow
          titulo="Horarios de atención"
          oracion={h.loaded ? resumirHorarios(h.horarios) : 'Cargando…'}
          estado={h.loaded && Object.keys(h.horarios).length > 0 ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('horarios')}
        />
        <AjusteRow
          titulo="Pedidos programados"
          oracion={programadosOn ? 'Activados' : 'Desactivados'}
          estado={programadosOn ? 'configurado' : 'sin-configurar'}
          accionLabel={programadosOn ? 'Cambiar' : 'Activar'}
          onAccion={() => setEditor('programados')}
        />
      </div>

      <AjusteEditor
        open={editor === 'horarios'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Horarios de atención"
        descripcion="Se guarda solo, un ratito después de tu último cambio."
        status={h.status}
      >
        <HorariosGrid
          horarios={h.horarios}
          loaded={h.loaded}
          agregarTurno={h.agregarTurno}
          eliminarTurno={h.eliminarTurno}
          actualizarTurno={h.actualizarTurno}
        />
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'programados'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Pedidos programados"
        descripcion="Que tus clientes puedan pedir para una franja más tarde."
      >
        <ProgramadosEditor horarios={h.horarios} />
      </AjusteEditor>
    </section>
  )
}
