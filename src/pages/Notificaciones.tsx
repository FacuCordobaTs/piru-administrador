import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bell, ShoppingCart, Table, DollarSign, CheckCircle, TestTube } from 'lucide-react'
import { toast } from 'sonner'
import NuevoPedidoModal from '@/components/NuevoPedidoModal'
import type { PedidoData } from '@/components/PedidoCompleto'

// Datos de ejemplo (simulados)
const notificacionesEjemplo = [
  {
    id: 1,
    tipo: 'pedido',
    titulo: 'Nuevo pedido en Mesa 5',
    descripcion: '2x Pizza Margarita, 1x Coca Cola',
    tiempo: 'Hace 2 minutos',
    leida: false,
    accion: 'Ver pedido'
  },
  {
    id: 2,
    tipo: 'pago',
    titulo: 'Pago recibido - Mesa 3',
    descripcion: 'Total: $125.50 - Efectivo',
    tiempo: 'Hace 15 minutos',
    leida: false,
    accion: 'Marcar como procesado'
  },
  {
    id: 3,
    tipo: 'mesa',
    titulo: 'Nueva mesa abierta',
    descripcion: 'Mesa 7 - 4 clientes conectados',
    tiempo: 'Hace 25 minutos',
    leida: true,
    accion: 'Ver mesa'
  },
  {
    id: 4,
    tipo: 'pedido',
    titulo: 'Pedido confirmado - Mesa 2',
    descripcion: 'El cliente confirmó su pedido',
    tiempo: 'Hace 30 minutos',
    leida: true,
    accion: 'Ver pedido'
  },
  {
    id: 5,
    tipo: 'pedido',
    titulo: 'Nuevo pedido en Mesa 1',
    descripcion: '1x Hamburguesa, 2x Papas Fritas',
    tiempo: 'Hace 45 minutos',
    leida: true,
    accion: 'Ver pedido'
  },
]

const Notificaciones = () => {
  const [notificaciones, setNotificaciones] = useState(notificacionesEjemplo)
  const [filtro, setFiltro] = useState<'todas' | 'pedidos' | 'pagos' | 'mesas'>('todas')
  const [nuevoPedidoModal, setNuevoPedidoModal] = useState(false)
  
  const pedidoEjemplo: PedidoData = {
    id: 999,
    mesa: 'Mesa 8',
    estado: 'pendiente',
    clientes: [
      { id: 1, nombre: 'Ana' },
      { id: 2, nombre: 'Carlos' },
    ],
    items: [
      { id: 1, nombre: 'Pizza Margarita', cantidad: 1, precio: 12.50, cliente: 'Ana', subtotal: 12.50 },
      { id: 2, nombre: 'Hamburguesa Clásica', cantidad: 1, precio: 8.75, cliente: 'Carlos', subtotal: 8.75 },
      { id: 3, nombre: 'Coca Cola', cantidad: 2, precio: 2.50, cliente: 'Ana', subtotal: 5.00 },
    ],
    total: 26.25,
    tiempoAbierta: '5 min',
    fechaCreacion: new Date().toISOString()
  }

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'pedido':
        return ShoppingCart
      case 'pago':
        return DollarSign
      case 'mesa':
        return Table
      default:
        return Bell
    }
  }

  const getColor = (tipo: string) => {
    switch (tipo) {
      case 'pedido':
        return 'text-primary'
      case 'pago':
        return 'text-green-500'
      case 'mesa':
        return 'text-blue-500'
      default:
        return 'text-muted-foreground'
    }
  }

  const marcarComoLeida = (id: number) => {
    setNotificaciones(notificaciones.map(n => 
      n.id === id ? { ...n, leida: true } : n
    ))
  }

  const filtrarNotificaciones = () => {
    if (filtro === 'todas') return notificaciones
    return notificaciones.filter(n => n.tipo === filtro.slice(0, -1)) // Remover 's' del final
  }

  const notificacionesFiltradas = filtrarNotificaciones()
  const noLeidas = notificaciones.filter(n => !n.leida).length

  const probarNotificacionPedido = () => {
    toast.success('¡Nuevo pedido recibido!', {
      description: 'Se ha recibido un nuevo pedido en Mesa 8',
      duration: 4000,
      action: {
        label: 'Ver',
        onClick: () => setNuevoPedidoModal(true),
      },
    })
  }

  const probarNotificacionPago = () => {
    toast.success('Pago recibido', {
      description: 'Mesa 3 - Total: $125.50 - Efectivo',
      duration: 3000,
    })
  }

  const probarNotificacionMesa = () => {
    toast.info('Nueva mesa abierta', {
      description: 'Mesa 7 - 4 clientes conectados',
      duration: 3000,
    })
  }

  const probarNotificacionError = () => {
    toast.error('Error al procesar pedido', {
      description: 'No se pudo confirmar el pedido de Mesa 2',
      duration: 4000,
    })
  }

  const probarModalNuevoPedido = () => {
    setNuevoPedidoModal(true)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notificaciones</h1>
          <p className="text-muted-foreground">
            Mantente al día con todas las actividades de tu restaurante
          </p>
        </div>
        <div className="flex items-center gap-2">
          {noLeidas > 0 && (
            <Badge variant="default" className="text-lg px-3 py-1">
              {noLeidas} nueva{noLeidas !== 1 ? 's' : ''}
            </Badge>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={probarModalNuevoPedido}
              className="hidden md:flex"
            >
              <TestTube className="mr-2 h-4 w-4" />
              Probar Modal Pedido
            </Button>
          </div>
        </div>
      </div>

      {/* Botones de Prueba */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold flex items-center">
                <TestTube className="mr-2 h-4 w-4" />
                Pruebas de Notificaciones
              </h3>
              <p className="text-sm text-muted-foreground">
                Prueba las diferentes notificaciones del sistema
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={probarNotificacionPedido}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Toast: Nuevo Pedido
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={probarNotificacionPago}
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Toast: Pago Recibido
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={probarNotificacionMesa}
            >
              <Table className="mr-2 h-4 w-4" />
              Toast: Nueva Mesa
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={probarNotificacionError}
            >
              <Bell className="mr-2 h-4 w-4" />
              Toast: Error
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={probarModalNuevoPedido}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Modal: Nuevo Pedido
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="mesas">Mesas</TabsTrigger>
        </TabsList>

        <TabsContent value={filtro} className="space-y-4 mt-6">
          {notificacionesFiltradas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay notificaciones en esta categoría</p>
              </CardContent>
            </Card>
          ) : (
            notificacionesFiltradas.map((notif) => {
              const Icon = getIcon(notif.tipo)
              return (
                <Card 
                  key={notif.id}
                  className={`transition-all duration-300 hover:shadow-md ${
                    !notif.leida ? 'border-primary border-2' : ''
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-lg bg-muted ${getColor(notif.tipo)}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">{notif.titulo}</h3>
                            <p className="text-sm text-muted-foreground">{notif.descripcion}</p>
                          </div>
                          {!notif.leida && (
                            <Badge variant="default" className="ml-2">Nueva</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">{notif.tiempo}</p>
                          <div className="flex gap-2">
                            {!notif.leida && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => marcarComoLeida(notif.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Marcar como leída
                              </Button>
                            )}
                            <Button variant="outline" size="sm">
                              {notif.accion}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>
      </Tabs>

      {noLeidas > 0 && (
        <Card className="bg-primary/10 border-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                Tienes {noLeidas} notificación{noLeidas !== 1 ? 'es' : ''} sin leer
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNotificaciones(notificaciones.map(n => ({ ...n, leida: true })))
                }}
              >
                Marcar todas como leídas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <NuevoPedidoModal
        open={nuevoPedidoModal}
        onClose={() => setNuevoPedidoModal(false)}
        pedido={pedidoEjemplo}
      />
    </div>
  )
}

export default Notificaciones

