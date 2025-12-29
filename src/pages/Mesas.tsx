import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/store/authStore'
import { mesasApi, ApiError } from '@/lib/api'
import { useMesaWebSocket } from '@/hooks/useMesaWebSocket'
import { toast } from 'sonner'
import MesaQRCode from '@/components/MesaQRCode'
import { 
  Table, Clock, Eye, Loader2, QrCode, Plus, Wifi, WifiOff, 
  Users, ShoppingCart, DollarSign, RefreshCw, Trash2, User
} from 'lucide-react'

// Types
interface ItemPedido {
  id: number
  productoId: number
  clienteNombre: string
  cantidad: number
  precioUnitario: string
  nombreProducto?: string
  imagenUrl?: string | null
}

interface Pedido {
  id: number
  estado: 'pending' | 'preparing' | 'delivered' | 'closed'
  total: string
  createdAt: string
  closedAt?: string | null
}

interface MesaConPedido {
  id: number
  nombre: string
  restauranteId: number
  qrToken: string
  createdAt: string
  pedidoActual: Pedido | null
  items: ItemPedido[]
  itemsCount: number
  totalItems: number
}

// Helper para obtener el badge del estado
const getEstadoBadge = (estado: string | null | undefined) => {
  const estados: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pendiente', variant: 'outline' },
    preparing: { label: 'Preparando', variant: 'default' },
    delivered: { label: 'Entregado', variant: 'secondary' },
    closed: { label: 'Cerrado', variant: 'secondary' },
  }
  return estados[estado || 'pending'] || { label: 'Sin pedido', variant: 'outline' }
}

// Helper para calcular tiempo transcurrido
const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `${diffMins} min`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`
  
  return date.toLocaleDateString('es-ES')
}

const Mesas = () => {
  const token = useAuthStore((state) => state.token)
  const [mesas, setMesas] = useState<MesaConPedido[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMesa, setSelectedMesa] = useState<MesaConPedido | null>(null)
  const [verQR, setVerQR] = useState(false)
  const [crearMesaDialog, setCrearMesaDialog] = useState(false)
  const [nombreMesa, setNombreMesa] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [eliminarMesaDialog, setEliminarMesaDialog] = useState(false)
  const [mesaAEliminar, setMesaAEliminar] = useState<MesaConPedido | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // WebSocket connection para la mesa seleccionada (solo cuando hay modal abierto)
  const { state: mesaState, isConnected, disconnect } = useMesaWebSocket(
    selectedMesa && !verQR ? selectedMesa.qrToken : null
  )

  // Fetch mesas con pedidos
  const fetchMesas = useCallback(async () => {
    if (!token) return
    
    setIsLoading(true)
    try {
      const response = await mesasApi.getAllWithPedidos(token) as {
        success: boolean
        data: MesaConPedido[]
      }
      
      if (response.success && response.data) {
        setMesas(response.data)
      }
    } catch (error) {
      console.error('Error fetching mesas:', error)
      if (error instanceof ApiError) {
        toast.error('Error al cargar mesas', {
          description: error.message,
        })
      }
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchMesas()
  }, [fetchMesas])

  // Actualizar la mesa seleccionada cuando recibimos datos del WebSocket
  useEffect(() => {
    if (mesaState && selectedMesa) {
      setSelectedMesa(prev => {
        if (!prev) return null
        return {
          ...prev,
          pedidoActual: mesaState.pedido || prev.pedidoActual,
          items: mesaState.items,
          itemsCount: mesaState.items.length,
          totalItems: mesaState.items.reduce((sum, item) => sum + (item.cantidad || 1), 0)
        }
      })
    }
  }, [mesaState])

  const handleCrearMesa = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token) {
      toast.error('No hay sesión activa')
      return
    }

    if (!nombreMesa.trim()) {
      toast.error('El nombre de la mesa es requerido')
      return
    }

    setIsCreating(true)

    try {
      await mesasApi.create(token, nombreMesa)

      toast.success('Mesa creada', {
        description: 'La mesa se creó correctamente',
      })

      await fetchMesas()
      setCrearMesaDialog(false)
      setNombreMesa('')
    } catch (error) {
      console.error('Error al crear mesa:', error)
      if (error instanceof ApiError) {
        toast.error('Error al crear mesa', {
          description: error.message,
        })
      } else {
        toast.error('Error de conexión', {
          description: 'No se pudo conectar con el servidor',
        })
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleVerQR = (mesa: MesaConPedido) => {
    setSelectedMesa(mesa)
    setVerQR(true)
  }

  const handleVerDetalles = (mesa: MesaConPedido) => {
    setSelectedMesa(mesa)
    setVerQR(false)
  }

  const handleCerrarDetalles = () => {
    disconnect()
    setSelectedMesa(null)
    setVerQR(false)
  }

  const handleEliminarMesa = async () => {
    if (!token || !mesaAEliminar) {
      toast.error('No hay sesión activa o mesa seleccionada')
      return
    }

    setIsDeleting(true)

    try {
      await mesasApi.delete(token, mesaAEliminar.id)

      toast.success('Mesa eliminada', {
        description: 'La mesa se eliminó correctamente',
      })

      await fetchMesas()
      setEliminarMesaDialog(false)
      setMesaAEliminar(null)
      setSelectedMesa(null)
    } catch (error) {
      console.error('Error al eliminar mesa:', error)
      if (error instanceof ApiError) {
        toast.error('Error al eliminar mesa', {
          description: error.message,
        })
      } else {
        toast.error('Error de conexión', {
          description: 'No se pudo conectar con el servidor',
        })
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAbrirEliminarDialog = (mesa: MesaConPedido) => {
    setMesaAEliminar(mesa)
    setEliminarMesaDialog(true)
  }

  // Agrupar items por cliente
  const agruparItemsPorCliente = (items: ItemPedido[]) => {
    return items.reduce((acc, item) => {
      const cliente = item.clienteNombre || 'Sin nombre'
      if (!acc[cliente]) {
        acc[cliente] = []
      }
      acc[cliente].push(item)
      return acc
    }, {} as Record<string, ItemPedido[]>)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Datos a mostrar: si hay WebSocket conectado, usar esos datos, sino usar los de la mesa
  const displayItems = mesaState?.items || selectedMesa?.items || []
  const displayTotal = mesaState?.total || selectedMesa?.pedidoActual?.total || '0.00'
  const displayEstado = mesaState?.estado || selectedMesa?.pedidoActual?.estado || 'pending'
  const displayClientes = mesaState?.clientes || []

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mesas</h1>
          <p className="text-muted-foreground">
            Gestiona y monitorea todas las mesas de tu restaurante
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchMesas} className="cursor-pointer">
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          <Button onClick={() => setCrearMesaDialog(true)} className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Mesa
          </Button>
        </div>
      </div>

      {mesas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Table className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-2">No hay mesas registradas</p>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Crea tu primera mesa para comenzar a recibir pedidos
            </p>
            <Button onClick={() => setCrearMesaDialog(true)} className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              Crear Primera Mesa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mesas.map((mesa) => {
            const estado = getEstadoBadge(mesa.pedidoActual?.estado)
            const hasActiveOrder = mesa.pedidoActual && mesa.pedidoActual.estado !== 'closed'
            
            return (
              <Card 
                key={mesa.id}
                className={`transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer ${
                  hasActiveOrder ? 'border-primary/50' : ''
                }`}
                onClick={() => handleVerDetalles(mesa)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{mesa.nombre}</CardTitle>
                    <Badge variant={estado.variant}>{estado.label}</Badge>
                  </div>
                  {mesa.pedidoActual && mesa.pedidoActual.estado !== 'closed' && (
                    <CardDescription className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getTimeAgo(mesa.pedidoActual.createdAt)}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Info del pedido activo */}
                    {hasActiveOrder ? (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center">
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Productos
                          </span>
                          <span className="font-medium">
                            {mesa.totalItems} {mesa.totalItems === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center">
                            <DollarSign className="mr-2 h-4 w-4" />
                            Total
                          </span>
                          <span className="font-bold text-lg">
                            ${parseFloat(mesa.pedidoActual?.total || '0').toFixed(2)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="py-2 text-center text-sm text-muted-foreground">
                        Mesa disponible - Sin pedido activo
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleVerQR(mesa)
                      }}
                      className="cursor-pointer"
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      Ver QR
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleVerDetalles(mesa)
                      }}
                      className="cursor-pointer"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Detalles
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog de Detalles */}
      {selectedMesa && !verQR && (
        <Dialog open={!!selectedMesa && !verQR} onOpenChange={(open) => !open && handleCerrarDetalles()}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedMesa.nombre}
                {isConnected ? (
                  <Badge variant="default" className="gap-1">
                    <Wifi className="h-3 w-3" />
                    En vivo
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <WifiOff className="h-3 w-3" />
                    Offline
                  </Badge>
                )}
                <Badge variant={getEstadoBadge(displayEstado).variant} className="ml-auto">
                  {getEstadoBadge(displayEstado).label}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {isConnected ? 'Actualizaciones en tiempo real' : 'Información del pedido actual'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Clientes conectados */}
              {displayClientes.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Clientes Conectados ({displayClientes.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {displayClientes.map((cliente) => (
                        <Badge key={cliente.id} variant="outline" className="gap-1">
                          <User className="h-3 w-3" />
                          {cliente.nombre}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Items del pedido agrupados por cliente */}
              {displayItems.length > 0 ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Items del Pedido
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(agruparItemsPorCliente(displayItems)).map(([cliente, items], idx) => (
                        <div key={cliente}>
                          {idx > 0 && <Separator className="my-3" />}
                          <div className="mb-2">
                            <Badge variant="secondary" className="gap-1">
                              <User className="h-3 w-3" />
                              {cliente}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {items.map((item) => (
                              <div 
                                key={item.id} 
                                className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  {item.imagenUrl && (
                                    <img 
                                      src={item.imagenUrl} 
                                      alt={item.nombreProducto} 
                                      className="w-10 h-10 rounded object-cover"
                                    />
                                  )}
                                  <div>
                                    <p className="font-medium text-sm">{item.nombreProducto}</p>
                                    <p className="text-xs text-muted-foreground">
                                      ${parseFloat(item.precioUnitario).toFixed(2)} x {item.cantidad}
                                    </p>
                                  </div>
                                </div>
                                <p className="font-semibold">
                                  ${(parseFloat(item.precioUnitario) * (item.cantidad || 1)).toFixed(2)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No hay productos en el pedido</p>
                  </CardContent>
                </Card>
              )}

              {/* Total */}
              {displayItems.length > 0 && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Total del Pedido</p>
                        <p className="text-xs text-muted-foreground">
                          {displayItems.reduce((sum, item) => sum + (item.cantidad || 1), 0)} productos
                        </p>
                      </div>
                      <p className="text-3xl font-bold text-primary">
                        ${parseFloat(displayTotal).toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Información de la mesa */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Información de la Mesa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID Mesa:</span>
                    <span className="font-mono">{selectedMesa.id}</span>
                  </div>
                  {selectedMesa.pedidoActual && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID Pedido:</span>
                      <span className="font-mono">{selectedMesa.pedidoActual.id}</span>
                    </div>
                  )}
                  {selectedMesa.pedidoActual?.createdAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pedido iniciado:</span>
                      <span>{new Date(selectedMesa.pedidoActual.createdAt).toLocaleString('es-ES')}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Acciones */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    setVerQR(true)
                  }}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Ver QR Code
                </Button>
                <Button 
                  variant="destructive" 
                  className="cursor-pointer"
                  onClick={() => handleAbrirEliminarDialog(selectedMesa)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar Mesa
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de QR Code */}
      {verQR && selectedMesa && (
        <Dialog open={verQR} onOpenChange={(open) => {
          setVerQR(open)
          if (!open) setSelectedMesa(null)
        }}>
          <DialogContent className="max-w-md">
            <MesaQRCode 
              qrToken={selectedMesa.qrToken}
              mesaNombre={selectedMesa.nombre}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de Confirmación de Eliminación */}
      <Dialog open={eliminarMesaDialog} onOpenChange={setEliminarMesaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar Mesa?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará la mesa "{mesaAEliminar?.nombre}" y todos los pedidos asociados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEliminarMesaDialog(false)
                setMesaAEliminar(null)
              }}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleEliminarMesa}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Crear Mesa */}
      <Dialog open={crearMesaDialog} onOpenChange={setCrearMesaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nueva Mesa</DialogTitle>
            <DialogDescription>
              Agrega una nueva mesa a tu restaurante
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCrearMesa} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombreMesa">Nombre de la mesa *</Label>
              <Input
                id="nombreMesa"
                value={nombreMesa}
                onChange={(e) => setNombreMesa(e.target.value)}
                placeholder="Ej: Mesa 1, Mesa VIP, etc."
                required
                disabled={isCreating}
                minLength={3}
              />
              <p className="text-xs text-muted-foreground">
                Este nombre será visible para los clientes
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCrearMesaDialog(false)}
                disabled={isCreating}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating} className="cursor-pointer">
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Mesa
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Mesas
