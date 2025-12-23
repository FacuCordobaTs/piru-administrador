import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, Users, Clock, DollarSign, Eye, ShoppingCart } from 'lucide-react'
import PedidoCompleto from '@/components/PedidoCompleto'

// Datos de ejemplo (simulados)
const mesasEjemplo = [
  {
    id: 1,
    nombre: 'Mesa 1',
    estado: 'ocupada',
    clientes: 3,
    pedidoTotal: 125.50,
    tiempoAbierta: '45 min',
    ultimoPedido: 'Hace 10 min'
  },
  {
    id: 2,
    nombre: 'Mesa 2',
    estado: 'ocupada',
    clientes: 2,
    pedidoTotal: 89.00,
    tiempoAbierta: '30 min',
    ultimoPedido: 'Hace 5 min'
  },
  {
    id: 3,
    nombre: 'Mesa 3',
    estado: 'libre',
    clientes: 0,
    pedidoTotal: 0,
    tiempoAbierta: '-',
    ultimoPedido: '-'
  },
  {
    id: 4,
    nombre: 'Mesa 4',
    estado: 'ocupada',
    clientes: 4,
    pedidoTotal: 210.75,
    tiempoAbierta: '1h 15 min',
    ultimoPedido: 'Hace 2 min'
  },
  {
    id: 5,
    nombre: 'Mesa 5',
    estado: 'pendiente',
    clientes: 2,
    pedidoTotal: 45.00,
    tiempoAbierta: '20 min',
    ultimoPedido: 'Hace 1 min'
  },
]

const Mesas = () => {
  const [selectedMesa, setSelectedMesa] = useState<typeof mesasEjemplo[0] | null>(null)
  const [verPedidoCompleto, setVerPedidoCompleto] = useState(false)

  const getEstadoBadge = (estado: string) => {
    const estados: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      ocupada: { label: 'Ocupada', variant: 'default' },
      libre: { label: 'Libre', variant: 'secondary' },
      pendiente: { label: 'Pendiente', variant: 'outline' },
    }
    return estados[estado] || { label: estado, variant: 'secondary' }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mesas</h1>
          <p className="text-muted-foreground">
            Gestiona y monitorea todas las mesas de tu restaurante
          </p>
        </div>
        <Button>
          <Table className="mr-2 h-4 w-4" />
          Nueva Mesa
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mesasEjemplo.map((mesa) => {
          const estadoBadge = getEstadoBadge(mesa.estado)
          return (
            <Card 
              key={mesa.id}
              className="transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer"
              onClick={() => setSelectedMesa(mesa)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{mesa.nombre}</CardTitle>
                  <Badge variant={estadoBadge.variant}>
                    {estadoBadge.label}
                  </Badge>
                </div>
                <CardDescription>
                  {mesa.estado === 'libre' ? 'Disponible' : `${mesa.clientes} cliente${mesa.clientes !== 1 ? 's' : ''}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mesa.estado !== 'libre' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center">
                        <Users className="mr-2 h-4 w-4" />
                        Clientes
                      </span>
                      <span className="font-medium">{mesa.clientes}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center">
                        <DollarSign className="mr-2 h-4 w-4" />
                        Total
                      </span>
                      <span className="font-medium">${mesa.pedidoTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center">
                        <Clock className="mr-2 h-4 w-4" />
                        Tiempo
                      </span>
                      <span className="font-medium">{mesa.tiempoAbierta}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Último pedido: {mesa.ultimoPedido}
                      </p>
                    </div>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedMesa(mesa)
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Ver Detalles
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {selectedMesa && (
        <Dialog open={!!selectedMesa} onOpenChange={() => setSelectedMesa(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedMesa.nombre} - Detalles</DialogTitle>
              <DialogDescription>
                Información completa de la mesa y su pedido actual
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Estado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={getEstadoBadge(selectedMesa.estado).variant}>
                      {getEstadoBadge(selectedMesa.estado).label}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Clientes Conectados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{selectedMesa.clientes}</p>
                  </CardContent>
                </Card>
              </div>
              {selectedMesa.estado !== 'libre' && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Pedido Actual</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total del pedido:</span>
                          <span className="font-bold">${selectedMesa.pedidoTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Tiempo abierta:</span>
                          <span>{selectedMesa.tiempoAbierta}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Último pedido:</span>
                          <span>{selectedMesa.ultimoPedido}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1"
                      onClick={() => setVerPedidoCompleto(true)}
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Ver Pedido Completo
                    </Button>
                    <Button variant="outline" className="flex-1">Marcar como Pagado</Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {verPedidoCompleto && (
        <Dialog open={verPedidoCompleto} onOpenChange={setVerPedidoCompleto}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Pedido Completo - {selectedMesa?.nombre}</DialogTitle>
              <DialogDescription>
                Detalle completo del pedido actual
              </DialogDescription>
            </DialogHeader>
            <PedidoCompleto />
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setVerPedidoCompleto(false)}>
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default Mesas

