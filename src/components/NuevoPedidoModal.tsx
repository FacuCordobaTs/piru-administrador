import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import PedidoCompleto, { type PedidoData } from './PedidoCompleto'

interface NuevoPedidoModalProps {
  open: boolean
  onClose: () => void
  pedido?: PedidoData
}

const NuevoPedidoModal = ({ open, onClose, pedido }: NuevoPedidoModalProps) => {
  if (!pedido) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">¡Nuevo Pedido!</DialogTitle>
              <DialogDescription className="text-base mt-2">
                Se ha recibido un nuevo pedido en {pedido.mesa}
              </DialogDescription>
            </div>
            <Badge variant="default" className="text-lg px-3 py-1 animate-pulse">
              Nuevo
            </Badge>
          </div>
        </DialogHeader>
        
        <div className="mt-4">
          <PedidoCompleto pedido={pedido} onClose={onClose} />
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={onClose}
          >
            Ver Más Tarde
          </Button>
          <Button 
            className="flex-1"
            onClick={() => {
              // Aquí se marcaría como visto/confirmado
              onClose()
            }}
          >
            Confirmar Pedido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default NuevoPedidoModal

