import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ShoppingCart } from 'lucide-react'

// Tipo para el pedido
export interface PedidoData {
  id: number
  mesa: string
  estado: string
  clientes: Array<{ id: number; nombre: string }>
  items: Array<{
    id: number
    nombre: string
    cantidad: number
    precio: number
    cliente: string
    subtotal: number
  }>
  total: number
  tiempoAbierta: string
  fechaCreacion: string
}

// Datos de ejemplo para el pedido
const pedidoEjemplo: PedidoData = {
  id: 1,
  mesa: 'Mesa 5',
  estado: 'pendiente',
  clientes: [
    { id: 1, nombre: 'Juan' },
    { id: 2, nombre: 'María' },
    { id: 3, nombre: 'Pedro' },
  ],
  items: [
    { id: 1, nombre: 'Pizza Margarita', cantidad: 2, precio: 12.50, cliente: 'Juan', subtotal: 25.00 },
    { id: 2, nombre: 'Coca Cola', cantidad: 1, precio: 2.50, cliente: 'María', subtotal: 2.50 },
    { id: 3, nombre: 'Hamburguesa Clásica', cantidad: 1, precio: 8.75, cliente: 'Pedro', subtotal: 8.75 },
    { id: 4, nombre: 'Papas Fritas', cantidad: 2, precio: 4.00, cliente: 'Juan', subtotal: 8.00 },
  ],
  total: 44.25,
  tiempoAbierta: '20 min',
  fechaCreacion: '2024-01-15 14:30'
}

interface PedidoCompletoProps {
  pedido?: PedidoData
  onClose?: () => void
}

const PedidoCompleto = ({ pedido = pedidoEjemplo }: PedidoCompletoProps) => {
  const itemsPorCliente = pedido.items.reduce((acc, item) => {
    if (!acc[item.cliente]) {
      acc[item.cliente] = []
    }
    acc[item.cliente].push(item)
    return acc
  }, {} as Record<string, typeof pedido.items>)

  const getEstadoBadge = (estado: string) => {
    const estados: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pendiente: { label: 'Pendiente', variant: 'outline' },
      confirmado: { label: 'Confirmado', variant: 'default' },
      preparando: { label: 'Preparando', variant: 'default' },
      listo: { label: 'Listo', variant: 'default' },
      entregado: { label: 'Entregado', variant: 'secondary' },
    }
    return estados[estado] || { label: estado, variant: 'secondary' }
  }

  const estadoBadge = getEstadoBadge(pedido.estado)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pedido #{pedido.id}</h2>
          <p className="text-muted-foreground">{pedido.mesa}</p>
        </div>
        <Badge variant={estadoBadge.variant} className="text-lg px-3 py-1">
          {estadoBadge.label}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShoppingCart className="mr-2 h-5 w-5" />
            Items del Pedido
          </CardTitle>
          <CardDescription>
            Productos ordenados por cada cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(itemsPorCliente).map(([cliente, items], index) => (
              <div key={cliente}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">{cliente}</h3>
                  <Badge variant="secondary">
                    {items.length} item{items.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          ${item.precio.toFixed(2)} x {item.cantidad}
                        </p>
                      </div>
                      <p className="font-bold">${item.subtotal.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                {index < Object.keys(itemsPorCliente).length - 1 && (
                  <Separator className="my-4" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Total del Pedido</p>
              <p className="text-xs text-muted-foreground">Incluye todos los items</p>
            </div>
            <p className="text-3xl font-bold text-primary">${pedido.total.toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PedidoCompleto

