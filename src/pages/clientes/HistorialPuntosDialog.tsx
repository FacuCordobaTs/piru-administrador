import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Sparkles } from 'lucide-react'
import { HistorialPuntosContenido } from './MovimientosPuntos'

interface HistorialPuntosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  clienteId: number
  clienteNombre: string
  puntosActuales: number
  onPuntosActualizados: (nuevosPuntos: number) => void
}

/**
 * Vista rápida de puntos desde el directorio de clientes. El cuerpo es el mismo
 * que usa la mitad Puntos de Retención (`HistorialPuntosContenido`).
 */
export function HistorialPuntosDialog({
  open,
  onOpenChange,
  token,
  clienteId,
  clienteNombre,
  puntosActuales,
  onPuntosActualizados,
}: HistorialPuntosDialogProps) {
  // El saldo vive acá para que la cabecera se actualice junto con el cuerpo.
  // Se reinicia al cambiar de cliente con el patrón de React de ajustar estado
  // durante el render (el diálogo se abre seteando `open` desde el padre, así
  // que no hay transición de `onOpenChange` en la que apoyarse).
  const [saldoLocal, setSaldoLocal] = useState<number | null>(null)
  const [clienteIdPrevio, setClienteIdPrevio] = useState(clienteId)
  if (clienteId !== clienteIdPrevio) {
    setClienteIdPrevio(clienteId)
    setSaldoLocal(null)
  }
  const puntos = saldoLocal ?? puntosActuales

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-6 rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Puntos de Fidelización</span>
          </div>
          <DialogTitle className="text-xl font-bold flex items-center justify-between mt-1">
            <span className="truncate">{clienteNombre}</span>
            <span className="shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full text-base font-black">
              {puntos} pts
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Auditoría y movimientos de puntos acumulados y canjeados.
          </DialogDescription>
        </DialogHeader>

        {/* La `key` reinicia el cuerpo al cambiar de cliente sin desmontar el diálogo. */}
        <HistorialPuntosContenido
          key={clienteId}
          token={token}
          clienteId={clienteId}
          puntosActuales={puntosActuales}
          onPuntosActualizados={(nuevos) => {
            setSaldoLocal(nuevos)
            onPuntosActualizados(nuevos)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
