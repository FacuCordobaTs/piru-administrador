import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Horarios as HorariosData, Turno } from './resumirHorarios'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const ORDEN = [1, 2, 3, 4, 5, 6, 0]

interface HorariosGridProps {
  horarios: HorariosData
  loaded: boolean
  agregarTurno: (dia: number) => void
  eliminarTurno: (dia: number, idx: number) => void
  actualizarTurno: (dia: number, idx: number, campo: keyof Turno, valor: string) => void
}

/** Editor semanal (grilla día/turnos). Autosave con debounce vía useHorarios. */
export function HorariosGrid({
  horarios,
  loaded,
  agregarTurno,
  eliminarTurno,
  actualizarTurno,
}: HorariosGridProps) {
  if (!loaded) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  return (
    <div className="divide-y divide-border">
      {ORDEN.map((dia) => {
        const turnos = horarios[dia] || []
        const abierto = turnos.length > 0
        return (
          <div key={dia} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start">
            <div className="flex items-center gap-2 sm:w-28 sm:pt-2">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', abierto ? 'bg-green-500' : 'bg-muted-foreground/30')} />
              <span className={cn('text-sm', abierto ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {DIAS[dia]}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {turnos.length === 0 ? (
                <span className="text-sm text-muted-foreground sm:pt-2">Cerrado</span>
              ) : (
                turnos.map((turno, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-muted p-1.5">
                    <Input
                      type="time"
                      value={turno.horaApertura}
                      onChange={(e) => actualizarTurno(dia, i, 'horaApertura', e.target.value)}
                      className="h-10 min-w-[92px] flex-1 border-none bg-background"
                    />
                    <span className="text-sm text-muted-foreground">a</span>
                    <Input
                      type="time"
                      value={turno.horaCierre}
                      onChange={(e) => actualizarTurno(dia, i, 'horaCierre', e.target.value)}
                      className="h-10 min-w-[92px] flex-1 border-none bg-background"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 text-muted-foreground hover:text-red-500"
                      onClick={() => eliminarTurno(dia, i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
              <button
                onClick={() => agregarTurno(dia)}
                className="mt-0.5 flex w-fit items-center gap-1.5 text-sm font-medium text-brand"
              >
                <Plus className="h-4 w-4" /> Agregar turno
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
