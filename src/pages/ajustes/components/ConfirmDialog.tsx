import { useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descripcion?: ReactNode
  confirmLabel?: string
  /** Estilo destructivo (rojo) para acciones como desconectar. */
  destructivo?: boolean
  onConfirm: () => void | Promise<void>
}

/** Confirmación en dialog propio (reemplaza window.confirm). */
export function ConfirmDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  confirmLabel = 'Confirmar',
  destructivo,
  onConfirm,
}: ConfirmDialogProps) {
  const [procesando, setProcesando] = useState(false)

  const confirmar = async () => {
    setProcesando(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">{titulo}</DialogTitle>
          {descripcion && (
            <DialogDescription className="font-normal">{descripcion}</DialogDescription>
          )}
        </DialogHeader>
        <div className="mt-2 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={procesando}
            className="h-11 min-h-[44px] font-medium"
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={procesando}
            className={cn(
              'h-11 min-h-[44px] font-medium',
              destructivo && 'bg-red-600 text-white hover:bg-red-700'
            )}
          >
            {procesando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
