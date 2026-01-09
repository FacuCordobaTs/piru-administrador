import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuthStore } from '@/store/authStore'
import { pedidosApi, productosApi, ApiError } from '@/lib/api'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'
import { toast } from 'sonner'
import { 
  Loader2, ArrowLeft, Clock, CheckCircle, ChefHat, Utensils, 
  ShoppingCart, Users, Wifi, WifiOff, User, Plus, Trash2, Minus,
  Receipt, CreditCard, Banknote, AlertCircle, CheckCircle2, XCircle, Search, Package
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
  descripcion?: string | null
  ingredientesExcluidos?: number[]
  ingredientesExcluidosNombres?: string[]
}

interface PagoInfo {
  id: number
  metodo: 'efectivo' | 'mercadopago'
  estado: 'pending' | 'paid' | 'failed'
  monto: string
  mpPaymentId?: string | null
  createdAt: string
}

interface Producto {
  id: number
  nombre: string
  descripcion: string | null
  precio: string
  activo: boolean
  imagenUrl: string | null
}

interface PedidoDetalle {
  id: number
  mesaId: number | null
  mesaNombre: string | null
  mesaQrToken?: string | null
  estado: 'pending' | 'preparing' | 'delivered' | 'closed'
  total: string
  createdAt: string
  closedAt?: string | null
  items: ItemPedido[]
  itemsPorCliente: Record<string, ItemPedido[]>
  totalItems: number
  pago?: PagoInfo | null
  pagos?: PagoInfo[]
}

// Helper para obtener el badge del estado
const getEstadoBadge = (estado: string | null | undefined) => {
  const estados: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; color: string }> = {
    pending: { label: 'Pendiente', variant: 'outline', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
    preparing: { label: 'Preparando', variant: 'default', icon: ChefHat, color: 'text-blue-600 bg-blue-100' },
    delivered: { label: 'Entregado', variant: 'secondary', icon: Utensils, color: 'text-green-600 bg-green-100' },
    closed: { label: 'Cerrado', variant: 'secondary', icon: CheckCircle, color: 'text-gray-600 bg-gray-100' },
  }
  return estados[estado || 'pending'] || estados.pending
}

// Helper para obtener info del estado del pago
const getEstadoPagoBadge = (estado: string | null | undefined) => {
  const estados: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
    pending: { label: 'Pendiente', variant: 'outline', icon: Clock },
    paid: { label: 'Pagado', variant: 'default', icon: CheckCircle2 },
    failed: { label: 'Fallido', variant: 'destructive', icon: XCircle },
  }
  return estados[estado || 'pending'] || estados.pending
}

// Helper para obtener info del método de pago
const getMetodoPagoInfo = (metodo: string | null | undefined) => {
  const metodos: Record<string, { label: string; icon: any }> = {
    efectivo: { label: 'Efectivo', icon: Banknote },
    mercadopago: { label: 'MercadoPago', icon: CreditCard },
  }
  return metodos[metodo || 'efectivo'] || metodos.efectivo
}

// Helper para formatear fecha completa
const formatDateFull = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', { 
    weekday: 'long',
    day: 'numeric', 
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Helper para calcular tiempo transcurrido
const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Hace un momento'
  if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`
  
  const diffDays = Math.floor(diffHours / 24)
  return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`
}

// Helper para calcular duración
const getDuration = (startDate: string, endDate?: string | null) => {
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date()
  const diffMs = end.getTime() - start.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 60) return `${diffMins} min`
  
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  return `${hours}h ${mins}m`
}

const Pedido = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  
  // WebSocket para actualizaciones en tiempo real
  const { mesas: mesasWS, isConnected } = useAdminWebSocket()
  
  // State
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Estados para gestión de productos
  const [addProductSheet, setAddProductSheet] = useState(false)
  const [productos, setProductos] = useState<Producto[]>([])
  const [loadingProductos, setLoadingProductos] = useState(false)
  const [searchProducto, setSearchProducto] = useState('')
  const [addingProducto, setAddingProducto] = useState<number | null>(null)
  const [cantidadProducto, setCantidadProducto] = useState<Record<number, number>>({})
  
  // Estados para eliminar item
  const [itemAEliminar, setItemAEliminar] = useState<ItemPedido | null>(null)
  const [deletingItem, setDeletingItem] = useState(false)
  
  // Estados para eliminar pedido completo
  const [showDeletePedidoDialog, setShowDeletePedidoDialog] = useState(false)
  const [deletingPedido, setDeletingPedido] = useState(false)

  // Fetch pedido desde API REST
  const fetchPedido = useCallback(async () => {
    if (!token || !id) return
    
    setIsLoading(true)
    try {
      const response = await pedidosApi.getById(token, Number(id)) as {
        success: boolean
        data: PedidoDetalle
      }
      
      if (response.success && response.data) {
        setPedido(response.data)
      }
    } catch (error) {
      console.error('Error fetching pedido:', error)
      if (error instanceof ApiError) {
        toast.error('Error al cargar el pedido', { description: error.message })
        if (error.status === 404) {
          navigate('/dashboard/pedidos')
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [token, id, navigate])

  // Initial fetch
  useEffect(() => {
    fetchPedido()
  }, [fetchPedido])

  // Actualizar desde WebSocket
  useEffect(() => {
    if (!pedido || mesasWS.length === 0) return
    
    // Buscar si este pedido está en alguna mesa del WebSocket
    const mesaWS = mesasWS.find(m => m.pedido?.id === pedido.id)
    if (mesaWS && mesaWS.pedido) {
      setPedido(prev => {
        if (!prev) return null
        
        // Agrupar items por cliente
        const itemsPorCliente = mesaWS.items.reduce((acc, item) => {
          const cliente = item.clienteNombre || 'Sin nombre'
          if (!acc[cliente]) {
            acc[cliente] = []
          }
          acc[cliente].push(item)
          return acc
        }, {} as Record<string, ItemPedido[]>)
        
        return {
          ...prev,
          estado: mesaWS.pedido!.estado,
          total: mesaWS.pedido!.total,
          items: mesaWS.items,
          itemsPorCliente,
          totalItems: mesaWS.totalItems
        }
      })
    }
  }, [mesasWS, pedido?.id])

  // Cambiar estado del pedido
  const handleChangeEstado = async (nuevoEstado: string) => {
    if (!token || !pedido) return
    
    setIsUpdating(true)
    try {
      await pedidosApi.updateEstado(token, pedido.id, nuevoEstado)
      toast.success('Estado actualizado correctamente')
      
      // Actualizar localmente
      setPedido(prev => prev ? { ...prev, estado: nuevoEstado as any } : null)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al actualizar estado', { description: error.message })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  // Cargar productos del restaurante
  const fetchProductos = useCallback(async () => {
    if (!token) return
    
    setLoadingProductos(true)
    try {
      const response = await productosApi.getAll(token) as {
        success: boolean
        productos: Producto[]
      }
      
      if (response.success && response.productos) {
        // Solo mostrar productos activos
        setProductos(response.productos.filter(p => p.activo))
      }
    } catch (error) {
      console.error('Error fetching productos:', error)
    } finally {
      setLoadingProductos(false)
    }
  }, [token])

  // Cargar productos cuando se abre el sheet
  useEffect(() => {
    if (addProductSheet && productos.length === 0) {
      fetchProductos()
    }
  }, [addProductSheet, fetchProductos, productos.length])

  // Agregar producto al pedido
  const handleAddProducto = async (producto: Producto) => {
    if (!token || !pedido) return
    
    setAddingProducto(producto.id)
    try {
      const cantidad = cantidadProducto[producto.id] || 1
      await pedidosApi.addItem(token, pedido.id, {
        productoId: producto.id,
        cantidad,
        clienteNombre: 'Mozo'
      })
      toast.success('Producto agregado', {
        description: `${cantidad}x ${producto.nombre}`
      })
      // Limpiar cantidad
      setCantidadProducto(prev => ({ ...prev, [producto.id]: 1 }))
      // Refrescar pedido
      await fetchPedido()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al agregar producto', { description: error.message })
      }
    } finally {
      setAddingProducto(null)
    }
  }

  // Eliminar item del pedido
  const handleDeleteItem = async () => {
    if (!token || !pedido || !itemAEliminar) return
    
    setDeletingItem(true)
    try {
      await pedidosApi.deleteItem(token, pedido.id, itemAEliminar.id)
      toast.success('Producto eliminado')
      setItemAEliminar(null)
      // Refrescar pedido
      await fetchPedido()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al eliminar producto', { description: error.message })
      }
    } finally {
      setDeletingItem(false)
    }
  }

  // Confirmar pedido
  const handleConfirmarPedido = async () => {
    if (!token || !pedido) return
    
    setIsUpdating(true)
    try {
      await pedidosApi.confirmar(token, pedido.id)
      toast.success('Pedido confirmado', {
        description: 'El pedido ha sido enviado a cocina'
      })
      await fetchPedido()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al confirmar pedido', { description: error.message })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  // Cerrar pedido
  const handleCerrarPedido = async () => {
    if (!token || !pedido) return
    
    setIsUpdating(true)
    try {
      await pedidosApi.cerrar(token, pedido.id)
      toast.success('Pedido cerrado')
      await fetchPedido()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al cerrar pedido', { description: error.message })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  // Eliminar pedido completo
  const handleDeletePedido = async () => {
    if (!token || !pedido) return
    
    setDeletingPedido(true)
    try {
      await pedidosApi.delete(token, pedido.id)
      toast.success('Pedido eliminado', {
        description: `El pedido #${pedido.id} ha sido eliminado correctamente`
      })
      // Redirigir a la lista de pedidos
      navigate('/dashboard/pedidos')
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al eliminar pedido', { description: error.message })
      }
    } finally {
      setDeletingPedido(false)
      setShowDeletePedidoDialog(false)
    }
  }

  // Filtrar productos por búsqueda
  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(searchProducto.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(searchProducto.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="w-full max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 flex flex-col items-center justify-center min-h-[400px]">
        <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">Pedido no encontrado</p>
        <Button onClick={() => navigate('/dashboard/pedidos')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Pedidos
        </Button>
      </div>
    )
  }

  const estadoBadge = getEstadoBadge(pedido.estado)
  const StatusIcon = estadoBadge.icon
  const isActive = pedido.estado !== 'closed'

  return (
    <div className="w-full max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 space-y-6 animate-in fade-in duration-500 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3  mt-8">
              <h1 className="text-3xl font-bold tracking-tight">Pedido #{pedido.id}</h1>
              <Badge variant={estadoBadge.variant} className="gap-1 text-base px-3 py-1">
                <StatusIcon className="h-4 w-4" />
                {estadoBadge.label}
              </Badge>
            </div>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              {pedido.mesaNombre || 'Sin mesa'}
              {isConnected ? (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Wifi className="h-3 w-3 text-green-500" />
                  En vivo
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-xs">
                  <WifiOff className="h-3 w-3 text-orange-500" />
                  Offline
                </Badge>
              )}
            </p>
          </div>
        </div>
        
        {/* Acciones de estado */}
        <div className="flex gap-2 flex-wrap">
          {/* Botón eliminar pedido */}
          <Button 
            variant="outline" 
            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            onClick={() => setShowDeletePedidoDialog(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </Button>

          {isActive && (
            <>
              {/* Botón agregar producto */}
              <Sheet open={addProductSheet} onOpenChange={setAddProductSheet}>
                <SheetTrigger asChild>
                  <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Producto
                  </Button>
                </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Agregar Producto
                  </SheetTitle>
                  <SheetDescription>
                    Selecciona un producto para agregar al pedido
                  </SheetDescription>
                </SheetHeader>
                
                {/* Buscador */}
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar producto..."
                    value={searchProducto}
                    onChange={(e) => setSearchProducto(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Lista de productos */}
                <ScrollArea className="h-[calc(100vh-200px)] mt-4">
                  {loadingProductos ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : productosFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Package className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {searchProducto ? 'No se encontraron productos' : 'No hay productos disponibles'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-4">
                      {productosFiltrados.map((producto) => (
                        <div 
                          key={producto.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          {producto.imagenUrl ? (
                            <img 
                              src={producto.imagenUrl} 
                              alt={producto.nombre}
                              className="w-14 h-14 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{producto.nombre}</p>
                            <p className="text-lg font-bold text-primary">
                              ${parseFloat(producto.precio).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Control de cantidad */}
                            <div className="flex items-center border rounded-lg">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setCantidadProducto(prev => ({
                                  ...prev,
                                  [producto.id]: Math.max(1, (prev[producto.id] || 1) - 1)
                                }))}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-medium">
                                {cantidadProducto[producto.id] || 1}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setCantidadProducto(prev => ({
                                  ...prev,
                                  [producto.id]: (prev[producto.id] || 1) + 1
                                }))}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleAddProducto(producto)}
                              disabled={addingProducto === producto.id}
                            >
                              {addingProducto === producto.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </SheetContent>
            </Sheet>

            {pedido.estado === 'pending' && (
              <Button 
                onClick={handleConfirmarPedido}
                disabled={isUpdating || pedido.items.length === 0}
              >
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChefHat className="mr-2 h-4 w-4" />}
                Confirmar Pedido
              </Button>
            )}
            {pedido.estado === 'preparing' && (
              <Button 
                onClick={() => handleChangeEstado('delivered')}
                disabled={isUpdating}
              >
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Utensils className="mr-2 h-4 w-4" />}
                Marcar como Entregado
              </Button>
            )}
            {pedido.estado === 'delivered' && (
              <Button 
                variant="secondary"
                onClick={handleCerrarPedido}
                disabled={isUpdating}
              >
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Cerrar Pedido
              </Button>
            )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal - Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items por cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Productos del Pedido
              </CardTitle>
              <CardDescription>
                {pedido.totalItems} producto{pedido.totalItems !== 1 ? 's' : ''} • 
                {Object.keys(pedido.itemsPorCliente).length} cliente{Object.keys(pedido.itemsPorCliente).length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.keys(pedido.itemsPorCliente).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-2">No hay productos en este pedido</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Agrega productos para comenzar
                  </p>
                  {isActive && (
                    <Button onClick={() => setAddProductSheet(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar Producto
                    </Button>
                  )}
                </div>
              ) : Object.entries(pedido.itemsPorCliente).map(([cliente, items], idx) => (
                <div key={cliente}>
                  {idx > 0 && <Separator className="mb-4" />}
                  <div className="mb-3">
                    <Badge variant="secondary" className="gap-1 text-sm">
                      <User className="h-3 w-3" />
                      {cliente}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group"
                      >
                        <div className="flex items-center gap-4">
                          {item.imagenUrl ? (
                            <img 
                              src={item.imagenUrl} 
                              alt={item.nombreProducto} 
                              className="w-14 h-14 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
                              <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{item.nombreProducto}</p>
                            <p className="text-sm text-muted-foreground">
                              ${parseFloat(item.precioUnitario).toFixed(2)} x {item.cantidad}
                            </p>
                            {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                              <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded">
                                <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                                  ⚠️ Sin: {item.ingredientesExcluidosNombres.join(', ')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-lg font-bold">
                            ${(parseFloat(item.precioUnitario) * (item.cantidad || 1)).toFixed(2)}
                          </p>
                          {isActive && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setItemAEliminar(item)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Columna lateral - Resumen */}
        <div className="space-y-6">
          {/* Total */}
          <Card className={pedido.pago?.estado === 'paid' 
            ? "bg-green-500/10 border-green-500/30" 
            : "bg-primary/5 border-primary/20"
          }>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-muted-foreground">Total del Pedido</CardTitle>
                {pedido.pago?.estado === 'paid' && (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Pagado
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className={`text-4xl font-bold ${pedido.pago?.estado === 'paid' ? 'text-green-600' : 'text-primary'}`}>
                ${parseFloat(pedido.total || '0').toFixed(2)}
              </p>
            </CardContent>
          </Card>

          {/* Información del pedido */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Información
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">ID del Pedido</span>
                <span className="font-mono text-sm">#{pedido.id}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Mesa</span>
                <Badge variant="outline">{pedido.mesaNombre || 'Sin asignar'}</Badge>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Estado</span>
                <Badge variant={estadoBadge.variant} className="gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {estadoBadge.label}
                </Badge>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">Creado</span>
                  <div className="text-right">
                    <p className="text-sm">{formatDateFull(pedido.createdAt)}</p>
                    <p className="text-xs text-muted-foreground">{getTimeAgo(pedido.createdAt)}</p>
                  </div>
                </div>
              </div>
              {pedido.closedAt && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Cerrado</span>
                      <div className="text-right">
                        <p className="text-sm">{formatDateFull(pedido.closedAt)}</p>
                        <p className="text-xs text-muted-foreground">
                          Duración: {getDuration(pedido.createdAt, pedido.closedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {!pedido.closedAt && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tiempo activo</span>
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {getDuration(pedido.createdAt)}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Información de Pago */}
          <Card className={pedido.pago?.estado === 'paid' ? 'border-green-500/30 bg-green-500/5' : ''}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Información de Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pedido.pago ? (
                <>
                  {/* Estado del pago */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Estado</span>
                    {(() => {
                      const estadoPago = getEstadoPagoBadge(pedido.pago.estado)
                      const EstadoIcon = estadoPago.icon
                      return (
                        <Badge variant={estadoPago.variant} className="gap-1">
                          <EstadoIcon className="h-3 w-3" />
                          {estadoPago.label}
                        </Badge>
                      )
                    })()}
                  </div>
                  <Separator />
                  
                  {/* Método de pago */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Método</span>
                    {(() => {
                      const metodoPago = getMetodoPagoInfo(pedido.pago.metodo)
                      const MetodoIcon = metodoPago.icon
                      return (
                        <div className="flex items-center gap-2">
                          <MetodoIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{metodoPago.label}</span>
                        </div>
                      )
                    })()}
                  </div>
                  <Separator />
                  
                  {/* Monto pagado */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Monto</span>
                    <span className={`text-lg font-bold ${pedido.pago.estado === 'paid' ? 'text-green-600' : ''}`}>
                      ${parseFloat(pedido.pago.monto || '0').toFixed(2)}
                    </span>
                  </div>
                  
                  {/* ID de MercadoPago si aplica */}
                  {pedido.pago.metodo === 'mercadopago' && pedido.pago.mpPaymentId && (
                    <>
                      <Separator />
                      <div className="flex justify-between items-start">
                        <span className="text-sm text-muted-foreground">ID MercadoPago</span>
                        <span className="font-mono text-xs text-right break-all max-w-[150px]">
                          {pedido.pago.mpPaymentId}
                        </span>
                      </div>
                    </>
                  )}
                  
                  {/* Fecha del pago */}
                  {pedido.pago.createdAt && (
                    <>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Fecha</span>
                        <span className="text-sm">
                          {new Date(pedido.pago.createdAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <AlertCircle className="h-8 w-8 text-orange-500 mb-2" />
                  <p className="text-sm font-medium">Pendiente de pago</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Este pedido aún no ha sido pagado
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumen de clientes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Clientes ({Object.keys(pedido.itemsPorCliente).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.keys(pedido.itemsPorCliente).map((cliente) => {
                  const clienteItems = pedido.itemsPorCliente[cliente]
                  const clienteTotal = clienteItems.reduce(
                    (sum, item) => sum + (parseFloat(item.precioUnitario) * (item.cantidad || 1)), 
                    0
                  )
                  return (
                    <Badge key={cliente} variant="secondary" className="gap-2 py-1.5 px-3">
                      <User className="h-3 w-3" />
                      {cliente}
                      <span className="text-xs text-muted-foreground">
                        ${clienteTotal.toFixed(2)}
                      </span>
                    </Badge>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog de confirmación para eliminar item */}
      <Dialog open={!!itemAEliminar} onOpenChange={(open) => !open && setItemAEliminar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              ¿Eliminar Producto?
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar "{itemAEliminar?.nombreProducto}" del pedido?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setItemAEliminar(null)}
              disabled={deletingItem}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteItem}
              disabled={deletingItem}
            >
              {deletingItem ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación para eliminar pedido completo */}
      <Dialog open={showDeletePedidoDialog} onOpenChange={setShowDeletePedidoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              ¿Eliminar Pedido?
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar el pedido <strong>#{pedido?.id}</strong> de la mesa <strong>{pedido?.mesaNombre || 'Sin asignar'}</strong>?
              <br /><br />
              Esta acción eliminará permanentemente el pedido y todos sus items asociados. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeletePedidoDialog(false)}
              disabled={deletingPedido}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePedido}
              disabled={deletingPedido}
            >
              {deletingPedido ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar Pedido
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Pedido

